/**
 * 飞行雪绒 — Supabase 适配器模块
 * Phase 3: 封装 Supabase 客户端，提供云端数据访问
 *
 * 依赖: supabase-js SDK (通过 <script> 全局注入)
 * 配置: 在 SupabaseDashboard 创建项目后，填入下方 CONFIG
 */

(function() {
    'use strict';

    /* ================================================================
     * 配置区 — 部署前必须替换为实际项目值
     * ================================================================ */
    var CONFIG = {
        /* Supabase 项目 URL — Dashboard → Settings → API → Project URL */
        url: 'https://lmlyfyjffaaddysiliht.supabase.co',

        /* 匿名公钥 (anon key) — 可公开，RLS 在数据库层控制权限 */
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtbHlmeWpmZmFhZGR5c2lsaWh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDQ4OTYsImV4cCI6MjA5ODUyMDg5Nn0.PESEQk_gwuqa-djkjB3HsNCViQA561ifVfd5LtJLt4E',

        /* 功能开关：true 启用云端同步 */
        enabled: true
    };

    /* 运行时状态 */
    var client     = null;
    var isReady    = false;
    var initError  = null;
    var currentUser = null;
    var AUTH_TIMEOUT = 12000;  /* 认证超时 12 秒 */

    /* 本地待同步队列（离线上传） */
    var PENDING_KEY = 'fxre_pending_sync';

    function savePendingQueue() {
        try {
            localStorage.setItem(PENDING_KEY, JSON.stringify(pendingSync));
            return true;
        } catch (e) {
            console.warn('[SupabaseAdapter] pending 队列持久化失败:', e.message || e);
            return false;
        }
    }

    function isQuotaError(msg) {
        if (!msg) return false;
        msg = String(msg);
        return msg.indexOf('配额已满') >= 0 || msg.indexOf('quota') >= 0;
    }

    function pendingItemKey(item) {
        if (item.action === 'addComment') {
            return item.action + '::' + item.targetId + '::' + (item.comment && item.comment.text) + '::' + (item.timestamp || '');
        }
        if (item.action === 'addSubmission') {
            return item.action + '::' + (item.submission && item.submission.title) + '::' + (item.timestamp || '');
        }
        return item.action + '::' + (item.timestamp || '');
    }

    function queuePending(item) {
        if (!item) return;
        var key = pendingItemKey(item);
        for (var i = 0; i < pendingSync.length; i++) {
            if (pendingItemKey(pendingSync[i]) === key) return;
        }
        pendingSync.push(item);
        savePendingQueue();
    }

    function loadPendingQueue() {
        try {
            var raw = localStorage.getItem(PENDING_KEY);
            if (raw) return JSON.parse(raw);
        } catch(e){}
        return [];
    }

    function clearPendingQueue() {
        pendingSync = [];
        try { localStorage.removeItem(PENDING_KEY); } catch(e){}
    }

    function dropQuotaBlockedFromQueue() {
        var before = pendingSync.length;
        pendingSync = pendingSync.filter(function(item) { return !item._quotaBlocked; });
        if (pendingSync.length !== before) savePendingQueue();
    }

    var pendingSync = loadPendingQueue();

    /* 投稿类型：前端英文 key ↔ 数据库中文 CHECK 约束 */
    var TYPE_TO_DB = {
        text:  '文字',
        story: '故事',
        poem:  '诗歌',
        art:   '插画',
        music: '音乐'
    };
    var TYPE_FROM_DB = {
        '文字': 'text',
        '故事': 'story',
        '诗歌': 'poem',
        '插画': 'art',
        '音乐': 'music'
    };

    function toDbType(type) {
        if (!type) return type;
        return TYPE_TO_DB[type] || type;
    }

    function fromDbType(type) {
        if (!type) return type;
        return TYPE_FROM_DB[type] || type;
    }

    /* ================================================================
     * 初始化
     * ================================================================ */

    /**
     * 等待 Supabase SDK 加载就绪（async 脚本可能尚未完成）
     * @param {number} timeoutMs
     * @returns {Promise<boolean>}
     */
    function waitForSDK(timeoutMs) {
        if (window.supabase && window.supabase.createClient) {
            return Promise.resolve(true);
        }
        if (window.__supabaseLoadFailed) {
            return Promise.resolve(false);
        }
        var deadline = Date.now() + (timeoutMs || 8000);
        return new Promise(function(resolve) {
            var timer = setInterval(function() {
                if (window.supabase && window.supabase.createClient) {
                    clearInterval(timer);
                    resolve(true);
                } else if (window.__supabaseLoadFailed || Date.now() > deadline) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 200);
        });
    }

    /**
     * 初始化 Supabase 客户端
     * @param {Object} opts — { url, anonKey }
     * @returns {Promise<boolean>}
     */
    function init(opts) {
        if (opts) {
            if (opts.url)     CONFIG.url     = opts.url;
            if (opts.anonKey) CONFIG.anonKey = opts.anonKey;
            if (opts.enabled !== undefined) CONFIG.enabled = opts.enabled;
        }

        if (!CONFIG.enabled) {
            return Promise.resolve(false);
        }

        if (!CONFIG.url || CONFIG.url === '__SUPABASE_URL__') {
            initError = 'Supabase URL 未配置';
            console.warn('[SupabaseAdapter]', initError);
            return Promise.resolve(false);
        }

        /* 等待 async 加载的 Supabase SDK */
        return waitForSDK(10000).then(function(sdkReady) {
            if (!sdkReady) {
                initError = 'supabase-js SDK 未加载（CDN 超时或网络不通）';
                console.warn('[SupabaseAdapter]', initError);
                return false;
            }

            try {
                client = window.supabase.createClient(CONFIG.url, CONFIG.anonKey, {
                    auth: {
                        autoRefreshToken: true,
                        persistSession: true,
                        detectSessionInUrl: false
                    }
                });
                isReady = true;
                window.supabaseClient = client;  /* 暴露给 auth-manager / sync-manager / upload-manager */
                console.log('[SupabaseAdapter] 初始化成功');
            } catch(e) {
                initError = e.message;
                console.warn('[SupabaseAdapter] 初始化失败:', e.message);
                return false;
            }

            /* 监听认证变化，保持 currentUser 与 session 一致（邮箱注册/升级后必需） */
            client.auth.onAuthStateChange(function(event, session) {
                if (session && session.user) {
                    currentUser = session.user;
                } else if (event === 'SIGNED_OUT') {
                    currentUser = null;
                }
            });

            /* 自动执行匿名登录（带超时） */
            return ensureAuthWithTimeout().then(function(user) {
                if (!user) {
                    initError = '匿名登录未完成（请确认 Supabase Dashboard 已启用 Anonymous Sign-ins）';
                }
                /* 登录结果不影响页面，继续尝试同步离线数据 */
                return syncPendingQueue().then(function() { return true; });
            }).catch(function() {
                return true; /* 认证失败不阻塞页面 */
            });
        });
    }

    /**
     * 从 Supabase session 刷新 currentUser（手动同步 / 注册升级后调用）
     */
    function refreshSession() {
        if (!isReady || !client) return Promise.resolve(null);
        return client.auth.getSession().then(function(result) {
            if (result.data && result.data.session) {
                currentUser = result.data.session.user;
                return currentUser;
            }
            currentUser = null;
            return null;
        });
    }

    /* ================================================================
     * 认证
     * ================================================================ */

    function ensureAuth() {
        if (!isReady) return Promise.resolve(null);

        return client.auth.getSession().then(function(result) {
            if (result.data && result.data.session) {
                currentUser = result.data.session.user;
                return currentUser;
            }
            /* 无现有会话 → 匿名登录 */
            return client.auth.signInAnonymously().then(function(signInResult) {
                if (signInResult.error) {
                    console.warn('[SupabaseAdapter] 匿名登录失败:', signInResult.error.message);
                    return null;
                }
                currentUser = signInResult.data.user;
                console.log('[SupabaseAdapter] 匿名登录成功, uid:', currentUser.id);
                return currentUser;
            });
        });
    }

    /**
     * 带超时的匿名认证
     * 避免弱网环境下无限等待阻塞页面
     */
    function ensureAuthWithTimeout() {
        return new Promise(function(resolve) {
            var settled = false;
            var timer = setTimeout(function() {
                if (!settled) {
                    settled = true;
                    console.warn('[SupabaseAdapter] 认证超时 (' + AUTH_TIMEOUT/1000 + 's)，跳过云端认证');
                    resolve(null);
                }
            }, AUTH_TIMEOUT);

            ensureAuth().then(function(user) {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve(user);
                }
            }).catch(function(err) {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    console.warn('[SupabaseAdapter] 认证异常:', err.message);
                    resolve(null);
                }
            });
        });
    }

    function getCurrentUser() {
        return currentUser;
    }

    function isAuthenticated() {
        return isReady && currentUser !== null;
    }

    /* ================================================================
     * 评论 CRUD
     * ================================================================ */

    /**
     * 获取指定目标的评论列表
     * @param {string} targetId — 如 'post_1', 'diary_1'
     * @returns {Promise<Array>}
     */
    function getComments(targetId, opts) {
        if (!isReady) return Promise.resolve([]);
        opts = opts || {};

        var query = client
            .from('comments')
            .select('*')
            .eq('target_id', targetId)
            .order('created_at', { ascending: true });

        if (opts.limit != null) {
            var offset = opts.offset || 0;
            query = query.range(offset, offset + opts.limit - 1);
        }

        return query.then(function(result) {
            if (result.error) {
                /* v10.1: 出错返回 null（区别于"真的为空"），
                   使调用方在瞬时故障时不会把本地数据误判为"云端已删"而误剔除 */
                console.warn('[SupabaseAdapter] getComments 失败:', result.error.message);
                return null;
            }
            return result.data || [];
        });
    }

    function getRecentComments(limit) {
        if (!isReady) return Promise.resolve([]);

        return client
            .from('comments')
            .select('id, target_id, author_name, content, is_hidden, created_at')
            .order('created_at', { ascending: false })
            .limit(limit || 50)
            .then(function(result) {
                if (result.error) {
                    console.warn('[SupabaseAdapter] getRecentComments:', result.error.message);
                    return [];
                }
                return result.data || [];
            });
    }

    /**
     * 添加一条评论
     * @param {string} targetId
     * @param {Object} comment — { author, color, text }
     * @returns {Promise<Object|null>} 返回创建后的评论对象或 null
     */
    function addComment(targetId, comment, extraFields) {
        if (!isReady) {
            queuePending({
                action: 'addComment',
                targetId: targetId,
                comment: comment,
                extraFields: extraFields,
                timestamp: new Date().toISOString()
            });
            return Promise.resolve(null);
        }

        function doInsert() {
            var insertData = {
                target_id:    targetId,
                author_id:    currentUser ? currentUser.id : null,
                author_name:  comment.author || '匿名信号源',
                author_color: comment.color  || '#6B8AFF',
                content:      comment.text
            };
            /* v9.0: 附带删除令牌（匿名用户） */
            if (extraFields && extraFields.delete_token) {
                insertData.delete_token = extraFields.delete_token;
            }
            if (extraFields && extraFields.parent_id) {
                insertData.parent_id = extraFields.parent_id;
            }
            return client
                .from('comments')
                .insert(insertData)
                .select()
                .single()
                .then(function(result) {
                    if (result.error) {
                        var errMsg = result.error.message || '未知错误';
                        console.warn('[SupabaseAdapter] addComment 失败:', errMsg);
                        if (!isQuotaError(errMsg)) {
                            queuePending({
                                action: 'addComment',
                                targetId: targetId,
                                comment: comment,
                                extraFields: extraFields,
                                timestamp: new Date().toISOString()
                            });
                        }
                        return { _error: errMsg, _quota: isQuotaError(errMsg) };
                    }
                    return result.data;
                });
        }

        /* 未登录时先尝试匿名登录 */
        if (!currentUser) {
            return ensureAuth().then(function(user) {
                if (!user) {
                    queuePending({
                        action: 'addComment',
                        targetId: targetId,
                        comment: comment,
                        extraFields: extraFields,
                        timestamp: new Date().toISOString()
                    });
                    return null;
                }
                return doInsert();
            });
        }

        return doInsert();
    }

    /**
     * 删除一条评论
     * v10.1: 软删(UPDATE is_hidden)改为物理 DELETE——
     *   软删后的行不满足 SELECT 策略(is_hidden=FALSE)，Realtime 服务器会丢弃该 UPDATE 事件，
     *   其他设备永远收不到删除通知；物理 DELETE 的 OLD 记录通过 RLS 校验，事件正常广播。
     *   RLS comments_auth_delete 仅允许作者删自己的评论，服务端权限不变。
     * @param {number} commentId
     * @returns {Promise<boolean>}
     */
    function deleteComment(commentId) {
        if (!isReady) return Promise.resolve(false);

        return client
            .from('comments')
            .delete()
            .eq('id', commentId)
            .select('id')
            .then(function(result) {
                if (result.error) {
                    console.warn('[SupabaseAdapter] deleteComment 失败:', result.error.message);
                    return false;
                }
                return !!(result.data && result.data.length);
            });
    }

    /**
     * 获取所有评论（归档用）
     * @returns {Promise<Object>} 按 targetId 分组的评论对象
     */
    function getAllComments() {
        if (!isReady) return Promise.resolve({});

        return client
            .from('comments')
            .select('*')
            .order('created_at', { ascending: true })
            .then(function(result) {
                if (result.error) return {};
                var grouped = {};
                (result.data || []).forEach(function(c) {
                    if (!grouped[c.target_id]) grouped[c.target_id] = [];
                    grouped[c.target_id].push({
                        id:      c.id,
                        author:  c.author_name,
                        color:   c.author_color,
                        text:    c.content,
                        time:    c.created_at
                    });
                });
                return grouped;
            });
    }

    /* ================================================================
     * 投稿 CRUD
     * ================================================================ */

    /**
     * 获取投稿列表
     * @param {string} typeFilter — 可选类型筛选
     * @returns {Promise<Array>}
     */
    function getSubmissions(typeFilter, opts) {
        if (!isReady) return Promise.resolve([]);
        opts = opts || {};

        /* R2: join submission_tags 以返回 AO3 标签，修复云端投稿标签筛选失效 */
        var query = client
            .from('submissions')
            .select('*, submission_tags(tag_id, tags(id, name, category, color))')
            .order('created_at', { ascending: false });

        if (typeFilter && typeFilter !== '全部') {
            query = query.eq('type', toDbType(typeFilter));
        }
        if (opts.limit != null) {
            var offset = opts.offset || 0;
            query = query.range(offset, offset + opts.limit - 1);
        }

        return query.then(function(result) {
            if (result.error) {
                /* v10.1: 出错返回 null（区别于"真的为空"），避免上层误剔除本地数据 */
                console.warn('[SupabaseAdapter] getSubmissions 失败:', result.error.message);
                return null;
            }
            return (result.data || []).map(function(s) {
                return {
                    id:       s.id,
                    type:     fromDbType(s.type),
                    title:    s.title,
                    content:  s.content,
                    name:     s.author_name,
                    color:    s.author_color,
                    likes:    s.likes,
                    time:     s.created_at,
                    authorId: s.author_id || '',
                    is_hidden: s.is_hidden === true,
                    tags:     (s.submission_tags || []).map(function(st) {
                        return st && st.tags ? st.tags.name : null;
                    }).filter(Boolean)
                };
            });
        });
    }

    /**
     * 添加一篇投稿
     * @param {Object} submission — { type, title, content, name, color }
     * @returns {Promise<Object|null>}
     */
    function addSubmission(submission, extraFields) {
        if (!isReady) {
            queuePending({
                action: 'addSubmission',
                submission: submission,
                extraFields: extraFields,
                timestamp: new Date().toISOString()
            });
            return Promise.resolve(null);
        }

        function doInsert() {
            var insertData = {
                type:         toDbType(submission.type),
                title:        submission.title,
                content:      submission.content,
                author_id:    currentUser ? currentUser.id : null,
                author_name:  submission.name  || '匿名信号源',
                author_color: submission.color || '#6B8AFF'
            };
            /* v9.0: 附带删除令牌 */
            if (extraFields && extraFields.delete_token) {
                insertData.delete_token = extraFields.delete_token;
            }
            return client
                .from('submissions')
                .insert(insertData)
                .select()
                .single()
                .then(function(result) {
                    if (result.error) {
                        var errMsg = result.error.message || '未知错误';
                        console.warn('[SupabaseAdapter] addSubmission 失败:', errMsg);
                        if (!isQuotaError(errMsg)) {
                            queuePending({
                                action: 'addSubmission',
                                submission: submission,
                                extraFields: extraFields,
                                timestamp: new Date().toISOString()
                            });
                        }
                        return { _error: errMsg, _quota: isQuotaError(errMsg) };
                    }
                    return {
                        id:      result.data.id,
                        type:    fromDbType(result.data.type),
                        title:   result.data.title,
                        content: result.data.content,
                        name:    result.data.author_name,
                        color:   result.data.author_color,
                        likes:   result.data.likes,
                        time:    result.data.created_at
                    };
                });
        }

        /* 未登录时先尝试匿名登录 */
        if (!currentUser) {
            return ensureAuth().then(function(user) {
                if (!user) {
                    queuePending({
                        action: 'addSubmission',
                        submission: submission,
                        timestamp: new Date().toISOString()
                    });
                    return null;
                }
                return doInsert();
            });
        }

        return doInsert();
    }

    /**
     * 点赞投稿
     * @param {number} submissionId
     * @returns {Promise<number>} 返回新的点赞数
     */
    function likeSubmission(submissionId) {
        if (!isReady) return Promise.resolve(0);

        return client.rpc('increment_submission_likes', { submission_id: submissionId })
            .then(function(result) {
                if (result.error) return 0;
                return result.data || 0;
            });
    }

    /**
     * 取消点赞投稿（G-10 修复）
     * @param {number} submissionId
     * @returns {Promise<number>} 返回新的点赞数
     */
    function unlikeSubmission(submissionId) {
        if (!isReady) return Promise.resolve(0);

        return client.rpc('decrement_submission_likes', { submission_id: submissionId })
            .then(function(result) {
                if (result.error) return 0;
                return result.data || 0;
            });
    }

    /* ================================================================
     * 实时订阅
     * ================================================================ */

    var activeChannels = {};

    /**
     * 订阅某个目标的评论变更
     * @param {string} targetId
     * @param {Function} onInsert — 新评论回调
     * @param {Function} onDelete — 删除评论回调
     */
    function subscribeComments(targetId, onInsert, onDelete) {
        if (!isReady) return;

        /* 避免重复订阅 */
        if (activeChannels[targetId]) {
            client.removeChannel(activeChannels[targetId]);
        }

        var channel = client
            .channel('comments:' + targetId)
            .on('postgres_changes',
                {
                    event:  '*',
                    schema: 'public',
                    table:  'comments',
                    filter: 'target_id=eq.' + targetId
                },
                function(payload) {
                    if (payload.eventType === 'INSERT' && onInsert) {
                        onInsert(payload.new);
                    }
                    if (payload.eventType === 'DELETE' && onDelete) {
                        onDelete(payload.old);
                    }
                }
            )
            .subscribe();

        activeChannels[targetId] = channel;
    }

    /**
     * 取消订阅
     * @param {string} targetId
     */
    function unsubscribeComments(targetId) {
        if (activeChannels[targetId]) {
            client.removeChannel(activeChannels[targetId]);
            delete activeChannels[targetId];
        }
    }

    /**
     * 订阅新投稿
     */
    function subscribeSubmissions(onInsert) {
        if (!isReady) return;

        var channel = client
            .channel('submissions')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'submissions' },
                function(payload) { if (onInsert) onInsert(payload.new); }
            )
            .subscribe();

        activeChannels['_submissions'] = channel;
    }

    /* ================================================================
     * 离线同步队列
     * ================================================================ */

    function syncPendingQueue() {
        if (pendingSync.length === 0) {
            return Promise.resolve({ synced: 0, failed: 0, remaining: 0, errors: [] });
        }

        var batch = pendingSync.slice();
        var failed = [];
        var synced = 0;
        var quotaSkipped = 0;
        var errors = [];

        console.log('[SupabaseAdapter] 同步', batch.length, '条离线数据...');

        return refreshSession().then(function() {
            if (!currentUser) return ensureAuth();
        }).then(function() {
            return Promise.all(batch.map(function(item) {
                var task;
                if (item.action === 'addComment') {
                    task = addComment(item.targetId, item.comment, item.extraFields);
                } else if (item.action === 'addSubmission') {
                    task = addSubmission(item.submission, item.extraFields);
                } else {
                    return Promise.resolve({ ok: true });
                }

                return task.then(function(result) {
                    if (item.action === 'addComment') {
                        if (result && result._quota) {
                            quotaSkipped++;
                            return { ok: false, quota: true };
                        }
                        if (result && result._error) {
                            errors.push({ action: item.action, targetId: item.targetId, error: result._error });
                            if (!isQuotaError(result._error)) failed.push(item);
                            else quotaSkipped++;
                            return { ok: false };
                        }
                        if (!result || !result.id) {
                            failed.push(item);
                            return { ok: false };
                        }
                    } else if (item.action === 'addSubmission') {
                        if (result && result._quota) {
                            quotaSkipped++;
                            return { ok: false, quota: true };
                        }
                        if (result && result._error) {
                            errors.push({ action: item.action, error: result._error });
                            if (!isQuotaError(result._error)) failed.push(item);
                            else quotaSkipped++;
                            return { ok: false };
                        }
                        if (!result || !result.id) {
                            failed.push(item);
                            return { ok: false };
                        }
                    }
                    synced++;
                    return { ok: true };
                }).catch(function(err) {
                    var errMsg = err.message || String(err);
                    errors.push({ action: item.action, error: errMsg });
                    if (isQuotaError(errMsg)) quotaSkipped++;
                    else failed.push(item);
                    return { ok: false };
                });
            }));
        }).then(function() {
            pendingSync = failed;
            savePendingQueue();
            console.log('[SupabaseAdapter] 离线同步完成: 成功', synced, '失败', failed.length);
            return { synced: synced, failed: failed.length, remaining: failed.length, quotaSkipped: quotaSkipped, errors: errors };
        });
    }

    function getPendingCount() {
        return pendingSync.length;
    }

    /* ================================================================
     * v9.0 评论删除令牌 RPC
     * ================================================================ */

    function deleteCommentWithToken(commentId, deleteToken) {
        if (!isReady) return Promise.resolve(false);
        return client.rpc('delete_comment_with_token', {
            p_comment_id: commentId,
            p_delete_token: deleteToken
        }).then(function(result) {
            if (result.error) {
                console.error('[SupabaseAdapter] deleteCommentWithToken error:', result.error);
                return false;
            }
            return result.data || false;
        });
    }

    function deleteSubmissionWithToken(submissionId, deleteToken) {
        if (!isReady) return Promise.resolve({ success: false, reason: '云端未就绪' });
        return client.rpc('delete_submission_with_token', {
            p_submission_id: submissionId,
            p_delete_token: deleteToken || ''
        }).then(function(result) {
            if (result.error) {
                console.error('[SupabaseAdapter] deleteSubmissionWithToken error:', result.error);
                return { success: false, reason: result.error.message };
            }
            var data = result.data;
            if (typeof data === 'boolean') return { success: data };
            return data || { success: false, reason: '未知错误' };
        });
    }

    function updateSubmissionWithToken(submissionId, deleteToken, title, content) {
        if (!isReady) return Promise.resolve({ success: false, reason: '云端未就绪' });
        return client.rpc('update_submission_with_token', {
            p_submission_id: submissionId,
            p_delete_token: deleteToken,
            p_title: title,
            p_content: content
        }).then(function(result) {
            if (result.error) {
                console.error('[SupabaseAdapter] updateSubmissionWithToken error:', result.error);
                return { success: false, reason: result.error.message };
            }
            return result.data || { success: false, reason: '未知错误' };
        });
    }

    /* ================================================================
     * v9.0 版主/管理员操作 RPC
     * ================================================================ */

    function moderateComment(commentId, action, reason) {
        if (!isReady) return Promise.resolve(false);
        return client.rpc('moderate_comment', {
            p_comment_id: commentId,
            p_action: action,
            p_reason: reason || ''
        }).then(function(result) {
            if (result.error) {
                console.error('[SupabaseAdapter] moderateComment error:', result.error);
                return false;
            }
            return result.data || false;
        });
    }

    function moderateSubmission(submissionId, action, reason) {
        if (!isReady) return Promise.resolve(false);
        return client.rpc('moderate_submission', {
            p_submission_id: submissionId,
            p_action: action,
            p_reason: reason || ''
        }).then(function(result) {
            if (result.error) {
                console.error('[SupabaseAdapter] moderateSubmission error:', result.error);
                return false;
            }
            return result.data || false;
        });
    }

    function batchModerateComments(commentIds, action, reason) {
        if (!isReady) return Promise.resolve({ success: 0, failed: 0 });
        return client.rpc('batch_moderate_comments', {
            p_comment_ids: commentIds,
            p_action: action,
            p_reason: reason || ''
        }).then(function(result) {
            if (result.error) {
                console.error('[SupabaseAdapter] batchModerateComments error:', result.error);
                return { success: 0, failed: commentIds.length };
            }
            var row = Array.isArray(result.data) ? result.data[0] : result.data;
            if (row) {
                return {
                    success: Number(row.success_count != null ? row.success_count : row.success || 0),
                    failed: Number(row.failed_count != null ? row.failed_count : row.failed || 0)
                };
            }
            return { success: 0, failed: 0 };
        });
    }

    function upsertProfile(profile) {
        if (!isReady || !currentUser) return Promise.resolve(false);
        profile = profile || {};
        return client
            .from('profiles')
            .upsert({
                id: currentUser.id,
                nickname: profile.nickname || null,
                avatar_color: profile.avatar_color || '#6B8AFF'
            }, { onConflict: 'id' })
            .then(function(result) {
                if (result.error) {
                    console.warn('[SupabaseAdapter] upsertProfile:', result.error.message);
                    return false;
                }
                return true;
            });
    }

    function updateBookmarkCollection(collectionId, updates) {
        if (!isReady || !currentUser) return Promise.resolve(false);
        return client
            .from('bookmark_collections')
            .update(updates)
            .eq('id', collectionId)
            .eq('user_id', currentUser.id)
            .then(function(result) {
                if (result.error) {
                    console.warn('[SupabaseAdapter] updateBookmarkCollection:', result.error.message);
                    return false;
                }
                return true;
            });
    }

    function deleteBookmarkCollection(collectionId) {
        if (!isReady || !currentUser) return Promise.resolve(false);
        return client
            .from('bookmarks')
            .update({ collection_id: null })
            .eq('collection_id', collectionId)
            .then(function() {
                return client
                    .from('bookmark_collections')
                    .delete()
                    .eq('id', collectionId)
                    .eq('user_id', currentUser.id);
            })
            .then(function(result) {
                if (result.error) {
                    console.warn('[SupabaseAdapter] deleteBookmarkCollection:', result.error.message);
                    return false;
                }
                return true;
            });
    }

    /* ================================================================
     * v9.2 标签与收藏 RPC
     * ================================================================ */

    function toggleBookmark(submissionId, collectionId, note) {
        if (!isReady) return Promise.resolve({ success: false });
        return client.rpc('toggle_bookmark', {
            p_submission_id: submissionId,
            p_collection_id: collectionId || null,
            p_note: note || ''
        }).then(function(result) {
            if (result.error) {
                console.error('[SupabaseAdapter] toggleBookmark error:', result.error);
                return { success: false };
            }
            return result.data || { success: false };
        });
    }

    function getUserBookmarks() {
        if (!isReady || !currentUser) return Promise.resolve([]);

        return client
            .from('bookmarks')
            .select('id, submission_id, collection_id, note, created_at')
            .order('created_at', { ascending: false })
            .then(function(result) {
                if (result.error) {
                    console.warn('[SupabaseAdapter] getUserBookmarks:', result.error.message);
                    return [];
                }
                return result.data || [];
            });
    }

    function getUserBookmarkIds() {
        return getUserBookmarks().then(function(rows) {
            return rows.map(function(row) { return row.submission_id; });
        });
    }

    function getBookmarkCollections() {
        if (!isReady || !currentUser) return Promise.resolve([]);

        return client
            .from('bookmark_collections')
            .select('id, name, description, is_public, sort_order, created_at')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true })
            .then(function(result) {
                if (result.error) {
                    console.warn('[SupabaseAdapter] getBookmarkCollections:', result.error.message);
                    return [];
                }
                return result.data || [];
            });
    }

    function createBookmarkCollection(name, description) {
        if (!isReady || !currentUser) return Promise.resolve(null);

        return client
            .from('bookmark_collections')
            .insert({
                user_id: currentUser.id,
                name: (name || '未命名收藏夹').substring(0, 50),
                description: (description || '').substring(0, 200)
            })
            .select()
            .single()
            .then(function(result) {
                if (result.error) {
                    console.warn('[SupabaseAdapter] createBookmarkCollection:', result.error.message);
                    return null;
                }
                return result.data;
            });
    }

    function setBookmarkCollection(submissionId, collectionId) {
        if (!isReady || !currentUser) return Promise.resolve(false);

        return client
            .from('bookmarks')
            .update({ collection_id: collectionId || null })
            .eq('user_id', currentUser.id)
            .eq('submission_id', submissionId)
            .then(function(result) {
                if (result.error) {
                    console.warn('[SupabaseAdapter] setBookmarkCollection:', result.error.message);
                    return false;
                }
                return true;
            });
    }

    function setBookmarkCollectionPublic(collectionId, isPublic) {
        if (!isReady || !currentUser) return Promise.resolve(false);

        return client
            .from('bookmark_collections')
            .update({ is_public: !!isPublic })
            .eq('id', collectionId)
            .eq('user_id', currentUser.id)
            .then(function(result) {
                if (result.error) {
                    console.warn('[SupabaseAdapter] setBookmarkCollectionPublic:', result.error.message);
                    return false;
                }
                return true;
            });
    }

    function getPublicCollection(collectionId) {
        if (!isReady) return Promise.resolve(null);

        return client
            .from('bookmark_collections')
            .select('id, name, description, is_public, created_at')
            .eq('id', collectionId)
            .eq('is_public', true)
            .single()
            .then(function(colResult) {
                if (colResult.error || !colResult.data) return null;

                return client
                    .from('bookmarks')
                    .select('submission_id, note, created_at, submissions(id, title, content, author_name, author_color, type, likes, created_at)')
                    .eq('collection_id', collectionId)
                    .eq('is_private', false)
                    .order('created_at', { ascending: false })
                    .then(function(bmResult) {
                        if (bmResult.error) {
                            console.warn('[SupabaseAdapter] getPublicCollection bookmarks:', bmResult.error.message);
                            return { collection: colResult.data, items: [] };
                        }
                        var items = (bmResult.data || []).map(function(row) {
                            var sub = row.submissions;
                            if (!sub) return null;
                            return {
                                submissionId: sub.id,
                                title: sub.title,
                                name: sub.author_name,
                                color: sub.author_color,
                                type: fromDbType(sub.type),
                                likes: sub.likes,
                                note: row.note || ''
                            };
                        }).filter(Boolean);
                        return { collection: colResult.data, items: items };
                    });
            });
    }

    function submitContentReport(targetType, targetId, reason) {
        if (!isReady) return Promise.resolve({ success: false, reason: '云端未就绪' });

        return client.rpc('submit_content_report', {
            p_target_type: targetType,
            p_target_id: targetId,
            p_reason: reason || ''
        }).then(function(result) {
            if (result.error) {
                return { success: false, reason: result.error.message };
            }
            return result.data || { success: false };
        });
    }

    function getModerationLogs(limit) {
        if (!isReady || !currentUser) return Promise.resolve([]);

        return client
            .from('moderation_logs')
            .select('id, action, target_type, target_id, operator_id, operator_role, reason, created_at')
            .order('created_at', { ascending: false })
            .limit(limit || 30)
            .then(function(result) {
                if (result.error) {
                    console.warn('[SupabaseAdapter] getModerationLogs:', result.error.message);
                    return [];
                }
                return result.data || [];
            });
    }

    function addSubmissionTags(submissionId, tagNames) {
        if (!isReady) return Promise.resolve(false);
        return client.rpc('add_submission_tags', {
            p_submission_id: submissionId,
            p_tag_names: tagNames
        }).then(function(result) {
            if (result.error) {
                console.error('[SupabaseAdapter] addSubmissionTags error:', result.error);
                return false;
            }
            return result.data || false;
        });
    }

    function filterSubmissionsByTags(tagNames, type, sort, limit, offset) {
        if (!isReady) return Promise.resolve([]);
        return client.rpc('filter_submissions_by_tags', {
            p_tag_names: tagNames || null,
            p_type: type || null,
            p_sort: sort || 'new',
            p_limit: limit || 20,
            p_offset: offset || 0
        }).then(function(result) {
            if (result.error) {
                console.error('[SupabaseAdapter] filterSubmissionsByTags error:', result.error);
                return [];
            }
            return result.data || [];
        });
    }

    function getTags() {
        if (!isReady) return Promise.resolve([]);
        return client.from('tags')
            .select('*')
            .order('usage_count', { ascending: false })
            .then(function(result) {
                if (result.error) return [];
                return result.data || [];
            });
    }

    function getSubmissionTags(submissionId) {
        if (!isReady) return Promise.resolve([]);
        return client.from('submission_tags')
            .select('tag_id, tags(id, name, category, color)')
            .eq('submission_id', submissionId)
            .then(function(result) {
                if (result.error) return [];
                return (result.data || []).map(function(row) {
                    return row.tags;
                }).filter(Boolean);
            });
    }

    /* ================================================================
     * 状态查询
     * ================================================================ */

    function getStatus() {
        return {
            ready:       isReady,
            error:       initError,
            user:        currentUser ? currentUser.id : null,
            pending:     pendingSync.length,
            configValid: CONFIG.url !== '__SUPABASE_URL__' && CONFIG.enabled
        };
    }

    /* ================================================================
     * 暴露接口
     * ================================================================ */
    window.SupabaseAdapter = {
        /* 生命周期 */
        init:   init,
        config: CONFIG,
        get isReady() { return isReady; },

        /* 认证 */
        getCurrentUser:         getCurrentUser,
        isAuthenticated:        isAuthenticated,
        ensureAuth:             ensureAuth,
        ensureAuthWithTimeout:  ensureAuthWithTimeout,
        refreshSession:         refreshSession,

        /* 评论 */
        getComments:    getComments,
        getRecentComments: getRecentComments,
        addComment:     addComment,
        deleteComment:  deleteComment,
        getAllComments: getAllComments,
        fetchComments:  getComments,

        /* v9.0 评论删除令牌 */
        deleteCommentWithToken:     deleteCommentWithToken,
        deleteSubmissionWithToken:  deleteSubmissionWithToken,
        updateSubmissionWithToken:  updateSubmissionWithToken,

        /* v9.0 版主操作 */
        moderateComment:        moderateComment,
        moderateSubmission:     moderateSubmission,
        batchModerateComments:  batchModerateComments,
        upsertProfile:          upsertProfile,

        /* 投稿 */
        getSubmissions:  getSubmissions,
        addSubmission:   addSubmission,
        likeSubmission:  likeSubmission,
        unlikeSubmission: unlikeSubmission,

        /* v9.2 标签与收藏 */
        toggleBookmark:           toggleBookmark,
        getUserBookmarks:         getUserBookmarks,
        getUserBookmarkIds:       getUserBookmarkIds,
        getBookmarkCollections:   getBookmarkCollections,
        createBookmarkCollection: createBookmarkCollection,
        updateBookmarkCollection: updateBookmarkCollection,
        deleteBookmarkCollection: deleteBookmarkCollection,
        setBookmarkCollection:         setBookmarkCollection,
        setBookmarkCollectionPublic:   setBookmarkCollectionPublic,
        getPublicCollection:           getPublicCollection,
        submitContentReport:           submitContentReport,
        getModerationLogs:        getModerationLogs,
        addSubmissionTags:        addSubmissionTags,
        filterSubmissionsByTags:  filterSubmissionsByTags,
        getTags:                  getTags,
        getSubmissionTags:        getSubmissionTags,

        /* 实时 */
        subscribeComments:    subscribeComments,
        unsubscribeComments:  unsubscribeComments,
        subscribeSubmissions: subscribeSubmissions,

        /* 离线 */
        syncPendingQueue: syncPendingQueue,
        getPendingCount:  getPendingCount,

        /* 状态 */
        getStatus: getStatus,

        /* 类型映射（供 repository 等模块使用） */
        toDbType:   toDbType,
        fromDbType: fromDbType
    };

})();
