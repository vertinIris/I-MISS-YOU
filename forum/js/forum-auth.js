/**
 * 星炬学院主论坛 · 通行证系统（统一账号版）
 * ----------------------------------------------------
 * 复用飞行雪绒主站同一 Supabase 项目（lmlyfyjffaaddysiliht）：
 *   - 注册/登录走 supabase.auth.signUp / signInWithPassword；
 *   - 用户名经本地映射为合成邮箱（stf_xxx@startorch.local），兼容中文名；
 *   - 口令由 Supabase 托管（加盐散列在服务端），前端不再自行散列；
 *   - 会话存于同域 localStorage 键 sb-<ref>-auth，与主站自动互认：
 *     在主站登录后访问论坛，refreshFromCloud() 会读到共享会话并自动识别。
 *
 * 公开 API 与 current 对象形状保持兼容（forum.js 零改动）：
 *   getUser() -> { key:uid, name, color, joined, posts }
 *   register / login / logout / onChange / bumpPostCount / openPanel
 *
 * 降级：若 supabaseClient 未就绪（CDN 失败/离线），register/login 明确报错，
 *      但「匿名身份发帖」路径（forum.js 中 user 为 null 时）仍可用。
 */
window.StarTorchAuth = (function () {
    'use strict';

    var ACCOUNTS_KEY = 'stf_accounts';          // 本地映射：用户名 -> 合成邮箱
    var SESSION_MIRROR_KEY = 'stf_session';     // 本地镜像：离线时仍可用 UI

    // 多管理员：与 db/migration-021 的 forum_admins 表保持一致（前端仅用于 UI 显隐，
    // 真正权限由 Supabase RLS 的 is_forum_admin() 裁定）。增删管理员请改 SQL 表。
    var FORUM_ADMIN_EMAILS = ['2473609011@qq.com', '3604893605@qq.com'];

    var AVATAR_COLORS = ['#FF6B9D', '#6B8AFF', '#B66BFF', '#7FD99E', '#E8C56A', '#A8D8FF', '#FF9E7A'];
    var listeners = [];
    var current = null;

    /* ---------- storage（本地映射 / 镜像，非口令） ---------- */
    function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
    function safeRemove(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

    function readAccounts() {
        try { return JSON.parse(safeGet(ACCOUNTS_KEY)) || {}; } catch (e) { return {}; }
    }
    function writeAccounts(map) { safeSet(ACCOUNTS_KEY, JSON.stringify(map)); }

    function normalizeKey(name) { return String(name || '').trim().toLowerCase(); }
    function randomColor() { return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]; }

    /* ---------- 当前用户视图 ---------- */
    function emit() {
        listeners.forEach(function (fn) {
            try { fn(current); } catch (e) { /* ignore */ }
        });
    }

    function publicView(uid, name, color, joined, posts, email) {
        return { key: uid, name: name, color: color, joined: joined || Date.now(), posts: posts || 0, email: email || null };
    }

    function saveMirror(v) { safeSet(SESSION_MIRROR_KEY, JSON.stringify(v)); }
    function loadMirror() { try { return JSON.parse(safeGet(SESSION_MIRROR_KEY)); } catch (e) { return null; } }
    function clearMirror() { safeRemove(SESSION_MIRROR_KEY); }

    function applyUser(user, profile) {
        var name = (profile && profile.nickname) || (user && user.email ? String(user.email).split('@')[0] : '星炬学院访客');
        var color = (profile && profile.avatar_color) || '#6B8AFF';
        var joined = (profile && profile.created_at) ? Date.parse(profile.created_at) : (current ? current.joined : Date.now());
        var v = publicView(user.id, name, color, joined, current ? current.posts : 0, (user && user.email) ? user.email : null);
        current = v;
        saveMirror(v);
        emit();
        return v;
    }

    function loadSession() {
        var mirror = loadMirror();
        if (mirror && mirror.key) {
            current = publicView(mirror.key, mirror.name, mirror.color, mirror.joined, mirror.posts);
        } else {
            current = null;
        }
        /* 异步用云端共享会话刷新（识别主站登录态）。
           supabaseClient 可能尚未就绪（CDN async），先轮询再刷新。 */
        refreshFromCloudDeferred();
    }

    function refreshFromCloudDeferred() {
        var tries = 0;
        (function tick() {
            if (window.supabaseClient) { refreshFromCloud(); return; }
            if (tries++ > 60) return; /* ~3s 超时则保持本地镜像 */
            setTimeout(tick, 50);
        })();
    }

    function refreshFromCloud() {
        var client = window.supabaseClient;
        if (!client) return;
        if (!client.auth || !client.auth.getSession) return;
        client.auth.getSession().then(function (res) {
            if (res && res.data && res.data.session && res.data.session.user) {
                var user = res.data.session.user;
                client.from('profiles')
                    .select('nickname, avatar_color, created_at')
                    .eq('id', user.id).single()
                    .then(function (p) { applyUser(user, (p && p.data) ? p.data : null); })
                    .catch(function () { applyUser(user, null); });
            }
        }).catch(function () { /* 无会话则保持本地镜像 */ });
    }

    /* ---------- 合成邮箱映射 ---------- */
    function toEmail(name) {
        var a = readAccounts();
        var key = normalizeKey(name);
        if (a[key] && a[key].email) return a[key].email;
        var email = 'stf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '@startorch.example.com';
        a[key] = { email: email, name: name };
        writeAccounts(a);
        return email;
    }

    /* ---------- 核心：注册 / 登录 / 登出 ---------- */
    function register(name, pwd) {
        var trimmed = String(name || '').trim();
        if (trimmed.length < 2 || trimmed.length > 20) {
            return Promise.reject(new Error('用户名需 2–20 个字符'));
        }
        if (String(pwd || '').length < 4) {
            return Promise.reject(new Error('口令至少 4 位'));
        }
        var client = window.supabaseClient;
        if (!client) return Promise.reject(new Error('云端未连接，暂无法注册（可先用匿名身份发帖）'));

        var email = toEmail(trimmed);
        var color = randomColor();
        return client.auth.signUp({
            email: email,
            password: pwd,
            options: { data: { nickname: trimmed, avatar_color: color } }
        }).then(function (res) {
            if (res.error) throw new Error(res.error.message || '注册失败');
            if (res.data && res.data.user && res.data.session) {
                return applyUser(res.data.user, {
                    nickname: trimmed, avatar_color: color, created_at: new Date().toISOString()
                });
            }
            /* 服务启用了邮箱确认时不会返回 session */
            throw new Error('注册成功，但账户待确认；请在 Supabase 关闭「邮箱确认」后再登录');
        });
    }

    function login(name, pwd) {
        var a = readAccounts();
        var key = normalizeKey(name);
        var acc = a[key];
        if (!acc) return Promise.reject(new Error('该用户名未在本论坛注册，请先注册'));
        var client = window.supabaseClient;
        if (!client) return Promise.reject(new Error('云端未连接，无法登录'));

        return client.auth.signInWithPassword({ email: acc.email, password: pwd })
            .then(function (res) {
                if (res.error) throw new Error(res.error.message || '登录失败');
                if (res.data && res.data.user) {
                    return client.from('profiles')
                        .select('nickname, avatar_color, created_at')
                        .eq('id', res.data.user.id).single()
                        .then(function (p) { return applyUser(res.data.user, (p && p.data) ? p.data : null); })
                        .catch(function () { return applyUser(res.data.user, null); });
                }
                throw new Error('登录失败');
            });
    }

    function logout() {
        var client = window.supabaseClient;
        if (client && client.auth && client.auth.signOut) {
            try { client.auth.signOut(); } catch (e) { /* ignore */ }
        }
        clearMirror();
        current = null;
        emit();
    }

    function bumpPostCount() {
        if (!current) return;
        current.posts = (current.posts || 0) + 1;
        saveMirror(current);
        emit();
    }

    function getUser() { return current; }
    function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

    /* 多管理员：当前登录用户邮箱是否在管理员列表中（UI 显隐用，权限由 RLS 裁定） */
    function isForumAdmin() {
        return !!(current && current.email && FORUM_ADMIN_EMAILS.indexOf(current.email) !== -1);
    }

    /* ---------- UI（以下逻辑保持不变） ---------- */
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
                if (root_close_on_escape(e, modal)) closePanel();
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

    function root_close_on_escape(e, modal) {
        return e.key === 'Escape' && !modal.hidden;
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
        isForumAdmin: isForumAdmin,
        bumpPostCount: bumpPostCount,
        openPanel: openPanel
    };
})();
