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
                    seedCloudIfEmpty().then(function() { resolve(); });
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

    /**
     * 获取指定目标的评论列表
     * @param {string} targetId
     * @returns {Promise<Array>}
     */
    function getComments(targetId) {
        var localData = localGetComments(targetId);

        /* 优先云端，但与本地合并 */
        if (provider === 'supabase' && cloudAvailable) {
            return window.SupabaseAdapter.getComments(targetId).then(function(cloudData) {
                var cloudComments = cloudData.map(function(row) {
                    var d = new Date(row.created_at);
                    return {
                        id:       row.id,                          /* 数据库主键，用于删除定位 */
                        authorId: row.author_id || '',             /* 匿名用户 UUID，用于自删权限 */
                        name:     row.author_name || '匿名信号源',
                        color:    row.author_color || '#6B8AFF',
                        text:     row.content || '',
                        time:     d.getTime(),
                        timeStr:  (d.getMonth()+1) + '月' + d.getDate() + '日 ' +
                                  String(d.getHours()).padStart(2,'0') + ':' +
                                  String(d.getMinutes()).padStart(2,'0')
                    };
                });
                /* 合并去重：本地 + 云端，按 name+text+time 去重 */
                return mergeComments(localData, cloudComments);
            }).catch(function(err) {
                console.warn('[Repository] 获取云端评论失败，回退本地:', err.message);
                return localData;
            });
        }
        /* 回退本地 — 同步返回，不包 Promise（调用方兼容同步代码） */
        return localData;
    }

    /**
     * 合并评论列表并去重
     * 本地数据可能包含未同步的新评论，云端数据包含其他设备评论
     */
    function mergeComments(localComments, cloudComments) {
        localComments = Array.isArray(localComments) ? localComments : [];
        cloudComments = Array.isArray(cloudComments) ? cloudComments : [];
        var seen = {};
        var merged = [];

        function add(c) {
            if (!c || !c.text) return;
            var key = (c.name || '') + '::' + c.text + '::' + (c.time || 0);
            if (seen[key]) return;
            seen[key] = true;
            merged.push(c);
        }

        localComments.forEach(add);
        cloudComments.forEach(add);
        /* 按时间升序排列 */
        merged.sort(function(a, b) { return (a.time || 0) - (b.time || 0); });
        return merged;
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
    function addComment(targetId, comment) {
        /* 本地写入由 main.js handleCommentSubmit 的 saveComments 完成，
           此处只负责云端同步，避免字段名不一致导致数据被覆盖
           (main.js 用 {name,time,timeStr}，repository 用 {author,time}) */
        emit('commentAdded', { targetId: targetId, comment: comment });

        /* 异步写云端（失败不影响本地） */
        if (provider === 'supabase' && cloudAvailable) {
            return window.SupabaseAdapter.addComment(targetId, comment)
                .then(function() {
                    console.log('[Repository] 云端同步成功:', targetId);
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
        var deleted = false;

        /* 1. 本地删除 — 按 id 匹配优先，否则按 name+text+time */
        localDeleteComment(targetId, comment);

        /* 2. 云端删除 — 有数据库 id 才调 Supabase */
        if (comment.id && provider === 'supabase' && cloudAvailable) {
            return window.SupabaseAdapter.deleteComment(comment.id).then(function(success) {
                if (success) {
                    emit('commentDeleted', { targetId: targetId, comment: comment, admin: opts.admin });
                }
                return success;
            }).catch(function(err) {
                console.warn('[Repository] 云端删除失败:', err.message);
                /* 本地已删，仍视为成功 */
                emit('commentDeleted', { targetId: targetId, comment: comment, admin: opts.admin });
                return true;
            });
        }

        /* 纯本地模式 */
        emit('commentDeleted', { targetId: targetId, comment: comment, admin: opts.admin });
        return Promise.resolve(true);
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
        if (provider === 'supabase' && cloudAvailable) {
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

        if (provider === 'supabase' && cloudAvailable) {
            return window.SupabaseAdapter.getSubmissions(typeFilter).then(function(cloudData) {
                var cloudSubs = cloudData.map(function(row) {
                    var d = new Date(row.time);
                    return {
                        id:      row.id,
                        type:    row.type,
                        title:   row.title,
                        content: row.content,
                        name:    row.name,
                        color:   row.color,
                        likes:   row.likes,
                        time:    d.getTime(),
                        timeStr: d.getFullYear() + '-' +
                                 String(d.getMonth()+1).padStart(2,'0') + '-' +
                                 String(d.getDate()).padStart(2,'0') + ' ' +
                                 String(d.getHours()).padStart(2,'0') + ':' +
                                 String(d.getMinutes()).padStart(2,'0'),
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
     */
    function mergeSubmissions(localSubs, cloudSubs, typeFilter) {
        localSubs = Array.isArray(localSubs) ? localSubs : [];
        cloudSubs = Array.isArray(cloudSubs) ? cloudSubs : [];
        var seen = {};
        var merged = [];

        function add(s) {
            if (!s || !s.title) return;
            var key = (s.id || '') + '::' + (s.title || '') + '::' + (s.time || 0);
            if (seen[key]) return;
            seen[key] = true;
            merged.push(s);
        }

        localSubs.forEach(add);
        cloudSubs.forEach(add);
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
    function addSubmission(submission) {
        /* 本地写入由 main.js saveSubmissions 完成，
           此处只负责云端同步，避免格式冲突 */
        emit('submissionAdded', { submission: submission });

        /* 异步写云端 */
        if (provider === 'supabase' && cloudAvailable) {
            return window.SupabaseAdapter.addSubmission(submission)
                .then(function() {
                    console.log('[Repository] 投稿云端同步成功');
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
                            author: c.author,
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
                        version:    'v7.3',
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
        getComments:    getComments,
        addComment:     addComment,
        deleteComment:  deleteComment,
        getAllComments: getAllComments,

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
