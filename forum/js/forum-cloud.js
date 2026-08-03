/**
 * 星炬学院主论坛 · 云端适配器（window.StarTorchCloud）
 * ----------------------------------------------------
 * 实现 forum-sync.js 约定的云端接缝接口：
 *      pull(cb)             -> 拉取云端 forum_submissions / forum_comments，合并进本地缓存
 *      pushSubmission(sub)  -> 新帖 upsert 到云端
 *      updateSubmission(sub) -> 点赞/收藏等增量更新（不动 created_at，保持时间线稳定）
 *      pushComment(subId,c) -> 评论插入云端
 *      getPending()         -> 待上报的本地写入数（离线队列长度）
 *      getMode()            -> 'cloud' | 'local'
 *
 * 设计原则：
 *   - 本地 stf_submissions 仍是 forum.js 的工作副本，云端是「叠加同步层」：
 *     拉取时把云端行映射成本地形状并合并（保留个人 liked / bookmarks），
 *     推送时把本地改动写回云端。forum.js 的数据访问几乎不变。
 *   - 透明匿名登录：发帖/评论前若无会话，自动 signInAnonymously 取得稳定 uid，
 *     使「匿名身份发帖」无需强制弹登录框（Supabase 匿名登录属 authenticated 角色，
 *     RLS 放行）。主站登录的共享会话会被自动识别。
 *   - 离线降级：无客户端 / 网络失败时，pull 走本地、push 进队列，getPending 反映积压。
 */
