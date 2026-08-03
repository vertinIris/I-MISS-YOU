/**
 * 星炬学院主论坛 · 同步监测 / 主动同步 / 自动同步
 * ----------------------------------------------------
 * 设计说明：
 *  - 论坛数据层（StarTorchData）目前为 localStorage 本地存储，无云端后端。
 *  - 因此本模块默认运行于「本地模式」：
 *      · 实时监测 —— 监听跨标签页 storage 事件，任一标签页发帖/评论后，
 *                    其他标签页会在毫秒级收到通知并自动拉取（真实实时）。
 *      · 自动同步 —— 定时轮询（默认 20s）+ 标签页重新可见时（visibilitychange）
 *                    立即重新拉取本地数据并重渲染，捕获隐藏期间的变化。
 *      · 主动同步 —— 顶部「立即同步」按钮，手动触发一次完整同步。
 *  - 云端扩展接缝：若日后挂载 window.StarTorchCloud（与飞行雪绒站共用
 *    同一 Supabase 实例、realm='startorch'），本模块自动切换为「云端模式」，
 *    pull/push/getPending 全部委托给该适配器，UI 无需改动。
 *
 * 接口约定（供 window.StarTorchCloud 实现）：
 *      pull(cb)        -> cb(booleanOk)
 *      push(item, cb)  -> cb(booleanOk)
 *      getPending()    -> number   （待上报的本地写入数）
 *      getMode()       -> 'cloud'
 */
