/**
 * SecurityShield — 前端安全防护网 v9.4
 *
 * 纵深防御层（配合 Supabase RLS + 服务端限流）：
 *   - XSS / 注入模式检测
 *   - 输入清洗与长度截断
 *   - 操作洪泛检测（点击/提交）
 *   - 危险 URL scheme 拦截
 *   - JSON 安全解析（防 prototype pollution）
 *   - DOM 注入监控（script/iframe 突变）
 *   - CSP 违规上报
 *   - 同步按钮防刷
 */
var SecurityShield = (function() {

    var ENABLED = true;
    var MAX_ACTIONS_PER_MINUTE = 150;
    var MAX_SYNC_PER_MINUTE = 8;
    var actionTimestamps = [];
    var syncTimestamps = [];
    var violationCount = 0;
    var observer = null;

    var XSS_PATTERNS = [
        /<script[\s>]/i,
        /<\/script>/i,
        /javascript\s*:/i,
        /vbscript\s*:/i,
        /data\s*:\s*text\/html/i,
        /on\w+\s*=/i,
        /<\s*iframe/i,
        /<\s*object/i,
        /<\s*embed/i,
        /<\s*svg[\s>][\s\S]*?on\w+/i,
        /expression\s*\(/i,
        /url\s*\(\s*['"]?\s*javascript/i
    ];

    var SQL_PATTERNS = [
        /(\bunion\b[\s\S]*\bselect\b)/i,
        /(\bdrop\b[\s\S]*\btable\b)/i,
        /(\binsert\b[\s\S]*\binto\b)/i,
        /(\bdelete\b[\s\S]*\bfrom\b)/i,
        /(?:^|\s)--(?:\s|$)/,
        /\/\*[\s\S]*?\*\//,
        /;\s*shutdown/i
    ];

    var DANGEROUS_URL = /^(javascript|vbscript|data\s*:\s*text\/html|file):/i;

    function now() { return Date.now(); }

    function trimActions(list, windowMs) {
        var cutoff = now() - windowMs;
        while (list.length && list[0] < cutoff) list.shift();
    }

    function recordAction() {
        actionTimestamps.push(now());
        trimActions(actionTimestamps, 60000);
        return actionTimestamps.length <= MAX_ACTIONS_PER_MINUTE;
    }

    function canSync() {
        syncTimestamps.push(now());
        trimActions(syncTimestamps, 60000);
        return syncTimestamps.length <= MAX_SYNC_PER_MINUTE;
    }

    function detectThreat(text) {
        if (!text || typeof text !== 'string') return null;
        var i;
        for (i = 0; i < XSS_PATTERNS.length; i++) {
            if (XSS_PATTERNS[i].test(text)) return '检测到可疑脚本内容';
        }
        for (i = 0; i < SQL_PATTERNS.length; i++) {
            if (SQL_PATTERNS[i].test(text)) return '检测到可疑注入模式';
        }
        return null;
    }

    function sanitizeText(text, maxLen) {
        if (text == null) return '';
        text = String(text);
        text = text.replace(/\0/g, '');
        text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
        if (maxLen && text.length > maxLen) text = text.substring(0, maxLen);
        return text.trim();
    }

    function isSafeUrl(url) {
        if (!url || typeof url !== 'string') return false;
        url = url.trim();
        if (url.indexOf('//') === 0) return true;
        if (/^https?:\/\//i.test(url)) return true;
        if (url.indexOf('/') === 0) return true;
        if (/^blob:/i.test(url)) return true;
        if (/^data:image\//i.test(url)) return true;
        return !DANGEROUS_URL.test(url);
    }

    function safeParseJSON(raw, fallback) {
        fallback = fallback !== undefined ? fallback : null;
        if (!raw || typeof raw !== 'string') return fallback;
        if (raw.length > 512000) return fallback;
        try {
            var parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                if ('__proto__' in parsed || 'constructor' in parsed || 'prototype' in parsed) {
                    logViolation('json_pollution', 'blocked');
                    return fallback;
                }
            }
            return parsed;
        } catch (e) {
            return fallback;
        }
    }

    function logViolation(type, detail) {
        violationCount++;
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('[SecurityShield]', type, detail || '');
        }
    }

    function guardUserInput(text, context) {
        if (!ENABLED) return { ok: true, text: text };
        if (!recordAction()) {
            return { ok: false, reason: '操作过于频繁，请稍后再试', text: '' };
        }
        text = sanitizeText(text);
        var threat = detectThreat(text);
        if (threat) {
            logViolation('input_' + (context || 'unknown'), threat);
            return { ok: false, reason: threat, text: '' };
        }
        return { ok: true, text: text };
    }

    function guardSyncAction() {
        if (!ENABLED) return { ok: true };
        if (!canSync()) {
            return { ok: false, reason: '同步过于频繁，请 1 分钟后再试' };
        }
        if (!recordAction()) {
            return { ok: false, reason: '操作过于频繁，请稍后再试' };
        }
        return { ok: true };
    }

    function scanFormInputs(form) {
        if (!form) return { ok: true };
        var inputs = form.querySelectorAll('input, textarea');
        for (var i = 0; i < inputs.length; i++) {
            var el = inputs[i];
            if (el.type === 'password' || el.type === 'hidden') continue;
            var check = guardUserInput(el.value, 'form');
            if (!check.ok) return check;
        }
        return { ok: true };
    }

    function onFormSubmit(e) {
        if (!ENABLED) return;
        var form = e.target;
        if (!form || !form.tagName || form.tagName !== 'FORM') return;
        var scan = scanFormInputs(form);
        if (!scan.ok) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.showSubmitToast === 'function') {
                window.showSubmitToast(scan.reason, 4000);
            }
        }
    }

    function onClickCapture() {
        if (!ENABLED) return;
        if (!recordAction()) {
            logViolation('click_flood', 'warn');
        }
    }

    function onCSPViolation(e) {
        logViolation('csp', (e.blockedURI || '') + ' ' + (e.violatedDirective || ''));
    }

    function watchDOM() {
        if (!window.MutationObserver) return;
        observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                m.addedNodes.forEach(function(node) {
                    if (node.nodeType !== 1) return;
                    var tag = (node.tagName || '').toLowerCase();
                    if (tag === 'script') {
                        var src = node.getAttribute('src') || '';
                        if (src && /^https?:\/\//i.test(src)) return;
                        if (node.hasAttribute('data-fxre-allowed')) return;
                        logViolation('dom_inject', 'inline-script');
                        try { node.remove(); } catch (err) {}
                        return;
                    }
                    if (tag === 'iframe' || tag === 'object' || tag === 'embed') {
                        if (node.hasAttribute('data-fxre-allowed')) return;
                        logViolation('dom_inject', tag);
                        try { node.remove(); } catch (err) {}
                        return;
                    }
                    if (node.querySelectorAll) {
                        node.querySelectorAll('script:not([src]):not([data-fxre-allowed])').forEach(function(el) {
                            logViolation('dom_inject_nested', 'script');
                            try { el.remove(); } catch (err2) {}
                        });
                    }
                });
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    function patchLocalStorage() {
        if (!window.localStorage) return;
        var origSet = localStorage.setItem.bind(localStorage);
        localStorage.setItem = function(key, value) {
            if (typeof key !== 'string') return;
            if (key.length > 128) {
                logViolation('storage_key', 'oversized');
                return;
            }
            if (typeof value === 'string' && value.length > 524288) {
                logViolation('storage_value', 'oversized');
                return;
            }
            return origSet(key, value);
        };
    }

    function init() {
        if (typeof document === 'undefined') return;
        document.addEventListener('submit', onFormSubmit, true);
        document.addEventListener('click', onClickCapture, true);
        window.addEventListener('securitypolicyviolation', onCSPViolation);
        patchLocalStorage();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', watchDOM);
        } else {
            watchDOM();
        }
    }

    return {
        init: init,
        guardUserInput: guardUserInput,
        guardSyncAction: guardSyncAction,
        sanitizeText: sanitizeText,
        detectThreat: detectThreat,
        isSafeUrl: isSafeUrl,
        safeParseJSON: safeParseJSON,
        getViolationCount: function() { return violationCount; }
    };
})();
