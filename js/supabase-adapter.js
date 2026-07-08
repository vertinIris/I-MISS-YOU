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
        try { localStorage.setItem(PENDING_KEY, JSON.stringify(pendingSync)); } catch(e){}
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

    function queuePending(item) {
        pendingSync.push(item);
        savePendingQueue();
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
    function getComments(targetId) {
        if (!isReady) return Promise.resolve([]);

        return client
            .from('comments')
            .select('*')
            .eq('target_id', targetId)
            .order('created_at', { ascending: true })
            .then(function(result) {
                if (result.error) {
                    console.warn('[SupabaseAdapter] getComments 失败:', result.error.message);
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
            return client
                .from('comments')
                .insert(insertData)
                .select()
                .single()
                .then(function(result) {
                    if (result.error) {
                        var errMsg = result.error.message || '未知错误';
                        console.warn('[SupabaseAdapter] addComment 失败:', errMsg);
                        result._errorMsg = errMsg;
                        queuePending({
                            action: 'addComment',
                            targetId: targetId,
                            comment: comment,
                            extraFields: extraFields,
                            timestamp: new Date().toISOString()
                        });
                        return { _error: errMsg };
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
     * @param {number} commentId
     * @returns {Promise<boolean>}
     */
    function deleteComment(commentId) {
        if (!isReady) return Promise.resolve(false);

        return client
            .from('comments')
            .delete()
            .eq('id', commentId)
            .then(function(result) {
                if (result.error) {
                    console.warn('[SupabaseAdapter] deleteComment 失败:', result.error.message);
                    return false;
                }
                return true;
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
    function getSubmissions(typeFilter) {
        if (!isReady) return Promise.resolve([]);

        var query = client
            .from('submissions')
            .select('*')
            .order('created_at', { ascending: false });

        if (typeFilter && typeFilter !== '全部') {
            query = query.eq('type', toDbType(typeFilter));
        }

        return query.then(function(result) {
            if (result.error) {
                console.warn('[SupabaseAdapter] getSubmissions 失败:', result.error.message);
                return [];
            }
            return (result.data || []).map(function(s) {
                return {
                    id:      s.id,
                    type:    fromDbType(s.type),
                    title:   s.title,
                    content: s.content,
                    name:    s.author_name,
                    color:   s.author_color,
                    likes:   s.likes,
                    time:    s.created_at
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
                        console.warn('[SupabaseAdapter] addSubmission 失败:', result.error.message);
                        queuePending({
                            action: 'addSubmission',
                            submission: submission,
                            timestamp: new Date().toISOString()
                        });
                        return null;
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
                        if (result && result._error) {
                            errors.push({ action: item.action, targetId: item.targetId, error: result._error });
                            failed.push(item);
                            return { ok: false };
                        }
                        if (!result || !result.id) {
                            failed.push(item);
                            return { ok: false };
                        }
                    } else if (item.action === 'addSubmission') {
                        if (result && result._error) {
                            errors.push({ action: item.action, error: result._error });
                            failed.push(item);
                            return { ok: false };
                        }
                        if (!result) {
                            failed.push(item);
                            return { ok: false };
                        }
                    }
                    synced++;
                    return { ok: true };
                }).catch(function(err) {
                    errors.push({ action: item.action, error: err.message || String(err) });
                    failed.push(item);
                    return { ok: false };
                });
            }));
        }).then(function() {
            pendingSync = failed;
            savePendingQueue();
            console.log('[SupabaseAdapter] 离线同步完成: 成功', synced, '失败', failed.length);
            return { synced: synced, failed: failed.length, remaining: failed.length, errors: errors };
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
        if (!isReady) return Promise.resolve(false);
        return client.rpc('delete_submission_with_token', {
            p_submission_id: submissionId,
            p_delete_token: deleteToken
        }).then(function(result) {
            if (result.error) {
                console.error('[SupabaseAdapter] deleteSubmissionWithToken error:', result.error);
                return false;
            }
            return result.data || false;
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
            return result.data || { success: 0, failed: 0 };
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
        addComment:     addComment,
        deleteComment:  deleteComment,
        getAllComments: getAllComments,
        fetchComments:  getComments,

        /* v9.0 评论删除令牌 */
        deleteCommentWithToken:     deleteCommentWithToken,
        deleteSubmissionWithToken:  deleteSubmissionWithToken,

        /* v9.0 版主操作 */
        moderateComment:        moderateComment,
        moderateSubmission:     moderateSubmission,
        batchModerateComments:  batchModerateComments,

        /* 投稿 */
        getSubmissions:  getSubmissions,
        addSubmission:   addSubmission,
        likeSubmission:  likeSubmission,
        unlikeSubmission: unlikeSubmission,

        /* v9.2 标签与收藏 */
        toggleBookmark:           toggleBookmark,
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
