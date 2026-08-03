/**
 * forum-chat.js — 星炬学院实时公共聊天室
 *
 * - 依赖：forum-auth.js (StarTorchAuth.getUser), forum-cloud.js (StarTorchCloud)
 * - 未登录用户可用临时昵称发送，登录用户自动带身份色
 * - 消息长度限制 200 字符，历史保留 50 条
 * - 通过 Supabase Realtime 接收新消息，轮询兜底
 */
(function () {
    'use strict';

    var MAX_LEN = 200;
    var HISTORY_LIMIT = 50;
    var POLL_MS = 8000;

    var els = {};
    var messages = [];
    var pollTimer = null;
    var realtimeOk = false;
    var lastSentAt = 0;
    var sentIds = {}; // 去重：防止自己发送的消息被 Realtime 重复渲染

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

    function setStatus(state, text) {
        if (!els.dot || !els.status) return;
        els.dot.className = 'stf-chat-dot ' + state;
        els.status.textContent = text || {
            ok: '实时连接中',
            offline: '本地模式',
            syncing: '连接中…'
        }[state] || '';
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

    function renderMessages() {
        if (!els.list) return;
        var html = messages.map(function (m) {
            var isSelf = m.isSelf;
            var color = sanitizeColor(m.color);
            return '<div class="stf-chat-message' + (isSelf ? ' is-self' : '') + '" data-id="' + escapeHTML(m.id) + '">'
                + '<span class="stf-chat-avatar" aria-hidden="true" style="background:' + color + '">' + escapeHTML(String(m.name).charAt(0)) + '</span>'
                + '<div class="stf-chat-bubble">'
                + '<div class="stf-chat-meta">'
                + '<span class="stf-chat-name" style="color:' + color + '">' + escapeHTML(m.name) + '</span>'
                + '<span class="stf-chat-time">' + escapeHTML(fmtTime(m.time)) + '</span>'
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
    }

    function addMessage(m, silent) {
        if (!m || !m.id || sentIds[m.id]) return;
        sentIds[m.id] = true;
        messages.push(m);
        if (messages.length > HISTORY_LIMIT) messages = messages.slice(messages.length - HISTORY_LIMIT);
        renderMessages();
        if (!silent && window.StarTorchForum && window.StarTorchForum.toast) {
            window.StarTorchForum.toast(m.name + '：' + m.content.slice(0, 30) + (m.content.length > 30 ? '…' : ''));
        }
    }

    function loadHistory() {
        var c = cloud();
        if (!c || !c.pullChat) return setStatus('offline', '本地模式');
        setStatus('syncing');
        c.pullChat(HISTORY_LIMIT, function (rows) {
            if (rows && rows.length) {
                rows.forEach(function (r) {
                    if (!sentIds[r.id]) {
                        sentIds[r.id] = true;
                        messages.push({
                            id: r.id,
                            name: r.name,
                            color: r.color,
                            content: r.content,
                            time: r.time,
                            isSelf: !!(currentUser() && currentUser().key && r.user_id && r.user_id === currentUser().key)
                        });
                    }
                });
                renderMessages();
            }
            setStatus('ok', '实时连接中');
        });
    }

    function sendMessage(text) {
        text = String(text || '').trim();
        if (!text) return;

        /* 安全清洗 */
        if (typeof SecurityShield !== 'undefined' && SecurityShield.sanitizeText) {
            text = SecurityShield.sanitizeText(text, MAX_LEN);
        }
        if (text.length > MAX_LEN) {
            if (window.StarTorchForum && window.StarTorchForum.toast) window.StarTorchForum.toast('消息太长啦，请控制在 ' + MAX_LEN + ' 字以内');
            return;
        }

        /* 威胁检测 */
        if (typeof SecurityShield !== 'undefined' && SecurityShield.detectThreat) {
            var threat = SecurityShield.detectThreat(text);
            if (threat) {
                if (window.StarTorchForum && window.StarTorchForum.toast) window.StarTorchForum.toast('⚠️ ' + threat + '，已拦截');
                if (typeof SecurityShield.logViolation === 'function') SecurityShield.logViolation('chat_threat', text.slice(0, 80));
                return;
            }
        }

        /* 客户端限流 */
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
        var tempId = 'local_' + now;

        // 乐观渲染
        addMessage({
            id: tempId,
            name: name,
            color: color,
            content: text,
            time: now,
            isSelf: true
        }, true);
        sentIds[tempId] = true;

        var c = cloud();
        if (!c || !c.pushChat) {
            setStatus('offline', '本地模式 · 消息未同步');
            if (window.StarTorchForum && window.StarTorchForum.toast) window.StarTorchForum.toast('当前处于本地模式，消息仅在本地可见');
            return;
        }

        c.pushChat({
            name: name,
            user_id: user ? user.key : null,
            color: color,
            content: text
        }, function (ok) {
            if (!ok) {
                setStatus('offline', '发送失败 · 本地保留');
                if (window.StarTorchForum && window.StarTorchForum.toast) window.StarTorchForum.toast('发送失败，消息已保留在本地');
            }
        });

        if (els.input) els.input.value = '';
        if (!user) {
            try { localStorage.setItem('stf_chat_nick', name); } catch (e) {}
        }

        if (typeof ClientRateLimiter !== 'undefined' && ClientRateLimiter.recordCommentSent) {
            ClientRateLimiter.recordCommentSent(text);
        }
    }

    function onRealtimeMessage(r) {
        realtimeOk = true;
        if (sentIds[r.id]) return; // 自己发的已通过乐观更新显示
        var user = currentUser();
        addMessage({
            id: r.id,
            name: r.name,
            color: r.color,
            content: r.content,
            time: r.time || Date.now(),
            isSelf: !!(user && user.key && r.user_id && r.user_id === user.key)
        }, document.hidden); // 后台时静默
        setStatus('ok', '实时连接中');
    }

    function startPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(function () {
            if (realtimeOk) return; // Realtime 正常时不轮询
            loadHistory();
        }, POLL_MS);
    }

    function bindEvents() {
        if (!els.form) return;
        els.form.addEventListener('submit', function (e) {
            e.preventDefault();
            sendMessage(els.input ? els.input.value : '');
        });
        if (els.input) {
            els.input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(els.input.value);
                }
            });
        }
    }

    function init() {
        els.list = $('stf-chat-messages');
        els.form = $('stf-chat-form');
        els.input = $('stf-chat-input');
        els.dot = $('stf-chat-dot');
        els.status = $('stf-chat-status');
        els.online = $('stf-chat-online');
        if (!els.list) return;

        bindEvents();

        var c = cloud();
        if (c && c.onChatRealtime) {
            c.onChatRealtime(onRealtimeMessage);
            loadHistory();
            startPolling();
        } else {
            // 等待云端适配器异步就绪（最多 10 秒）
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

        if (els.online) els.online.textContent = '星域公共频道';
    }

    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);
})();
