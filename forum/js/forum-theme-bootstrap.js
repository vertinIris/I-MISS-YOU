(function () {
    'use strict';
    /* 沿用主站主题偏好 + 地址/realm；仅做视觉同步；不影响功能独立性
       原为 forum/index.html 内联脚本，CSP 加固（移除 'unsafe-inline'）后提取为外部文件。
       必须在 CSS 加载前同步执行，避免 FOUC 闪烁。 */
    try {
        /* v11: 仅保留暗色主题（星空氛围）——light/auto 模式已移除 */
        document.documentElement.setAttribute('data-theme', 'dark');
    } catch (e) { document.documentElement.setAttribute('data-theme', 'dark'); }

    var LOC_REALM = {
        '星炬学院': 'startorch',
        '拉贝尔学部': 'labelle',
        '拉海洛': 'lahairo',
        '雪原小屋': 'snow-cabin',
        '电子海': 'digital-sea'
    };
    try {
        var loc = localStorage.getItem('snowfluff-location') || '星炬学院';
        var realm = localStorage.getItem('snowfluff-realm') || LOC_REALM[loc] || 'startorch';
        document.documentElement.setAttribute('data-realm', realm);
        document.documentElement.setAttribute('data-location', loc);
        window.__STF_REALM__ = { location: loc, realm: realm };
    } catch (e2) {
        document.documentElement.setAttribute('data-realm', 'startorch');
        document.documentElement.setAttribute('data-location', '星炬学院');
    }
})();
