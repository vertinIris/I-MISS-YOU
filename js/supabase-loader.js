(function () {
    'use strict';
    /* 主站 Supabase SDK CDN 加载 + 容错
       原为 index.html 内联 onerror 属性，CSP 加固（移除 'unsafe-inline'）后提取为外部文件。
       用 addEventListener 风格的 onerror 替代内联事件处理器。 */
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onerror = function () {
        console.warn('[Phase3] Supabase SDK CDN 加载失败，回退纯本地模式');
        window.__supabaseLoadFailed = true;
    };
    document.head.appendChild(s);
})();
