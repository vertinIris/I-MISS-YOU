/**
 * SyncManager — Realtime 实时同步 + 轮询降级
 * 飞行雪绒 v9.1
 *
 * 职责:
 *   - Realtime Channel 管理（INSERT/UPDATE/DELETE 全事件）
 *   - 断连自动降级轮询
 *   - 指数退避重连
 *   - 右下角同步状态指示器 + 可点击同步按钮
 *   - 评论/投稿双通道订阅
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
    var lastSyncTime = new Date(0).toISOString();
    var subscriptions = {};
    var callbacks = {};
    var lastSyncResult = null;
    var onManualSync = null;

    function setState(newState) {
        if (state === newState) return;
        var oldState = state;
        state = newState;
        updateSyncIndicator(newState);

        if (typeof callbacks.onStateChange === 'function') {
            callbacks.onStateChange(newState, oldState);
        }
    }

    function getState() {
        return state;
    }

    function getCommentTargetIds() {
        var ids = [];
        document.querySelectorAll('.comment-area').forEach(function(area) {
            if (area.id && area.id.indexOf('comments-') === 0) {
                ids.push(area.id.replace('comments-', ''));
            }
        });
        return ids;
    }

    // ---- 评论 Realtime 订阅 ----

    function connectComments(targetId, handlers) {
        if (!window.supabaseClient) {
            setState(STATE.OFFLINE);
            return;
        }

        callbacks.onNewComment = handlers.onNewComment;
        callbacks.onUpdateComment = handlers.onUpdateComment;
        callbacks.onDeleteComment = handlers.onDeleteComment;

        disconnectComments(targetId);

        var channel = supabaseClient
            .channel('public:comments:' + targetId)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'comments',
                filter: 'target_id=eq.' + targetId
            }, function(payload) {
                if (typeof callbacks.onNewComment === 'function') {
                    callbacks.onNewComment(payload.new);
                }
                lastSyncTime = new Date().toISOString();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'comments',
                filter: 'target_id=eq.' + targetId
            }, function(payload) {
                if (typeof callbacks.onUpdateComment === 'function') {
                    callbacks.onUpdateComment(payload.new, payload.old);
                }
                lastSyncTime = new Date().toISOString();
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'comments',
                filter: 'target_id=eq.' + targetId
            }, function(payload) {
                if (typeof callbacks.onDeleteComment === 'function') {
                    callbacks.onDeleteComment(payload.old);
                }
            })
            .subscribe(function(status) {
                if (status === 'SUBSCRIBED') {
                    setState(STATE.REALTIME);
                    reconnectAttempts = 0;
                    stopPolling();
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setState(STATE.POLLING);
                    startPolling(targetId);
                } else if (status === 'CLOSED') {
                    setState(STATE.RECONNECTING);
                    attemptReconnect(targetId);
                }
            });

        subscriptions[targetId] = channel;
    }

    function disconnectComments(targetId) {
        if (subscriptions[targetId]) {
            supabaseClient.removeChannel(subscriptions[targetId]);
            delete subscriptions[targetId];
        }
    }

    function disconnectAll() {
        Object.keys(subscriptions).forEach(function(key) {
            disconnectComments(key);
        });
        stopPolling();
        setState(STATE.OFFLINE);
    }

    function attemptReconnect(targetId) {
        if (reconnectAttempts >= maxReconnect) {
            setState(STATE.POLLING);
            startPolling(targetId);
            return;
        }

        var delay = Math.pow(2, reconnectAttempts) * 1000;
        reconnectAttempts++;

        setTimeout(function() {
            if (subscriptions[targetId]) {
                subscriptions[targetId].subscribe();
            }
        }, delay);
    }

    function startPolling(targetId) {
        stopPolling();

        pollInterval = setInterval(function() {
            if (!window.SupabaseAdapter || !SupabaseAdapter.isReady) return;

            SupabaseAdapter.fetchComments(targetId).then(function(comments) {
                if (!comments || comments.length === 0) return;

                var maxTime = lastSyncTime;
                comments.forEach(function(c) {
                    var cTime = c.created_at || new Date(0).toISOString();
                    if (new Date(cTime) > new Date(lastSyncTime)) {
                        if (typeof callbacks.onNewComment === 'function') {
                            callbacks.onNewComment(c);
                        }
                    }
                    if (cTime > maxTime) maxTime = cTime;
                });
                lastSyncTime = maxTime;
            }).catch(function(err) {
                console.warn('[SyncManager] Polling error:', err);
            });
        }, pollIntervalMs);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    /**
     * 刷新单个 target 的评论（从云端拉取）
     */
    function manualRefresh(targetId) {
        if (!window.SupabaseAdapter || !SupabaseAdapter.isReady) {
            return Promise.resolve([]);
        }

        var fetchFn = SupabaseAdapter.fetchComments.bind(SupabaseAdapter);
        return fetchFn(targetId).then(function(comments) {
            lastSyncTime = new Date().toISOString();
            return comments || [];
        });
    }

    /**
     * 刷新页面上所有评论区
     */
    function refreshAllCommentTargets() {
        var ids = getCommentTargetIds();
        if (!ids.length) return Promise.resolve([]);

        return Promise.all(ids.map(function(id) {
            return manualRefresh(id);
        }));
    }

    function connectSubmissions(handlers) {
        if (!window.supabaseClient) return;

        callbacks.onNewSubmission = handlers.onNewSubmission;
        callbacks.onUpdateSubmission = handlers.onUpdateSubmission;

        var channel = supabaseClient
            .channel('public:submissions')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'submissions'
            }, function(payload) {
                if (typeof callbacks.onNewSubmission === 'function') {
                    callbacks.onNewSubmission(payload.new);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'submissions'
            }, function(payload) {
                if (typeof callbacks.onUpdateSubmission === 'function') {
                    callbacks.onUpdateSubmission(payload.new, payload.old);
                }
            })
            .subscribe();

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
            parts.push('待同步 ' + pending + ' 条（点击 🔄 重试）');
        }
        if (lastSyncResult) {
            if (lastSyncResult.failed > 0) {
                parts.push('上次失败 ' + lastSyncResult.failed + ' 条');
                if (lastSyncResult.errorMsg) parts.push(lastSyncResult.errorMsg);
            } else if (lastSyncResult.uploaded > 0) {
                parts.push('上次成功上传 ' + lastSyncResult.uploaded + ' 条');
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
            syncing:     { icon: '\uD83D\uDD04', text: '\u540c\u6b65\u4e2d\u2026', class: 'sync-syncing' },
            realtime:    { icon: '\uD83D\uDFE2', text: '\u5b9e\u65f6\u540c\u6b65', class: 'sync-live' },
            polling:     { icon: '\uD83D\uDFE1', text: '\u8f6e\u8be2\u540c\u6b65', class: 'sync-poll' },
            offline:     { icon: '\uD83D\uDD34', text: '\u672a\u8fde\u63a5', class: 'sync-off' },
            reconnecting:{ icon: '\uD83D\uDD04', text: '\u91cd\u8fde\u4e2d', class: 'sync-conn' }
        };

        var c = config[s] || config.offline;
        var pendingHint = pending > 0 ? ' · 待同步 ' + pending + ' 条' : '';
        var resultHint = '';
        if (lastSyncResult && lastSyncResult.time) {
            if (lastSyncResult.failed > 0) {
                resultHint = ' · 失败' + lastSyncResult.failed;
            } else if (lastSyncResult.uploaded > 0 || lastSyncResult.pulled) {
                resultHint = ' · ✓';
            }
        }

        indicator.className = 'sync-indicator ' + c.class;
        indicator.title = buildSyncTitle(s, pending);
        var statusEl = indicator.querySelector('.sync-status-text');
        if (statusEl) {
            statusEl.innerHTML = '<span class="sync-dot">' + c.icon + '</span>' +
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
                '<span class="sync-dot">\uD83D\uDD34</span>' +
                '<span class="sync-text">\u672a\u8fde\u63a5</span>' +
            '</div>' +
            '<button type="button" class="sync-indicator-btn" id="sync-indicator-btn" title="立即同步：上传待发送 + 拉取云端最新" aria-label="立即同步">\uD83D\uDD04</button>';

        var btn = div.querySelector('#sync-indicator-btn');
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof onManualSync === 'function') {
                onManualSync(btn);
            }
        });

        div.querySelector('.sync-status-text').addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof onManualSync === 'function') {
                onManualSync(btn);
            }
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
