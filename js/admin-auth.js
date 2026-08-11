/**
 * 飞行雪绒 — 管理员口令认证模块
 * v7.6: 轻量管理员系统，基于口令哈希 + sessionStorage
 *
 * 使用方式:
 *   1. 双击页脚 → 弹出输入框 → 输入口令
 *   2. 控制台: __FXRE.admin('口令')  登录
 *   3. 控制台: __FXRE.admin('logout') 退出
 *
 * 安全设计:
 *   - 口令只存 SHA-256 哈希，明文不出现在代码中
 *   - sessionStorage 会话令牌（关闭浏览器即失效）
 *   - 失败 3 次冷却 30 秒
 */

(function() {
    'use strict';

    /* ================================================================
     * 配置 — 修改口令后，用 SHA-256 生成新哈希替换下方
     * 默认口令: flyingedelweiss2026
     * ================================================================ */
    var ADMIN_HASH = '70a05acb9fe708c9b2ae2013f5dcaadf2e8e18428a714a6a029b093b7509d143';

    /* 运行时状态 */
    var adminToken  = null;       /* sessionStorage key */
    var failCount   = 0;
    var cooldownUntil = 0;
    var MAX_FAILS   = 3;
    var COOLDOWN_MS = 30000;     /* 30 秒冷却 */

    /* ================================================================
     * 统一通知 helper：优先 AppToast（Notyf），降级原生 alert
     * 守卫: typeof window.AppToast !== 'undefined'（库未加载时不报错）
     * ================================================================ */
    function notify(level, msg) {
        if (typeof window.AppToast !== 'undefined' && window.AppToast[level]) {
            try { window.AppToast[level](msg); return; } catch(_) { /* 降级 */ }
        }
        try { alert(msg); } catch(_) { /* ignore */ }
    }

    /* ================================================================
     * 核心: SHA-256 哈希（纯 JS，零依赖）
     * ================================================================ */
    function sha256(message) {
        function utf8Encode(str) {
            var result = [];
            for (var i = 0; i < str.length; i++) {
                var c = str.charCodeAt(i);
                if (c < 0x80) {
                    result.push(c);
                } else if (c < 0x800) {
                    result.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
                } else if (c < 0xd800 || c >= 0xe000) {
                    result.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
                } else {
                    /* surrogate pair */
                    i++;
                    var cc = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                    result.push(0xf0 | (cc >> 18), 0x80 | ((cc >> 12) & 0x3f),
                                0x80 | ((cc >> 6) & 0x3f), 0x80 | (cc & 0x3f));
                }
            }
            return result;
        }

        /* 常量 */
        var K = [
            0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
            0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
            0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
            0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
            0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
            0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
            0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
            0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
        ];

        var msgBytes = utf8Encode(message);
        var msgBitLen = msgBytes.length * 8;

        /* padding */
        msgBytes.push(0x80);
        while ((msgBytes.length % 64) !== 56) msgBytes.push(0x00);

        /* 64-bit big-endian length */
        var hi = Math.floor(msgBitLen / 0x100000000);
        var lo = msgBitLen >>> 0;
        msgBytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
        msgBytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

        /* 初始哈希值 */
        var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];

        /* 处理每个 512-bit 块 */
        for (var i = 0; i < msgBytes.length; i += 64) {
            var W = new Array(64);
            for (var t = 0; t < 16; t++) {
                W[t] = (msgBytes[i + t*4] << 24) | (msgBytes[i + t*4 + 1] << 16) |
                       (msgBytes[i + t*4 + 2] << 8) | msgBytes[i + t*4 + 3];
            }
            for (t = 16; t < 64; t++) {
                var s0 = (rightRotate(W[t-15], 7) ^ rightRotate(W[t-15], 18) ^ (W[t-15] >>> 3));
                var s1 = (rightRotate(W[t-2], 17) ^ rightRotate(W[t-2], 19) ^ (W[t-2] >>> 10));
                W[t] = (W[t-16] + s0 + W[t-7] + s1) | 0;
            }

            var a = H[0], b = H[1], c = H[2], d = H[3];
            var e = H[4], f = H[5], g = H[6], h = H[7];

            for (t = 0; t < 64; t++) {
                var S1 = (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25));
                var ch = (e & f) ^ ((~e) & g);
                var temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
                var S0 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22));
                var maj = (a & b) ^ (a & c) ^ (b & c);
                var temp2 = (S0 + maj) | 0;

                h = g; g = f; f = e; e = (d + temp1) | 0;
                d = c; c = b; b = a; a = (temp1 + temp2) | 0;
            }

            H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0;
            H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
            H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0;
            H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
        }

        function rightRotate(v, n) { return (v >>> n) | (v << (32 - n)); }

        return H.map(function(x) {
            return ('0000000' + (x >>> 0).toString(16)).slice(-8);
        }).join('');
    }

    /* ================================================================
     * 认证逻辑
     * ================================================================ */

    /**
     * 尝试验证口令
     * @param {string} passphrase
     * @returns {{ success: bool, reason: string }}
     */
    function verify(passphrase) {
        if (!passphrase || typeof passphrase !== 'string') {
            return { success: false, reason: '请输入口令' };
        }
        if (passphrase.length < 6) {
            return { success: false, reason: '口令至少6位' };
        }

        /* 冷却检查 */
        if (cooldownUntil > Date.now()) {
            var remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
            return { success: false, reason: '请 ' + remaining + ' 秒后再试' };
        }

        var hash = sha256(passphrase);
        if (hash === ADMIN_HASH) {
            /* 成功 */
            failCount = 0;
            cooldownUntil = 0;
            var token = 'fxre_admin_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
            try { sessionStorage.setItem('fxre_admin_token', token); } catch(_) {}
            adminToken = token;
            console.log('[AdminAuth] 管理员登录成功');
            return { success: true, reason: '' };
        }

        /* 失败 */
        failCount++;
        if (failCount >= MAX_FAILS) {
            cooldownUntil = Date.now() + COOLDOWN_MS;
            failCount = 0;
            return { success: false, reason: '错误次数过多，请30秒后再试' };
        }
        return { success: false, reason: '口令错误 (' + (MAX_FAILS - failCount) + ' 次机会)' };
    }

    /**
     * 检查当前是否为管理员
     * @returns {boolean}
     */
    function isAdmin() {
        /* 优先用内存缓存 */
        if (adminToken) return true;
        /* 回退 sessionStorage */
        try {
            var stored = sessionStorage.getItem('fxre_admin_token');
            if (stored) { adminToken = stored; return true; }
        } catch(_) {}
        return false;
    }

    /**
     * 退出管理员
     */
    function logout() {
        adminToken = null;
        try { sessionStorage.removeItem('fxre_admin_token'); } catch(_) {}
        console.log('[AdminAuth] 已退出管理员模式');
    }

    /**
     * 检查是否可删除某条评论
     * @param {Object} comment — 评论对象，需含 authorId
     * @returns {boolean}
     */
    var SELF_DELETE_MS = 10 * 60 * 1000; /* 10 分钟自删窗口 */

    function canDelete(comment) {
        if (!comment) return false;
        if (isAdmin()) return true;
        if (window.SupabaseAdapter && comment.authorId) {
            var user = window.SupabaseAdapter.getCurrentUser();
            if (user && user.id === comment.authorId) {
                if (comment.time) {
                    var age = Date.now() - (typeof comment.time === 'number' ? comment.time : new Date(comment.time).getTime());
                    if (age > SELF_DELETE_MS) return false;
                }
                return true;
            }
        }
        return false;
    }

    /* ================================================================
     * UI: 登录弹窗
     * ================================================================ */

    function showLoginPrompt(callback) {
        /* 冷却中不弹 */
        if (cooldownUntil > Date.now()) {
            var remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
            notify('error', '口令验证已锁定，请 ' + remaining + ' 秒后再试');
            if (callback) callback(false);
            return;
        }

        /* R15: 移除 emoji 功能图标，改用纯文本提示（符合 P0-1 图标规范） */
        var pass = prompt('请输入管理员口令：');
        if (pass === null) {
            if (callback) callback(false);
            return;
        }
        var result = verify(pass);
        if (result.success) {
            notify('success', '管理员模式已开启 · 可删除任意评论（关闭浏览器自动退出）');
            if (callback) callback(true);
        } else {
            notify('error', '验证失败：' + result.reason);
            if (callback) callback(false);
        }
    }

    /* ================================================================
     * 暴露接口
     * ================================================================ */
    window.AdminAuth = {
        login:    showLoginPrompt,
        openLoginModal: openLoginModal,
        logout:   logout,
        isAdmin:  isAdmin,
        canDelete: canDelete,
        verify:   verify
    };

    /* ================================================================
     * UI: 页内登录 Modal（替代原生 prompt，移动端友好）
     * ================================================================ */
    function openLoginModal(onSuccess) {
        if (cooldownUntil > Date.now()) {
            var remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
            notify('error', '口令验证已锁定，请 ' + remaining + ' 秒后再试');
            if (onSuccess) onSuccess(false);
            return;
        }
        var overlay  = document.getElementById('admin-login-modal');
        var input    = document.getElementById('admin-modal-input');
        var errEl    = document.getElementById('admin-modal-error');
        var submitBtn= document.getElementById('admin-modal-submit');
        var cancelBtn= document.getElementById('admin-modal-cancel');
        if (!overlay || !input) {
            /* 降级到原生 prompt */
            showLoginPrompt(onSuccess);
            return;
        }
        function close() {
            overlay.hidden = true;
            input.value = '';
            if (errEl) errEl.hidden = true;
            document.removeEventListener('keydown', onKey, true);
        }
        function onKey(e) { if (e.key === 'Escape') close(); }
        function submit() {
            var result = verify(input.value);
            if (result.success) {
                close();
                if (onSuccess) onSuccess(true);
            } else {
                if (errEl) { errEl.textContent = result.reason; errEl.hidden = false; }
                input.focus();
            }
        }
        overlay.hidden = false;
        if (errEl) errEl.hidden = true;
        input.value = '';
        setTimeout(function() { try { input.focus(); } catch(_) {} }, 50);
        submitBtn.onclick = submit;
        cancelBtn.onclick = close;
        overlay.onclick = function(e) { if (e.target === overlay) close(); };
        document.addEventListener('keydown', onKey, true);
        input.onkeydown = function(e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
    }

    /* 也挂到全局调试接口下 */
    if (!window.__FXRE) window.__FXRE = {};
    window.__FXRE.admin = function(cmd) {
        if (!cmd || cmd === 'status') {
            return { isAdmin: isAdmin(), cooldown: cooldownUntil > Date.now() };
        }
        if (cmd === 'logout') { logout(); return '已退出'; }
        if (cmd === 'login') { showLoginPrompt(); return '请在弹出的对话框中输入口令'; }
        /* 尝试作为口令直接登录 */
        var result = verify(cmd);
        return result.success ? '登录成功' : result.reason;
    };

    console.log('[AdminAuth] 管理员模块已加载');
    console.log('[AdminAuth] 提示: 在控制台输入 __FXRE.admin("口令") 登录, __FXRE.admin("logout") 退出');

})();
