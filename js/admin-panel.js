/**
 * AdminPanel — 版主/管理员后台 v9.6
 * 举报队列 · 评论审核（含批量）· 操作日志
 */
var AdminPanel = (function() {

    var activeTab = 'reports';
    var pendingComments = [];
    var selectedCommentIds = {};

    function canAccess() {
        if (typeof AdminAuth !== 'undefined' && AdminAuth.isAdmin()) return true;
        if (typeof AuthManager !== 'undefined') {
            var role = AuthManager.session.role;
            return role === 'moderator' || role === 'admin';
        }
        return false;
    }

    function isAdmin() {
        if (typeof AdminAuth !== 'undefined' && AdminAuth.isAdmin()) return true;
        return typeof AuthManager !== 'undefined' && AuthManager.session.role === 'admin';
    }

    function canBatch() {
        return typeof AuthManager !== 'undefined' && AuthManager.canBatchModerate
            ? AuthManager.canBatchModerate()
            : isAdmin();
    }

    function openPanel() {
        if (!canAccess()) {
            if (typeof showSubmitToast === 'function') showSubmitToast('需要版主或管理员权限', 3000);
            return;
        }
        var panel = document.getElementById('admin-panel');
        if (!panel) return;
        panel.hidden = false;
        refreshPanel();
    }

    function closePanel() {
        var panel = document.getElementById('admin-panel');
        if (panel) panel.hidden = true;
        selectedCommentIds = {};
    }

    function switchTab(tab) {
        activeTab = tab;
        document.querySelectorAll('.admin-tab').forEach(function(btn) {
            btn.classList.toggle('active', btn.getAttribute('data-admin-tab') === tab);
        });
        document.querySelectorAll('.admin-tab-panel').forEach(function(panel) {
            panel.hidden = panel.getAttribute('data-admin-tab') !== tab;
        });
        if (tab === 'comments') refreshCommentsTab();
        if (tab === 'reports') refreshReportsTab();
        if (tab === 'logs') refreshLogsTab();
    }

    function refreshPanel() {
        switchTab(activeTab);
    }

    function refreshReportsTab() {
        var reportsEl = document.getElementById('admin-reports-list');
        if (!reportsEl) return;
        reportsEl.innerHTML = '<li class="admin-loading">加载中…</li>';

        if (typeof SupabaseAdapter === 'undefined' || !SupabaseAdapter.getModerationLogs) {
            reportsEl.innerHTML = '<li class="admin-empty">云端未就绪</li>';
            return;
        }

        SupabaseAdapter.getModerationLogs(40).then(function(rows) {
            rows = rows || [];
            var reports = rows.filter(function(r) { return r.action === 'report'; });
            if (reports.length === 0) {
                reportsEl.innerHTML = '<li class="admin-empty">暂无待处理举报</li>';
                return;
            }
            reportsEl.innerHTML = reports.map(function(r) {
                return '<li class="admin-log-item admin-report-item">' +
                    '<span class="admin-log-action">举报 · ' + escapeHtml(r.target_type) + ' #' + r.target_id + '</span>' +
                    '<span class="admin-log-reason">' + escapeHtml(r.reason || '') + '</span>' +
                    '<span class="admin-log-time">' + formatTime(r.created_at) + '</span>' +
                    '<div class="admin-report-actions">' +
                    '<button type="button" class="admin-action-btn" data-mod-type="' + r.target_type + '" data-mod-id="' + r.target_id + '" data-mod-action="hide">隐藏</button>' +
                    (isAdmin() ? '<button type="button" class="admin-action-btn admin-action-danger" data-mod-type="' + r.target_type + '" data-mod-id="' + r.target_id + '" data-mod-action="delete">删除</button>' : '') +
                    '</div></li>';
            }).join('');
            bindModActions(reportsEl);
        }).catch(function() {
            reportsEl.innerHTML = '<li class="admin-empty">加载失败</li>';
        });
    }

    function refreshCommentsTab() {
        var listEl = document.getElementById('admin-comments-list');
        var batchBar = document.getElementById('admin-batch-bar');
        if (!listEl) return;

        listEl.innerHTML = '<li class="admin-loading">加载中…</li>';
        selectedCommentIds = {};
        if (batchBar) batchBar.hidden = true;

        if (typeof SupabaseAdapter === 'undefined' || !SupabaseAdapter.getRecentComments) {
            listEl.innerHTML = '<li class="admin-empty">云端未就绪</li>';
            return;
        }

        SupabaseAdapter.getRecentComments(60).then(function(rows) {
            pendingComments = rows || [];
            if (pendingComments.length === 0) {
                listEl.innerHTML = '<li class="admin-empty">暂无评论</li>';
                return;
            }
            listEl.innerHTML = pendingComments.map(function(c) {
                var preview = (c.content || '').substring(0, 80);
                var hiddenTag = c.is_hidden ? ' <span class="admin-tag-hidden">已隐藏</span>' : '';
                return '<li class="admin-log-item admin-comment-item">' +
                    '<label class="admin-comment-check">' +
                    '<input type="checkbox" class="admin-comment-cb" data-comment-id="' + c.id + '">' +
                    '<span class="admin-log-action">#' + c.id + ' · ' + escapeHtml(c.target_id) + hiddenTag + '</span>' +
                    '</label>' +
                    '<span class="admin-log-reason">' + escapeHtml(c.author_name || '') + '：' + escapeHtml(preview) + '</span>' +
                    '<span class="admin-log-time">' + formatTime(c.created_at) + '</span>' +
                    '<div class="admin-report-actions">' +
                    (c.is_hidden
                        ? '<button type="button" class="admin-action-btn" data-comment-id="' + c.id + '" data-comment-action="restore">恢复</button>'
                        : '<button type="button" class="admin-action-btn" data-comment-id="' + c.id + '" data-comment-action="hide">隐藏</button>') +
                    (isAdmin() ? '<button type="button" class="admin-action-btn admin-action-danger" data-comment-id="' + c.id + '" data-comment-action="delete">删除</button>' : '') +
                    '</div></li>';
            }).join('');

            listEl.querySelectorAll('.admin-comment-cb').forEach(function(cb) {
                cb.addEventListener('change', function() {
                    var id = parseInt(cb.getAttribute('data-comment-id'), 10);
                    if (cb.checked) selectedCommentIds[id] = true;
                    else delete selectedCommentIds[id];
                    updateBatchBar();
                });
            });

            listEl.querySelectorAll('[data-comment-action]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var id = parseInt(btn.getAttribute('data-comment-id'), 10);
                    var action = btn.getAttribute('data-comment-action');
                    if (!id || !action) return;
                    btn.disabled = true;
                    SupabaseAdapter.moderateComment(id, action, '管理后台').then(function(ok) {
                        btn.disabled = false;
                        if (ok) {
                            showSubmitToast('已处理', 2000);
                            refreshCommentsTab();
                            refreshAllCommentUIs();
                        } else {
                            showSubmitToast('处理失败', 3000);
                        }
                    });
                });
            });
        }).catch(function() {
            listEl.innerHTML = '<li class="admin-empty">加载失败</li>';
        });
    }

    function updateBatchBar() {
        var batchBar = document.getElementById('admin-batch-bar');
        if (!batchBar) return;
        var count = Object.keys(selectedCommentIds).length;
        batchBar.hidden = count === 0 || !canBatch();
        var countEl = document.getElementById('admin-batch-count');
        if (countEl) countEl.textContent = String(count);
    }

    function runBatchAction(action) {
        if (!canBatch()) {
            showSubmitToast('仅管理员可批量操作', 3000);
            return;
        }
        var ids = Object.keys(selectedCommentIds).map(function(k) { return parseInt(k, 10); });
        if (!ids.length) return;
        if (!confirm('确定对 ' + ids.length + ' 条评论执行「' + action + '」？')) return;

        SupabaseAdapter.batchModerateComments(ids, action, '批量操作').then(function(result) {
            result = result || {};
            if (typeof showSubmitToast === 'function') {
                showSubmitToast('成功 ' + (result.success || 0) + ' 条，失败 ' + (result.failed || 0) + ' 条', 4000);
            }
            selectedCommentIds = {};
            refreshCommentsTab();
            refreshAllCommentUIs();
        });
    }

    function refreshLogsTab() {
        var logsEl = document.getElementById('admin-logs-list');
        if (!logsEl) return;
        logsEl.innerHTML = '<li class="admin-loading">加载中…</li>';

        if (typeof SupabaseAdapter === 'undefined' || !SupabaseAdapter.getModerationLogs) {
            logsEl.innerHTML = '<li class="admin-empty">云端未就绪</li>';
            return;
        }

        SupabaseAdapter.getModerationLogs(50).then(function(rows) {
            rows = rows || [];
            var ops = rows.filter(function(r) { return r.action !== 'report'; });
            if (ops.length === 0) {
                logsEl.innerHTML = '<li class="admin-empty">暂无操作记录</li>';
                return;
            }
            logsEl.innerHTML = ops.map(function(r) {
                return '<li class="admin-log-item">' +
                    '<span class="admin-log-action">' + escapeHtml(r.action) + ' · ' + escapeHtml(r.target_type) + ' #' + (r.target_id || '-') + '</span>' +
                    '<span class="admin-log-reason">' + escapeHtml(r.reason || '') + '</span>' +
                    '<span class="admin-log-time">' + formatTime(r.created_at) + '</span></li>';
            }).join('');
        }).catch(function() {
            logsEl.innerHTML = '<li class="admin-empty">加载失败</li>';
        });
    }

    function refreshAllCommentUIs() {
        if (typeof renderCommunity === 'function') renderCommunity();
        document.querySelectorAll('.comment-area').forEach(function(area) {
            var tid = area.id.replace('comments-', '');
            if (typeof renderComments === 'function') renderComments(tid);
        });
    }

    function bindModActions(container) {
        container.querySelectorAll('.admin-action-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var type = btn.getAttribute('data-mod-type');
                var id = parseInt(btn.getAttribute('data-mod-id'), 10);
                var action = btn.getAttribute('data-mod-action');
                if (!id || !type) return;
                btn.disabled = true;

                var promise;
                if (type === 'comment') {
                    promise = SupabaseAdapter.moderateComment(id, action, '管理后台处理');
                } else if (type === 'submission') {
                    promise = SupabaseAdapter.moderateSubmission(id, action, '管理后台处理');
                } else {
                    btn.disabled = false;
                    return;
                }

                promise.then(function(ok) {
                    btn.disabled = false;
                    if (ok) {
                        if (typeof showSubmitToast === 'function') showSubmitToast('已处理', 2000);
                        refreshPanel();
                        refreshAllCommentUIs();
                    } else {
                        if (typeof showSubmitToast === 'function') showSubmitToast('处理失败', 3000);
                    }
                });
            });
        });
    }

    function escapeHtml(text) {
        if (typeof escapeHTML === 'function') return escapeHTML(String(text || ''));
        var div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function formatTime(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            return (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
                String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        } catch(_) {
            return '';
        }
    }

    function updateNavButton() {
        var btn = document.getElementById('admin-panel-open-btn');
        if (!btn) return;
        btn.hidden = !canAccess();
    }

    function init() {
        var openBtn = document.getElementById('admin-panel-open-btn');
        var closeBtn = document.getElementById('admin-panel-close-btn');
        var panel = document.getElementById('admin-panel');
        if (openBtn) openBtn.addEventListener('click', openPanel);
        if (closeBtn) closeBtn.addEventListener('click', closePanel);
        if (panel) {
            panel.addEventListener('click', function(e) {
                if (e.target === panel) closePanel();
            });
        }
        document.querySelectorAll('.admin-tab').forEach(function(tabBtn) {
            tabBtn.addEventListener('click', function() {
                switchTab(tabBtn.getAttribute('data-admin-tab'));
            });
        });
        document.querySelectorAll('[data-batch-action]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                runBatchAction(btn.getAttribute('data-batch-action'));
            });
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && panel && !panel.hidden) closePanel();
        });
        updateNavButton();
    }

    return {
        init: init,
        open: openPanel,
        close: closePanel,
        refresh: refreshPanel,
        canAccess: canAccess,
        updateNavButton: updateNavButton
    };
})();
