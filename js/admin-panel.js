/**
 * AdminPanel — 版主/管理员后台（举报队列 + 操作日志）
 * 飞行雪绒 v9.3
 */
var AdminPanel = (function() {

    function canAccess() {
        if (typeof AdminAuth !== 'undefined' && AdminAuth.isAdmin()) return true;
        if (typeof AuthManager !== 'undefined') {
            var role = AuthManager.session.role;
            return role === 'moderator' || role === 'admin';
        }
        return false;
    }

    function openPanel() {
        if (!canAccess()) {
            if (typeof showSubmitToast === 'function') {
                showSubmitToast('需要版主或管理员权限', 3000);
            }
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
    }

    function refreshPanel() {
        var reportsEl = document.getElementById('admin-reports-list');
        var logsEl = document.getElementById('admin-logs-list');
        if (!reportsEl || !logsEl) return;

        reportsEl.innerHTML = '<li class="admin-loading">加载中…</li>';
        logsEl.innerHTML = '<li class="admin-loading">加载中…</li>';

        if (typeof SupabaseAdapter === 'undefined' || !SupabaseAdapter.getModerationLogs) {
            reportsEl.innerHTML = '<li class="admin-empty">云端未就绪</li>';
            logsEl.innerHTML = '<li class="admin-empty">云端未就绪</li>';
            return;
        }

        SupabaseAdapter.getModerationLogs(40).then(function(rows) {
            rows = rows || [];
            var reports = rows.filter(function(r) { return r.action === 'report'; });
            var ops = rows.filter(function(r) { return r.action !== 'report'; });

            if (reports.length === 0) {
                reportsEl.innerHTML = '<li class="admin-empty">暂无待处理举报</li>';
            } else {
                reportsEl.innerHTML = reports.map(function(r) {
                    return '<li class="admin-log-item admin-report-item">' +
                        '<span class="admin-log-action">举报 · ' + escapeHtml(r.target_type) + ' #' + r.target_id + '</span>' +
                        '<span class="admin-log-reason">' + escapeHtml(r.reason || '') + '</span>' +
                        '<span class="admin-log-time">' + formatTime(r.created_at) + '</span>' +
                        '<div class="admin-report-actions">' +
                        '<button type="button" class="admin-action-btn" data-mod-type="' + r.target_type + '" data-mod-id="' + r.target_id + '" data-mod-action="hide">隐藏</button>' +
                        '</div></li>';
                }).join('');
                bindModActions(reportsEl);
            }

            if (ops.length === 0) {
                logsEl.innerHTML = '<li class="admin-empty">暂无操作记录</li>';
            } else {
                logsEl.innerHTML = ops.map(function(r) {
                    return '<li class="admin-log-item">' +
                        '<span class="admin-log-action">' + escapeHtml(r.action) + ' · ' + escapeHtml(r.target_type) + ' #' + (r.target_id || '-') + '</span>' +
                        '<span class="admin-log-reason">' + escapeHtml(r.reason || '') + '</span>' +
                        '<span class="admin-log-time">' + formatTime(r.created_at) + '</span></li>';
                }).join('');
            }
        }).catch(function() {
            reportsEl.innerHTML = '<li class="admin-empty">加载失败</li>';
            logsEl.innerHTML = '<li class="admin-empty">加载失败</li>';
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
                        if (typeof renderCommunity === 'function') renderCommunity();
                        document.querySelectorAll('.comment-area').forEach(function(area) {
                            var tid = area.id.replace('comments-', '');
                            if (typeof renderComments === 'function') renderComments(tid);
                        });
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
        } catch (e) {
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
