/**
 * 飞行雪绒 — 客户端速率限制器
 * Phase 3: 防止恶意刷屏，辅助 RLS 服务端限制
 *
 * 规则:
 *   - 评论: 每个目标(targetId) 3 次 / 60 秒
 *   - 投稿: 全局 2 次 / 5 分钟
 *
 * 依赖: localStorage（服务端降级时回退内存）
 */

(function() {
    'use strict';

    /* ================================================================
     * localStorage 安全封装
     * ================================================================ */
    function safeGetItem(key) {
        try { return localStorage.getItem(key); } catch(e) { return null; }
    }

    function safeSetItem(key, value) {
        try { localStorage.setItem(key, value); return true; } catch(e) { return false; }
    }

    /* ================================================================
     * 内存回退存储（localStorage 不可用时）
     * ================================================================ */
    var memoryStore = {};

    function getStore(key) {
        var val = safeGetItem(key);
        if (val !== null) return val;
        return memoryStore[key] || null;
    }

    function setStore(key, value) {
        if (!safeSetItem(key, value)) {
            memoryStore[key] = value;
        }
    }

    /* ================================================================
     * 速率限制配置
     * ================================================================ */
    var CONFIG = {
        /* 评论限制 */
        comment: {
            maxRequests: 3,       /* 最大次数 */
            windowMs:    60000,   /* 时间窗口 (60 秒) */
            blockMs:     120000   /* 超限封禁时间 (2 分钟) */
        },
        /* 投稿限制 */
        submission: {
            maxRequests: 2,       /* 最大次数 */
            windowMs:    300000,  /* 时间窗口 (5 分钟) */
            blockMs:     600000   /* 超限封禁时间 (10 分钟) */
        }
    };

    /* ================================================================
     * 核心: 检查速率限制
     * ================================================================ */

    /**
     * 检查是否允许操作
     * @param {string} type — 'comment' | 'submission'
     * @param {string} id   — targetId (评论) 或 '' (投稿)
     * @returns {{ allowed: boolean, retryAfter: number, reason: string }}
     */
    function check(type, id) {
        var cfg   = CONFIG[type];
        var key   = 'fxre_rl_' + type + '_' + (id || 'global');
        var now   = Date.now();
        var data  = loadState(key);
        var cfgT  = cfg || CONFIG.comment;

        /* 处于封禁期 */
        if (data.blockUntil && now < data.blockUntil) {
            return {
                allowed:    false,
                retryAfter: Math.ceil((data.blockUntil - now) / 1000),
                reason:     '操作太频繁，请 ' + Math.ceil((data.blockUntil - now) / 1000) + ' 秒后再试'
            };
        }

        /* 清理过期记录 */
        var windowStart = now - (cfgT.windowMs || 60000);
        data.timestamps = (data.timestamps || []).filter(function(ts) {
            return ts > windowStart;
        });

        /* 检查是否超限 */
        if (data.timestamps.length >= (cfgT.maxRequests || 3)) {
            data.blockUntil = now + (cfgT.blockMs || 120000);
            saveState(key, data);
            return {
                allowed:    false,
                retryAfter: Math.ceil((cfgT.blockMs || 120000) / 1000),
                reason:     '操作太频繁，请 ' + Math.ceil((cfgT.blockMs || 120000) / 1000) + ' 秒后再试'
            };
        }

        return { allowed: true, retryAfter: 0, reason: '' };
    }

    /**
     * 记录一次操作（调用前确保 check 通过）
     * @param {string} type — 'comment' | 'submission'
     * @param {string} id   — targetId (评论) 或 '' (投稿)
     */
    function record(type, id) {
        var key  = 'fxre_rl_' + type + '_' + (id || 'global');
        var data = loadState(key);
        var now  = Date.now();
        data.timestamps = data.timestamps || [];
        data.timestamps.push(now);
        saveState(key, data);
    }

    /**
     * 获取剩余可用次数
     * @param {string} type
     * @param {string} id
     * @returns {number}
     */
    function remaining(type, id) {
        var cfg   = CONFIG[type];
        var key   = 'fxre_rl_' + type + '_' + (id || 'global');
        var data  = loadState(key);
        var now   = Date.now();
        var cfgT  = cfg || CONFIG.comment;

        if (data.blockUntil && now < data.blockUntil) return 0;

        var windowStart = now - (cfgT.windowMs || 60000);
        var active = (data.timestamps || []).filter(function(ts) {
            return ts > windowStart;
        });
        return Math.max(0, (cfgT.maxRequests || 3) - active.length);
    }

    /* ================================================================
     * 便捷方法
     * ================================================================ */

    function checkComment(targetId) {
        return check('comment', targetId);
    }

    function recordComment(targetId) {
        record('comment', targetId);
    }

    function checkSubmission() {
        return check('submission', 'global');
    }

    function recordSubmission() {
        record('submission', 'global');
    }

    /* ================================================================
     * 内部: 状态持久化
     * ================================================================ */

    function loadState(key) {
        try {
            var raw = getStore(key);
            if (raw) { return JSON.parse(raw); }
        } catch(e) {}
        return { timestamps: [], blockUntil: 0 };
    }

    function saveState(key, data) {
        try {
            setStore(key, JSON.stringify(data));
        } catch(e) {}
    }

    /* ================================================================
     * 暴露接口
     * ================================================================ */
    window.RateLimiter = {
        check:          check,
        record:         record,
        remaining:      remaining,
        checkComment:   checkComment,
        recordComment:  recordComment,
        checkSubmission: checkSubmission,
        recordSubmission: recordSubmission
    };

})();
