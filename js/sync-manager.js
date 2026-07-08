/**
 * SyncManager — Realtime 实时同步 + 轮询降级
 * 飞行雪绒 v9.1
 *
 * 职责:
 *   - Realtime Channel 管理（INSERT/UPDATE/DELETE 全事件）
 *   - 断连自动降级轮询
 *   - 指数退避重连
 *   - 同步状态指示器 UI
 *   - 评论/投稿双通道订阅
 */

var SyncManager = (function() {

    var STATE = {
        REALTIME: 'realtime',
        POLLING: 'polling',
        OFFLINE: 'offline',
        RECONNECTING: 'reconnecting'
    };

    var state = STATE.OFFLINE;
    var reconnectAttempts = 0;
    var maxReconnect = 5;
    var pollInterval = null;
    var pollIntervalMs = 15000;  // 15秒
    var lastSyncTime = new Date(0).toISOString();
    var subscriptions = {};
    var callbacks = {};

    // ---- 状态管理 ----

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

    // ---- 评论 Realtime 订阅 ----

    function connectComments(targetId, handlers) {
        if (!window.supabaseClient) {
            setState(STATE.OFFLINE);
            return;
        }

        callbacks.onNewComment = handlers.onNewComment;
        callbacks.onUpdateComment = handlers.onUpdateComment;
        callbacks.onDeleteComment = handlers.onDeleteComment;

        // 如果已有该 targetId 的订阅，先取消
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

    // ---- 指数退避重连 ----

    function attemptReconnect(targetId) {
        if (reconnectAttempts >= maxReconnect) {
            setState(STATE.POLLING);
            startPolling(targetId);
            return;
        }

        var delay = Math.pow(2, reconnectAttempts) * 1000; // 1s/2s/4s/8s/16s
        reconnectAttempts++;

        setTimeout(function() {
            if (subscriptions[targetId]) {
                subscriptions[targetId].subscribe();
            }
        }, delay);
    }

    // ---- 轮询降级 ----

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

    // ---- 手动刷新 ----

    function manualRefresh(targetId) {
        if (!window.SupabaseAdapter || !SupabaseAdapter.isReady) {
            return Promise.resolve([]);
        }

        return SupabaseAdapter.fetchComments(targetId).then(function(comments) {
            if (comments && comments.length > 0) {
                comments.forEach(function(c) {
                    if (typeof callbacks.onNewComment === 'function') {
                        callbacks.onNewComment(c);
                    }
                });
                lastSyncTime = new Date().toISOString();
            }
            return comments;
        });
    }

    // ---- 投稿 Realtime 订阅 ----

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

    // ---- 同步状态指示器 UI ----

    function updateSyncIndicator(s) {
        var indicator = document.getElementById('sync-indicator');
        if (!indicator) return;

        var config = {
            realtime:    { icon: '\uD83D\uDD34', text: '\u5B9E\u65F6\u540C\u6B65', class: 'sync-live' },
            polling:     { icon: '\uD83D\uDFE1', text: '\u8F6E\u8BE2\u540C\u6B65', class: 'sync-poll' },
            offline:     { icon: '\uD83D\uDD34', text: '\u5DF2\u65AD\u5F00',   class: 'sync-off' },
            reconnecting:{ icon: '\uD83D\uDD04', text: '\u91CD\u8FDE\u4E2D',   class: 'sync-conn' }
        };

        var c = config[s] || config.offline;
        indicator.className = 'sync-indicator ' + c.class;
        indicator.innerHTML = '<span class="sync-dot">' + c.icon + '</span>' +
            '<span class="sync-text">' + c.text + '</span>';
    }

    function createSyncIndicator() {
        if (document.getElementById('sync-indicator')) return;

        var div = document.createElement('div');
        div.id = 'sync-indicator';
        div.className = 'sync-indicator sync-off';
        div.innerHTML = '<span class="sync-dot">\uD83D\uDD34</span><span class="sync-text">\u5DF2\u65AD\u5F00</span>';
        div.title = '\u70B9\u51FB\u624B\u52A8\u5237\u65B0';
        div.addEventListener('click', function() {
            // 手动刷新当前活跃的 targetId
            Object.keys(subscriptions).forEach(function(key) {
                if (key !== 'submissions') {
                    manualRefresh(key);
                }
            });
        });
        document.body.appendChild(div);
    }

    // ---- 导出 ----

    return {
        STATE: STATE,
        connectComments: connectComments,
        disconnectComments: disconnectComments,
        disconnectAll: disconnectAll,
        connectSubmissions: connectSubmissions,
        manualRefresh: manualRefresh,
        getState: getState,
        createSyncIndicator: createSyncIndicator,
        updateSyncIndicator: updateSyncIndicator
    };
})();
