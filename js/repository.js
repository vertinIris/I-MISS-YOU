/**
 * 飞行雪绒 — DataRepository 抽象层
 * Phase 3: 统一数据访问接口，支持 localStorage / Supabase 双后端切换
 *
 * 设计原则:
 *   1. 所有业务代码只调用 DataRepository，不直接操作 localStorage 或 Supabase
 *   2. 切换后端只需一行: DataRepository.switchProvider('supabase')
 *   3. 双写策略: 云端写入失败时自动降级到本地，数据不丢失
 *   4. 种子数据: 首次使用自动写入预置评论和投稿（只写一次）
 */

(function() {
    'use strict';

    /* ================================================================
     * Provider 状态
     * ================================================================ */
    var provider       = 'localStorage';  /* 'localStorage' | 'supabase' */
    var cloudAvailable = false;
    var listeners      = {};              /* 数据变更监听器 */

    /* ================================================================
     * 安全的 localStorage 封装
     * ================================================================ */
    function safeGetItem(key) {
        try { return localStorage.getItem(key); } catch(e) { return null; }
    }

    function safeSetItem(key, value) {
        try { localStorage.setItem(key, value); return true; } catch(e) { return false; }
    }

    /* ================================================================
     * Provider 管理
     * ================================================================ */

    /**
     * 切换数据后端
     * @param {string} newProvider — 'localStorage' | 'supabase'
     */
    function switchProvider(newProvider) {
        if (newProvider !== 'localStorage' && newProvider !== 'supabase') {
            console.warn('[Repository] 未知 provider:', newProvider);
            return;
        }
        provider = newProvider;
        safeSetItem('fxre_data_provider', newProvider);
        console.log('[Repository] 已切换到:', newProvider);
    }

    /**
     * 标记云端是否可用
     */
    function setCloudAvailable(available) {
        cloudAvailable = available;
    }

    /**
     * 初始化云端适配器（带超时保护）
     * Promise 在所有消费端准备好之前不会 resolve
     */
    function initCloud(opts) {
        if (!window.SupabaseAdapter) {
            console.warn('[Repository] SupabaseAdapter 未加载');
            return Promise.resolve();
        }

        var CLOUD_TIMEOUT = 15000; /* 15 秒总超时 */

        return new Promise(function(resolve) {
            var settled = false;
            var timer = setTimeout(function() {
                if (!settled) {
                    settled = true;
                    console.warn('[Repository] 云端初始化超时 (' + CLOUD_TIMEOUT/1000 + 's)，回退纯本地模式');
                    resolve();
                }
            }, CLOUD_TIMEOUT);

            window.SupabaseAdapter.init(opts).then(function(success) {
                if (settled) return;
                settled = true;
                clearTimeout(timer);

                if (success) {
                    cloudAvailable = true;
                    /* 默认启用云端作为 provider */
                    switchProvider('supabase');
                    /* 首次云端连接时，同步本地种子数据到云端 */
                    seedCloudIfEmpty()
                        .then(function() { return syncLocalOnlyComments(); })
                        .then(function() {
                            emit('cloudReady', { provider: provider });
                            resolve();
                        });
                } else {
                    resolve();
                }
            }).catch(function(err) {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                console.warn('[Repository] 云端初始化异常:', err.message);
                resolve();
            });
        });
    }

    /* ================================================================
     * 数据变更监听
     * ================================================================ */

    function on(event, fn) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
    }

    function emit(event, data) {
        if (!listeners[event]) return;
        listeners[event].forEach(function(fn) {
            try { fn(data); } catch(e) {}
        });
    }

    /* ================================================================
     * 评论
     * ================================================================ */

    function isCloudReady() {
        return !!(window.SupabaseAdapter &&
                  window.SupabaseAdapter.getStatus &&
                  window.SupabaseAdapter.getStatus().ready);
    }

    function isCloudEnabled() {
        return !!(window.SupabaseAdapter &&
                  window.SupabaseAdapter.config &&
                  window.SupabaseAdapter.config.enabled);
    }

    /**
     * 将云端行映射为前端评论对象
     */
    function mapCloudComment(row) {
        var d = new Date(row.created_at);
        return {
            id:       row.id,
            authorId: row.author_id || '',
            name:     row.author_name || '匿名信号源',
            color:    row.author_color || '#6B8AFF',
            text:     row.content || '',
            parentId: row.parent_id || null,
            time:     d.getTime(),
            is_hidden: row.is_hidden === true,
            timeStr:  (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
                      String(d.getHours()).padStart(2, '0') + ':' +
                      String(d.getMinutes()).padStart(2, '0')
        };
    }

    /**
     * 获取指定目标的评论列表
     * @param {string} targetId
     * @returns {Promise<Array>|Array}
     */
    function getComments(targetId) {
        var localData = localGetComments(targetId);

        /* SDK 就绪即拉云端（不依赖 cloudAvailable，避免初始化竞态） */
        if (isCloudReady()) {
            return window.SupabaseAdapter.getComments(targetId).then(function(cloudData) {
                /* v10.1: null = 云端读取出错 → 回退本地，
                   不能把瞬时故障当"云端已清空"去做远端删除剔除 */
                if (cloudData === null) return localData;
                var cloudComments = (cloudData || []).map(mapCloudComment);
                return mergeComments(localData, cloudComments);
            }).catch(function(err) {
                console.warn('[Repository] 获取云端评论失败，回退本地:', err.message);
                return localData;
            });
        }
        return localData;
    }

    /**
     * 合并评论列表并去重（云端条目优先保留 id/authorId）
     */
    function mergeComments(localComments, cloudComments) {
        localComments = Array.isArray(localComments) ? localComments : [];
        cloudComments = Array.isArray(cloudComments) ? cloudComments : [];
        var byKey = {};

        function commentKey(c) {
            if (c.id) return 'id:' + c.id;
            return (c.name || '') + '::' + c.text + '::' + (c.time || 0);
        }

        function upsert(c) {
            if (!c || !c.text) return;
            var key = commentKey(c);
            var existing = byKey[key];
            if (!existing) {
                byKey[key] = c;
                return;
            }
            /* 同内容时优先保留带云端 id 的版本 */
            if (c.id && !existing.id) {
                byKey[key] = Object.assign({}, existing, c);
            } else if (c.id && existing.id && c.authorId && !existing.authorId) {
                byKey[key] = Object.assign({}, existing, c);
            }
        }

        localComments.forEach(upsert);
        cloudComments.forEach(upsert);

        var merged = Object.keys(byKey).map(function(k) { return byKey[k]; });

        /* v10.1: 云端权威剔除——本地带云端 id 但本次云端结果缺失的条目，
           说明已在远端被删除/隐藏（Realtime DELETE 漏收或软删时代残留），本地同步剔除。
           无 id 的乐观项/种子评论一律保留（种子无 id 字段，不受影响）。
           安全性：仅在云端读取成功时才走到本函数（出错时上层已回退 localData）。 */
        var cloudIds = {};
        cloudComments.forEach(function(c) { if (c.id != null) cloudIds[String(c.id)] = 1; });
        merged = merged.filter(function(c) {
            if (c.id == null) return true;
            return !!cloudIds[String(c.id)];
        });

        /* v9.0: 过滤已隐藏评论 */
        merged = merged.filter(function(c) { return c.is_hidden !== true; });
        merged.sort(function(a, b) { return (a.time || 0) - (b.time || 0); });
        return merged;
    }

    /**
     * 拉取云端评论并写回 localStorage（跨设备可见的关键步骤）
     */
    function pullCommentsAndPersist(targetId) {
        return Promise.resolve(getComments(targetId)).then(function(comments) {
            comments = Array.isArray(comments) ? comments : [];
            safeSetItem('fxre_comments_' + targetId, JSON.stringify(comments));
            return comments;
        });
    }

    /**
     * 将仅存在本地的用户评论补传到云端（有 time 无 id 的条目）
     */
    function syncLocalOnlyComments() {
        if (!isCloudReady()) return Promise.resolve();

        var keyTasks = [];

        try {
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (!key || key.indexOf('fxre_comments_') !== 0) continue;
                var targetId = key.replace('fxre_comments_', '');
                if (targetId === 'seed_version') continue;

                var list;
                try { list = JSON.parse(safeGetItem(key) || '[]'); } catch(e) { continue; }
                if (!Array.isArray(list)) continue;

                var uploadTasks = [];
                list.forEach(function(c, idx) {
                    if (c.id || !c.text || !c.time) return;
                    uploadTasks.push(
                        window.SupabaseAdapter.addComment(targetId, {
                            author: c.name || c.author || '匿名信号源',
                            color:  c.color || '#6B8AFF',
                            text:   c.text
                        }).then(function(row) {
                            if (row && row.id) {
                                list[idx].id = row.id;
                                list[idx].authorId = row.author_id || '';
                            }
                        })
                    );
                });

                if (uploadTasks.length) {
                    keyTasks.push(
                        Promise.all(uploadTasks).then(function() {
                            safeSetItem(key, JSON.stringify(list));
                        })
                    );
                }
            }
        } catch(e) {}

        return Promise.all(keyTasks).then(function() {
            if (keyTasks.length) console.log('[Repository] 本地未同步评论补传完成');
        });
    }

    /**
     * 全量云端同步：刷新 session → 推送 pending → 补传本地-only → 拉取全部评论区
     * @returns {Promise<Object>} { pushStats, pulledTargets }
     */
    function fullCloudSync() {
        var chain = Promise.resolve();

        if (window.SupabaseAdapter && window.SupabaseAdapter.refreshSession) {
            chain = chain.then(function() { return SupabaseAdapter.refreshSession(); });
        }
        if (window.SupabaseAdapter && window.SupabaseAdapter.ensureAuth) {
            chain = chain.then(function() { return SupabaseAdapter.ensureAuth(); });
        }

        return chain.then(function() {
            if (!window.SupabaseAdapter || !SupabaseAdapter.syncPendingQueue) {
                return { synced: 0, failed: 0, remaining: 0, errors: [] };
            }
            return SupabaseAdapter.syncPendingQueue();
        }).then(function(pushStats) {
            return syncLocalOnlyComments().then(function() {
                return pushStats;
            });
        }).then(function(pushStats) {
            var tasks = [];
            var targetIds = [];
            try {
                for (var i = 0; i < localStorage.length; i++) {
                    var key = localStorage.key(i);
                    if (!key || key.indexOf('fxre_comments_') !== 0) continue;
                    var targetId = key.replace('fxre_comments_', '');
                    if (targetId === 'seed_version') continue;
                    targetIds.push(targetId);
                    tasks.push(pullCommentsAndPersist(targetId));
                }
            } catch(e) {}

            /* 也拉取页面上可见但 localStorage 可能尚未有的 target */
            if (typeof document !== 'undefined') {
                document.querySelectorAll('.comment-area').forEach(function(area) {
                    var tid = area.id.replace('comments-', '');
                    if (tid && targetIds.indexOf(tid) === -1) {
                        targetIds.push(tid);
                        tasks.push(pullCommentsAndPersist(tid));
                    }
                });
            }

            return Promise.all(tasks).then(function() {
                return { pushStats: pushStats, pulledTargets: targetIds.length };
            });
        });
    }

    function localGetComments(targetId) {
        try {
            var data = safeGetItem('fxre_comments_' + targetId);
            return data ? JSON.parse(data) : [];
        } catch(e) { return []; }
    }

    /**
     * 添加一条评论（双写策略）
     * @param {string} targetId
     * @param {Object} comment — { author, color, text }
     * @returns {Promise<Object|null>}
     */
    function addComment(targetId, comment, extraFields) {
        emit('commentAdded', { targetId: targetId, comment: comment });

        /* 只要 Supabase 已启用就尝试写入（适配器内部会排队 pending） */
        if (isCloudEnabled()) {
            return window.SupabaseAdapter.addComment(targetId, comment, extraFields)
                .then(function(row) {
                    if (row && row._error) return row;
                    if (row && row.id) {
                        console.log('[Repository] 云端同步成功:', targetId, 'id=' + row.id);
                        return mapCloudComment(row);
                    }
                    console.log('[Repository] 云端同步已排队或跳过:', targetId);
                    return comment;
                })
                .catch(function(err) {
                    console.warn('[Repository] 云端同步失败:', err.message);
                    return comment;
                });
        }

        return Promise.resolve(comment);
    }

    /**
     * 删除一条评论（云端 + 本地双删）
     * @param {string} targetId — 评论所属目标
     * @param {Object} comment — 完整评论对象，需含 id(云端) 或 name+text+time(本地)
     * @param {Object} opts — { admin: bool }
     * @returns {Promise<boolean>}
     */
    function deleteComment(targetId, comment, opts) {
        opts = opts || {};
        localDeleteComment(targetId, comment);

        /* 管理员删他人评论：RLS 不允许，仅本地移除 */
        if (opts.admin && comment.id && isCloudReady()) {
            var currentUser = window.SupabaseAdapter.getCurrentUser();
            if (currentUser && comment.authorId && comment.authorId !== currentUser.id) {
                emit('commentDeleted', { targetId: targetId, comment: comment, admin: true, cloud: false });
                return Promise.resolve({ local: true, cloud: false, adminLocalOnly: true });
            }
        }

        if (comment.id && isCloudReady()) {
            return window.SupabaseAdapter.deleteComment(comment.id).then(function(success) {
                if (success) {
                    emit('commentDeleted', { targetId: targetId, comment: comment, admin: opts.admin });
                }
                return { local: true, cloud: success };
            }).catch(function(err) {
                console.warn('[Repository] 云端删除失败:', err.message);
                emit('commentDeleted', { targetId: targetId, comment: comment, admin: opts.admin });
                return { local: true, cloud: false };
            });
        }

        emit('commentDeleted', { targetId: targetId, comment: comment, admin: opts.admin });
        return Promise.resolve({ local: true, cloud: !comment.id });
    }

    function localDeleteComment(targetId, comment) {
        try {
            var key  = 'fxre_comments_' + targetId;
            var data = safeGetItem(key);
            if (!data) return;
            var list = JSON.parse(data);
            var before = list.length;
            /* 按 id 匹配（云端同步过来的已有 id），否则按 name+text+time */
            list = list.filter(function(c) {
                if (comment.id && c.id === comment.id) return false;
                if (!comment.id && c.name === comment.name && c.text === comment.text && c.time === comment.time) return false;
                return true;
            });
            if (list.length < before) {
                safeSetItem(key, JSON.stringify(list));
            }
        } catch(e) {}
    }
    function getAllComments() {
        if (isCloudReady()) {
            return window.SupabaseAdapter.getAllComments().then(function(cloudData) {
                if (Object.keys(cloudData).length > 0) return cloudData;
                return localGetAllComments();
            });
        }
        return Promise.resolve(localGetAllComments());
    }

    function localGetAllComments() {
        var result = {};
        /* 扫描所有 fxre_comments_* 键 */
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.indexOf('fxre_comments_') === 0) {
                    var targetId = key.replace('fxre_comments_', '');
                    if (targetId === 'seed_version') continue;
                    result[targetId] = JSON.parse(safeGetItem(key));
                }
            }
        } catch(e) {}
        return result;
    }

    /* ================================================================
     * 投稿
     * ================================================================ */

    /**
     * 获取投稿列表
     * @param {string} typeFilter — 可选类型筛选
     */
    function getSubmissions(typeFilter) {
        var localData = localGetSubmissions(typeFilter);

        if (isCloudReady()) {
            return window.SupabaseAdapter.getSubmissions(typeFilter).then(function(cloudData) {
                /* v10.1: null = 云端读取出错 → 回退本地，防误剔除 */
                if (cloudData === null) return localData;
                var cloudSubs = cloudData.map(function(row) {
                    var d = new Date(row.time);
                    return {
                        id:       row.id,
                        type:     row.type,
                        title:    row.title,
                        content:  row.content,
                        name:     row.name,
                        color:    row.color,
                        likes:    row.likes,
                        authorId: row.authorId || '',
                        time:     d.getTime(),
                        timeStr:  d.getFullYear() + '-' +
                                 String(d.getMonth()+1).padStart(2,'0') + '-' +
                                 String(d.getDate()).padStart(2,'0') + ' ' +
                                 String(d.getHours()).padStart(2,'0') + ':' +
                                 String(d.getMinutes()).padStart(2,'0'),
                        tags:     row.tags || [],
                        liked: false
                    };
                });
                /* 合并去重：本地优先保留未同步投稿，云端补充其他设备投稿 */
                return mergeSubmissions(localData, cloudSubs, typeFilter);
            }).catch(function(err) {
                console.warn('[Repository] 获取云端投稿失败，回退本地:', err.message);
                return localData;
            });
        }
        return localData;
    }

    /**
     * 合并投稿列表并去重
     * 保留本地 liked 状态，使用云端 likes 权威值（G-10 修复）
     */
    function mergeSubmissions(localSubs, cloudSubs, typeFilter) {
        localSubs = Array.isArray(localSubs) ? localSubs : [];
        cloudSubs = Array.isArray(cloudSubs) ? cloudSubs : [];
        var byKey = {};
        var merged = [];

        function contentKey(s) {
            var t = s.time || 0;
            return (s.title || '') + '::' + (s.name || '') + '::' + Math.floor(t / 60000);
        }

        function isNumericId(id) {
            return /^\d+$/.test(String(id || ''));
        }

        function mergeEntry(existing, incoming, fromLocal) {
            if (!existing) return incoming;
            if (isNumericId(incoming.id) && !isNumericId(existing.id)) {
                existing.id = incoming.id;
            } else if (incoming.id && !existing.id) {
                existing.id = incoming.id;
            }
            if (fromLocal) {
                if (incoming.liked) existing.liked = true;
            } else {
                existing.likes = incoming.likes != null ? incoming.likes : existing.likes;
            }
            existing.authorId = incoming.authorId || existing.authorId;
            existing.is_hidden = incoming.is_hidden === true ? true : existing.is_hidden;
            /* R2/R13: 合并时保留云端 tags，避免云/本地合并丢失标签 */
            if (incoming.tags && incoming.tags.length) existing.tags = incoming.tags;
            return existing;
        }

        localSubs.forEach(function(s) {
            if (!s || !s.title) return;
            var k = contentKey(s);
            byKey[k] = mergeEntry(byKey[k], s, true);
        });

        cloudSubs.forEach(function(s) {
            if (!s || !s.title) return;
            var k = contentKey(s);
            byKey[k] = mergeEntry(byKey[k], s, false);
        });

        merged = Object.keys(byKey).map(function(k) { return byKey[k]; });

        /* v10.1: 云端权威剔除——本地带数字（云端）id 但本次云端结果缺失的投稿，
           说明已在远端被删除，本地剔除。
           'sub_' 前缀的本地乐观项与 'seed_' 种子均为非数字 id，一律保留。 */
        var cloudIds = {};
        cloudSubs.forEach(function(s) { if (isNumericId(s.id)) cloudIds[String(s.id)] = 1; });
        merged = merged.filter(function(s) {
            if (!isNumericId(s.id)) return true;
            return !!cloudIds[String(s.id)];
        });

        merged = merged.filter(function(s) { return s.is_hidden !== true; });
        merged.sort(function(a, b) { return (b.time || 0) - (a.time || 0); });

        if (typeFilter && typeFilter !== '全部') {
            merged = merged.filter(function(s) { return s.type === typeFilter; });
        }
        return merged;
    }

    function localGetSubmissions(typeFilter) {
        try {
            var data = safeGetItem('fxre_submissions');
            var all = data ? JSON.parse(data) : [];
            if (!typeFilter || typeFilter === '全部') return all;
            return all.filter(function(s) { return s.type === typeFilter; });
        } catch(e) { return []; }
    }

    /**
     * 添加一篇投稿
     */
    function addSubmission(submission, extraFields) {
        /* 本地写入由 main.js saveSubmissions 完成，
           此处只负责云端同步，避免格式冲突 */
        emit('submissionAdded', { submission: submission });

        /* 异步写云端（适配器内部 pending 队列） */
        if (isCloudEnabled()) {
            return window.SupabaseAdapter.addSubmission(submission, extraFields)
                .then(function(cloudRow) {
                    if (cloudRow && cloudRow._error) {
                        console.warn('[Repository] 投稿云端同步失败:', cloudRow._error);
                        return submission;
                    }
                    if (cloudRow && cloudRow.id) {
                        console.log('[Repository] 投稿云端同步成功, id=', cloudRow.id);
                        return cloudRow;
                    }
                    console.log('[Repository] 投稿已入 pending 队列');
                    return submission;
                })
                .catch(function(err) {
                    console.warn('[Repository] 投稿云端同步失败:', err.message);
                    return submission;
                });
        }

        return Promise.resolve(submission);
    }

    /* ================================================================
     * 种子数据管理
     * ================================================================ */

    /**
     * 检查并写入种子数据
     * 版本号控制，只写入一次
     */
    function ensureSeedData(seedVersion, seedComments, seedSubmissions) {
        var seedKey = 'fxre_seed_version';
        var existing = safeGetItem(seedKey);

        if (existing === seedVersion) return; /* 已写入 */

        /* 写入本地评论种子 */
        for (var key in seedComments) {
            if (!safeGetItem('fxre_comments_' + key)) {
                safeSetItem('fxre_comments_' + key, JSON.stringify(seedComments[key]));
            }
        }

        /* 写入本地投稿种子 */
        if (!safeGetItem('fxre_submissions') && seedSubmissions) {
            safeSetItem('fxre_submissions', JSON.stringify(seedSubmissions));
        }

        safeSetItem(seedKey, seedVersion);
    }

    /**
     * 首次云端连接时，将本地种子数据同步到云端
     */
    function seedCloudIfEmpty() {
        if (!cloudAvailable || !window.SupabaseAdapter) return Promise.resolve();

        return window.SupabaseAdapter.getAllComments().then(function(cloudComments) {
            /* 云端已有数据，跳过 */
            if (Object.keys(cloudComments).length > 0) return;

            /* 否则从 local 推种子到云端 */
            var local = localGetAllComments();
            var promises = [];
            for (var targetId in local) {
                local[targetId].forEach(function(c) {
                    promises.push(
                        window.SupabaseAdapter.addComment(targetId, {
                            author: c.name || c.author || '匿名信号源',
                            color:  c.color,
                            text:   c.text
                        })
                    );
                });
            }
            return Promise.all(promises);
        }).then(function() {
            /* 同理处理投稿 */
            return window.SupabaseAdapter.getSubmissions().then(function(cloudSubs) {
                if (cloudSubs.length > 0) return;
                var localSubs = localGetSubmissions();
                var promises = localSubs.map(function(s) {
                    return window.SupabaseAdapter.addSubmission({
                        type:    s.type,
                        title:   s.title,
                        content: s.content,
                        name:    s.name,
                        color:   s.color
                    });
                });
                return Promise.all(promises);
            });
        }).catch(function(e) {
            console.warn('[Repository] 云端种子同步失败:', e.message);
        });
    }

    /* ================================================================
     * 归档
     * ================================================================ */

    function exportData() {
        return getAllComments().then(function(comments) {
            return getSubmissions().then(function(submissions) {
                return {
                    comments: comments,
                    submissions: submissions,
                    metadata: {
                        version:    'v7.8',
                        exportDate: new Date().toISOString(),
                        provider:   provider
                    }
                };
            });
        });
    }

    function importData(jsonString) {
        try {
            var data = JSON.parse(jsonString);
            if (!data.comments || !data.submissions) return false;

            /* 写入评论 */
            for (var targetId in data.comments) {
                var existing = localGetComments(targetId);
                var merged = existing.concat(data.comments[targetId].filter(function(c) {
                    return !existing.some(function(e) {
                        return e.text === c.text && e.author === c.author;
                    });
                }));
                safeSetItem('fxre_comments_' + targetId, JSON.stringify(merged));
            }

            /* 写入投稿 */
            var existingSubs = localGetSubmissions();
            var newSubs = data.submissions.filter(function(s) {
                return !existingSubs.some(function(e) {
                    return e.title === s.title && e.name === s.name;
                });
            });
            safeSetItem('fxre_submissions', JSON.stringify(newSubs.concat(existingSubs)));

            return true;
        } catch(e) {
            console.warn('[Repository] 导入失败:', e.message);
            return false;
        }
    }

    /* ================================================================
     * 公开 API
     * ================================================================ */
    window.DataRepository = {
        /* Provider */
        switchProvider:    switchProvider,
        getProvider:       function() { return provider; },
        setCloudAvailable: setCloudAvailable,
        initCloud:         initCloud,

        /* 评论 */
        getComments:           getComments,
        addComment:            addComment,
        deleteComment:         deleteComment,
        getAllComments:        getAllComments,
        pullCommentsAndPersist: pullCommentsAndPersist,
        syncLocalOnlyComments: syncLocalOnlyComments,
        fullCloudSync:         fullCloudSync,

        /* 投稿 */
        getSubmissions: getSubmissions,
        addSubmission:  addSubmission,

        /* 种子 */
        ensureSeedData: ensureSeedData,

        /* 归档 */
        exportData: exportData,
        importData: importData,

        /* 事件 */
        on: on
    };

})();
