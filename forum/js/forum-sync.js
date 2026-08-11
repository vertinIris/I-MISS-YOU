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
        syncing: false,
        cloudDegraded: false,   // 云端连接失败但本地数据可用（软降级，非致命）
        auto: true,
        adapter: null,
        _adapterRef: null       // 云端适配器引用备份，用于降级后手动/退避重连
    };
    var timer = null;
    var listeners = [];

    /* 云端重连退避 */
    var REPROBE_BASE = 30000;   // 首次退避 30s
    var REPROBE_MAX = 180000;   // 封顶 3min
    var reprobeTimer = null;
    var reprobeDelay = REPROBE_BASE;

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
        } catch(_) { /* ignore */ }
        return bag;
    }

    function hashOf(bag) {
        var s = '';
        Object.keys(bag).sort().forEach(function (k) { s += k + '=' + (bag[k] || '') + ';'; });
        return s.length + ':' + s;
    }

    function getPending() {
        if (state.adapter && typeof state.adapter.getPending === 'function') {
            try { return state.adapter.getPending() || 0; } catch(_) { return 0; }
        }
        return 0;
    }

    /* ---------- 渲染 ---------- */
    function statusText() {
        if (!state.healthy) return '同步异常';
        if (state.cloudDegraded) return '本地正常';
        if (state.hasRemoteUpdate) return '同步中…';
        if (state.mode === 'cloud') {
            var p = getPending();
            return '云端已连接' + (p > 0 ? ' · 待上报 ' + p : '');
        }
        return '本地模式';
    }

    function paint() {
        var dot = document.getElementById('stf-sync-dot');
        var txt = document.getElementById('stf-sync-text');
        if (dot) {
            var cls = 'stf-sync-dot';
            if (!state.healthy) cls += ' is-error';
            else if (state.cloudDegraded) cls += ' is-offline';
            else if (state.hasRemoteUpdate) cls += ' is-syncing';
            else cls += ' is-ok';
            dot.className = cls;
        }
        if (txt) txt.textContent = statusText();
        for (var i = 0; i < listeners.length; i++) {
            try { listeners[i](getStatus()); } catch(_) { /* ignore */ }
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
        state.syncing = true;
        paint();
        if (state.adapter && typeof state.adapter.pull === 'function') {
            state.mode = 'cloud';
            try {
                state.adapter.pull(function (ok) {
                    state.syncing = false;
                    if (ok) {
                        state.lastSync = nowTs();
                        state.hasRemoteUpdate = false;
                        state.healthy = true;
                        state.cloudDegraded = false;
                        stopReprobe();
                        reprobeDelay = REPROBE_BASE;
                        paint();
                        if (window.StarTorchForum && window.StarTorchForum.refreshCommunity) {
                            window.StarTorchForum.refreshCommunity();
                        }
                    } else {
                        handleCloudFailure();
                    }
                });
            } catch(_) {
                state.syncing = false;
                handleCloudFailure();
            }
            return;
        }

        /* 本地模式：重新跑种子合并 + 重渲染 */
        try {
            if (window.StarTorchData) window.StarTorchData.ensureSeedData();
        } catch(_) { /* ignore */ }
        if (window.StarTorchForum && window.StarTorchForum.refreshCommunity) {
            window.StarTorchForum.refreshCommunity();
        }
        state.syncing = false;
        afterSync(true);
    }

    /* ---------- 云端降级与退避重连 ---------- */
    function handleCloudFailure() {
        state.cloudDegraded = true;
        state.healthy = true;            // 本地数据仍可用，非致命错误
        state.mode = 'local';
        if (!state._adapterRef) state._adapterRef = state.adapter;
        state.adapter = null;            // 摘除云端，避免每轮轮询重复报错
        startReprobe();                  // 退避后自动重连
        paint();
    }

    function reprobeCloud() {
        var adapter = state._adapterRef || window.StarTorchCloud || null;
        if (!adapter) { startReprobe(); return; }
        state.adapter = adapter;
        state.mode = 'cloud';
        doSync();
    }

    function startReprobe() {
        stopReprobe();
        reprobeTimer = setTimeout(function () {
            reprobeDelay = Math.min(reprobeDelay * 1.5, REPROBE_MAX);
            reprobeCloud();
        }, reprobeDelay);
    }

    function stopReprobe() {
        if (reprobeTimer) { clearTimeout(reprobeTimer); reprobeTimer = null; }
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
    function getCloudLastError() {
        if (state.adapter && typeof state.adapter.getLastError === 'function') {
            try { return state.adapter.getLastError(); } catch(_) { return null; }
        }
        return null;
    }

    function getStatus() {
        return {
            mode: state.mode,
            lastSync: state.lastSync,
            lastSyncText: fmtTime(state.lastSync),
            hasRemoteUpdate: state.hasRemoteUpdate,
            syncing: state.syncing,
            healthy: state.healthy,
            cloudDegraded: state.cloudDegraded,
            auto: state.auto,
            pending: getPending(),
            lastError: getCloudLastError()
        };
    }

    function syncNow() {
        /* 降级态下手动重试：恢复云端适配器引用并重置退避，立即重连 */
        if (state.cloudDegraded && (state._adapterRef || window.StarTorchCloud)) {
            state.adapter = state._adapterRef || window.StarTorchCloud;
            state.mode = 'cloud';
            stopReprobe();
            reprobeDelay = REPROBE_BASE;
        }
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

        createEdgeIndicator();

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

    /* ---------- 右下角悬浮边缘同步指示器（与飞行雪绒主站一致） ---------- */
    function createEdgeIndicator() {
        if (document.getElementById('stf-edge-indicator')) return;
        var wrap = document.createElement('div');
        wrap.id = 'stf-edge-indicator';
        wrap.className = 'stf-edge-indicator';
        wrap.setAttribute('role', 'status');
        wrap.setAttribute('aria-live', 'polite');

        var status = document.createElement('div');
        status.className = 'stf-edge-status';

        var dot = document.createElement('span');
        dot.className = 'stf-edge-dot is-ok';
        dot.id = 'stf-edge-dot';

        var text = document.createElement('span');
        text.className = 'stf-edge-text';
        text.id = 'stf-edge-text';
        text.textContent = statusText();

        status.appendChild(dot);
        status.appendChild(text);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'stf-edge-btn';
        btn.className = 'stf-edge-btn';
        btn.setAttribute('aria-label', '立即同步数据');
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
        btn.addEventListener('click', function () { syncNow(); });

        wrap.appendChild(status);
        wrap.appendChild(btn);
        document.body.appendChild(wrap);

        onStatus(updateEdgeIndicator);
        updateEdgeIndicator(getStatus());
    }

    function updateEdgeIndicator(s) {
        var dot = document.getElementById('stf-edge-dot');
        var txt = document.getElementById('stf-edge-text');
        var btn = document.getElementById('stf-edge-btn');
        if (!s) s = getStatus();
        if (dot) {
            var cls = 'stf-edge-dot';
            if (!s.healthy) cls += ' is-error';
            else if (s.cloudDegraded) cls += ' is-offline';
            else if (s.syncing || s.hasRemoteUpdate) cls += ' is-syncing';
            else cls += ' is-ok';
            dot.className = cls;
        }
        if (txt) {
            if (!s.healthy) txt.textContent = '同步异常 · 点击重试';
            else if (s.cloudDegraded) {
                var hint = s.lastError && s.lastError.stage ? (' · ' + s.lastError.stage + ' 失败') : '';
                txt.textContent = '本地正常 · 点击重试' + hint;
            }
            else if (s.syncing || s.hasRemoteUpdate) txt.textContent = '同步中…';
            else if (s.mode === 'cloud') txt.textContent = '云端已连接';
            else txt.textContent = '本地模式';
        }
        if (btn) {
            btn.classList.toggle('syncing', !!(s.syncing || s.hasRemoteUpdate));
        }
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
