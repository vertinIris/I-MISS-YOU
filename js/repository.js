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
                    dedupeLocalComments();
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
                            /* 清理历史遗留的重复评论（修复前版本反复拉取产生的本地副本） */
                            dedupeLocalComments();
                            emit('cloudReady', { provider: provider });
                            resolve();
                        });
                } else {
                    dedupeLocalComments();
                    resolve();
                }
            }).catch(function(err) {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                console.warn('[Repository] 云端初始化异常:', err.message);
                dedupeLocalComments();
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
     * 评论内容签名（用于去重 / 近似判定）
     * 归一化：去掉姓名首尾空白、去掉正文所有空白与末尾标点，
     * 使 "text" / "text。" / "text " / "text，" 视为同一条（满足"高度相似即去重"）。
     */
    function commentSig(c) {
        var name = (c.name || '').trim();
        var text = (c.text || '')
            .replace(/\s+/g, '')
            .replace(/[。.，,！!?？、~～.]+$/g, '');
        return name + '|' + text;
    }

    /**
     * 评论去重核心：跨 id / 无 id 的内容签名去重
     * 同 (name + text) 的两条评论，若存在一条带云端 id，则无 id 的那条视为重复并丢弃。
     * @param {Array} list
     * @returns {Array} 去重后的列表
     */
    function dedupeCommentList(list) {
        list = Array.isArray(list) ? list : [];
        var byId = {}, sigToId = {}, sigSeen = {}, out = [];
        function sigOf(c) {
            return commentSig(c);
        }
        /* Pass 1: 登记所有带 id 的评论，建立 内容签名 -> id 映射 */
        list.forEach(function(c) {
            if (c && c.text && c.id != null) {
                byId['id:' + c.id] = c;
                sigToId[sigOf(c)] = c.id;
            }
        });
        /* Pass 2: 决定保留/丢弃 */
        list.forEach(function(c) {
            if (!c || !c.text) { out.push(c); return; }
            if (c.id != null) {
                if (!sigSeen['id:' + c.id]) { sigSeen['id:' + c.id] = 1; out.push(c); }
                return;
            }
            var sig = sigOf(c);
            if (sigToId[sig] != null) return;          /* 与某条带 id 评论内容相同 → 丢弃 */
            var sk = 'sig:' + sig;
            if (sigSeen[sk]) return;
            sigSeen[sk] = 1; out.push(c);
        });
        return out;
    }

    /**
     * 合并评论列表并去重（云端条目优先保留 id/authorId）
     *
     * 修复（重复入库根因）：
     *   旧逻辑对云端评论用 `id:NNN`、对无 id 的本地种子评论用 `name::text::0` 作为去重键，
     *   二者永远不相等 → 同一条种子评论（本地无 id + 云端点 id）被当作两条，
     *   经 pullCommentsAndPersist 反复写回 localStorage，造成"反复拉取导致重复入库"。
     *   现改为：先登记云端（带 id）锚点，本地无 id 且与某条带 id 评论内容相同的项直接丢弃，
     *   并把本地的 timeStr/time 回写进云端锚点，避免种子时间戳丢失。
     */
    function mergeComments(localComments, cloudComments) {
        localComments  = Array.isArray(localComments)  ? localComments  : [];
        cloudComments  = Array.isArray(cloudComments)  ? cloudComments  : [];

        function isSeedLabel(s) {
            /* 仅把种子自带的"X月X日"式标签视为优先；自动生成的时间戳(含 '-')不算 */
            return s && s.indexOf('月') >= 0;
        }
        function contentSig(c) {
            return commentSig(c);
        }

        var byId    = {};   /* id -> 评论 */
        var sigToId = {};   /* 内容签名 -> id（用于识别无 id 重复） */

        function mergeFields(base, incoming) {
            base = base || {}; incoming = incoming || {};
            function pick(a, b) {
                return (a !== undefined && a !== null && a !== '') ? a : b;
            }
            return {
                id:       pick(incoming.id, base.id),
                authorId: pick(incoming.authorId, base.authorId),
                name:     pick(incoming.name, base.name),
                color:    pick(incoming.color, base.color),
                text:     pick(incoming.text, base.text),
                parentId: pick(incoming.parentId, base.parentId),
                time:     pick(incoming.time, base.time),
                timeStr:  isSeedLabel(base.timeStr) ? base.timeStr
                          : (isSeedLabel(incoming.timeStr) ? incoming.timeStr
                          : pick(incoming.timeStr, base.timeStr)),
                is_hidden: incoming.is_hidden === true ? true : (base.is_hidden === true)
            };
        }

        function register(c) {
            if (!c || !c.text) return;
            var sig = contentSig(c);
            if (c.id != null) {
                sigToId[sig] = c.id;
                byId['id:' + c.id] = byId['id:' + c.id]
                    ? mergeFields(byId['id:' + c.id], c)
                    : c;
                return;
            }
            /* 无 id：若已有同内容 id 版本，则把本地美观 timeStr/time 回写后丢弃自身 */
            if (sigToId[sig] != null) {
                var anchor = byId['id:' + sigToId[sig]];
                if (anchor) {
                    if (isSeedLabel(c.timeStr) && !isSeedLabel(anchor.timeStr)) anchor.timeStr = c.timeStr;
                    if (c.time && !anchor.time) anchor.time = c.time;
                }
                return;
            }
            if (!byId['sig:' + sig]) byId['sig:' + sig] = c;
        }

        /* 关键：先处理云端（带 id），本地无 id 同内容项随后被识别为重复丢弃 */
        cloudComments.forEach(register);
        localComments.forEach(register);

        var merged = Object.keys(byId).map(function(k) { return byId[k]; });

        /* 云端权威剔除——本地带云端 id 但本次云端结果缺失的条目，说明已在远端被删除/隐藏 */
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
     * 清理 localStorage 中已存在的重复评论（一次性修复 + 每次云端就绪后执行）
     * 使用与 mergeComments 一致的跨 id/内容签名去重，确保本地持久层不再残留重复。
     * @returns {number} 移除的重复条数
     */
    function dedupeLocalComments() {
        var removed = 0;
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (!key || key.indexOf('fxre_comments_') !== 0) continue;
                if (key === 'fxre_comments_seed_version') continue;
                var list;
                try { list = JSON.parse(safeGetItem(key) || '[]'); } catch(e) { continue; }
                if (!Array.isArray(list)) continue;
                var deduped = dedupeCommentList(list);
                if (deduped.length !== list.length) {
                    removed += (list.length - deduped.length);
                    safeSetItem(key, JSON.stringify(deduped));
                }
            }
        } catch(e) {}
        if (removed > 0) console.log('[Repository] 已清理本地重复评论 ' + removed + ' 条');
        return removed;
    }

    /**
     * 云端重复清理（best-effort）：按 (target_id, author_name, content) 分组，
     * 保留 id 最小的一条，其余删除。
     * 注意：受 RLS 限制，匿名用户只能删除 author_id 为自己的评论；
     * 种子评论 author_id 为 NULL，前端无法删除——需在 Supabase SQL 编辑器
     * 以服务角色执行 db/migration-018-dedupe-comments.sql 完成清理。
     * @returns {Promise<number>} 删除的重复条数
     */
    function dedupeCloudComments() {
        if (!isCloudReady() || !window.SupabaseAdapter || !window.SupabaseAdapter.getAllComments) {
            return Promise.resolve(0);
        }
        return window.SupabaseAdapter.getAllComments().then(function(grouped) {
            var deleteTasks = [];
            Object.keys(grouped).forEach(function(targetId) {
                var rows = grouped[targetId] || [];
                var seen = {};
                rows.forEach(function(r) {
                    if (!r || !r.text) return;
                    var sig = ((r.author || '').trim()) + '|' + (r.text || '').trim();
                    if (seen[sig]) {
                        if (r.id != null) deleteTasks.push(window.SupabaseAdapter.deleteComment(r.id));
                    } else {
                        seen[sig] = 1;
                    }
                });
            });
            return Promise.all(deleteTasks).then(function() { return deleteTasks.length; });
        }).catch(function() { return 0; });
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
                    if (!c || c.id || !c.text || !c.time) return;
                    uploadTasks.push(
                        window.SupabaseAdapter.addComment(targetId, {
                            author: c.name || c.author || '匿名信号源',
                            color:  c.color || '#6B8AFF',
                            text:   c.text
                        }).then(function(row) {
                            if (row && row.id && list && list[idx]) {
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
        var merged;

        function contentKey(s) {
            var t = s.time || 0;
            return (s.title || '') + '::' + (s.name || '') + '::' + Math.floor(t / 60000);
        }

        function isNumericId(id) {
            return /^\d+$/.test(String(id || ''));
        }

        function mergeEntry(existing, incoming, fromLocal) {
            if (!existing) return incoming;
            if (!incoming) return existing;
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
     * 一次性本地缓存迁移（v19 内容改写落地补丁）
     *
     * 背景：Supabase live 的评论（35 条匿名信号源）与投稿（6 篇 × 2 重复行）已
     *       在云端按角色人设去 AI 化改写（见 db/migration-019-deaify-live-content.sql）。
     *       但本仓库在合并云端与本地数据时采用「本地文本优先」：
     *         - mergeComments 对同名 id 评论取本地 text（L273 pick(incoming.text, base.text)）
     *         - mergeSubmissions 直接不回写 content（L681~698 只更新 id/likes/...）
     *       老访客 localStorage 中缓存的带云端 id 的旧文本会持续压制云端改写结果，
     *       导致改写对他们不生效。
     *
     * 做法：以版本标记 fxre_content_v19 为闸门，仅执行一次——遍历本地缓存，
     *       剔除带云端 id 的副本（旧文本），仅保留无 id 的种子评论与
     *       非数字 id 的种子/本地投稿。下次 getComments / getSubmissions 合并时，
     *       这些 id 只剩云端改写后的版本，从而生效。
     *
     * 安全性：种子评论（main.js SEED_COMMENTS）仅含 timeStr 无 id，投稿种子用
     *       'seed_' 前缀、本地乐观投稿用 'sub_' 前缀（均非数字 id），均被保留，
     *       不会被误删，也不会被 syncLocalOnlyComments 回传污染云端改写成果。
     */
    function clearLocalCloudCommentsOnce() {
        var MARKER = 'fxre_content_v19';
        if (safeGetItem(MARKER)) return;                 /* 已执行过，跳过 */
        try {
            var removedAny = false;
            for (var i = 0; i < localStorage.length; i++) {
                var key;
                try { key = localStorage.key(i); } catch(e) { continue; }
                if (!key) continue;

                if (key.indexOf('fxre_comments_') === 0) {
                    if (key === 'fxre_comments_seed_version') continue;
                    var clist;
                    try { clist = JSON.parse(safeGetItem(key) || '[]'); } catch(e) { continue; }
                    if (!Array.isArray(clist)) continue;
                    var ckept = clist.filter(function(c) { return !(c && c.id != null); });
                    if (ckept.length !== clist.length) {
                        safeSetItem(key, JSON.stringify(ckept));
                        removedAny = true;
                    }

                } else if (key === 'fxre_submissions') {
                    var slist;
                    try { slist = JSON.parse(safeGetItem(key) || '[]'); } catch(e) { continue; }
                    if (!Array.isArray(slist)) continue;
                    var skept = slist.filter(function(s) {
                        /* 仅剔除带数字 id 的云端投稿副本，保留种子(seed_)/本地(sub_) */
                        return !(s && s.id != null && /^\d+$/.test(String(s.id)));
                    });
                    if (skept.length !== slist.length) {
                        safeSetItem(key, JSON.stringify(skept));
                        removedAny = true;
                    }
                }
            }
            safeSetItem(MARKER, '1');
            if (removedAny) {
                console.log('[Repository] v19 本地缓存迁移完成：已清掉带云端 id 的旧评论/投稿副本');
            }
        } catch(e) {
            console.warn('[Repository] v19 本地缓存迁移失败（可安全忽略，下次加载自动重试）:', e.message);
        }
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
        dedupeLocalComments:   dedupeLocalComments,
        dedupeCloudComments:   dedupeCloudComments,

        /* 投稿 */
        getSubmissions: getSubmissions,
        addSubmission:  addSubmission,

        /* 种子 */
        ensureSeedData: ensureSeedData,

        /* v19 一次性本地缓存迁移（去 AI 化改写落地用，暴露以便手动重跑/排查） */
        clearLocalCloudCommentsOnce: clearLocalCloudCommentsOnce,

        /* 归档 */
        exportData: exportData,
        importData: importData,

        /* 事件 */
        on: on
    };

    /* ================================================================
     * 模块加载即执行：v19 本地缓存一次性迁移
     * 必须早于任何 getComments / getSubmissions 调用，
     * 否则「本地文本优先」会让老访客继续看到改写前的旧文本。
     * 有 fxre_content_v19 标记时自动跳过，重复加载无副作用。
     * ================================================================ */
    clearLocalCloudCommentsOnce();

})();
