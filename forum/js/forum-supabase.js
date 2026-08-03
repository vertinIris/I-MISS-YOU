/**
 * 星炬学院主论坛 · Supabase 客户端初始化
 * ----------------------------------------------------
 * 复用飞行雪绒主站同一 Supabase 项目（lmlyfyjffaaddysiliht），
 * 因此两站共享 auth.users / profiles —— 账号自动打通，无需手动同步。
 *
 * 关键点：
 *   - supabase-js SDK 由 index.html 的 <script async> CDN 注入（与主站同款）。
 *   - 该脚本是 async，可能晚于本文件执行，故用 waitForSDK 轮询就绪。
 *   - 论坛是独立页面（forum/index.html），自身没有 window.supabase，必须自建客户端。
 *   - 客户端创建后挂到 window.supabaseClient（与主站同名），便于共享会话调试。
 */
(function () {
    'use strict';

    /* 与主站 js/supabase-adapter.js 完全一致的项目配置（anonKey 为公开公钥，可复用） */
    var CONFIG = {
        url: 'https://lmlyfyjffaaddysiliht.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtbHlmeWpmZmFhZGR5c2lsaWh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDQ4OTYsImV4cCI6MjA5ODUyMDg5Nn0.PESEQk_gwuqa-djkjB3HsNCViQA561ifVfd5LtJLt4E'
    };

    var client = null;
    var initPromise = null;

    /* 等待 CDN 注入的 window.supabase 就绪 */
    function waitForSDK(timeoutMs) {
        return new Promise(function (resolve) {
            if (window.supabase) return resolve(true);
            var waited = 0;
            var step = 50;
            var max = timeoutMs || 10000;
            var timer = setInterval(function () {
                if (window.supabase) { clearInterval(timer); resolve(true); return; }
                waited += step;
                if (waited >= max) { clearInterval(timer); resolve(false); }
            }, step);
        });
    }

    function init() {
        if (initPromise) return initPromise;
        initPromise = waitForSDK(10000).then(function (ok) {
            if (!ok || !window.supabase) {
                console.warn('[forum-supabase] SDK 未加载（CDN 超时或离线），论坛回退纯本地模式');
                return null;
            }
            try {
                client = window.supabase.createClient(CONFIG.url, CONFIG.anonKey, {
                    auth: {
                        autoRefreshToken: true,
                        persistSession: true,
                        detectSessionInUrl: false
                    }
                });
                window.supabaseClient = client; /* 与主站同名，便于跨页共享会话 */
                console.log('[forum-supabase] 客户端初始化成功');
                return client;
            } catch (e) {
                console.warn('[forum-supabase] 初始化失败', e);
                return null;
            }
        });
        return initPromise;
    }

    function ensureForumClient() {
        if (client) return Promise.resolve(client);
        return init();
    }

    function getClient() { return client; }

    window.forumSupabase = {
        init: init,
        ensureForumClient: ensureForumClient,
        getClient: getClient,
        CONFIG: CONFIG
    };

    /* 自启动（异步，SDK 就绪后自动创建客户端；失败则静默本地模式） */
    init();
})();
