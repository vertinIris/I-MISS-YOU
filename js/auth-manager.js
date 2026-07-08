/**
 * AuthManager — 认证与权限管理模块
 * 飞行雪绒 v9.0
 *
 * 职责:
 *   - 会话状态管理（匿名/注册/版主/管理员）
 *   - 删除令牌生成与校验
 *   - 匿名→注册平滑升级
 *   - 角色权限判定
 */

var AuthManager = (function() {

    var session = {
        uid: null,
        role: 'anonymous',      // anonymous / user / moderator / admin
        isAnonymous: true,
        email: null,
        deleteTokens: {}        // { commentId: token, submissionId: token }
    };

    // ---- 初始化 ----

    function init() {
        // 从 localStorage 恢复删除令牌
        try {
            session.deleteTokens = JSON.parse(
                localStorage.getItem('fxre_delete_tokens') || '{}'
            );
        } catch(e) {
            session.deleteTokens = {};
        }

        // 恢复会话缓存
        try {
            var cached = JSON.parse(
                localStorage.getItem('fxre_auth_session') || '{}'
            );
            if (cached.uid) {
                session.uid = cached.uid;
                session.role = cached.role || 'user';
                session.isAnonymous = cached.isAnonymous !== false;
                session.email = cached.email || null;
            }
        } catch(e) { /* ignore */ }
    }

    // ---- 删除令牌管理 ----

    function generateToken() {
        // UUID v4 生成
        if (window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID();
        }
        // Fallback
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0;
            var v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function storeDeleteToken(targetId, token) {
        session.deleteTokens[targetId] = token;
        try {
            localStorage.setItem('fxre_delete_tokens',
                JSON.stringify(session.deleteTokens));
        } catch(e) { /* quota exceeded */ }
    }

    function getDeleteToken(targetId) {
        return session.deleteTokens[targetId] || null;
    }

    function removeDeleteToken(targetId) {
        delete session.deleteTokens[targetId];
        try {
            localStorage.setItem('fxre_delete_tokens',
                JSON.stringify(session.deleteTokens));
        } catch(e) { /* ignore */ }
    }

    // ---- 权限判定 ----

    function canDeleteComment(comment) {
        if (!comment) return false;
        // 注册用户：作者是自己
        if (session.uid && comment.author_id === session.uid) return true;
        // 匿名用户：有删除令牌
        if (session.deleteTokens[comment.id]) return true;
        // 版主以上
        if (session.role === 'moderator' || session.role === 'admin') return true;
        return false;
    }

    function canDeleteSubmission(submission) {
        if (!submission) return false;
        if (session.uid && submission.author_id === session.uid) return true;
        if (session.deleteTokens[submission.id]) return true;
        if (session.role === 'moderator' || session.role === 'admin') return true;
        return false;
    }

    function canHideComment() {
        return session.role === 'moderator' || session.role === 'admin';
    }

    function canDeletePermanently() {
        return session.role === 'admin';
    }

    function canBatchModerate() {
        return session.role === 'admin';
    }

    function canCreateBookmark() {
        return session.role !== 'anonymous';
    }

    function canManageTags() {
        return session.role === 'moderator' || session.role === 'admin';
    }

    function isBanned() {
        return session.isBanned === true;
    }

    // ---- 会话更新 ----

    function updateSession(user) {
        if (!user) {
            session.uid = null;
            session.role = 'anonymous';
            session.isAnonymous = true;
            session.email = null;
        } else {
            session.uid = user.id;
            session.email = user.email || null;
            session.isAnonymous = user.is_anonymous !== false;

            // 从 user metadata 获取角色
            var role = 'user';
            if (user.user_metadata && user.user_metadata.role) {
                role = user.user_metadata.role;
            }
            session.role = role;
        }

        // 缓存到 localStorage
        try {
            localStorage.setItem('fxre_auth_session', JSON.stringify({
                uid: session.uid,
                role: session.role,
                isAnonymous: session.isAnonymous,
                email: session.email
            }));
        } catch(e) { /* ignore */ }
    }

    // ---- 匿名→注册升级 ----

    function upgradeToRegistered(email, password) {
        if (!window.supabaseClient) {
            return Promise.reject(new Error('Supabase 未连接'));
        }

        return supabaseClient.auth.updateUser({
            email: email,
            password: password
        }).then(function(result) {
            if (result.error) throw result.error;

            // UID 不变，comments/submissions 中的 author_id 自动关联
            // delete_token 仍然有效（向后兼容）
            updateSession(result.data.user);

            return { success: true, user: result.data.user };
        });
    }

    function linkOAuth(provider) {
        if (!window.supabaseClient) {
            return Promise.reject(new Error('Supabase 未连接'));
        }

        return supabaseClient.auth.linkIdentity({
            provider: provider
        }).then(function(result) {
            if (result.error) throw result.error;
            return { success: true };
        });
    }

    // ---- 获取角色（从 profiles 表） ----

    function fetchRole() {
        if (!window.supabaseClient || !session.uid) {
            return Promise.resolve('anonymous');
        }

        return supabaseClient
            .from('profiles')
            .select('role, is_banned, banned_until, ban_reason')
            .eq('id', session.uid)
            .single()
            .then(function(result) {
                if (result.error || !result.data) return 'anonymous';

                session.role = result.data.role || 'user';
                session.isBanned = result.data.is_banned || false;

                // 检查封禁是否已过期
                if (session.isBanned && result.data.banned_until) {
                    if (new Date(result.data.banned_until) < new Date()) {
                        session.isBanned = false;
                    }
                }

                session.banReason = result.data.ban_reason || '';

                // 更新缓存
                try {
                    localStorage.setItem('fxre_auth_session', JSON.stringify({
                        uid: session.uid,
                        role: session.role,
                        isAnonymous: session.isAnonymous,
                        email: session.email
                    }));
                } catch(e) { /* ignore */ }

                return session.role;
            });
    }

    // ---- 导出 ----

    return {
        init: init,
        session: session,
        generateToken: generateToken,
        storeDeleteToken: storeDeleteToken,
        getDeleteToken: getDeleteToken,
        removeDeleteToken: removeDeleteToken,
        canDeleteComment: canDeleteComment,
        canDeleteSubmission: canDeleteSubmission,
        canHideComment: canHideComment,
        canDeletePermanently: canDeletePermanently,
        canBatchModerate: canBatchModerate,
        canCreateBookmark: canCreateBookmark,
        canManageTags: canManageTags,
        isBanned: isBanned,
        updateSession: updateSession,
        upgradeToRegistered: upgradeToRegistered,
        linkOAuth: linkOAuth,
        fetchRole: fetchRole
    };
})();
