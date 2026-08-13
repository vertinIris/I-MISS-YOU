/**
 * 飞行雪绒 · 重置密码页逻辑
 * --------------------------------------------------
 * 由 reset-password.html 内联脚本提取为外部文件，
 * 避免 Cloudflare Pages `_headers` CSP（script-src 'self'，无 unsafe-inline）
 * 拦截内联脚本导致页面完全不可用。
 */
(function () {
    'use strict';

    var msg = document.getElementById('reset-msg');
    var cfg = window.SupabaseAdapter && window.SupabaseAdapter.config;

    function setMsg(text, type) {
        if (!msg) return;
        msg.textContent = text;
        msg.className = 'reset-msg' + (type ? ' ' + type : '');
    }

    if (!cfg || !cfg.url || cfg.url.indexOf('__SUPABASE') >= 0) {
        setMsg('Supabase 未配置，请联系站点维护者', 'error');
        return;
    }

    if (typeof window.supabase === 'undefined') {
        setMsg('登录服务加载失败，请刷新重试或联系站点维护者', 'error');
        return;
    }

    var client = window.supabase.createClient(cfg.url, cfg.anonKey);

    client.auth.getSession().then(function (res) {
        if (!res.data.session) {
            setMsg('链接无效或已过期，请重新申请重置邮件', 'error');
        }
    }).catch(function () {
        setMsg('会话校验失败，请重新打开邮件链接', 'error');
    });

    document.getElementById('reset-submit').addEventListener('click', function () {
        var p1 = document.getElementById('new-password').value;
        var p2 = document.getElementById('new-password2').value;
        if (p1.length < 6) {
            setMsg('密码至少 6 位', 'error');
            return;
        }
        if (p1 !== p2) {
            setMsg('两次密码不一致', 'error');
            return;
        }
        client.auth.updateUser({ password: p1 }).then(function (result) {
            if (result.error) {
                setMsg(result.error.message, 'error');
                return;
            }
            setMsg('密码已更新，3 秒后跳转首页…', 'ok');
            setTimeout(function () { location.href = 'index.html'; }, 3000);
        }).catch(function (err) {
            setMsg((err && err.message) || '密码更新失败，请重试', 'error');
        });
    });
})();