(function () {
    'use strict';

    var QUEUE_KEY = 'stf_cloud_queue';
    var client = null;
    var connected = false;
    var initialized = false;
    var sessionPromise = null;
    var refreshTimer = null;

    /* ---------- 工具 ---------- */
    function pad(n) { return String(n).padStart(2, '0'); }
    function fmtTimeStr(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
            ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

    function readLocalSubmissions() {
        try {
            var raw = safeGet('stf_submissions');
            var arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }
    function writeLocalSubmissions(list) { safeSet('stf_submissions', JSON.stringify(list)); }

    function queueOp(op, payload) {
        try {
            var q = JSON.parse(safeGet(QUEUE_KEY) || '[]');
            if (!Array.isArray(q)) q = [];
            q.push({ op: op, payload: payload, at: Date.now() });
            safeSet(QUEUE_KEY, JSON.stringify(q));
        } catch (e) { /* 配额不足则丢弃，下次联网重试由云端为准 */ }
    }
    function getPending() {
        try {
            var q = JSON.parse(safeGet(QUEUE_KEY) || '[]');
            return Array.isArray(q) ? q.length : 0;
        } catch (e) { return 0; }
    }
    async function drainQueue() {
        var q;
        try { q = JSON.parse(safeGet(QUEUE_KEY) || '[]'); } catch (e) { q = []; }
        if (!Array.isArray(q) || !q.length) return;
        var kept = [];
        for (var i = 0; i < q.length; i++) {
            var item = q[i];
            var ok = false;
            try {
                if (item.op === 'submission') ok = await attemptSubmission(item.payload);
                else if (item.op === 'update') ok = await attemptUpdate(item.payload);
                else if (item.op === 'comment') ok = await attemptComment(item.payload.subId, item.payload.comment);
                else if (item.op === 'hideComment') ok = await attemptHideComment(item.payload.subId, item.payload.name, item.payload.text);
                else ok = true; /* 未知类型直接丢弃，避免死循环 */
            } catch (e) { ok = false; }
            if (!ok) kept.push(item);
        }
        safeSet(QUEUE_KEY, JSON.stringify(kept));
    }

    /* ---------- 会话（透明匿名登录） ---------- */
    function ensureSession() {
        if (sessionPromise) return sessionPromise;
        sessionPromise = (async function () {
            try {
                var res = await client.auth.getSession();
                if (res && res.data && res.data.session) return res.data.session;
                var anon = await client.auth.signInAnonymously();
                if (anon && anon.data && anon.data.user) {
                    try {
                        await client.from('profiles').upsert({
                            id: anon.data.user.id,
                            nickname: '星炬学院访客',
                            avatar_color: '#6B8AFF'
                        });
                    } catch (e) { /* 忽略：profile 非发帖必需 */ }
                    return anon.data.session;
                }
                return null;
            } catch (e) {
                console.warn('[forum-cloud] ensureSession 失败', e);
                return null;
            }
        })();
        return sessionPromise;
    }

    /* ---------- 行映射 ---------- */
    function cloudRowToLocal(r) {
        return {
            id: r.id,
            name: r.author_name,
            type: r.type,
            title: r.title,
            content: r.content,
            image: r.image || '',
            realm: r.realm || 'startorch',
            tags: Array.isArray(r.tags) ? r.tags : [],
            time: r.created_at ? Date.parse(r.created_at) : Date.now(),
            timeStr: fmtTimeStr(r.created_at),
            likes: r.likes || 0,
            liked: false,
            bookmarks: 0,
            color: r.author_color || '#6B8AFF',
            identity: r.identity || null,
            is_hidden: !!r.is_hidden,
            author: r.author_id || null
        };
    }

    function toCloudRow(sub) {
        return {
            id: sub.id,
            author_id: sub.author || null,
            author_name: sub.name,
            author_color: sub.color || '#6B8AFF',
            type: sub.type,
            title: sub.title,
            content: sub.content,
            image: sub.image || '',
            tags: sub.tags || [],
            identity: sub.identity || null,
            realm: 'startorch',
            likes: sub.likes || 0,
            is_hidden: sub.is_hidden || false,
            created_at: sub.time ? new Date(sub.time).toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    /* ---------- 拉取 + 合并 ---------- */
    function mergeIntoLocal(rows) {
        var local = readLocalSubmissions();
        var localById = {};
        local.forEach(function (s) { if (s && s.id) localById[s.id] = s; });

        var merged = (rows || []).map(function (r) {
            var m = cloudRowToLocal(r);
            var l = localById[r.id];
            if (l) {
                /* 保留个人点赞 / 收藏态与本地时间 */
                m.liked = !!l.liked;
                m.bookmarks = l.bookmarks || 0;
                if (l.time) m.time = l.time;
            }
            return m;
        });

        /* 纳入本地独有（离线创建、尚未上报）的帖子 */
        local.forEach(function (s) {
            if (s && s.id && !merged.some(function (m) { return m.id === s.id; })) merged.push(s);
        });

        merged.sort(function (a, b) { return (b.time || 0) - (a.time || 0); });
        writeLocalSubmissions(merged);
        return merged;
    }

    async function pullComments(ids) {
        if (!ids || !ids.length) return;
        try {
            var res = await client.from('forum_comments').select('*').in('submission_id', ids);
            if (res.error) throw res.error;
            var bySub = {};
            (res.data || []).forEach(function (r) {
                (bySub[r.submission_id] = bySub[r.submission_id] || []).push({
                    name: r.author_name,
                    text: r.content,
                    color: r.author_color || '#A8D8FF',
                    timeStr: fmtTimeStr(r.created_at),
                    is_hidden: !!r.is_hidden
                });
            });
            Object.keys(bySub).forEach(function (sid) {
                var localC = (window.StarTorchData && StarTorchData.getComments) ? StarTorchData.getComments(sid) : [];
                var cloudC = bySub[sid];
                var combined = cloudC.slice();
                (localC || []).forEach(function (lc) {
                    if (!combined.some(function (x) { return x.name === lc.name && x.text === lc.text; })) combined.push(lc);
                });
                if (window.StarTorchData && StarTorchData.saveComments) StarTorchData.saveComments(sid, combined);
            });
        } catch (e) {
            console.warn('[forum-cloud] 评论拉取失败（保留本地）', e);
        }
    }

    async function ensureCloudSeed(seeds, cloudIds) {
        if (!seeds || !seeds.length || !cloudIds) return;
        for (var i = 0; i < seeds.length; i++) {
            var s = seeds[i];
            if (!s || !s.id) continue;
            if (cloudIds.indexOf(s.id) !== -1) continue;
            try {
                await ensureSession();
                await client.from('forum_submissions').upsert(toCloudRow(s));
            } catch (e) {
                console.warn('[forum-cloud] 官方种子上云失败', s.id, e);
            }
        }
    }

    async function pull(cb) {
        if (!client) {
            /* 离线：本地兜底，标记未连接 */
            try { if (window.StarTorchData) StarTorchData.ensureSeedData(); } catch (e) { /* ignore */ }
            if (window.StarTorchForum && window.StarTorchForum.refreshCommunity) window.StarTorchForum.refreshCommunity();
            return cb && cb(false);
        }
        try {
            connected = true;
            var res = await client.from('forum_submissions')
                .select('*').eq('realm', 'startorch').order('created_at', { ascending: false });
            if (res.error) throw res.error;

            var cloudIds = (res.data || []).map(function (r) { return r.id; });
            mergeIntoLocal(res.data || []);
            await pullComments(cloudIds);

            var seeds = (window.StarTorchData && StarTorchData.getSeedSubmissions) ? StarTorchData.getSeedSubmissions() : [];
            await ensureCloudSeed(seeds, cloudIds);

            drainQueue();
            if (window.StarTorchForum && window.StarTorchForum.refreshCommunity) window.StarTorchForum.refreshCommunity();
            return cb && cb(true);
        } catch (e) {
            console.warn('[forum-cloud] pull 失败（保留上次本地数据）', e);
            connected = false;
            return cb && cb(false);
        }
    }

    /* ---------- 推送（内部 attempt*: 尝试上云，返回布尔，不自动入队） ---------- */
    async function attemptSubmission(sub) {
        if (!client) return false;
        try {
            await ensureSession();
            var { error } = await client.from('forum_submissions').upsert(toCloudRow(sub));
            if (error) throw error;
            return true;
        } catch (e) { console.warn('[forum-cloud] 发帖上云失败', e); return false; }
    }
    async function attemptUpdate(sub) {
        if (!client) return false;
        try {
            var { error } = await client.from('forum_submissions')
                .update({ likes: sub.likes || 0, is_hidden: !!sub.is_hidden, updated_at: new Date().toISOString() })
                .eq('id', sub.id);
            if (error) throw error;
            return true;
        } catch (e) { console.warn('[forum-cloud] 点赞/收藏上云失败', e); return false; }
    }
    async function attemptComment(subId, comment) {
        if (!client) return false;
        try {
            await ensureSession();
            var row = {
                id: 'stf_c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
                submission_id: subId,
                author_id: null,
                author_name: comment.name,
                author_color: comment.color || '#A8D8FF',
                content: comment.text,
                created_at: new Date().toISOString()
            };
            var { error } = await client.from('forum_comments').insert(row);
            if (error) throw error;
            return true;
        } catch (e) { console.warn('[forum-cloud] 评论上云失败', e); return false; }
    }

    async function attemptHideComment(subId, name, text) {
        if (!client) return false;
        try {
            await ensureSession();
            var { error } = await client.from('forum_comments')
                .update({ is_hidden: true })
                .eq('submission_id', subId)
                .eq('author_name', name)
                .eq('content', text);
            if (error) throw error;
            return true;
        } catch (e) { console.warn('[forum-cloud] 评论隐藏失败', e); return false; }
    }
    async function hideComment(subId, name, text, cb) {
        var ok = await attemptHideComment(subId, name, text);
        if (!ok) queueOp('hideComment', { subId: subId, name: name, text: text });
        return cb && cb(ok);
    }

    /* 公开方法：尝试上云，失败则入离线队列 */
    async function pushSubmission(sub, cb) {
        var ok = await attemptSubmission(sub);
        if (!ok) queueOp('submission', sub);
        return cb && cb(ok);
    }
    async function updateSubmission(sub, cb) {
        var ok = await attemptUpdate(sub);
        if (!ok) queueOp('update', sub);
        return cb && cb(ok);
    }
    async function pushComment(subId, comment, cb) {
        var ok = await attemptComment(subId, comment);
        if (!ok) queueOp('comment', { subId: subId, comment: comment });
        return cb && cb(ok);
    }

    /* 通用 push（文档接口兼容；forum.js 实际调用上面的具名方法） */
    async function push(item, cb) {
        if (!item) return cb && cb(false);
        if (item.submission_id) return pushComment(item.submission_id, item, cb);
        if (item._op === 'update') return updateSubmission(item, cb);
        return pushSubmission(item, cb);
    }

    /* ---------- Realtime ---------- */
    function scheduleRefresh() {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(function () {
            if (window.StarTorchSync && window.StarTorchSync.syncNow) window.StarTorchSync.syncNow();
        }, 800);
    }

    function subscribeRealtime() {
        if (!client || !client.channel) return;
        try {
            client.channel('forum-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_submissions' }, scheduleRefresh)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_comments' }, scheduleRefresh)
                .subscribe();
        } catch (e) {
            console.warn('[forum-cloud] Realtime 订阅失败（不影响轮询兜底）', e);
        }
    }

    /* ---------- 初始化 ---------- */
    function init() {
        if (initialized) return;
        initialized = true;
        window.forumSupabase.ensureForumClient().then(function (c) {
            if (!c) {
                console.warn('[forum-cloud] 无客户端，保持本地模式（window.StarTorchCloud 不挂载）');
                return;
            }
            client = c;
            window.StarTorchCloud = api;
            subscribeRealtime();
            if (window.StarTorchSync && window.StarTorchSync.attachCloud) {
                window.StarTorchSync.attachCloud(api);
            }
        });
    }

    var api = {
        init: init,
        pull: pull,
        push: push,
        pushSubmission: pushSubmission,
        updateSubmission: updateSubmission,
        pushComment: pushComment,
        hideComment: hideComment,
        getPending: getPending,
        getMode: function () { return connected ? 'cloud' : 'local'; },
        isConnected: function () { return connected; }
    };

    /* 自启动 */
    init();
})();
