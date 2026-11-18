(function () {
    'use strict';
    /* 主站 Supabase SDK CDN 加载 + 容错链
       原为 index.html 内联 onerror 属性，CSP 加固（移除 'unsafe-inline'）后提取为外部文件。
       用 addEventListener 风格的 onerror 替代内联事件处理器。

       P0-3 修复（2026-11-18）：原实现仅 jsdelivr 单点，CDN 故障即主站云端功能全瘫。
       现移植论坛的四级降级链：jsdelivr → unpkg → 本地副本 → 纯本地模式。
       注意：本地副本位于 forum/js/supabase.min.js（仓库内唯一一份 SDK 本地文件，
       与主站同源部署，可直接访问）；无需重复打包一份到根目录。 */

    function loadSDK(src, onErr) {
        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.onerror = onErr;
        document.head.appendChild(s);
    }

    function fallbackToLocal() {
        // 第三级：本地同源副本（forum/js/ 与主站同域部署）
        loadSDK('forum/js/supabase.min.js', function () {
            // 第四级：全部失败 → 通知 adapter 停止等待，进入纯本地模式
            console.warn('[Phase3] Supabase SDK 所有来源均加载失败，回退纯本地模式');
            window.__supabaseLoadFailed = true;
        });
    }

    var main = document.createElement('script');
    main.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    main.async = true;
    main.crossOrigin = 'anonymous';
    main.onerror = function () {
        // 第二级：unpkg
        loadSDK('https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js', fallbackToLocal);
    };
    document.head.appendChild(main);
})();
