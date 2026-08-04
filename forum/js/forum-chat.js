/**
 * forum-chat.js — 星炬学院实时公共聊天室（v2 · 真实感增强）
 *
 * 实时来源（按优先级合并）：
 *   1. 云端 Supabase Realtime（forum_chat 表存在时）—— 跨设备·跨用户真正即时
 *   2. 同浏览器 BroadcastChannel —— 多标签页即时（即使云端表未创建也能演示"活"的聊天）
 *   3. 轮询兜底（Realtime 不可用时每 8s 拉一次历史）
 *
 * 真实感细节：
 *   - 正在输入指示（同浏览器多标签页）
 *   - 在线人数 / 本地会话标识
 *   - 自己消息的「发送中 / 已送达」双态
 *   - 连接状态系统提示（接入频道 / 本地模式 / 聊天表待创建）
 *   - 去重、平滑动画、自动滚动到底
 *
 * 依赖：forum-auth.js (StarTorchAuth.getUser)、forum-cloud.js (StarTorchCloud)
 */
(function () {
    'use strict';

    var MAX_LEN = 200;
    var HISTORY_LIMIT = 80;
    var VISIBLE_LIMIT = 40;
    var POLL_MS = 8000;
    var TYPING_TIMEOUT = 3000;
    var PRESENCE_WINDOW = 5 * 60 * 1000; // 5 分钟内算"在线"
    var visibleCount = VISIBLE_LIMIT;

    var els = {};
    var messages = [];
    var pollTimer = null;
    var realtimeOk = false;
    var chatTableMissing = false;
    var lastSentAt = 0;
    var sentIds = {};                 // 去重：已渲染过的消息 id（含系统去重 key）
    var pendingByTemp = {};            // tempId -> { content, name, user_id, time } 乐观消息待合并
    var participants = {};             // stableKey -> { t, name }（按用户/终端 id，不按显示名）
    var typingPeers = {};              // name -> 时间戳（正在输入指示）
    var bc = null;                     // BroadcastChannel 实例
    var PENDING_MATCH_MS = 120000;     // 乐观消息与服务端回显的匹配窗口
    var tabId = null;

    function $(id) { return document.getElementById(id); }

    function escapeHTML(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function sanitizeColor(c) {
        if (!c) return '#6B8AFF';
        var s = String(c).trim();
        if (/^#[0-9A-Fa-f]{3,8}$/.test(s)) return s;
        if (/^var\(--[\w-]+\)$/.test(s)) return s;
        if (/^rgb(a?)\([\d\s,.%/]+\)$/.test(s)) return s;
        if (/^hsl(a?)\([\d\s,.%/]+\)$/.test(s)) return s;
        return '#6B8AFF';
    }
    function fmtTime(ts) {
        var d = new Date(ts);
        return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    }
    function currentUser() {
        return (typeof StarTorchAuth !== 'undefined' && StarTorchAuth.getUser) ? StarTorchAuth.getUser() : null;
    }
    function cloud() {
        return window.StarTorchCloud || null;
    }
    function cloudChatReady() {
        var c = cloud();
        return !!(c && c.isChatAvailable && c.isChatAvailable());
    }

    /* ---------- 状态点 + 文案 ---------- */
    function setStatus(state, text) {
        if (!els.dot || !els.status) return;
        els.dot.className = 'stf-chat-dot ' + state;
        els.status.textContent = text || ({
            ok: '实时连接中',
            offline: '本地模式',
            syncing: '连接中…',
            nomissing: '聊天表待创建'
        })[state] || '';
    }

    function getTabId() {
        if (tabId) return tabId;
        try {
            tabId = sessionStorage.getItem('stf_chat_tab') || '';
            if (!tabId) {
                tabId = 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
                sessionStorage.setItem('stf_chat_tab', tabId);
            }
        } catch (e) {
            tabId = 't_' + Date.now().toString(36);
        }
        return tabId;
    }

    function participantKey(optUserId) {
        if (optUserId) return 'u:' + String(optUserId);
        var user = currentUser();
        if (user && user.key) return 'u:' + String(user.key);
        return 'tab:' + getTabId();
    }

    function touchParticipant(key, nameHint) {
        /* 仅接受稳定 key（u: / tab:），禁止用显示名开槽，避免改名刷人数 */
        if (!key) return;
        var k = String(key);
        if (k.indexOf('u:') !== 0 && k.indexOf('tab:') !== 0) return;
        participants[k] = {
            t: Date.now(),
            name: nameHint || (participants[k] && participants[k].name) || ''
        };
    }

    function touchFromMessage(m) {
        if (!m) return;
        if (m.user_id) {
            touchParticipant('u:' + String(m.user_id), m.name);
            return;
        }
        if (m.isSelf) touchParticipant(participantKey(), m.name);
    }

    function refreshPresence() {
        if (!els.online) return;
        var now = Date.now();
        var selfKey = participantKey();
        touchParticipant(selfKey, getSenderName());
        var count = 0;
        Object.keys(participants).forEach(function (k) {
            var row = participants[k];
            var ts = row && typeof row === 'object' ? row.t : row;
            if (now - (ts || 0) < PRESENCE_WINDOW) count++;
        });
        if (count < 1) count = 1;
        if (cloudChatReady()) {
            els.online.textContent = count + ' 人在线 · 星域公共频道';
        } else if (chatTableMissing) {
            els.online.textContent = '本地会话 · 聊天表待创建';
        } else {
            els.online.textContent = '本地会话 · ' + count + ' 终端';
        }
    }

    function getSenderName() {
        var user = currentUser();
        if (user && user.name) {
            var n = String(user.name).trim();
            /* 与 StarTorchAuth 对齐：占位默认名不当作真实署名 */
            var placeholder = (window.StarTorchAuth && StarTorchAuth.isPlaceholderName)
                ? StarTorchAuth.isPlaceholderName(n)
                : (n === '匿名信号源' || n === '星炬学院访客');
            if (n && !placeholder) return n;
            if (user.displayEmail) return String(user.displayEmail).split('@')[0];
            if (user.email && String(user.email).indexOf('@startorch.example.com') === -1) {
                return String(user.email).split('@')[0];
            }
        }
        var saved = '';
        try { saved = localStorage.getItem('stf_chat_nick') || ''; } catch (e) {}
        return saved || '匿名信号源';
    }
    function currentUserKey() {
        var user = currentUser();
        return user && user.key ? user.key : null;
    }
    function isMinePayload(r) {
        if (!r) return false;
        var key = currentUserKey();
        if (key && r.user_id && String(r.user_id) === String(key)) return true;
        return false;
    }
    function getSenderColor() {
        var user = currentUser();
        if (user && user.color) return sanitizeColor(user.color);
        return '#6B8AFF';
    }

    function scrollToBottom() {
        if (!els.list) return;
        els.list.scrollTop = els.list.scrollHeight;
    }

    /* 正在输入指示（同浏览器多标签页） */
    function renderTyping() {
        if (!els.typing) return;
        var names = Object.keys(typingPeers).filter(function (n) {
            return Date.now() - (typingPeers[n] || 0) < TYPING_TIMEOUT;
        });
        if (!names.length) { els.typing.hidden = true; els.typing.innerHTML = ''; return; }
        var label = names.length === 1 ? (names[0] + ' 正在输入') : (names.length + ' 人正在输入');
        els.typing.hidden = false;
        els.typing.innerHTML = '<span class="stf-chat-typing-dots"><i></i><i></i><i></i></span><span>' + escapeHTML(label) + '</span>';
    }
    function markPeerTyping(name) {
        if (!name) return;
        typingPeers[name] = Date.now();
        renderTyping();
        clearTimeout(typingPeers._t);
        typingPeers._t = setTimeout(renderTyping, TYPING_TIMEOUT + 200);
    }

    /* ---------- 渲染 ---------- */
    function visibleSlice() {
        if (messages.length <= visibleCount) return messages;
        return messages.slice(messages.length - visibleCount);
    }

    function renderMessages() {
        if (!els.list) return;
        var slice = visibleSlice();
        var hidden = messages.length - slice.length;
        var html = '';
        if (hidden > 0) {
            html += '<button type="button" class="stf-chat-load-more" id="stf-chat-load-more">'
                + '加载更早的 ' + Math.min(VISIBLE_LIMIT, hidden) + ' 条（还有 ' + hidden + ' 条）'
                + '</button>';
        }
        html += slice.map(function (m) {
            if (m.system) {
                return '<div class="stf-chat-system" role="status">' + escapeHTML(m.text) + '</div>';
            }
            var isSelf = m.isSelf;
            var color = sanitizeColor(m.color);
            var statusMark = '';
            if (isSelf) {
                if (m.status === 'sending') statusMark = '<span class="stf-chat-tick sending" aria-label="发送中">⟳</span>';
                else if (m.status === 'delivered') statusMark = '<span class="stf-chat-tick delivered" aria-label="已送达">✓</span>';
                else if (m.status === 'local') statusMark = '<span class="stf-chat-tick local" aria-label="仅本地">•</span>';
            }
            return '<div class="stf-chat-message' + (isSelf ? ' is-self' : '') + '" data-id="' + escapeHTML(m.id) + '" data-copy="' + escapeHTML(m.content) + '" title="点击复制全文">'
                + '<span class="stf-chat-avatar" aria-hidden="true" style="background:' + color + '">' + escapeHTML(String(m.name).charAt(0)) + '</span>'
                + '<div class="stf-chat-bubble">'
                + '<div class="stf-chat-meta">'
                + '<span class="stf-chat-name" style="color:' + color + '">' + escapeHTML(m.name) + '</span>'
                + '<span class="stf-chat-time">' + escapeHTML(fmtTime(m.time)) + '</span>'
                + statusMark
                + '</div>'
                + '<p class="stf-chat-text">' + escapeHTML(m.content) + '</p>'
                + '</div>'
                + '</div>';
        }).join('');
        if (!slice.length) {
            html = '<div class="stf-chat-empty" role="status">'
                + '<span>📡</span><p>暂无信号，发送第一条消息，开启这个频率吧。</p>'
                + '</div>';
        }
        els.list.innerHTML = html;
        var loadBtn = document.getElementById('stf-chat-load-more');
        if (loadBtn) {
            loadBtn.addEventListener('click', function () {
                visibleCount = Math.min(messages.length, visibleCount + VISIBLE_LIMIT);
                renderMessages();
            });
        }
        scrollToBottom();
        refreshPresence();
    }

    function copyChatText(text) {
        if (!text) return;
        function ok() {
            if (window.StarTorchForum && window.StarTorchForum.toast) {
                window.StarTorchForum.toast('已复制消息全文');
            }
        }
        function fail() {
            if (window.StarTorchForum && window.StarTorchForum.toast) {
                window.StarTorchForum.toast('复制失败，请手动选择文字');
            }
        }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(ok).catch(function () {
                    fallbackCopyText(text, ok, fail);
                });
                return;
            }
        } catch (e) { /* fallback */ }
        fallbackCopyText(text, ok, fail);
    }

    function fallbackCopyText(text, ok, fail) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try {
            var done = document.execCommand('copy');
            if (done) ok(); else fail();
        } catch (e) { fail(); }
        document.body.removeChild(ta);
    }

    function addMessage(m, silent) {
        if (!m || !m.id) return;
        if (sentIds[m.id]) return;
        sentIds[m.id] = true;
        messages.push(m);
        if (messages.length > HISTORY_LIMIT) messages = messages.slice(messages.length - HISTORY_LIMIT);
        touchFromMessage(m);
        renderMessages();
        if (!silent && window.StarTorchForum && window.StarTorchForum.toast) {
            window.StarTorchForum.toast(m.name + '：' + m.content.slice(0, 30) + (m.content.length > 30 ? '…' : ''));
        }
    }

    /** 按稳定 key 去重系统提示（同 session 只出现一次） */
    function addSystem(text, dedupeKey) {
        var sysId = dedupeKey ? ('sys_' + dedupeKey) : ('sys_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
        if (sentIds[sysId]) return;
        sentIds[sysId] = true;
        messages.push({ id: sysId, system: true, text: text });
        if (messages.length > HISTORY_LIMIT + 5) messages = messages.slice(messages.length - (HISTORY_LIMIT + 5));
        renderMessages();
    }

    /** 在 pending 乐观消息中匹配服务端回显 */
    function findPendingTempId(r) {
        if (!r) return null;
        var keys = Object.keys(pendingByTemp);
        var best = null;
        var bestDelta = Infinity;
        for (var i = 0; i < keys.length; i++) {
            var tid = keys[i];
            var p = pendingByTemp[tid];
            if (!p) continue;
            if (p.content !== r.content || p.name !== r.name) continue;
            if (p.user_id && r.user_id && String(p.user_id) !== String(r.user_id)) continue;
            var delta = Math.abs((r.time || 0) - (p.time || 0));
            if (delta <= PENDING_MATCH_MS && delta < bestDelta) {
                bestDelta = delta;
                best = tid;
            }
        }
        return best;
    }

    /**
     * 将服务端消息合并进已有乐观气泡（tempId → serverId），避免左右各一条。
     * @returns {boolean} 已处理（合并或已存在）则为 true，调用方勿再 append
     */
    function mergeOrMarkServerMessage(r, forceSelf) {
        if (!r || !r.id) return true;
        if (sentIds[r.id]) return true;

        var tempId = findPendingTempId(r);
        var mine = forceSelf || isMinePayload(r) || !!tempId;

        if (tempId) {
            for (var i = 0; i < messages.length; i++) {
                if (messages[i].id === tempId) {
                    delete sentIds[tempId];
                    messages[i].id = r.id;
                    messages[i].time = r.time || messages[i].time;
                    messages[i].user_id = r.user_id;
                    messages[i].isSelf = true;
                    messages[i].status = 'delivered';
                    if (r.color) messages[i].color = r.color;
                    sentIds[r.id] = true;
                    delete pendingByTemp[tempId];
                    renderMessages();
                    return true;
                }
            }
            /* 乐观条目已被裁剪掉：只登记 server id，避免再插一条 */
            delete pendingByTemp[tempId];
            sentIds[r.id] = true;
            return true;
        }

        if (mine && !tempId) {
            /* 无匹配乐观条目但仍是自己：按自己消息插入（例如多标签页） */
            addMessage({
                id: r.id, name: r.name, color: r.color, content: r.content,
                time: r.time || Date.now(), user_id: r.user_id,
                isSelf: true, status: 'delivered'
            }, true);
            return true;
        }

        return false;
    }

    /* ---------- 历史 / 云端 ---------- */
    function loadHistory(opts) {
        opts = opts || {};
        var c = cloud();
        if (!c || !c.pullChat) { setStatus('offline', '本地模式'); return; }
        if (!opts.silent) setStatus('syncing', '连接中…');
        c.pullChat(HISTORY_LIMIT, function (rows, err) {
            if (err && err.code === 'PGRST205') {
                chatTableMissing = true;
                setStatus('nomissing', '聊天表待创建');
                addSystem('聊天表尚未在云端创建，当前为本地会话 · 消息仅本机可见', 'chat_table_missing');
                return;
            }
            if (rows && rows.length) {
                rows.forEach(function (r) {
                    if (sentIds[r.id]) return;
                    if (mergeOrMarkServerMessage(r, false)) return;
                    sentIds[r.id] = true;
                    messages.push({
                        id: r.id, name: r.name, color: r.color, content: r.content,
                        time: r.time, user_id: r.user_id,
                        isSelf: isMinePayload(r)
                    });
                    touchFromMessage({
                        user_id: r.user_id,
                        name: r.name,
                        isSelf: isMinePayload(r)
                    });
                });
                renderMessages();
            }
            if (cloudChatReady()) {
                setStatus('ok', '实时连接中');
                addSystem('已接入星域公共频道 · 全球即时同步', 'channel_joined');
            } else if (!opts.silent) {
                setStatus('offline', '本地模式');
            }
        });
    }

    /* ---------- 发送 ---------- */
    function sendMessage(text) {
        text = String(text || '').trim();
        if (!text) return;

        if (typeof SecurityShield !== 'undefined' && SecurityShield.sanitizeText) {
            text = SecurityShield.sanitizeText(text, MAX_LEN);
        }
        if (text.length > MAX_LEN) {
            if (window.StarTorchForum && window.StarTorchForum.toast) window.StarTorchForum.toast('消息太长啦，请控制在 ' + MAX_LEN + ' 字以内');
            return;
        }
        if (typeof SecurityShield !== 'undefined' && SecurityShield.detectThreat) {
            var threat = SecurityShield.detectThreat(text);
            if (threat) {
                if (window.StarTorchForum && window.StarTorchForum.toast) window.StarTorchForum.toast('⚠️ ' + threat + '，已拦截');
                if (typeof SecurityShield.logViolation === 'function') SecurityShield.logViolation('chat_threat', text.slice(0, 80));
                return;
            }
        }
        if (typeof ClientRateLimiter !== 'undefined' && ClientRateLimiter.canSendComment && !ClientRateLimiter.canSendComment(text)) {
            if (window.StarTorchForum && window.StarTorchForum.toast) window.StarTorchForum.toast('发送太频繁啦，休息一会儿再聊吧');
            return;
        }
        var now = Date.now();
        if (now - lastSentAt < 1000) {
            if (window.StarTorchForum && window.StarTorchForum.toast) window.StarTorchForum.toast('慢一点，让信号飞一会儿～');
            return;
        }
        lastSentAt = now;

        var user = currentUser();
        var name = getSenderName();
        var color = getSenderColor();
        var userKey = user ? user.key : null;
        var tempId = 'local_' + now + '_' + Math.random().toString(36).slice(2, 7);
        var msg = {
            id: tempId, name: name, color: color, content: text,
            time: now, user_id: userKey, isSelf: true,
            status: cloudChatReady() ? 'sending' : 'local'
        };

        pendingByTemp[tempId] = {
            content: text, name: name, user_id: userKey, time: now
        };

        // 乐观渲染（自己立即看到）
        addMessage(msg, true);

        // 同浏览器多标签页即时
        if (bc) {
            try {
                bc.postMessage({
                    t: 'msg',
                    msg: {
                        id: tempId, name: name, color: color, content: text,
                        time: now, user_id: userKey, isSelf: false
                    }
                });
            } catch (e) {}
        }

        // 上云
        var c = cloud();
        if (!cloudChatReady()) {
            if (chatTableMissing) setStatus('nomissing', '聊天表待创建');
            else setStatus('offline', '本地模式 · 消息未同步');
            if (window.StarTorchForum && window.StarTorchForum.toast) window.StarTorchForum.toast('当前为本地模式，消息仅本机可见');
            delete pendingByTemp[tempId];
        } else {
            c.pushChat({
                name: name, user_id: userKey, color: color, content: text
            }, function (ok, err, row) {
                if (ok && row && row.id) {
                    mergeOrMarkServerMessage(row, true);
                } else if (ok) {
                    msg.status = 'delivered';
                    renderMessages();
                } else {
                    msg.status = 'local';
                    delete pendingByTemp[tempId];
                    if (err && err.code === 'PGRST205') {
                        chatTableMissing = true;
                        setStatus('nomissing', '聊天表待创建');
                        addSystem('云端聊天表尚未创建，已切换为本地会话', 'chat_table_missing');
                    }
                    renderMessages();
                }
            });
        }

        if (els.input) els.input.value = '';
        if (els.counter) els.counter.textContent = '0/' + MAX_LEN;
        if (!user) { try { localStorage.setItem('stf_chat_nick', name); } catch (e) {} }
        if (typeof ClientRateLimiter !== 'undefined' && ClientRateLimiter.recordCommentSent) {
            ClientRateLimiter.recordCommentSent(text);
        }
    }

    /* ---------- Realtime 回调 ---------- */
    function onRealtimeMessage(r) {
        realtimeOk = true;
        if (!r || !r.id) return;
        if (sentIds[r.id]) return;
        if (mergeOrMarkServerMessage(r, false)) {
            setStatus('ok', '实时连接中');
            refreshPresence();
            return;
        }
        addMessage({
            id: r.id, name: r.name, color: r.color, content: r.content,
            time: r.time || Date.now(), user_id: r.user_id,
            isSelf: isMinePayload(r)
        }, document.hidden);
        setStatus('ok', '实时连接中');
        refreshPresence();
    }

    function onBroadcastMessage(e) {
        var data = e.data;
        if (!data || !data.t) return;
        if (data.t === 'msg' && data.msg) {
            var m = data.msg;
            if (sentIds[m.id]) return;
            /* 本端发出的 BC 带 local_ id；若同内容已有自己的乐观消息则跳过 */
            if (m.id && String(m.id).indexOf('local_') === 0 && findPendingTempId(m)) return;
            addMessage({
                id: m.id, name: m.name, color: m.color, content: m.content,
                time: m.time || Date.now(), user_id: m.user_id,
                isSelf: isMinePayload(m)
            }, document.hidden);
        } else if (data.t === 'typing' && data.name) {
            if (data.name !== getSenderName()) markPeerTyping(data.name);
        } else if (data.t === 'hello' && (data.key || data.name)) {
            if (data.key) touchParticipant(data.key, data.name);
            refreshPresence();
        }
    }

    function startPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(function () {
            if (realtimeOk || chatTableMissing) return;
            loadHistory({ silent: true });
        }, POLL_MS);
    }

    function broadcastTyping() {
        if (bc) { try { bc.postMessage({ t: 'typing', name: getSenderName() }); } catch (e) {} }
    }

    function bindEvents() {
        if (els.form) {
            els.form.addEventListener('submit', function (e) {
                e.preventDefault();
                sendMessage(els.input ? els.input.value : '');
            });
        }
        if (els.input) {
            els.input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(els.input.value);
                } else if (e.key === 'Enter' && e.shiftKey) {
                    // 允许换行（textarea 行为，input 下忽略）
                }
            });
            els.input.addEventListener('input', function () {
                if (els.counter) els.counter.textContent = (els.input.value.length) + '/' + MAX_LEN;
                broadcastTyping();
            });
        }
        if (els.expand) {
            els.expand.addEventListener('click', function () { toggleChatExpand(); });
        }
        if (els.list) {
            els.list.addEventListener('click', function (e) {
                var msg = e.target.closest('.stf-chat-message');
                if (!msg || !els.list.contains(msg)) return;
                var text = msg.getAttribute('data-copy') || '';
                if (text) copyChatText(text);
            });
        }
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && els.card && els.card.classList.contains('is-chat-expanded')) {
                setChatExpanded(false);
            }
        });
    }

    function ensureBackdrop() {
        var bd = document.getElementById('stf-chat-backdrop');
        if (bd) return bd;
        bd = document.createElement('div');
        bd.id = 'stf-chat-backdrop';
        bd.className = 'stf-chat-backdrop';
        bd.hidden = true;
        bd.addEventListener('click', function () { setChatExpanded(false); });
        document.body.appendChild(bd);
        return bd;
    }

    function setChatExpanded(on) {
        if (!els.card) return;
        var bd = ensureBackdrop();
        if (on) {
            if (!els.card._stfHomeParent) {
                els.card._stfHomeParent = els.card.parentNode;
                els.card._stfHomeNext = els.card.nextSibling;
            }
            /* 挂到 body，脱离侧栏/父级 filter·containment，避免放大后文字发糊 */
            document.body.appendChild(els.card);
            els.card.classList.add('is-chat-expanded');
        } else {
            els.card.classList.remove('is-chat-expanded');
            els.card.style.removeProperty('transform');
            if (els.card._stfHomeParent) {
                if (els.card._stfHomeNext && els.card._stfHomeNext.parentNode === els.card._stfHomeParent) {
                    els.card._stfHomeParent.insertBefore(els.card, els.card._stfHomeNext);
                } else {
                    els.card._stfHomeParent.appendChild(els.card);
                }
            }
        }
        document.body.classList.toggle('stf-chat-expanded-open', !!on);
        bd.hidden = !on;
        if (els.expand) {
            els.expand.setAttribute('aria-expanded', on ? 'true' : 'false');
            els.expand.textContent = on ? '收起' : '放大';
            els.expand.title = on ? '收起回侧栏' : '放大聊天面板';
        }
        var panel = $('stf-chat-panel');
        var entry = $('stf-chat-entry');
        if (on && panel) {
            panel.hidden = false;
            if (entry) entry.setAttribute('aria-expanded', 'true');
        }
        requestAnimationFrame(scrollToBottom);
    }

    function toggleChatExpand() {
        if (!els.card) return;
        setChatExpanded(!els.card.classList.contains('is-chat-expanded'));
    }

    function setupBroadcast() {
        if (typeof BroadcastChannel === 'undefined') return;
        try {
            bc = new BroadcastChannel('stf-chat-room');
            bc.onmessage = onBroadcastMessage;
            // 宣告在线，让其他标签页知道有同伴
            try { bc.postMessage({ t: 'hello', key: participantKey(), name: getSenderName() }); } catch (e) {}
        } catch (e) { bc = null; }
    }

    function init() {
        els.list = $('stf-chat-messages');
        els.form = $('stf-chat-form');
        els.input = $('stf-chat-input');
        els.dot = $('stf-chat-dot');
        els.status = $('stf-chat-status');
        els.online = $('stf-chat-online');
        els.typing = $('stf-chat-typing');
        els.counter = $('stf-chat-counter');
        els.card = $('stf-chat-card');
        els.expand = $('stf-chat-expand');
        if (!els.list) return;

        bindEvents();
        setupBroadcast();
        touchParticipant(participantKey(), getSenderName());

        /* 登录态变化时刷新在线署名提示（不改历史消息）；改名不新增人数 */
        if (window.StarTorchAuth && window.StarTorchAuth.onChange) {
            window.StarTorchAuth.onChange(function () {
                touchParticipant(participantKey(), getSenderName());
                refreshPresence();
            });
        }

        var c = cloud();
        if (c && c.onChatRealtime) {
            c.onChatRealtime(onRealtimeMessage);
            loadHistory();
            startPolling();
        } else {
            var wait = 0;
            var timer = setInterval(function () {
                wait += 300;
                var cc = cloud();
                if (cc && cc.onChatRealtime) {
                    clearInterval(timer);
                    cc.onChatRealtime(onRealtimeMessage);
                    loadHistory();
                    startPolling();
                } else if (wait > 10000) {
                    clearInterval(timer);
                    setStatus('offline', '本地模式');
                    renderMessages();
                }
            }, 300);
        }
        refreshPresence();
    }

    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);
})();