(function () {
    'use strict';

    var AUTO_INTERVAL = 20000;   // 自动同步轮询间隔（ms）
    var STORAGE_PREFIXES = ['stf_submissions', 'stf_seed', 'stf_comments_', 'stf_draft', 'stf_nickname'];

    var state = {
        mode: 'local',
        lastSync: 0,
        hasRemoteUpdate: false,
        healthy: true,
        auto: true,
        adapter: null
    };
    var timer = null;
    var listeners = [];

    /* ---------- 工具 ---------- */
    function nowTs() { return Date.now(); }

    function fmtTime(ts) {
        if (!ts) return '—';
        var d = new Date(ts);
        var p = function (n) { return String(n).padStart(2, '0'); };
        return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    function collectLocal() {
        var bag = {};
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (!k) continue;
                var hit = false;
                for (var j = 0; j < STORAGE_PREFIXES.length; j++) {
                    if (k.indexOf(STORAGE_PREFIXES[j]) === 0) { hit = true; break; }
                }
                if (hit) bag[k] = localStorage.getItem(k);
            }
        } catch (e) { /* ignore */ }
        return bag;
    }

    function hashOf(bag) {
        var s = '';
        Object.keys(bag).sort().forEach(function (k) { s += k + '=' + (bag[k] || '') + ';'; });
        return s.length + ':' + s;
    }

    function getPending() {
        if (state.adapter && typeof state.adapter.getPending === 'function') {
            try { return state.adapter.getPending() || 0; } catch (e) { return 0; }
        }
        return 0;
    }

    /* ---------- 渲染 ---------- */
    function statusText() {
        if (!state.healthy) return '同步异常 · 请点击重试';
        if (state.hasRemoteUpdate) return '检测到新内容 · 同步中…';
        if (state.mode === 'cloud') {
            var p = getPending();
            return '云端已连接' + (p > 0 ? ' · 待上报 ' + p : '') + ' · 上次 ' + fmtTime(state.lastSync);
        }
        return '本地模式 · 上次同步 ' + fmtTime(state.lastSync);
    }

    function paint() {
        var dot = document.getElementById('stf-sync-dot');
        var txt = document.getElementById('stf-sync-text');
        if (dot) {
            var cls = 'stf-sync-dot';
            if (!state.healthy) cls += ' is-error';
            else if (state.hasRemoteUpdate) cls += ' is-syncing';
            else cls += ' is-ok';
            dot.className = cls;
        }
        if (txt) txt.textContent = statusText();
        for (var i = 0; i < listeners.length; i++) {
            try { listeners[i](getStatus()); } catch (e) { /* ignore */ }
        }
    }

    function emit() { paint(); }

    /* ---------- 同步核心 ---------- */
    function afterSync(ok) {
        if (ok) { state.lastSync = nowTs(); state.hasRemoteUpdate = false; state.healthy = true; }
        else { state.healthy = false; }
        paint();
    }

    function doSync() {
        if (state.adapter && typeof state.adapter.pull === 'function') {
            state.mode = 'cloud';
            try {
                state.adapter.pull(function (ok) {
                    afterSync(!!ok);
                    if (ok && window.StarTorchForum && window.StarTorchForum.refreshCommunity) {
                        window.StarTorchForum.refreshCommunity();
                    }
                });
            } catch (e) { afterSync(false); }
            return;
        }

        /* 本地模式：重新跑种子合并 + 重渲染 */
        try {
            if (window.StarTorchData) window.StarTorchData.ensureSeedData();
        } catch (e) { /* ignore */ }
        if (window.StarTorchForum && window.StarTorchForum.refreshCommunity) {
            window.StarTorchForum.refreshCommunity();
        }
        afterSync(true);
    }

    /* ---------- 实时监测（跨标签页） ---------- */
    function onStorage(e) {
        if (!e || !e.key) return;
        if (e.key.indexOf('stf_') !== 0) return;
        state.hasRemoteUpdate = true;
        emit();
        if (state.auto && !document.hidden) doSync();
    }

    function onVisibility() {
        if (!document.hidden) doSync();
    }

    /* ---------- 自动同步 ---------- */
    function startAuto() {
        if (timer) clearInterval(timer);
        timer = setInterval(function () {
            if (document.hidden) return;
            doSync();
        }, AUTO_INTERVAL);
        document.addEventListener('visibilitychange', onVisibility);
    }

    function stopAuto() {
        if (timer) { clearInterval(timer); timer = null; }
        document.removeEventListener('visibilitychange', onVisibility);
    }

    /* ---------- 公开 API ---------- */
    function getStatus() {
        return {
            mode: state.mode,
            lastSync: state.lastSync,
            lastSyncText: fmtTime(state.lastSync),
            hasRemoteUpdate: state.hasRemoteUpdate,
            healthy: state.healthy,
            auto: state.auto,
            pending: getPending()
        };
    }

    function syncNow() {
        doSync();
        if (window.StarTorchForum && window.StarTorchForum.toast) {
            window.StarTorchForum.toast('已触发同步 · ' + (state.mode === 'cloud' ? '云端' : '本地'));
        }
    }

    /** 本地写入后调用：刷新「上次同步」时间并立即重绘状态（无需等待轮询） */
    function noteLocalWrite() {
        state.lastSync = nowTs();
        state.hasRemoteUpdate = false;
        state.healthy = true;
        paint();
    }

    function setAuto(on) {
        state.auto = !!on;
        if (state.auto) startAuto(); else stopAuto();
        paint();
    }

    function onStatus(cb) {
        if (typeof cb === 'function') listeners.push(cb);
    }

    /* 云端适配器就绪后由 forum-cloud.js 调用：从本地模式热切换为云端模式 */
    function attachCloud(adapter) {
        if (!adapter) return;
        state.adapter = adapter;
        state.mode = 'cloud';
        doSync();
    }

    function init(opts) {
        opts = opts || {};
        state.auto = (opts.auto !== false);
        state.adapter = window.StarTorchCloud || null;
        state.mode = state.adapter ? 'cloud' : 'local';

        var btn = document.getElementById('stf-sync-now');
        if (btn && !btn.__bound) {
            btn.__bound = true;
            btn.addEventListener('click', function () {
                if (window.StarTorchForum && window.StarTorchForum.toast) {
                    window.StarTorchForum.toast('已触发同步 · ' + (state.mode === 'cloud' ? '云端' : '本地'));
                }
                doSync();
            });
        }

        window.addEventListener('storage', onStorage);
        if (state.auto) startAuto();

        /* 初始同步一次 */
        doSync();
    }

    window.StarTorchSync = {
        init: init,
        getStatus: getStatus,
        syncNow: syncNow,
        noteLocalWrite: noteLocalWrite,
        setAuto: setAuto,
        onStatus: onStatus,
        attachCloud: attachCloud
    };

    /* 自挂载：等待 StarTorchForum / StarTorchData 就绪后初始化 */
    function boot() {
        if (window.StarTorchData) init();
    }
    if (document.readyState !== 'loading') {
        setTimeout(boot, 0);
    } else {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
    }
})();
