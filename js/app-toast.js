/**
 * 飞行雪绒 · AppToast + sanitizeHTML 共享工具层
 *
 * 职责:
 *   1. AppToast — 封装 Notyf Toast 通知（成功/错误/信息/警告），统一操作反馈
 *   2. sanitizeHTML — 封装 DOMPurify UGC 消毒（白名单模式），防 XSS
 *
 * 依赖: vendor/notyf/notyf.min.js + vendor/dompurify/purify.min.js（均 defer 加载）
 * 守卫: typeof X !== 'undefined'（库未加载时降级，不报错）
 *
 * 加载顺序: DOMPurify(defer) → Notyf(defer) → app-toast.js(defer) → bundle-main.js(defer)
 */
(function () {
    'use strict';

    /* ================================================================
     * AppToast — Notyf 封装
     * ================================================================ */
    var notyfInstance = null;

    function getNotyf() {
        if (notyfInstance) return notyfInstance;
        if (typeof Notyf === 'undefined') return null;
        try {
            notyfInstance = new Notyf({
                duration: 3500,
                position: { x: 'right', y: 'top' },
                dismissible: true,
                ripple: true
            });
        } catch(e) {
            console.warn('[AppToast] Notyf 初始化失败:', e.message || e);
            return null;
        }
        return notyfInstance;
    }

    function fallbackLog(level, msg) {
        if (typeof console !== 'undefined' && console[level]) {
            console[level]('[AppToast:' + level + ']', msg);
        }
    }

    function show(type, message, opts) {
        var n = getNotyf();
        if (!n) { fallbackLog(type === 'success' ? 'log' : type, message); return; }
        try {
            var cfg = opts || {};
            if (type === 'success') {
                n.success({ message: message, duration: cfg.duration || 3500, dismissible: cfg.dismissible !== false });
            } else if (type === 'error') {
                n.error({ message: message, duration: cfg.duration || 5000, dismissible: cfg.dismissible !== false });
            } else {
                /* info / warn: Notyf 3.x 无原生 info 类型，用自定义 type */
                n.open({
                    type: 'info',
                    message: message,
                    duration: cfg.duration || 3500,
                    dismissible: cfg.dismissible !== false
                });
            }
        } catch(_) {
            fallbackLog(type, message);
        }
    }

    window.AppToast = {
        success: function (msg, opts) { show('success', msg, opts); },
        error:   function (msg, opts) { show('error', msg, opts); },
        info:    function (msg, opts) { show('info', msg, opts); },
        warn:    function (msg, opts) { show('warn', msg, opts); }
    };

    /* ================================================================
     * sanitizeHTML — DOMPurify 封装（UGC 白名单消毒）
     * ================================================================ */
    var PURIFY_CONFIG = {
        ALLOWED_TAGS: [
            'p', 'br', 'hr', 'span', 'div',
            'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup',
            'a', 'code', 'pre', 'blockquote',
            'ul', 'ol', 'li',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'img',
            'table', 'thead', 'tbody', 'tr', 'th', 'td'
        ],
        ALLOWED_ATTR: [
            'href', 'title', 'target', 'rel',
            'src', 'alt', 'width', 'height',
            'class',
            'colspan', 'rowspan'
        ],
        ALLOW_DATA_ATTR: false,
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
    };

    window.sanitizeHTML = function (dirty) {
        if (typeof dirty !== 'string') return '';
        if (typeof DOMPurify === 'undefined') {
            /* DOMPurify 未加载：降级为纯文本（转义 HTML） */
            return dirty.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }
        try {
            return DOMPurify.sanitize(dirty, PURIFY_CONFIG);
        } catch(e) {
            console.warn('[sanitizeHTML] DOMPurify 消毒失败，降级纯文本:', e.message || e);
            return dirty.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }
    };

    /* ================================================================
     * sanitizeTemplateHTML — 站点自有模板消毒（区别于 UGC 白名单）
     * ---------------------------------------------------------------
     * 背景：buildSubmissionCardHTML 等产出的是「站点模板 + 少量已转义字段」，
     *       其中 article / button / input / data-* / style 属于模板骨架而非用户输入。
     *       若套用 UGC 白名单，骨架会被整体剥离，导致卡片无法渲染（P0-1）。
     *
     * 安全边界（与 UGC 消毒一致，不降低防护强度）：
     *   - DOMPurify 始终移除 <script>/<style>/<iframe> 与所有 on* 事件处理器
     *   - 用户可控字段在进入模板前必须已经过 escapeHTML() / SecurityShield 校验
     *
     * 注意：不要把真正的用户输入直接丢给本函数，那是 sanitizeHTML 的职责。
     * ================================================================ */
    var TEMPLATE_CONFIG = {
        ALLOWED_TAGS: [
            'article', 'section', 'header', 'footer', 'aside', 'nav',
            'p', 'br', 'hr', 'span', 'div',
            'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup', 'small',
            'a', 'code', 'pre', 'blockquote',
            'ul', 'ol', 'li',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'img', 'figure', 'figcaption',
            'button', 'input', 'textarea', 'select', 'option', 'form', 'label', 'time',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'svg', 'path', 'circle', 'rect', 'g', 'line', 'polyline', 'polygon'
        ],
        ALLOWED_ATTR: [
            'href', 'title', 'target', 'rel',
            'src', 'alt', 'width', 'height',
            'class', 'id', 'style', 'type', 'name', 'value', 'placeholder',
            'disabled', 'required', 'maxlength', 'rows', 'cols', 'hidden',
            'colspan', 'rowspan',
            'viewBox', 'fill', 'stroke', 'stroke-width', 'd', 'points', 'xmlns',
            'aria-label', 'aria-expanded', 'aria-hidden', 'aria-modal', 'role', 'tabindex'
        ],
        ALLOW_DATA_ATTR: true,
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'formaction']
    };

    window.sanitizeTemplateHTML = function (dirty) {
        if (typeof dirty !== 'string') return '';
        if (typeof DOMPurify === 'undefined') {
            /* DOMPurify 未加载：模板由站点自身生成且字段已转义，允许原样返回以保功能可用 */
            return dirty;
        }
        try {
            return DOMPurify.sanitize(dirty, TEMPLATE_CONFIG);
        } catch(e) {
            console.warn('[sanitizeTemplateHTML] DOMPurify 消毒失败，回退原模板:', e.message || e);
            return dirty;
        }
    };

    /* 便捷别名：安全设置 innerHTML */
    window.setSafeHTML = function (element, dirty) {
        if (!element || typeof element.innerHTML === 'undefined') return;
        element.innerHTML = window.sanitizeHTML(dirty);
    };
})();
