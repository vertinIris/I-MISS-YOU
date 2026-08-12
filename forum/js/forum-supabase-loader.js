(function () {
    'use strict';
    /* 论坛上云：Supabase 客户端加载 + CDN 容错链
       原为 forum/index.html 内联脚本 + onerror 内联属性，CSP 加固后提取为外部文件。
       用 addEventListener 替代内联 onerror，消除对 'unsafe-inline' 的依赖。 */
    window.__loadSupabaseSDK = function (src, onErr) {
        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.onerror = onErr;
        document.head.appendChild(s);
    };

    /* 主 CDN 脚本加载 + 容错链：jsdelivr → unpkg → 本地 supabase.min.js → 纯本地模式 */
    var main = document.createElement('script');
    main.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    main.async = true;
    main.crossOrigin = 'anonymous';
    main.onerror = function () {
        window.__loadSupabaseSDK('https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js', function () {
            window.__loadSupabaseSDK('js/supabase.min.js', function () {
                console.warn('[forum] Supabase SDK 所有来源均加载失败，回退纯本地模式');
            });
        });
    };
    document.head.appendChild(main);
})();
