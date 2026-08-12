/**
 * Markdown 渲染器（window.renderMarkdown）
 * --------------------------------------------------
 * 封装 marked + DOMPurify + highlight.js，提供安全的 Markdown 渲染。
 * 降级策略：marked 未加载 → 纯文本 + 换行；highlight.js 未加载 → 不高亮
 *
 * 加载顺序：DOMPurify(defer) → marked(defer) → highlight.js(defer) → 本模块(defer) → bundle(defer)
 * 使用：var html = window.renderMarkdown(userInput);
 */
(function () {
    'use strict';

    /* Markdown 检测：仅当文本含 Markdown 标记时才启用 marked，否则纯文本（性能 + 兼容） */
    var MD_MARKERS = /(^|\n)\s*(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|```|~~~|`[^`]+`|\|.*\|)|\*\*|__|\[.+?\]\(.+?\)/;

    function isMarkdown(text) {
        if (!text || typeof text !== 'string') return false;
        return MD_MARKERS.test(text);
    }

    function escapePlain(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\n/g, '<br>');
    }

    /**
     * renderMarkdown(text) — 安全渲染 Markdown 为 HTML
     * @param {string} text - 用户输入文本
     * @returns {string} 消毒后的 HTML 字符串
     */
    window.renderMarkdown = function (text) {
        if (!text || typeof text !== 'string') return '';
        var sanitized = text; // 原始文本（marked 会处理转义）

        // 非 Markdown：纯文本 + 换行，经 DOMPurify 消毒
        if (!isMarkdown(sanitized)) {
            var plain = escapePlain(sanitized);
            if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(plain);
            return plain;
        }

        // Markdown：marked 解析 → highlight.js 高亮 → DOMPurify 消毒
        if (typeof marked === 'undefined') {
            // marked 未加载，降级纯文本
            var fallback = escapePlain(sanitized);
            if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(fallback);
            return fallback;
        }

        try {
            // 配置 marked（v5+ 用 marked.parse，v4- 用 marked）
            var parseFn = marked.parse || marked;
            var html = parseFn(sanitized, {
                breaks: true,       // 单换行转 <br>
                gfm: true,          // GitHub Flavored Markdown
                headerIds: false,   // 不生成 header id（避免冲突）
                mangle: false
            });

            // highlight.js 代码高亮（marked 渲染后）
            if (typeof hljs !== 'undefined' && hljs.highlightAll) {
                // 用临时容器高亮（避免直接操作主 DOM）
                var tmp = document.createElement('div');
                tmp.innerHTML = html;
                tmp.querySelectorAll('pre code').forEach(function (block) {
                    try { hljs.highlightElement(block); } catch (_) {}
                });
                html = tmp.innerHTML;
            }

            // DOMPurify 消毒（防 XSS）
            if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(html);
            if (typeof DOMPurify !== 'undefined') return DOMPurify.sanitize(html);
            return html;
        } catch (e) {
            console.warn('[renderMarkdown] 渲染失败，降级纯文本:', e.message || e);
            var errFallback = escapePlain(sanitized);
            if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(errFallback);
            return errFallback;
        }
    };
})();
