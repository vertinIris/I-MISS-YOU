/**
 * web-vitals RUM 采集器（window.FXRE_Vitals）
 * --------------------------------------------------
 * 采集真实用户 Core Web Vitals (LCP/INP/CLS/TTFB/FCP)，
 * 页面卸载或隐藏时批量上报到 Supabase performance_metrics 表。
 *
 * 依赖：vendor/web-vitals（需在 HTML 中引入，或用 CDN）
 * 设计：匿名采集，不记录 user_id，仅路径/指标/UA
 * 隐私：RLS 仅允许 INSERT，不可 SELECT
 */
(function () {
    'use strict';

    var QUEUE_KEY = 'fxre_vitals_queue';
    var SUPABASE_URL = (window.__FXRE_API && window.__FXRE_API.supabaseUrl) || '';
    var SUPABASE_KEY = (window.__FXRE_API && window.__FXRE_API.supabaseAnonKey) || '';
    var FLUSH_THRESHOLD = 5; // 队列达 5 条触发上报

    function safeGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (_) { return false; } }

    function getRating(name, value) {
        // Google 官方阈值：https://web.dev/articles/vitals
        if (name === 'LCP') return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
        if (name === 'INP') return value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor';
        if (name === 'CLS') return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
        if (name === 'TTFB') return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
        if (name === 'FCP') return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
        return 'good';
    }

    function queueMetric(name, value) {
        if (typeof value !== 'number' || !isFinite(value) || value < 0) return;
        var queue = [];
        try { queue = JSON.parse(safeGet(QUEUE_KEY) || '[]'); if (!Array.isArray(queue)) queue = []; } catch (_) { queue = []; }
        queue.push({
            metric_name: name,
            metric_value: Math.round(value * 100) / 100,
            metric_rating: getRating(name, value),
            page_path: location.pathname,
            user_agent: navigator.userAgent,
            connection_type: (navigator.connection && navigator.connection.effectiveType) || null,
            created_at: new Date().toISOString()
        });
        safeSet(QUEUE_KEY, JSON.stringify(queue));
        if (queue.length >= FLUSH_THRESHOLD) flush();
    }

    async function flush() {
        var queue = [];
        try { queue = JSON.parse(safeGet(QUEUE_KEY) || '[]'); if (!Array.isArray(queue)) queue = []; } catch (_) { return; }
        if (!queue.length) return;
        if (!SUPABASE_URL || !SUPABASE_KEY || !window.supabaseClient) {
            // 无 Supabase 客户端，保留队列下次重试（上限 20 条防溢出）
            if (queue.length > 20) queue = queue.slice(-20);
            safeSet(QUEUE_KEY, JSON.stringify(queue));
            return;
        }
        try {
            var { error } = await window.supabaseClient
                .from('performance_metrics')
                .insert(queue);
            if (!error) safeSet(QUEUE_KEY, '[]');
        } catch (_) { /* 离线保留队列，下次重试 */ }
    }

    function init() {
        // 动态加载 web-vitals 库（若未引入）
        if (typeof window.webVitals === 'undefined') {
            var s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/web-vitals@4/dist/web-vitals.iife.js';
            s.async = true;
            s.onload = bindVitals;
            document.head.appendChild(s);
        } else {
            bindVitals();
        }
        // 页面隐藏或卸载时上报
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
        window.addEventListener('pagehide', flush);
    }

    function bindVitals() {
        var wv = window.webVitals;
        if (!wv) return;
        ['LCP', 'INP', 'CLS', 'TTFB', 'FCP'].forEach(function (name) {
            var fn = wv['on' + name];
            if (typeof fn === 'function') {
                fn(function (metric) { queueMetric(name, metric.value); });
            }
        });
    }

    window.FXRE_Vitals = { init: init, flush: flush };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
