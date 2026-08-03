/**
 * 星炬学院主论坛 · 本地通行证系统
 * 完全独立于飞行雪绒站 AuthManager，存储前缀 stf_*
 *
 * 设计取舍：
 *   同人站无后端，账号仅落在本机 localStorage，用于「稳定的发帖身份」而非安全鉴权。
 *   口令仍做加盐散列（Web Crypto SHA-256，降级 FNV-1a），避免明文落盘。
 */
window.StarTorchAuth = (function () {
    'use strict';

    var ACCOUNTS_KEY = 'stf_accounts';
    var SESSION_KEY = 'stf_session';

    var AVATAR_COLORS = ['#FF6B9D', '#6B8AFF', '#B66BFF', '#7FD99E', '#E8C56A', '#A8D8FF', '#FF9E7A'];
    var listeners = [];
    var current = null;

    /* ---------- storage ---------- */
    function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
    function safeRemove(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

    function readAccounts() {
        try { return JSON.parse(safeGet(ACCOUNTS_KEY)) || {}; } catch (e) { return {}; }
    }
    function writeAccounts(map) { safeSet(ACCOUNTS_KEY, JSON.stringify(map)); }

    /* ---------- hashing ---------- */
    function fallbackHash(text) {
        var h1 = 0x811c9dc5, h2 = 0x01000193, i;
        for (i = 0; i < text.length; i++) {
            h1 ^= text.charCodeAt(i);
            h1 = (h1 * 16777619) >>> 0;
            h2 = ((h2 << 5) + h2 + text.charCodeAt(i)) >>> 0;
        }
        return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
    }

    function hashPassword(pwd, salt) {
        var text = salt + '::' + pwd + '::startorch';
        if (window.crypto && window.crypto.subtle && window.TextEncoder) {
            try {
                return window.crypto.subtle
                    .digest('SHA-256', new TextEncoder().encode(text))
                    .then(function (buf) {
                        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
                            return ('00' + b.toString(16)).slice(-2);
                        }).join('');
                    })
                    .catch(function () { return fallbackHash(text); });
            } catch (e) { /* fall through */ }
        }
        return Promise.resolve(fallbackHash(text));
    }

    function randomSalt() {
        if (window.crypto && window.crypto.getRandomValues) {
            var arr = new Uint8Array(8);
            window.crypto.getRandomValues(arr);
            return Array.prototype.map.call(arr, function (b) {
                return ('00' + b.toString(16)).slice(-2);
            }).join('');
        }
        return String(Date.now()) + Math.random().toString(16).slice(2, 10);
    }

    /* ---------- core ---------- */
    function normalizeKey(name) { return String(name || '').trim().toLowerCase(); }

    function emit() {
        listeners.forEach(function (fn) {
            try { fn(current); } catch (e) { /* ignore */ } });
    }

    function loadSession() {
        var key = safeGet(SESSION_KEY);
        if (!key) { current = null; return; }
        var accounts = readAccounts();
        current = accounts[key] ? publicView(accounts[key]) : null;
        if (!current) safeRemove(SESSION_KEY);
    }

    function publicView(acc) {
        return { key: acc.key, name: acc.name, color: acc.color, joined: acc.joined, posts: acc.posts || 0 };
    }

    function register(name, pwd) {
        var trimmed = String(name || '').trim();
        if (trimmed.length < 2 || trimmed.length > 20) {
            return Promise.reject(new Error('用户名需 2–20 个字符'));
        }
        if (String(pwd || '').length < 4) {
            return Promise.reject(new Error('口令至少 4 位'));
        }
        var accounts = readAccounts();
        var key = normalizeKey(trimmed);
        if (accounts[key]) return Promise.reject(new Error('该用户名已被占用'));

        var salt = randomSalt();
        return hashPassword(pwd, salt).then(function (hash) {
            accounts[key] = {
                key: key,
                name: trimmed,
                salt: salt,
                hash: hash,
                color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
                joined: Date.now(),
                posts: 0
            };
            writeAccounts(accounts);
            safeSet(SESSION_KEY, key);
            current = publicView(accounts[key]);
            emit();
            return current;
        });
    }

    function login(name, pwd) {
        var accounts = readAccounts();
        var key = normalizeKey(name);
        var acc = accounts[key];
        if (!acc) return Promise.reject(new Error('账号不存在，请先注册'));
        return hashPassword(pwd, acc.salt).then(function (hash) {
            if (hash !== acc.hash) throw new Error('口令不正确');
            safeSet(SESSION_KEY, key);
            current = publicView(acc);
            emit();
            return current;
        });
    }

    function logout() {
        safeRemove(SESSION_KEY);
        current = null;
        emit();
    }

    function bumpPostCount() {
        if (!current) return;
        var accounts = readAccounts();
        var acc = accounts[current.key];
        if (!acc) return;
        acc.posts = (acc.posts || 0) + 1;
        writeAccounts(accounts);
        current.posts = acc.posts;
        emit();
    }

    function getUser() { return current; }
    function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

    /* ---------- UI ---------- */
    function $(id) { return document.getElementById(id); }

    function initials(name) {
        var n = String(name || '').trim();
        if (!n) return '?';
        return /[\u4e00-\u9fa5]/.test(n.charAt(0)) ? n.charAt(0) : n.charAt(0).toUpperCase();
    }

    function formatDate(ts) {
        var d = new Date(ts || Date.now());
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function renderEntry() {
        var avatar = $('stf-account-avatar');
        var label = $('stf-account-name');
        var btn = $('stf-account-btn');
        if (!avatar || !label || !btn) return;

        if (current) {
            avatar.textContent = initials(current.name);
            avatar.style.background = current.color;
            avatar.classList.add('is-signed');
            label.textContent = current.name;
            btn.classList.add('is-signed');
            btn.setAttribute('aria-label', '账号：' + current.name);
        } else {
            avatar.textContent = '＋';
            avatar.style.background = '';
            avatar.classList.remove('is-signed');
            label.textContent = '登录';
            btn.classList.remove('is-signed');
            btn.setAttribute('aria-label', '登录或注册星炬学院通行证');
        }
    }

    function renderPanel() {
        var guest = $('stf-account-guest');
        var user = $('stf-account-user');
        if (!guest || !user) return;

        if (current) {
            guest.hidden = true;
            user.hidden = false;
            var av = $('stf-account-card-avatar');
            if (av) { av.textContent = initials(current.name); av.style.background = current.color; }
            var nm = $('stf-account-card-name');
            if (nm) nm.textContent = current.name;
            var meta = $('stf-account-card-meta');
            if (meta) meta.textContent = '加入于 ' + formatDate(current.joined) + ' · 已发布 ' + (current.posts || 0) + ' 篇';
        } else {
            guest.hidden = false;
            user.hidden = true;
        }
    }

    function setError(id, msg) {
        var el = $(id);
        if (!el) return;
        el.textContent = msg || '';
        el.hidden = !msg;
    }

    function openPanel() {
        var modal = $('stf-account-modal');
        if (!modal) return;
        renderPanel();
        modal.hidden = false;
        requestAnimationFrame(function () { modal.classList.add('open'); });
        var btn = $('stf-account-btn');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        var focusTarget = current ? $('stf-logout-btn') : $('stf-login-name');
        if (focusTarget) setTimeout(function () { focusTarget.focus(); }, 120);
    }

    function closePanel() {
        var modal = $('stf-account-modal');
        if (!modal) return;
        modal.classList.remove('open');
        setTimeout(function () { modal.hidden = true; }, 280);
        var btn = $('stf-account-btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        setError('stf-login-error', '');
        setError('stf-register-error', '');
    }

    function switchTab(tab) {
        document.querySelectorAll('.stf-auth-tab').forEach(function (b) {
            var on = b.getAttribute('data-auth-tab') === tab;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        var loginForm = $('stf-login-form');
        var regForm = $('stf-register-form');
        if (loginForm) loginForm.hidden = tab !== 'login';
        if (regForm) regForm.hidden = tab !== 'register';
        setError('stf-login-error', '');
        setError('stf-register-error', '');
    }

    function toast(msg) {
        if (window.StarTorchForum && window.StarTorchForum.toast) window.StarTorchForum.toast(msg);
    }

    function bindUI() {
        var btn = $('stf-account-btn');
        if (btn) btn.addEventListener('click', openPanel);

        var modal = $('stf-account-modal');
        if (modal) {
            modal.querySelectorAll('[data-account-close]').forEach(function (el) {
                el.addEventListener('click', closePanel);
            });
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && !modal.hidden) closePanel();
            });
        }

        document.querySelectorAll('.stf-auth-tab').forEach(function (b) {
            b.addEventListener('click', function () { switchTab(b.getAttribute('data-auth-tab')); });
        });

        var loginForm = $('stf-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', function (e) {
                e.preventDefault();
                setError('stf-login-error', '');
                login($('stf-login-name').value, $('stf-login-pwd').value)
                    .then(function (u) {
                        loginForm.reset();
                        closePanel();
                        toast('欢迎回来，' + u.name + ' ✦');
                    })
                    .catch(function (err) { setError('stf-login-error', err.message || '登录失败'); });
            });
        }

        var regForm = $('stf-register-form');
        if (regForm) {
            regForm.addEventListener('submit', function (e) {
                e.preventDefault();
                setError('stf-register-error', '');
                var pwd = $('stf-register-pwd').value;
                var confirmPwd = $('stf-register-pwd2').value;
                if (pwd !== confirmPwd) { setError('stf-register-error', '两次输入的口令不一致'); return; }
                register($('stf-register-name').value, pwd)
                    .then(function (u) {
                        regForm.reset();
                        closePanel();
                        toast('通行证已签发，欢迎加入星炬学院，' + u.name + ' ✦');
                    })
                    .catch(function (err) { setError('stf-register-error', err.message || '注册失败'); });
            });
        }

        var logoutBtn = $('stf-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                logout();
                closePanel();
                toast('已退出登录，你仍可用匿名身份发帖');
            });
        }

        onChange(function () { renderEntry(); renderPanel(); });
    }

    function init() {
        loadSession();
        bindUI();
        renderEntry();
        emit();
    }

    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);

    return {
        getUser: getUser,
        register: register,
        login: login,
        logout: logout,
        onChange: onChange,
        bumpPostCount: bumpPostCount,
        openPanel: openPanel
    };
})();
