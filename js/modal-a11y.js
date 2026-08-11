/**
 * 共享模态可访问性：焦点陷阱 + 焦点归还（WCAG 2.1 AA）
 * - 监听任意 [role="dialog"] 的 hidden 属性变化
 * - 打开：记录触发元素，聚焦首个可聚焦控件
 * - 关闭：焦点归还触发元素
 * - Tab/Shift+Tab 在对话框内循环（焦点陷阱）
 * 主站 / 论坛共用；纯装饰层 aria-hidden 不参与。
 */
(function () {
    'use strict';
    var FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    var lastFocused = null;

    function getFocusable(dialog) {
        return Array.prototype.slice.call(dialog.querySelectorAll(FOCUSABLE)).filter(function (el) {
            return !el.disabled && el.offsetParent !== null;
        });
    }

    function bindDialogs() {
        var dialogs = Array.prototype.slice.call(document.querySelectorAll('[role="dialog"]'));
        if (!('MutationObserver' in window) || !dialogs.length) return;

        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                var el = m.target;
                if (el.hidden) {
                    if (lastFocused && document.contains(lastFocused)) {
                        try { lastFocused.focus(); } catch (_) { /* ignore */ }
                    }
                    lastFocused = null;
                } else {
                    lastFocused = document.activeElement;
                    var f = getFocusable(el);
                    if (f.length) {
                        try { f[0].focus(); } catch (_) { /* ignore */ }
                    } else {
                        try { el.focus(); } catch (_) { /* ignore */ }
                    }
                }
            });
        });
        dialogs.forEach(function (d) {
            observer.observe(d, { attributes: true, attributeFilter: ['hidden'] });
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var d = document.querySelector('[role="dialog"]:not([hidden])');
        if (!d) return;
        var f = getFocusable(d);
        if (!f.length) { e.preventDefault(); return; }
        var first = f[0], last = f[f.length - 1];
        if (!d.contains(document.activeElement)) {
            e.preventDefault(); first.focus(); return;
        }
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindDialogs);
    } else {
        bindDialogs();
    }
})();
