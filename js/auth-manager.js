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

    var PROFILE_CACHE_KEY = 'fxre_profile_cache';

    var session = {
        uid: null,
        role: 'anonymous',      // anonymous / user / moderator / admin
        isAnonymous: true,
        email: null,
        nickname: null,
        avatarColor: null,
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
        var authorId = comment.authorId || comment.author_id;
        // 注册用户：作者是自己
        if (session.uid && authorId === session.uid) return true;
        // 匿名用户：有删除令牌
        if (comment.id && session.deleteTokens[comment.id]) return true;
        // 版主以上
        if (session.role === 'moderator' || session.role === 'admin') return true;
        return false;
    }

    function canDeleteSubmission(submission) {
        if (!submission) return false;
        var authorId = submission.authorId || submission.author_id;
        if (session.uid && authorId === session.uid) return true;
        if (session.deleteTokens[submission.id]) return true;
        if (session.role === 'moderator' || session.role === 'admin') return true;
        return false;
    }

    function canEditSubmission(submission) {
        if (!submission) return false;
        var EDIT_MS = 24 * 60 * 60 * 1000;
        var created = submission.time || submission.createdAt;
        if (created && (Date.now() - created) > EDIT_MS) return false;
        var authorId = submission.authorId || submission.author_id;
        if (session.uid && authorId === session.uid) return true;
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
            /* 已绑邮箱即视为「非纯匿名」（可能仍待邮件确认） */
            session.isAnonymous = !user.email;

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

    function mapAuthError(err) {
        var msg = (err && (err.message || err.msg)) || String(err || '未知错误');
        var lower = msg.toLowerCase();
        if (lower.indexOf('already') >= 0 || lower.indexOf('registered') >= 0 || lower.indexOf('exists') >= 0) {
            return '该邮箱已被注册，请改用「登录」';
        }
        if (lower.indexOf('invalid login') >= 0 || lower.indexOf('invalid credentials') >= 0) {
            return '邮箱或密码不正确';
        }
        if (lower.indexOf('email not confirmed') >= 0 || lower.indexOf('not confirmed') >= 0) {
            return '请先点击邮箱里的确认链接';
        }
        if (lower.indexOf('rate') >= 0 || lower.indexOf('too many') >= 0) {
            return '操作过于频繁，请稍后再试';
        }
        if (lower.indexOf('password') >= 0 && lower.indexOf('6') >= 0) {
            return '密码至少 6 位';
        }
        return msg;
    }

    function needsEmailConfirm(user) {
        if (!user || !user.email) return false;
        return !(user.email_confirmed_at || user.confirmed_at);
    }

    // ---- 匿名→注册升级 ----

    function upgradeToRegistered(email, password) {
        if (!window.supabaseClient) {
            return Promise.resolve({ success: false, error: '云端未连接' });
        }

        return supabaseClient.auth.updateUser({
            email: email,
            password: password
        }).then(function(result) {
            if (result.error) {
                return { success: false, error: mapAuthError(result.error) };
            }

            // UID 不变，comments/submissions 中的 author_id 自动关联
            updateSession(result.data.user);
            var pending = needsEmailConfirm(result.data.user);

            return {
                success: true,
                user: result.data.user,
                needsConfirmation: pending,
                message: pending
                    ? '升级成功！请查收确认邮件后完成验证'
                    : '账号升级成功'
            };
        }).catch(function(err) {
            return { success: false, error: mapAuthError(err) };
        });
    }

    function signIn(email, password) {
        if (!window.supabaseClient) {
            return Promise.resolve({ success: false, error: '云端未连接' });
        }

        return supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        }).then(function(result) {
            if (result.error) {
                return { success: false, error: mapAuthError(result.error) };
            }
            updateSession(result.data.user);
            return {
                success: true,
                user: result.data.user,
                needsConfirmation: needsEmailConfirm(result.data.user)
            };
        }).catch(function(err) {
            return { success: false, error: mapAuthError(err) };
        });
    }

    function signOut() {
        if (!window.supabaseClient) {
            return Promise.resolve({ success: false, error: '云端未连接' });
        }

        return supabaseClient.auth.signOut().then(function(result) {
            if (result.error) {
                return { success: false, error: mapAuthError(result.error) };
            }
            updateSession(null);
            /* 退出后重新匿名登录，保证仍可发评 */
            return supabaseClient.auth.signInAnonymously().then(function(anon) {
                if (anon.error) {
                    return { success: true, user: null, warning: mapAuthError(anon.error) };
                }
                updateSession(anon.data.user);
                return { success: true, user: anon.data.user };
            });
        }).catch(function(err) {
            return { success: false, error: mapAuthError(err) };
        });
    }

    function resendConfirmation(email) {
        if (!window.supabaseClient) {
            return Promise.resolve({ success: false, error: '云端未连接' });
        }
        var target = email || session.email;
        if (!target) {
            return Promise.resolve({ success: false, error: '没有可重发的邮箱' });
        }

        return supabaseClient.auth.resend({
            type: 'signup',
            email: target
        }).then(function(result) {
            if (result.error) {
                return { success: false, error: mapAuthError(result.error) };
            }
            return { success: true, message: '确认邮件已重新发送，请查收' };
        }).catch(function(err) {
            return { success: false, error: mapAuthError(err) };
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

    // ---- profiles 昵称（跨设备身份） ----

    function getCachedProfile() {
        try {
            var cached = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || '{}');
            if (cached.nickname) return cached;
        } catch (e) { /* ignore */ }
        return { nickname: null, avatar_color: null };
    }

    function cacheProfile(profile) {
        if (!profile) return;
        try {
            localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
                nickname: profile.nickname || null,
                avatar_color: profile.avatar_color || profile.avatarColor || null,
                updated_at: Date.now()
            }));
        } catch (e) { /* ignore */ }
    }

    function fetchProfile() {
        var cached = getCachedProfile();
        if (!window.supabaseClient || !session.uid) {
            if (cached.nickname) {
                session.nickname = cached.nickname;
                session.avatarColor = cached.avatar_color;
            }
            return Promise.resolve(cached);
        }

        return supabaseClient
            .from('profiles')
            .select('nickname, avatar_color')
            .eq('id', session.uid)
            .single()
            .then(function(result) {
                if (result.error || !result.data) {
                    if (cached.nickname) {
                        session.nickname = cached.nickname;
                        session.avatarColor = cached.avatar_color;
                    }
                    return cached;
                }
                var profile = {
                    nickname: result.data.nickname || null,
                    avatar_color: result.data.avatar_color || '#6B8AFF'
                };
                if (profile.nickname && profile.nickname !== '匿名信号源') {
                    session.nickname = profile.nickname;
                    session.avatarColor = profile.avatar_color;
                    cacheProfile(profile);
                }
                return profile;
            })
            .catch(function() {
                return cached;
            });
    }

    function saveNickname(nickname) {
        if (!nickname) return Promise.resolve(false);
        nickname = nickname.trim().substring(0, 50);
        if (!nickname || nickname === '匿名信号源') return Promise.resolve(false);

        session.nickname = nickname;
        cacheProfile({ nickname: nickname, avatar_color: session.avatarColor });

        if (!window.supabaseClient || !session.uid) {
            return Promise.resolve(true);
        }

        return supabaseClient
            .from('profiles')
            .update({ nickname: nickname })
            .eq('id', session.uid)
            .then(function(result) {
                if (result.error) {
                    console.warn('[AuthManager] saveNickname:', result.error.message);
                    return false;
                }
                return true;
            })
            .catch(function(err) {
                console.warn('[AuthManager] saveNickname failed:', err);
                return false;
            });
    }

    function resetPassword(email) {
        if (!window.supabaseClient) {
            return Promise.reject(new Error('Supabase 未连接'));
        }
        email = (email || '').trim();
        if (!email) {
            return Promise.resolve({ success: false, error: '请先填写邮箱' });
        }

        var base = window.location.href.replace(/[#?].*$/, '').replace(/[^/]+$/, '');
        var redirectTo = base + 'reset-password.html';

        return supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: redirectTo
        }).then(function(result) {
            if (result.error) {
                return { success: false, error: mapAuthError(result.error) };
            }
            return {
                success: true,
                message: '重置邮件已发送，请查收邮箱（含垃圾箱）'
            };
        }).catch(function(err) {
            return { success: false, error: mapAuthError(err) };
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
        canEditSubmission: canEditSubmission,
        canHideComment: canHideComment,
        canDeletePermanently: canDeletePermanently,
        canBatchModerate: canBatchModerate,
        canCreateBookmark: canCreateBookmark,
        canManageTags: canManageTags,
        isBanned: isBanned,
        updateSession: updateSession,
        upgradeToRegistered: upgradeToRegistered,
        signIn: signIn,
        signOut: signOut,
        resendConfirmation: resendConfirmation,
        needsEmailConfirm: needsEmailConfirm,
        mapAuthError: mapAuthError,
        linkOAuth: linkOAuth,
        fetchRole: fetchRole,
        fetchProfile: fetchProfile,
        saveNickname: saveNickname,
        getCachedProfile: getCachedProfile,
        resetPassword: resetPassword
    };
})();
