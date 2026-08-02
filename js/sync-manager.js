/**
 * SyncManager — Realtime 实时同步 + 轮询降级
 * 飞行雪绒 v9.5
 *
 * 职责:
 *   - Realtime Channel 管理（INSERT/UPDATE/DELETE 全事件）
 *   - per-target 回调（多评论区互不覆盖）
 *   - 断连自动降级轮询
 *   - 右下角同步状态指示器 + 可点击同步按钮
 */

var SyncManager = (function() {

    var STATE = {
        REALTIME: 'realtime',
        POLLING: 'polling',
        OFFLINE: 'offline',
        RECONNECTING: 'reconnecting',
        SYNCING: 'syncing'
    };

    var state = STATE.OFFLINE;
    var reconnectAttempts = 0;
    var maxReconnect = 5;
    var pollInterval = null;
    var pollIntervalMs = 15000;
    /* R1: 按评论区分别维护最近同步时间，避免跨 target 共享导致轮询去重错乱 */
    var lastSyncByTarget = {};
    var statusCallbacks = {};
    var subscriptions = {};
    function _ls(targetId) { return lastSyncByTarget[targetId] || new Date(0).toISOString(); }
    /** @type {Object.<string, {onNewComment, onUpdateComment, onDeleteComment}>} */
    var targetCallbacks = {};
    var submissionCallbacks = {};
    var lastSyncResult = null;
    var onManualSync = null;
    var onStateChange = null;

    function setState(newState) {
        if (state === newState) return;
        var oldState = state;
        state = newState;
        updateSyncIndicator(newState);
        if (typeof onStateChange === 'function') {
            onStateChange(newState, oldState);
        }
    }

    function getState() {
        return state;
    }

    function getCommentTargetIds() {
        var ids = [];
        Object.keys(targetCallbacks).forEach(function(id) {
            if (id !== 'submissions') ids.push(id);
        });
        return ids;
    }

    function invokeHandler(targetId, handlerName, arg1, arg2) {
        var h = targetCallbacks[targetId];
        if (h && typeof h[handlerName] === 'function') {
            h[handlerName](arg1, arg2);
        }
    }

    function connectComments(targetId, handlers) {
        if (!window.supabaseClient) {
            setState(STATE.OFFLINE);
            return;
        }

        targetCallbacks[targetId] = handlers || {};

        if (subscriptions[targetId]) {
            return;
        }

        var channel = supabaseClient
            .channel('public:comments:' + targetId)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'comments',
                filter: 'target_id=eq.' + targetId
            }, function(payload) {
                invokeHandler(targetId, 'onNewComment', payload.new);
                lastSyncByTarget[targetId] = new Date().toISOString();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'comments',
                filter: 'target_id=eq.' + targetId
            }, function(payload) {
                invokeHandler(targetId, 'onUpdateComment', payload.new, payload.old);
                lastSyncByTarget[targetId] = new Date().toISOString();
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'comments',
                filter: 'target_id=eq.' + targetId
            }, function(payload) {
                invokeHandler(targetId, 'onDeleteComment', payload.old);
            })
        var onStatus = function(status) {
            if (status === 'SUBSCRIBED') {
                setState(STATE.REALTIME);
                reconnectAttempts = 0;
                stopPolling();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                setState(STATE.POLLING);
                startPolling();
            } else if (status === 'CLOSED') {
                setState(STATE.RECONNECTING);
                attemptReconnect(targetId);
            }
        };
        statusCallbacks[targetId] = onStatus;
        channel.subscribe(onStatus);

        subscriptions[targetId] = channel;
    }

    function disconnectComments(targetId) {
        if (subscriptions[targetId]) {
            supabaseClient.removeChannel(subscriptions[targetId]);
            delete subscriptions[targetId];
        }
        delete targetCallbacks[targetId];
    }

    function disconnectAll() {
        Object.keys(subscriptions).forEach(function(key) {
            if (key === 'submissions') {
                supabaseClient.removeChannel(subscriptions[key]);
                delete subscriptions[key];
            } else {
                disconnectComments(key);
            }
        });
        stopPolling();
        setState(STATE.OFFLINE);
    }

    function attemptReconnect(targetId) {
        if (reconnectAttempts >= maxReconnect) {
            setState(STATE.POLLING);
            startPolling();
            return;
        }

        var delay = Math.pow(2, reconnectAttempts) * 1000;
        reconnectAttempts++;

        setTimeout(function() {
            /* v10.1: supabase-js v2 同一 channel 实例只允许 subscribe 一次
               （重复调用会抛 "tried to subscribe multiple times"），
               重连必须移除旧实例并重建 channel，而不是对旧实例二次 subscribe */
            if (subscriptions[targetId]) {
                try { supabaseClient.removeChannel(subscriptions[targetId]); } catch (e) {}
                delete subscriptions[targetId];
            }
            if (targetId === 'submissions') {
                var subHandlers = submissionCallbacks;
                submissionCallbacks = null;
                connectSubmissions(subHandlers);
            } else {
                var commentHandlers = targetCallbacks[targetId];
                delete targetCallbacks[targetId];
                connectComments(targetId, commentHandlers);
            }
        }, delay);
    }

    function startPolling() {
        stopPolling();

        pollInterval = setInterval(function() {
            if (!window.SupabaseAdapter || !SupabaseAdapter.isReady) return;

            getCommentTargetIds().forEach(function(targetId) {
                SupabaseAdapter.fetchComments(targetId).then(function(comments) {
                    if (!comments) return;  /* null = 读取出错，跳过本轮防误删 */
                    var since = _ls(targetId);

                    /* R4: 若提供批量回调，则全量对账（新增/编辑/删除一并处理） */
                    var h = targetCallbacks[targetId];
                    if (h && typeof h.onBulkComments === 'function') {
                        h.onBulkComments(comments);
                        var bulkMax = since;
                        comments.forEach(function(c) {
                            var ct = c.created_at || new Date(0).toISOString();
                            if (ct > bulkMax) bulkMax = ct;
                        });
                        lastSyncByTarget[targetId] = bulkMax;
                        return;
                    }

                    /* 兼容旧契约：仅检测新增 */
                    var maxTime = since;
                    comments.forEach(function(c) {
                        var cTime = c.created_at || new Date(0).toISOString();
                        if (new Date(cTime) > new Date(since)) {
                            invokeHandler(targetId, 'onNewComment', c);
                        }
                        if (cTime > maxTime) maxTime = cTime;
                    });
                    lastSyncByTarget[targetId] = maxTime;
                }).catch(function(err) {
                    console.warn('[SyncManager] Polling error:', err);
                });
            });

            /* v10.1: 投稿轮询降级——此前轮询只覆盖评论区，投稿通道断连后
               其他设备的新投稿/删除永远不会同步（getCommentTargetIds 排除 submissions） */
            if (typeof submissionCallbacks.onPollSubmissions === 'function') {
                SupabaseAdapter.getSubmissions().then(function(subs) {
                    if (!subs) return;  /* null = 读取出错，跳过本轮 */
                    submissionCallbacks.onPollSubmissions(subs);
                }).catch(function(err) {
                    console.warn('[SyncManager] Submissions polling error:', err);
                });
            }
        }, pollIntervalMs);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    function manualRefresh(targetId) {
        if (!window.SupabaseAdapter || !SupabaseAdapter.isReady) {
            return Promise.resolve([]);
        }
        return SupabaseAdapter.fetchComments(targetId).then(function(comments) {
            lastSyncByTarget[targetId] = new Date().toISOString();
            return comments || [];
        });
    }

    function refreshAllCommentTargets() {
        var ids = getCommentTargetIds();
        if (!ids.length) return Promise.resolve([]);
        return Promise.all(ids.map(function(id) { return manualRefresh(id); }));
    }

    function connectSubmissions(handlers) {
        if (!window.supabaseClient) return;

        submissionCallbacks = handlers || {};

        if (subscriptions['submissions']) return;

        var channel = supabaseClient
            .channel('public:submissions')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'submissions'
            }, function(payload) {
                if (typeof submissionCallbacks.onNewSubmission === 'function') {
                    submissionCallbacks.onNewSubmission(payload.new);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'submissions'
            }, function(payload) {
                if (typeof submissionCallbacks.onUpdateSubmission === 'function') {
                    submissionCallbacks.onUpdateSubmission(payload.new, payload.old);
                }
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'submissions'
            }, function(payload) {
                if (typeof submissionCallbacks.onDeleteSubmission === 'function') {
                    submissionCallbacks.onDeleteSubmission(payload.old);
                }
            });

        /* R3: 投稿通道同样需要状态回调——断连时降级轮询/重连，与评论通道一致 */
        var onStatus = function(status) {
            if (status === 'SUBSCRIBED') {
                setState(STATE.REALTIME);
                reconnectAttempts = 0;
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                setState(STATE.POLLING);
                startPolling();
            } else if (status === 'CLOSED') {
                setState(STATE.RECONNECTING);
                attemptReconnect('submissions');
            }
        };
        statusCallbacks['submissions'] = onStatus;
        channel.subscribe(onStatus);

        subscriptions['submissions'] = channel;
    }

    function setLastSyncResult(result) {
        lastSyncResult = result;
        updateSyncIndicator(state);
    }

    function getLastSyncResult() {
        return lastSyncResult;
    }

    function refreshPendingIndicator() {
        updateSyncIndicator(state);
    }

    function buildSyncTitle(s, pending) {
        var parts = [];
        var stateLabels = {
            syncing: '正在同步',
            realtime: '实时同步已连接',
            polling: '轮询同步模式',
            offline: '未连接云端',
            reconnecting: '正在重连'
        };
        parts.push(stateLabels[s] || '未知状态');
        if (pending > 0) {
            parts.push('待同步 ' + pending + ' 条（点击同步按钮重试）');
        }
        if (lastSyncResult) {
            if (lastSyncResult.failed > 0) {
                parts.push('上次失败 ' + lastSyncResult.failed + ' 条');
                if (lastSyncResult.errorMsg) parts.push(lastSyncResult.errorMsg);
            } else if (lastSyncResult.uploaded > 0) {
                parts.push('上次成功上传 ' + lastSyncResult.uploaded + ' 条');
            }
            if (lastSyncResult.quotaSkipped > 0) {
                parts.push('配额满跳过 ' + lastSyncResult.quotaSkipped + ' 条');
            }
        }
        if (s === 'offline' && window.SupabaseAdapter) {
            var st = SupabaseAdapter.getStatus();
            if (st.error) parts.push(st.error);
        }
        return parts.join(' · ');
    }

    function updateSyncIndicator(s) {
        var indicator = document.getElementById('sync-indicator');
        if (!indicator) return;

        var pending = (window.SupabaseAdapter && SupabaseAdapter.getStatus)
            ? SupabaseAdapter.getStatus().pending : 0;

        var config = {
            syncing:     { dot: 'sync-dot-syncing', text: '\u540c\u6b65\u4e2d\u2026', class: 'sync-syncing' },
            realtime:    { dot: 'sync-dot-live', text: '\u5b9e\u65f6\u540c\u6b65', class: 'sync-live' },
            polling:     { dot: 'sync-dot-poll', text: '\u8f6e\u8be2\u540c\u6b65', class: 'sync-poll' },
            offline:     { dot: 'sync-dot-off', text: '\u672a\u8fde\u63a5', class: 'sync-off' },
            reconnecting:{ dot: 'sync-dot-syncing', text: '\u91cd\u8fde\u4e2d', class: 'sync-conn' }
        };

        var c = config[s] || config.offline;
        var pendingHint = pending > 0 ? ' · 待同步 ' + pending + ' 条' : '';
        var resultHint = '';
        if (lastSyncResult && lastSyncResult.time) {
            if (lastSyncResult.failed > 0) {
                resultHint = ' · 失败' + lastSyncResult.failed;
            } else if (lastSyncResult.uploaded > 0 || lastSyncResult.pulled) {
                resultHint = ' · 已同步';
            }
        }

        indicator.className = 'sync-indicator ' + c.class;
        indicator.title = buildSyncTitle(s, pending);
        var statusEl = indicator.querySelector('.sync-status-text');
        if (statusEl) {
            statusEl.innerHTML = '<span class="sync-dot ' + c.dot + '" aria-hidden="true"></span>' +
                '<span class="sync-text">' + c.text + pendingHint + resultHint + '</span>';
        }
    }

    function createSyncIndicator() {
        if (document.getElementById('sync-indicator')) return;

        var div = document.createElement('div');
        div.id = 'sync-indicator';
        div.className = 'sync-indicator sync-off';
        div.innerHTML =
            '<div class="sync-status-text">' +
                '<span class="sync-dot sync-dot-off" aria-hidden="true"></span>' +
                '<span class="sync-text">\u672a\u8fde\u63a5</span>' +
            '</div>' +
            '<button type="button" class="sync-indicator-btn" id="sync-indicator-btn" title="立即同步：上传待发送 + 拉取云端最新" aria-label="立即同步"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></button>';

        var btn = div.querySelector('#sync-indicator-btn');
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof onManualSync === 'function') onManualSync(btn);
        });

        div.querySelector('.sync-status-text').addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof onManualSync === 'function') onManualSync(btn);
        });

        document.body.appendChild(div);
    }

    function setManualSyncHandler(fn) {
        onManualSync = fn;
    }

    return {
        STATE: STATE,
        connectComments: connectComments,
        disconnectComments: disconnectComments,
        disconnectAll: disconnectAll,
        connectSubmissions: connectSubmissions,
        manualRefresh: manualRefresh,
        refreshAllCommentTargets: refreshAllCommentTargets,
        getState: getState,
        createSyncIndicator: createSyncIndicator,
        updateSyncIndicator: updateSyncIndicator,
        setLastSyncResult: setLastSyncResult,
        getLastSyncResult: getLastSyncResult,
        refreshPendingIndicator: refreshPendingIndicator,
        setManualSyncHandler: setManualSyncHandler,
        setState: setState
    };
})();
