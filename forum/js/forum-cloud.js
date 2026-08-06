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
    var chatTableMissing = false; /* forum_chat 表尚未在云端创建时为 true */
    var sessionPromise = null;
    var refreshTimer = null;

    /* ---------- 工具 ---------- */
    function pad(n) { return String(n).padStart(2, '0'); }
    function sanitizeColor(c) {
        if (!c) return '#6d8fd6';
        var s = String(c).trim();
        if (/^#[0-9A-Fa-f]{3,8}$/.test(s)) return s;
        if (/^var\(--[\w-]+\)$/.test(s)) return s;
        if (/^rgb(a?)\([\d\s,.%/]+\)$/.test(s)) return s;
        if (/^hsl(a?)\([\d\s,.%/]+\)$/.test(s)) return s;
        return '#6d8fd6';
    }

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
    function isAnonUser(user) {
        if (!user) return true;
        if (user.is_anonymous === true) return true;
        if (user.app_metadata && user.app_metadata.provider === 'anonymous') return true;
        if (!user.email) return true;
        return false;
    }

    function ensureSession() {
        if (sessionPromise) return sessionPromise;
        sessionPromise = (async function () {
            try {
                var res = await client.auth.getSession();
                if (res && res.data && res.data.session) {
                    var sessUser = res.data.session.user;
                    /* 显式退出后若仍残留匿名会话，允许继续用于 RLS，但不强迫通行证登录态 */
                    return res.data.session;
                }

                /* 已有真实通行证镜像时，勿抢先匿名登录覆盖共享会话（竞态窗口） */
                var authUser = (window.StarTorchAuth && window.StarTorchAuth.getUser)
                    ? window.StarTorchAuth.getUser() : null;
                if (authUser && authUser.email && String(authUser.email).indexOf('@startorch.example.com') === -1) {
                    var retry = await client.auth.getSession();
                    if (retry && retry.data && retry.data.session) return retry.data.session;
                    /* 真实邮箱镜像存在时，绝不降级匿名登录，避免顶栏变成「星炬学院访客」 */
                    return null;
                }

                /* 显式退出后仍可静默匿名拿 uid 发帖，但 Auth UI 不会把它当登录（见 applyUser） */
                var anon = await client.auth.signInAnonymously();
                if (anon && anon.data && anon.data.user) {
                    try {
                        /* 仅在尚无 nickname 时写入占位，避免覆盖真实用户资料 */
                        var existing = await client.from('profiles')
                            .select('nickname')
                            .eq('id', anon.data.user.id)
                            .maybeSingle();
                        var nick = existing && existing.data && existing.data.nickname;
                        if (!nick) {
                            await client.from('profiles').upsert({
                                id: anon.data.user.id,
                                nickname: '星炬学院访客',
                                avatar_color: '#6d8fd6'
                            });
                        }
                    } catch (e) { /* 忽略：profile 非发帖必需 */ }
                    return anon.data.session;
                }
                return null;
            } catch (e) {
                console.warn('[forum-cloud] ensureSession 失败', e);
                return null;
            } finally {
                /* 允许下次重新探测（会话可能已由主站登录刷新） */
                setTimeout(function () { sessionPromise = null; }, 0);
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
            color: sanitizeColor(r.author_color),
            identity: r.identity || null,
            is_hidden: !!r.is_hidden,
            is_pinned: !!r.is_pinned,
            author: r.author_id || null
        };
    }

    function toCloudRow(sub) {
        return {
            id: sub.id,
            author_id: sub.author || null,
            author_name: sub.name,
            author_color: sub.color || '#6d8fd6',
            type: sub.type,
            title: sub.title,
            content: sub.content,
            image: sub.image || '',
            tags: sub.tags || [],
            identity: sub.identity || null,
            realm: 'startorch',
            likes: sub.likes || 0,
            is_hidden: sub.is_hidden || false,
            is_pinned: !!sub.is_pinned,
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
                    id: r.id,
                    name: r.author_name,
                    text: r.content,
                    color: r.author_color || '#A8D8FF',
                    timeStr: fmtTimeStr(r.created_at),
                    is_hidden: !!r.is_hidden,
                    parent_id: r.parent_id || null,
                    author: r.author_id || null
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

    /* 讨论区上云白名单：档案向 type:lore 永不 upsert 进 forum_submissions */
    var CLOUD_SEED_TYPE_ALLOW = {
        story: 1, poem: 1, art: 1, text: 1, video: 1
    };

    function isCloudSeedAllowed(seed) {
        if (!seed || !seed.id) return false;
        var t = String(seed.type || '').toLowerCase();
        if (t === 'lore') return false;
        return !!CLOUD_SEED_TYPE_ALLOW[t];
    }

    async function ensureCloudSeed(seeds, cloudIds) {
        if (!seeds || !seeds.length || !cloudIds) return;
        for (var i = 0; i < seeds.length; i++) {
            var s = seeds[i];
            if (!isCloudSeedAllowed(s)) continue;
            if (cloudIds.indexOf(s.id) !== -1) continue;
            try {
                await ensureSession();
                await client.from('forum_submissions').upsert(toCloudRow(s));
            } catch (e) {
                console.warn('[forum-cloud] 官方种子上云失败', s.id, e);
            }
        }
    }

    var lastPullError = null;
    function setPullError(e, stage) {
        lastPullError = {
            stage: stage || 'unknown',
            message: (e && (e.message || e.msg || String(e))) || '未知错误',
            code: e && (e.code || e.statusCode || e.status),
            time: Date.now()
        };
        console.warn('[forum-cloud] pull 阶段失败: ' + stage, e);
    }
    function clearPullError() { lastPullError = null; }

    function isAuthError(e) {
        if (!e) return false;
        var code = e.code || e.statusCode || e.status;
        if (code === 401 || code === '401') return true;
        var msg = String(e.message || e.msg || e);
        return /jwt|invalid token|not authenticated|401/i.test(msg);
    }

    async function clearStaleSession() {
        try {
            await client.auth.signOut({ scope: 'local' });
        } catch (e) { /* ignore */ }
        /* 同时清理旧版 localStorage key */
        try {
            localStorage.removeItem('sb-' + 'lmlyfyjffaaddysiliht' + '-auth-token');
        } catch (e) { /* ignore */ }
    }

    async function pullSubmissionsOnce() {
        var res = await client.from('forum_submissions')
            .select('*').eq('realm', 'startorch').order('created_at', { ascending: false });
        if (res.error) throw res.error;
        return res.data || [];
    }

    async function pull(cb) {
        if (!client) {
            /* 离线：本地兜底，标记未连接 */
            setPullError({ message: 'Supabase 客户端未初始化（SDK 可能加载失败）' }, 'init');
            try { if (window.StarTorchData) StarTorchData.ensureSeedData(); } catch (e) { /* ignore */ }
            if (window.StarTorchForum && window.StarTorchForum.refreshCommunity) window.StarTorchForum.refreshCommunity();
            return cb && cb(false);
        }
        try {
            /* 1. 拉取主表 —— 这是判断「云端可达」的核心 */
            var rows = await pullSubmissionsOnce();

            var cloudIds = rows.map(function (r) { return r.id; });
            mergeIntoLocal(rows);
            connected = true;
            clearPullError();

            /* 2. 评论与种子上云属于「增强同步」，失败不应导致整体降级 */
            try { await pullComments(cloudIds); } catch (e) { setPullError(e, 'comments'); }

            try {
                var seeds = (window.StarTorchData && StarTorchData.getSeedSubmissions) ? StarTorchData.getSeedSubmissions() : [];
                await ensureCloudSeed(seeds, cloudIds);
            } catch (e) { setPullError(e, 'seed'); }

            /* 3. 离线队列同样不应阻塞主流程 */
            drainQueue().catch(function (e) { setPullError(e, 'queue'); });

            if (window.StarTorchForum && window.StarTorchForum.refreshCommunity) window.StarTorchForum.refreshCommunity();
            return cb && cb(true);
        } catch (e) {
            /* 主站过期/无效 session 会导致 401；清掉本地 session 用 anon key 重试一次 */
            if (isAuthError(e)) {
                try {
                    await clearStaleSession();
                    var rows2 = await pullSubmissionsOnce();
                    var cloudIds2 = rows2.map(function (r) { return r.id; });
                    mergeIntoLocal(rows2);
                    connected = true;
                    clearPullError();
                    try { await pullComments(cloudIds2); } catch (ee) { setPullError(ee, 'comments'); }
                    if (window.StarTorchForum && window.StarTorchForum.refreshCommunity) window.StarTorchForum.refreshCommunity();
                    return cb && cb(true);
                } catch (e2) {
                    setPullError(e2, 'submissions');
                    connected = false;
                    return cb && cb(false);
                }
            }
            setPullError(e, 'submissions');
            connected = false;
            return cb && cb(false);
        }
    }

    /* ---------- 推送（内部 attempt*: 尝试上云，返回布尔，不自动入队） ---------- */
    async function attemptSubmission(sub) {
        if (!client) return false;
        /* 档案向 lore 禁止写入 forum_submissions（种子/误入双保险） */
        if (sub && String(sub.type || '').toLowerCase() === 'lore') {
            console.warn('[forum-cloud] 拒绝 upsert type:lore', sub && sub.id);
            return true; /* 视为已处理，避免离线队列反复重试 */
        }
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
                .update({
                    likes: sub.likes || 0,
                    is_hidden: !!sub.is_hidden,
                    is_pinned: !!sub.is_pinned,
                    updated_at: new Date().toISOString()
                })
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
                id: comment.id || ('stf_c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
                submission_id: subId,
                author_id: comment.author || null,
                author_name: comment.name,
                author_color: comment.color || '#A8D8FF',
                content: comment.text,
                parent_id: comment.parent_id || null,
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

    /* ---------- 实时聊天 ---------- */
    var chatListeners = [];
    function chatRowToLocal(r) {
        return {
            id: r.id,
            name: r.name,
            color: sanitizeColor(r.color),
            content: r.content,
            time: new Date(r.created_at).getTime(),
            user_id: r.user_id
        };
    }
    function notifyChatListeners(payload) {
        chatListeners.forEach(function (cb) { try { cb(payload); } catch (e) {} });
    }
    async function pullChat(limit, cb) {
        if (!client) return cb && cb([], { code: 'NO_CLIENT' });
        try {
            await ensureSession();
            var res = await client.from('forum_chat')
                .select('*')
                .eq('realm', 'startorch')
                .eq('is_hidden', false)
                .order('created_at', { ascending: false })
                .limit(limit || 50);
            if (res.error) throw res.error;
            chatTableMissing = false;
            var rows = (res.data || []).map(chatRowToLocal).reverse();
            return cb && cb(rows, null);
        } catch (e) {
            console.warn('[forum-cloud] 拉取聊天失败', e);
            if (e && (e.code === 'PGRST205' || (e.message && /could not find the table/i.test(e.message)))) {
                chatTableMissing = true;
                return cb && cb([], e);
            }
            return cb && cb([], e);
        }
    }
    async function pushChat(msg, cb) {
        if (!client) return cb && cb(false, { code: 'NO_CLIENT' });
        try {
            await ensureSession();
            var row = {
                realm: 'startorch',
                name: msg.name,
                user_id: msg.user_id || null,
                color: sanitizeColor(msg.color),
                content: msg.content
            };
            /* select 回传服务端 id，供客户端 tempId → serverId 合并去重 */
            var res = await client.from('forum_chat').insert(row).select('*');
            if (res.error) throw res.error;
            chatTableMissing = false;
            var inserted = (res.data && res.data[0]) ? chatRowToLocal(res.data[0]) : null;
            return cb && cb(true, null, inserted);
        } catch (e) {
            console.warn('[forum-cloud] 发送聊天失败', e);
            if (e && (e.code === 'PGRST205' || (e.message && /could not find the table/i.test(e.message)))) {
                chatTableMissing = true;
            }
            return cb && cb(false, e, null);
        }
    }
    function onChatRealtime(cb) {
        if (typeof cb === 'function') chatListeners.push(cb);
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
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_chat' }, function (payload) {
                    if (payload.new && !payload.new.is_hidden) notifyChatListeners(chatRowToLocal(payload.new));
                })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'forum_chat' }, function (payload) {
                    if (payload.new && payload.new.is_hidden) scheduleRefresh();
                })
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
        isConnected: function () { return connected; },
        getLastError: function () { return lastPullError; },
        isChatAvailable: function () { return !!client && !chatTableMissing; },
        isChatTableMissing: function () { return chatTableMissing; },
        pullChat: pullChat,
        pushChat: pushChat,
        onChatRealtime: onChatRealtime
    };

    /* 自启动 */
    init();
})();
