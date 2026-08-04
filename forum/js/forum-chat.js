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
    var HISTORY_LIMIT = 50;
    var POLL_MS = 8000;
    var TYPING_TIMEOUT = 3000;
    var PRESENCE_WINDOW = 5 * 60 * 1000; // 5 分钟内算"在线"

    var els = {};
    var messages = [];
    var pollTimer = null;
    var realtimeOk = false;
    var chatTableMissing = false;
    var lastSentAt = 0;
    var sentIds = {};                 // 去重：防止自己发的消息被重复渲染
    var participants = {};             // name -> 最近活跃时间戳（在线人数统计）
    var typingPeers = {};              // name -> 时间戳（正在输入指示）
    var bc = null;                     // BroadcastChannel 实例

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

    function touchParticipant(name) {
        if (name) participants[name] = Date.now();
    }

    function refreshPresence() {
        if (!els.online) return;
        var now = Date.now();
        var count = 1; // 至少是自己
        Object.keys(participants).forEach(function (n) {
            if (now - (participants[n] || 0) < PRESENCE_WINDOW) count++;
        });
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
        if (user && user.name) return user.name;
        var saved = '';
        try { saved = localStorage.getItem('stf_chat_nick') || ''; } catch (e) {}
        return saved || '匿名信号';
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
    function renderMessages() {
        if (!els.list) return;
        var html = messages.map(function (m) {
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
            return '<div class="stf-chat-message' + (isSelf ? ' is-self' : '') + '" data-id="' + escapeHTML(m.id) + '">'
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
        if (!html) {
            html = '<div class="stf-chat-empty" role="status">'
                + '<span>📡</span><p>暂无信号，发送第一条消息，开启这个频率吧。</p>'
                + '</div>';
        }
        els.list.innerHTML = html;
        scrollToBottom();
        refreshPresence();
    }

    function addMessage(m, silent) {
        if (!m || !m.id) return;
        if (sentIds[m.id]) return;
        sentIds[m.id] = true;
        messages.push(m);
        if (messages.length > HISTORY_LIMIT) messages = messages.slice(messages.length - HISTORY_LIMIT);
        touchParticipant(m.name);
        renderMessages();
        if (!silent && window.StarTorchForum && window.StarTorchForum.toast) {
            window.StarTorchForum.toast(m.name + '：' + m.content.slice(0, 30) + (m.content.length > 30 ? '…' : ''));
        }
    }

    function addSystem(text) {
        var sysId = 'sys_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        messages.push({ id: sysId, system: true, text: text });
        if (messages.length > HISTORY_LIMIT + 5) messages = messages.slice(messages.length - (HISTORY_LIMIT + 5));
        renderMessages();
    }

    /* ---------- 历史 / 云端 ---------- */
    function loadHistory() {
        var c = cloud();
        if (!c || !c.pullChat) { setStatus('offline', '本地模式'); return; }
        setStatus('syncing', '连接中…');
        c.pullChat(HISTORY_LIMIT, function (rows, err) {
            if (err && err.code === 'PGRST205') {
                chatTableMissing = true;
                setStatus('nomissing', '聊天表待创建');
                addSystem('聊天表尚未在云端创建，当前为本地会话 · 消息仅本机可见');
                return;
            }
            if (rows && rows.length) {
                rows.forEach(function (r) {
                    if (!sentIds[r.id]) {
                        sentIds[r.id] = true;
                        messages.push({
                            id: r.id, name: r.name, color: r.color, content: r.content,
                            time: r.time, isSelf: false
                        });
                        touchParticipant(r.name);
                    }
                });
                renderMessages();
            }
            if (cloudChatReady()) {
                setStatus('ok', '实时连接中');
                addSystem('已接入星域公共频道 · 全球即时同步');
            } else {
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
        var tempId = 'local_' + now + '_' + Math.random().toString(36).slice(2, 7);
        var msg = {
            id: tempId, name: name, color: color, content: text,
            time: now, isSelf: true, status: cloudChatReady() ? 'sending' : 'local'
        };

        // 乐观渲染（自己立即看到）
        addMessage(msg, true);
        sentIds[tempId] = true;

        // 同浏览器多标签页即时
        if (bc) {
            try { bc.postMessage({ t: 'msg', msg: { id: tempId, name: name, color: color, content: text, time: now, isSelf: false } }); } catch (e) {}
        }

        // 上云
        var c = cloud();
        if (!cloudChatReady()) {
            if (chatTableMissing) setStatus('nomissing', '聊天表待创建');
            else setStatus('offline', '本地模式 · 消息未同步');
            if (window.StarTorchForum && window.StarTorchForum.toast) window.StarTorchForum.toast('当前为本地模式，消息仅本机可见');
        } else {
            c.pushChat({
                name: name, user_id: user ? user.key : null, color: color, content: text
            }, function (ok, err) {
                msg.status = ok ? 'delivered' : 'local';
                if (err && err.code === 'PGRST205') {
                    chatTableMissing = true;
                    setStatus('nomissing', '聊天表待创建');
                    addSystem('云端聊天表尚未创建，已切换为本地会话');
                }
                renderMessages();
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
        if (sentIds[r.id]) return;
        var user = currentUser();
        addMessage({
            id: r.id, name: r.name, color: r.color, content: r.content,
            time: r.time || Date.now(), isSelf: false
        }, document.hidden);
        setStatus('ok', '实时连接中');
        refreshPresence();
    }

    function onBroadcastMessage(e) {
        var data = e.data;
        if (!data || !data.t) return;
        if (data.t === 'msg' && data.msg) {
            addMessage(data.msg, document.hidden);
        } else if (data.t === 'typing' && data.name) {
            if (data.name !== getSenderName()) markPeerTyping(data.name);
        } else if (data.t === 'hello' && data.name) {
            touchParticipant(data.name);
            refreshPresence();
        }
    }

    function startPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(function () {
            if (realtimeOk || chatTableMissing) return;
            loadHistory();
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
    }

    function setupBroadcast() {
        if (typeof BroadcastChannel === 'undefined') return;
        try {
            bc = new BroadcastChannel('stf-chat-room');
            bc.onmessage = onBroadcastMessage;
            // 宣告在线，让其他标签页知道有同伴
            try { bc.postMessage({ t: 'hello', name: getSenderName() }); } catch (e) {}
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
        if (!els.list) return;

        bindEvents();
        setupBroadcast();
        touchParticipant(getSenderName());

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
