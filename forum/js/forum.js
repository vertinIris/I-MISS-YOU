/**
 * 星炬学院主论坛 · 独立前端逻辑
 * 不依赖飞行雪绒站 js/main.js 或 js/repository.js
 */
(function () {
    'use strict';

    /* 暴露 toast 给 forum-auth.js / forum-upload.js 复用（showToast 为函数声明，已 hoist） */
    window.StarTorchForum = window.StarTorchForum || {};
    window.StarTorchForum.toast = showToast;
    window.StarTorchForum.refreshCommunity = function () { renderCommunity(); };

    var COMMUNITY_PAGE_SIZE = 6;
    var communityFilter = 'all';
    var communitySort = 'new';
    var communityPage = 0;
    var activeTags = [];
    var searchQuery = '';
    var searchTimer = null;

    /* 内容上限：较改版前统一提升 3 倍 */
    var LIMIT_NAME = 60;
    var LIMIT_TITLE = 300;
    var LIMIT_CONTENT = 6000;
    var DRAFT_KEY = 'stf_draft';

    var typeLabels = { text: '文字', story: '故事', poem: '诗歌', art: '插画', music: '音乐' };

    /* 未登录用户可选的匿名身份，贴合鸣潮「普通人」世界观 */
    var ANONYMOUS_IDENTITIES = {
        student:  { name: '星炬学院学生', color: '#6B8AFF' },
        resident: { name: '拉海洛居民', color: '#A8D8FF' },
        observer: { name: '残星会观察员', color: '#B66BFF' },
        intern:   { name: '深空联合实习生', color: '#7FD99E' },
        club:     { name: '泛音社社员', color: '#FF6B9D' },
        rover:    { name: '路过漂泊者', color: '#E8C56A' },
        listener: { name: '匿名听众', color: '#FFB6D9' }
    };

    var CHAR_COLOR_MAP = {
        '爱弥斯': 'var(--aimisi-pink)',
        '达妮娅': 'var(--denia-lavender)',
        '西格莉卡': 'var(--sigrica-green)',
        '琳奈': 'var(--linne-purple)',
        '莫宁': 'var(--mornye-red)',
        '洛瑟菈': 'var(--lucilla-gold)',
        '漂泊者': 'var(--drifter-blue)'
    };

    function escapeHTML(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeColor(c) {
        if (!c) return '#6B8AFF';
        var s = String(c).trim();
        if (/^#[0-9A-Fa-f]{3,8}$/.test(s)) return s;
        if (/^var\(--[\w-]+\)$/.test(s)) return s;
        if (/^rgb(a?)\([\d\s,.%/]+\)$/.test(s)) return s;
        if (/^hsl(a?)\([\d\s,.%/]+\)$/.test(s)) return s;
        return '#6B8AFF';
    }

    function charColorForSubmission(s) {
        if (!s || !s.tags || !Array.isArray(s.tags)) return '';
        for (var i = 0; i < s.tags.length; i++) {
            if (CHAR_COLOR_MAP[s.tags[i]]) return CHAR_COLOR_MAP[s.tags[i]];
        }
        return '';
    }

    function detectIdentityFromName(name) {
        if (!name) return '';
        for (var id in ANONYMOUS_IDENTITIES) {
            if (ANONYMOUS_IDENTITIES[id].name === name) return id;
        }
        return '';
    }

    function currentUser() {
        return (window.StarTorchAuth && window.StarTorchAuth.getUser) ? window.StarTorchAuth.getUser() : null;
    }

    function syncIdentityControls(prefix, identityId) {
        var nameInput = document.getElementById(prefix + '-nickname');
        var identitySelect = document.getElementById(prefix + '-identity');
        if (!nameInput || !identitySelect) return;

        var user = currentUser();
        if (user) {
            /* 已登录：署名锁定为通行证名称，匿名身份停用 */
            nameInput.value = user.name;
            nameInput.disabled = true;
            nameInput.classList.add('is-signed');
            nameInput.classList.remove('is-anonymous');
            identitySelect.value = '';
            identitySelect.disabled = true;
            identitySelect.classList.remove('is-anonymous');
            identitySelect.classList.add('is-signed');
            return;
        }

        identitySelect.disabled = false;
        identitySelect.classList.remove('is-signed');
        nameInput.classList.remove('is-signed');
        identitySelect.value = identityId || '';
        var info = ANONYMOUS_IDENTITIES[identityId];
        if (info) {
            nameInput.value = info.name;
            nameInput.disabled = true;
            nameInput.classList.add('is-anonymous');
            identitySelect.classList.add('is-anonymous');
        } else {
            nameInput.disabled = false;
            nameInput.classList.remove('is-anonymous');
            identitySelect.classList.remove('is-anonymous');
        }
    }

    function restoreNickname(prefix) {
        var nameInput = document.getElementById(prefix + '-nickname');
        var user = currentUser();
        if (user) { syncIdentityControls(prefix, ''); return; }

        var saved = StarTorchData.getNickname();
        var identityId = detectIdentityFromName(saved);
        if (identityId) {
            syncIdentityControls(prefix, identityId);
        } else {
            syncIdentityControls(prefix, '');
            if (nameInput) nameInput.value = saved || '';
        }
    }

    /* 登录态变化时，实时刷新两个表单的署名控件 */
    function syncAuthUI() {
        ['stf-composer', 'stf-submit'].forEach(function (prefix) {
            if (document.getElementById(prefix + '-nickname')) restoreNickname(prefix);
        });
        var trigger = document.querySelector('.stf-composer-placeholder');
        if (trigger) {
            var user = currentUser();
            trigger.textContent = user
                ? (user.name + '，分享你的鸣潮同人…')
                : '分享你的鸣潮同人…';
        }
    }

    function previewText(text, maxLen) {
        if (!text) return '';
        text = text.replace(/\[插图\]\s*https?:\/\/\S+/g, '');
        return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
    }

    /* ============ Toast ============ */
    function showToast(message, duration) {
        duration = duration || 2500;
        var existing = document.getElementById('stf-toast');
        if (existing) existing.remove();

        var el = document.createElement('div');
        el.id = 'stf-toast';
        el.className = 'stf-toast';
        el.textContent = message;
        document.body.appendChild(el);

        requestAnimationFrame(function () { el.classList.add('show'); });
        setTimeout(function () {
            el.classList.remove('show');
            setTimeout(function () { el.remove(); }, 300);
        }, duration);
    }

    /* ============ Rendering ============ */
    function getFilteredSubmissions() {
        var submissions = StarTorchData.getSubmissions().filter(function (s) { return !s.is_hidden; });
        var filtered = communityFilter === 'all'
            ? submissions
            : submissions.filter(function (s) { return s.type === communityFilter; });

        if (activeTags.length > 0) {
            filtered = filtered.filter(function (s) {
                if (!s.tags || !Array.isArray(s.tags)) return false;
                return activeTags.every(function (tag) { return s.tags.indexOf(tag) !== -1; });
            });
        }

        if (searchQuery) {
            var q = searchQuery.toLowerCase();
            filtered = filtered.filter(function (s) {
                var hay = [s.title, s.content, s.name].concat(s.tags || []).join(' ').toLowerCase();
                return hay.indexOf(q) !== -1;
            });
        }

        if (communitySort === 'hot') {
            return filtered.sort(function (a, b) {
                var la = a.likes || 0, lb = b.likes || 0;
                if (lb !== la) return lb - la;
                return (b.time || 0) - (a.time || 0);
            });
        }
        return filtered.sort(function (a, b) { return (b.time || 0) - (a.time || 0); });
    }

    /* ============ Stats ============ */
    function renderStats() {
        var subs = StarTorchData.getSubmissions().filter(function (s) { return !s.is_hidden; });
        var works = subs.length;
        var members = new Set(subs.map(function (s) { return s.name; })).size + 24;
        var online = 8 + Math.floor(Math.random() * 13);
        var w = document.getElementById('stf-stat-works');
        var m = document.getElementById('stf-stat-members');
        var o = document.getElementById('stf-stat-online');
        if (w) w.textContent = works;
        if (m) m.textContent = members;
        if (o) o.textContent = online;
    }

    function buildCardHTML(s) {
        var initial = s.name.charAt(0).toUpperCase();
        var bgColor = sanitizeColor(s.color);
        var cardCharColor = charColorForSubmission(s);
        var cardCharStyle = cardCharColor ? ' style="--char:' + cardCharColor + '"' : '';
        var commentCount = (StarTorchData.getComments(s.id) || []).length;

        var tagsHtml = '';
        var tagsPreviewHtml = '';
        if (s.tags && s.tags.length) {
            tagsHtml = '<div class="stf-card-tags">' +
                s.tags.map(function (t) { return '<span class="stf-card-tag">' + escapeHTML(t) + '</span>'; }).join('') +
                '</div>';
            tagsPreviewHtml = '<div class="stf-card-tags stf-card-tags--preview">' +
                s.tags.slice(0, 3).map(function (t) { return '<span class="stf-card-tag">' + escapeHTML(t) + '</span>'; }).join('') +
                (s.tags.length > 3 ? '<span class="stf-card-tag">+' + (s.tags.length - 3) + '</span>' : '') +
                '</div>';
        }

        var preview = escapeHTML(previewText(s.content, 110));
        var headerHtml =
            '<div class="stf-card-header">' +
                '<div class="stf-card-avatar" style="background:' + bgColor + '">' + escapeHTML(initial) + '</div>' +
                '<div class="stf-card-info">' +
                    '<div class="stf-card-author">' + escapeHTML(s.name) + '</div>' +
                    '<div class="stf-card-time">' + escapeHTML(s.timeStr) + '</div>' +
                '</div>' +
                '<span class="stf-card-badge" data-type="' + s.type + '">' + (typeLabels[s.type] || s.type) + '</span>' +
            '</div>';

        /* 立体翻转卡片：正面摘要 / 背面完整内容与互动
           外层仅作定位与时间线节点；翻转由 .stf-card-inner 的 rotateY 驱动 */
        return '<article class="stf-card" data-id="' + s.id + '"' + cardCharStyle +
                ' tabindex="0" role="button" aria-expanded="false">' +
            '<span class="stf-node" aria-hidden="true"></span>' +
            '<div class="stf-card-inner">' +
                '<div class="stf-card-front">' +
                    headerHtml +
                    '<h3 class="stf-card-title">' + escapeHTML(s.title) + '</h3>' +
                    '<div class="stf-card-preview">' + preview + '</div>' +
                    tagsPreviewHtml +
                    '<div class="stf-card-front-actions">' +
                        '<span class="stf-front-stat">❤ ' + (s.likes || 0) + '</span>' +
                        '<span class="stf-front-stat">💬 ' + commentCount + '</span>' +
                        '<span class="stf-front-stat">⭐ ' + (s.bookmarks || 0) + '</span>' +
                        '<span class="stf-card-flip-hint">点击翻转 ↻</span>' +
                    '</div>' +
                '</div>' +
                '<div class="stf-card-back">' +
                    headerHtml +
                    '<h3 class="stf-card-title">' + escapeHTML(s.title) + '</h3>' +
                    '<div class="stf-card-content">' + escapeHTML(s.content) + '</div>' +
                    tagsHtml +
                    '<div class="stf-card-actions">' +
                        '<button class="stf-card-action' + (s.liked ? ' liked' : '') + '" data-action="like">' +
                            '<svg viewBox="0 0 24 24" fill="' + (s.liked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
                            '<span>' + (s.likes || 0) + '</span>' +
                        '</button>' +
                        '<button class="stf-card-action" data-action="comment">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
                            '<span>评论</span>' +
                        '</button>' +
                        '<button class="stf-card-action' + (s.bookmarked ? ' bookmarked' : '') + '" data-action="bookmark">' +
                            '<svg viewBox="0 0 24 24" fill="' + (s.bookmarked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
                            '<span>收藏</span>' +
                        '</button>' +
                        (window.StarTorchAuth && window.StarTorchAuth.isForumAdmin() ? '<button type="button" class="stf-card-action stf-admin-hide" data-action="admin-hide" title="管理员：隐藏该帖">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>' +
                            '<span>隐藏</span>' +
                        '</button>' : '') +
                        '<button type="button" class="stf-card-flip-back">返回 ↺</button>' +
                    '</div>' +
                    '<div class="stf-card-comments" id="stf-comments-' + s.id + '">' +
                        '<div class="stf-comment-list" id="stf-comment-list-' + s.id + '"></div>' +
                        '<form class="stf-comment-form" data-target="' + s.id + '">' +
                            '<input type="text" class="stf-comment-name" placeholder="昵称" maxlength="20" required>' +
                            '<input type="text" class="stf-comment-input" placeholder="写下你的评论……" maxlength="500" required>' +
                            '<button type="submit" class="stf-comment-submit">发送</button>' +
                        '</form>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</article>';
    }

    function renderComments(targetId) {
        var list = document.getElementById('stf-comment-list-' + targetId);
        if (!list) return;
        var comments = StarTorchData.getComments(targetId);
        if (!comments.length) {
            list.innerHTML = '<p class="stf-comments-empty">还没有评论</p>';
            return;
        }
        list.innerHTML = comments.filter(function (c) { return !c.is_hidden; }).map(function (c) {
            return '<div class="stf-comment">' +
                '<span class="stf-comment-name" style="color:' + sanitizeColor(c.color) + '">' + escapeHTML(c.name) + '</span>' +
                '<span class="stf-comment-text">' + escapeHTML(c.text) + '</span>' +
                '<span class="stf-comment-time">' + escapeHTML(c.timeStr) + '</span>' +
                (window.StarTorchAuth && window.StarTorchAuth.isForumAdmin() ? '<button type="button" class="stf-comment-hide" data-action="admin-hide-comment" data-hide-sub="' + targetId + '" data-hide-name="' + escapeHTML(c.name) + '" data-hide-text="' + escapeHTML(c.text) + '" title="管理员：隐藏该评论">✕</button>' : '') +
            '</div>';
        }).join('');
    }

    /** 窗口分页：首尾 + 当前附近页码，中间用省略号，避免上百个圆点横排 */
    function buildPageWindow(current, totalPages, siblingCount) {
        var siblings = typeof siblingCount === 'number' ? siblingCount : 1;
        var set = {};
        var i;
        set[0] = true;
        set[totalPages - 1] = true;
        for (i = current - siblings; i <= current + siblings; i++) {
            if (i >= 0 && i < totalPages) set[i] = true;
        }
        var list = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
        var out = [];
        var prev = null;
        for (i = 0; i < list.length; i++) {
            if (prev !== null && list[i] - prev > 1) out.push('ellipsis');
            out.push(list[i]);
            prev = list[i];
        }
        return out;
    }

    function renderPagination(total) {
        var nav = document.getElementById('stf-pagination');
        if (!nav) return;
        var pages = Math.ceil(total / COMMUNITY_PAGE_SIZE);
        if (pages <= 1) { nav.hidden = true; nav.innerHTML = ''; return; }
        if (communityPage >= pages) communityPage = pages - 1;
        if (communityPage < 0) communityPage = 0;
        nav.hidden = false;

        var html = '';
        html += '<button type="button" class="stf-page-btn stf-page-nav"' +
            (communityPage <= 0 ? ' disabled aria-disabled="true"' : '') +
            ' data-page="' + Math.max(0, communityPage - 1) + '" aria-label="上一页">‹</button>';

        var windowItems = buildPageWindow(communityPage, pages, 1);
        for (var i = 0; i < windowItems.length; i++) {
            var item = windowItems[i];
            if (item === 'ellipsis') {
                html += '<span class="stf-page-ellipsis" aria-hidden="true">…</span>';
                continue;
            }
            html += '<button type="button" class="stf-page-btn' +
                (item === communityPage ? ' active' : '') +
                '" data-page="' + item + '" aria-label="第 ' + (item + 1) + ' 页"' +
                (item === communityPage ? ' aria-current="page"' : '') +
                '>' + (item + 1) + '</button>';
        }

        html += '<button type="button" class="stf-page-btn stf-page-nav"' +
            (communityPage >= pages - 1 ? ' disabled aria-disabled="true"' : '') +
            ' data-page="' + Math.min(pages - 1, communityPage + 1) + '" aria-label="下一页">›</button>';

        html += '<span class="stf-page-info">' + (communityPage + 1) + ' / ' + pages + '</span>';
        nav.innerHTML = html;
    }

    function renderCommunity() {
        var grid = document.getElementById('stf-community-grid');
        var empty = document.getElementById('stf-community-empty');
        var countEl = document.getElementById('stf-community-count');
        if (!grid) return;

        var filtered = getFilteredSubmissions();
        if (countEl) countEl.textContent = filtered.length;

        renderStats();
        renderPagination(filtered.length);

        if (filtered.length === 0) {
            grid.innerHTML = '';
            if (empty) empty.classList.add('show');
            return;
        }
        if (empty) empty.classList.remove('show');

        var start = communityPage * COMMUNITY_PAGE_SIZE;
        var pageItems = filtered.slice(start, start + COMMUNITY_PAGE_SIZE);

        grid.innerHTML = pageItems.map(buildCardHTML).join('');

        // restore nickname
        var nickname = StarTorchData.getNickname();
        grid.querySelectorAll('.stf-comment-name').forEach(function (input) {
            if (nickname) input.value = nickname;
        });

        pageItems.forEach(function (s) { renderComments(s.id); });
    }

    /* ============ Actions ============ */
    function getAllSubmissions() {
        try {
            var data = localStorage.getItem('stf_submissions');
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    }

    function findSubmission(id) {
        return getAllSubmissions().find(function (s) { return s.id === id; });
    }

    function updateSubmission(id, mutator) {
        var list = getAllSubmissions();
        var idx = list.findIndex(function (s) { return s.id === id; });
        if (idx === -1) return null;
        mutator(list[idx]);
        StarTorchData.saveSubmissions(list);
        return list[idx];
    }

    function toggleLike(id) {
        var s = updateSubmission(id, function (item) {
            item.liked = !item.liked;
            item.likes = (item.likes || 0) + (item.liked ? 1 : -1);
        });
        if (s) {
            if (window.StarTorchCloud) window.StarTorchCloud.updateSubmission(s, function () {});
            renderCommunity();
            showToast(s.liked ? '已点赞 ❤' : '已取消点赞');
        }
    }

    function toggleBookmark(id) {
        var s = updateSubmission(id, function (item) {
            item.bookmarked = !item.bookmarked;
            item.bookmarks = (item.bookmarks || 0) + (item.bookmarked ? 1 : -1);
        });
        if (s) {
            if (window.StarTorchCloud) window.StarTorchCloud.updateSubmission(s, function () {});
            renderCommunity();
            showToast(s.bookmarked ? '已收藏 ★' : '已取消收藏');
        }
    }

    /* 管理员操作（多管理员，权限平等；UI 显隐由 isForumAdmin 控制，实际删除由 RLS 裁定） */
    function hideSubmission(id) {
        if (!window.StarTorchAuth || !window.StarTorchAuth.isForumAdmin()) return;
        var s = updateSubmission(id, function (item) { item.is_hidden = true; });
        if (s) {
            if (window.StarTorchCloud) window.StarTorchCloud.updateSubmission(s, function () {});
            renderCommunity();
            showToast('已隐藏该帖（管理员操作）');
        }
    }

    function hideComment(targetId, name, text) {
        if (!window.StarTorchAuth || !window.StarTorchAuth.isForumAdmin()) return;
        var list = StarTorchData.getComments(targetId);
        var updated = (list || []).map(function (c) {
            if (c.name === name && c.text === text) c.is_hidden = true;
            return c;
        });
        StarTorchData.saveComments(targetId, updated);
        if (window.StarTorchCloud) window.StarTorchCloud.hideComment(targetId, name, text, function () {});
        renderComments(targetId);
        showToast('已隐藏该评论（管理员操作）');
    }

    function toggleComments(id) {
        var panel = document.getElementById('stf-comments-' + id);
        if (!panel) return;
        var card = panel.closest('.stf-card');
        var open = panel.classList.toggle('open');
        if (card) card.classList.toggle('comments-open', open);
    }

    /* 立体翻转：点击卡片主体切换 is-flipped，驱动 rotateY(180deg) */
    function toggleCard(card) {
        if (!card) return;
        var flipped = card.classList.toggle('is-flipped');
        card.setAttribute('aria-expanded', flipped ? 'true' : 'false');
    }

    function addComment(targetId, name, text) {
        if (!name || !text) return;
        var comments = StarTorchData.getComments(targetId);
        var now = new Date();
        comments.push({
            name: name,
            text: text,
            color: '#A8D8FF',
            timeStr: (now.getMonth() + 1) + '月' + now.getDate() + '日 ' +
                String(now.getHours()).padStart(2, '0') + ':' +
                String(now.getMinutes()).padStart(2, '0')
        });
        StarTorchData.saveComments(targetId, comments);
        if (window.StarTorchCloud) {
            window.StarTorchCloud.pushComment(targetId, comments[comments.length - 1], function (ok) {
                if (!ok) console.warn('[forum] 评论上云失败，已转入离线队列');
            });
        }
        StarTorchData.setNickname(name);
        renderComments(targetId);
        showToast('评论已发送 ✨');
    }

    /* ============ Submission Modal ============ */
    function openSubmitModal() {
        var modal = document.getElementById('stf-submit-modal');
        if (modal) {
            modal.hidden = false;
            requestAnimationFrame(function () { modal.classList.add('open'); });
            restoreNickname('stf-submit');
            loadDraft('stf-submit');
            updateCounter('stf-submit');
        }
    }

    function closeSubmitModal() {
        var modal = document.getElementById('stf-submit-modal');
        if (modal) {
            modal.classList.remove('open');
            setTimeout(function () { modal.hidden = true; }, 300);
        }
    }

    /* 构建投稿对象（投稿弹窗 / 快捷发布框共用） */
    function buildSubmission(name, type, title, content, tags, identityId, attachment) {
        var now = new Date();
        var user = currentUser();
        var identity = user ? null : ANONYMOUS_IDENTITIES[identityId];
        var displayName = user ? user.name : (identity ? identity.name : name);
        var body = content;
        if (attachment && attachment.kind === 'audio') {
            body += '\n\n♪ 附件音频：' + attachment.name;
        }
        return {
            id: 'stf_' + now.getTime(),
            name: displayName,
            type: type,
            title: title,
            content: body,
            image: (attachment && attachment.image) ? attachment.image : '',
            realm: 'startorch',
            tags: tags || [],
            time: now.getTime(),
            timeStr: now.getFullYear() + '-' +
                String(now.getMonth() + 1).padStart(2, '0') + '-' +
                String(now.getDate()).padStart(2, '0') + ' ' +
                String(now.getHours()).padStart(2, '0') + ':' +
                String(now.getMinutes()).padStart(2, '0'),
            likes: 0,
            liked: false,
            bookmarks: 0,
            color: user ? sanitizeColor(user.color) : (identity ? identity.color : '#6B8AFF'),
            identity: user ? null : (identityId || null),
            author: user ? user.key : null
        };
    }

    /* 持久化新投稿并刷新 + 新节点脉冲 */
    function persistNewSubmission(newSub) {
        var list = getAllSubmissions();
        list.unshift(newSub);
        try {
            StarTorchData.saveSubmissions(list);
        } catch (e) {
            showToast('本地存储空间不足，请移除附件后重试');
            return false;
        }
        StarTorchData.setNickname(newSub.name);
        if (newSub.author && window.StarTorchAuth) window.StarTorchAuth.bumpPostCount();
        /* 上云（乐观更新本地已完成，云端后台同步；失败自动入队） */
        if (window.StarTorchCloud) {
            window.StarTorchCloud.pushSubmission(newSub, function (ok) {
                if (!ok) console.warn('[forum] 发帖上云失败，已转入离线队列');
            });
        }
        if (window.StarTorchSync) window.StarTorchSync.noteLocalWrite();
        clearDraft();
        searchQuery = '';
        var searchEl = document.getElementById('stf-search');
        if (searchEl) searchEl.value = '';
        communityFilter = 'all';
        communityPage = 0;
        updateFilterUI();
        renderCommunity();
        pulseNewCard(newSub.id);
        return true;
    }

    function pulseNewCard(id) {
        var card = document.querySelector('.stf-card[data-id="' + id + '"]');
        if (!card) return;
        card.classList.add('is-new');
        setTimeout(function () { card.classList.remove('is-new'); }, 1100);
    }

    function readTagsFrom(selectorEl) {
        var tags = [];
        if (selectorEl) {
            selectorEl.querySelectorAll('.select-tag.active').forEach(function (chip) {
                tags.push(chip.getAttribute('data-tag'));
            });
        }
        return tags;
    }

    function handleSubmit(e) {
        e.preventDefault();
        var modal = document.getElementById('stf-submit-modal');
        if (!modal) return;

        var identityId = modal.querySelector('#stf-submit-identity').value;
        var rawName = modal.querySelector('#stf-submit-nickname').value.trim();
        var type = modal.querySelector('#stf-submit-type').value;
        var rawTitle = modal.querySelector('#stf-submit-title').value.trim();
        var rawContent = modal.querySelector('#stf-submit-content').value.trim();

        if (!validateFields(rawName, rawTitle, rawContent)) return;

        var selectedTags = readTagsFrom(modal.querySelector('#stf-submit-tag-selector'));
        var attachment = window.StarTorchUpload ? window.StarTorchUpload.getAttachment('stf-submit') : null;
        var newSub = buildSubmission(rawName, type, rawTitle, rawContent, selectedTags, identityId, attachment);

        if (!persistNewSubmission(newSub)) return;

        modal.querySelector('form').reset();
        modal.querySelectorAll('.select-tag.active').forEach(function (c) { c.classList.remove('active'); });
        if (window.StarTorchUpload) window.StarTorchUpload.clear('stf-submit');
        syncIdentityControls('stf-submit', '');
        updateCounter('stf-submit');
        closeSubmitModal();
        showToast('投稿成功，已发布到星炬学院论坛 ✨');
    }

    /* 统一字段校验，上限已提升 3 倍 */
    function validateFields(name, title, content) {
        if (!name || !title || !content) { showToast('请填写完整信息'); return false; }
        if (name.length > LIMIT_NAME) { showToast('昵称限 ' + LIMIT_NAME + ' 字'); return false; }
        if (title.length > LIMIT_TITLE) { showToast('标题限 ' + LIMIT_TITLE + ' 字'); return false; }
        if (content.length > LIMIT_CONTENT) { showToast('内容限 ' + LIMIT_CONTENT + ' 字'); return false; }
        return true;
    }

    /* 快捷发布框（feed 内常驻）提交 */
    function handleQuickSubmit(e) {
        e.preventDefault();
        var form = document.getElementById('stf-composer-form');
        if (!form) return;

        var identityId = form.querySelector('#stf-composer-identity').value;
        var rawName = form.querySelector('#stf-composer-nickname').value.trim();
        var type = form.querySelector('#stf-composer-type').value;
        var rawTitle = form.querySelector('#stf-composer-title').value.trim();
        var rawContent = form.querySelector('#stf-composer-content').value.trim();

        if (!validateFields(rawName, rawTitle, rawContent)) return;

        var selectedTags = readTagsFrom(form.querySelector('#stf-composer-tag-selector'));
        var attachment = window.StarTorchUpload ? window.StarTorchUpload.getAttachment('stf-composer') : null;
        var newSub = buildSubmission(rawName, type, rawTitle, rawContent, selectedTags, identityId, attachment);

        if (!persistNewSubmission(newSub)) return;

        form.reset();
        form.querySelectorAll('.select-tag.active').forEach(function (c) { c.classList.remove('active'); });
        if (window.StarTorchUpload) window.StarTorchUpload.clear('stf-composer');
        syncIdentityControls('stf-composer', '');
        updateCounter('stf-composer');
        closeComposer();
        showToast('已发布到星炬学院论坛 ✨');
    }

    /* ============ 字数计数 / 草稿 ============ */
    function updateCounter(prefix) {
        var textarea = document.getElementById(prefix + '-content');
        var counter = document.getElementById(prefix + '-counter');
        if (!textarea || !counter) return;
        var len = textarea.value.length;
        counter.textContent = len + ' / ' + LIMIT_CONTENT;
        counter.classList.toggle('is-warn', len > LIMIT_CONTENT * 0.9);
    }

    function saveDraft(prefix) {
        var title = document.getElementById(prefix + '-title');
        var content = document.getElementById(prefix + '-content');
        if (!title || !content) return;
        if (!title.value.trim() && !content.value.trim()) { clearDraft(); return; }
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify({
                title: title.value, content: content.value, at: Date.now()
            }));
        } catch (e) { /* 配额不足时静默 */ }
        var hint = document.getElementById(prefix + '-draft');
        if (hint) {
            hint.textContent = '草稿已保存';
            clearTimeout(hint._t);
            hint._t = setTimeout(function () { hint.textContent = ''; }, 1800);
        }
    }

    function clearDraft() {
        try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
    }

    function loadDraft(prefix) {
        var raw;
        try { raw = localStorage.getItem(DRAFT_KEY); } catch (e) { return; }
        if (!raw) return;
        var draft;
        try { draft = JSON.parse(raw); } catch (e) { return; }
        if (!draft) return;
        var title = document.getElementById(prefix + '-title');
        var content = document.getElementById(prefix + '-content');
        if (title && !title.value) title.value = draft.title || '';
        if (content && !content.value) content.value = draft.content || '';
        updateCounter(prefix);
        var hint = document.getElementById(prefix + '-draft');
        if (hint && (draft.title || draft.content)) hint.textContent = '已恢复上次草稿';
    }

    function openComposer() {
        var composer = document.getElementById('stf-composer');
        var form = document.getElementById('stf-composer-form');
        var trigger = document.getElementById('stf-composer-trigger');
        if (!composer || !form) return;
        form.hidden = false;
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
        restoreNickname('stf-composer');
        loadDraft('stf-composer');
        updateCounter('stf-composer');
        var first = form.querySelector('#stf-composer-title');
        if (first) first.focus();
    }

    function closeComposer() {
        var form = document.getElementById('stf-composer-form');
        var trigger = document.getElementById('stf-composer-trigger');
        if (!form) return;
        form.hidden = true;
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }

    function updateFilterUI() {
        document.querySelectorAll('.stf-filter-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === communityFilter);
        });
    }

    /* ============ Event Binding ============ */
    function bindEvents() {
        // filter buttons
        document.querySelectorAll('.stf-filter-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                communityFilter = btn.getAttribute('data-filter');
                communityPage = 0;
                updateFilterUI();
                renderCommunity();
            });
        });

        // tag chips
        document.querySelectorAll('.stf-tag-chip').forEach(function (chip) {
            chip.addEventListener('click', function () {
                var tag = chip.getAttribute('data-tag');
                chip.classList.toggle('active');
                if (chip.classList.contains('active')) {
                    if (activeTags.indexOf(tag) === -1) activeTags.push(tag);
                } else {
                    activeTags = activeTags.filter(function (t) { return t !== tag; });
                }
                communityPage = 0;
                renderCommunity();
            });
        });

        // pagination
        var pagination = document.getElementById('stf-pagination');
        if (pagination) {
            pagination.addEventListener('click', function (e) {
                var btn = e.target.closest('.stf-page-btn');
                if (!btn || btn.disabled) return;
                var nextPage = parseInt(btn.getAttribute('data-page'), 10);
                if (isNaN(nextPage) || nextPage === communityPage) return;
                communityPage = nextPage;
                renderCommunity();
                var section = document.getElementById('stf-community');
                if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }

        // sort toggle (最新 / 热门)
        document.querySelectorAll('.stf-sort-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                communitySort = btn.getAttribute('data-sort');
                document.querySelectorAll('.stf-sort-btn').forEach(function (b) {
                    b.classList.toggle('active', b === btn);
                });
                communityPage = 0;
                renderCommunity();
            });
        });

        // grid actions
        var grid = document.getElementById('stf-community-grid');
        if (grid) {
            grid.addEventListener('click', function (e) {
                var card = e.target.closest('.stf-card');
                if (!card) return;
                var id = card.getAttribute('data-id');

                // 评论区域点击不触发翻转
                if (e.target.closest('.stf-comment-form, .stf-card-comments, .stf-comment-list')) return;

                if (e.target.closest('[data-action="like"]')) { toggleLike(id); return; }
                if (e.target.closest('[data-action="comment"]')) { toggleComments(id); return; }
                if (e.target.closest('[data-action="bookmark"]')) { toggleBookmark(id); return; }
                if (e.target.closest('[data-action="admin-hide"]')) { hideSubmission(id); return; }

                // 翻转触发：正面/背面空白区域或显式翻转按钮
                toggleCard(card);
            });

            grid.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                var card = e.target.closest('.stf-card');
                if (!card) return;
                // 焦点在按钮/输入时不拦截
                if (e.target.closest('button, input, textarea, a')) return;
                e.preventDefault();
                toggleCard(card);
            });

            grid.addEventListener('submit', function (e) {
                var form = e.target.closest('.stf-comment-form');
                if (!form) return;
                e.preventDefault();
                var targetId = form.getAttribute('data-target');
                var name = form.querySelector('.stf-comment-name').value.trim();
                var text = form.querySelector('.stf-comment-input').value.trim();
                if (!name || !text) { showToast('请填写昵称和评论'); return; }
                addComment(targetId, name, text);
                form.querySelector('.stf-comment-input').value = '';
            });

            /* 管理员：隐藏评论（评论区在 grid 主点击处理器中被 early-return，这里单独代理） */
            grid.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-action="admin-hide-comment"]');
                if (!btn) return;
                e.stopPropagation();
                hideComment(btn.getAttribute('data-hide-sub'), btn.getAttribute('data-hide-name'), btn.getAttribute('data-hide-text'));
            });
        }

        // 快捷发布框
        var composerTrigger = document.getElementById('stf-composer-trigger');
        if (composerTrigger) {
            composerTrigger.addEventListener('click', function () {
                var form = document.getElementById('stf-composer-form');
                if (form && form.hidden) openComposer(); else closeComposer();
            });
        }
        var composerCancel = document.getElementById('stf-composer-cancel');
        if (composerCancel) composerCancel.addEventListener('click', closeComposer);
        var composerForm = document.getElementById('stf-composer-form');
        if (composerForm) composerForm.addEventListener('submit', handleQuickSubmit);

        // 快捷发布框匿名身份
        var composerIdentity = document.getElementById('stf-composer-identity');
        if (composerIdentity) {
            composerIdentity.addEventListener('change', function () {
                syncIdentityControls('stf-composer', composerIdentity.value);
            });
        }

        // 快捷发布框标签选择器
        var composerSelector = document.getElementById('stf-composer-tag-selector');
        if (composerSelector) {
            composerSelector.addEventListener('click', function (e) {
                var chip = e.target.closest('.select-tag');
                if (!chip) return;
                e.preventDefault();
                var activeCount = composerSelector.querySelectorAll('.select-tag.active').length;
                if (!chip.classList.contains('active') && activeCount >= 5) {
                    showToast('最多选择5个标签');
                    return;
                }
                chip.classList.toggle('active');
            });
        }

        // submit modal
        document.querySelectorAll('[data-action="open-submit"]').forEach(function (btn) {
            btn.addEventListener('click', openSubmitModal);
        });

        var submitModal = document.getElementById('stf-submit-modal');
        if (submitModal) {
            submitModal.querySelectorAll('[data-close]').forEach(function (el) {
                el.addEventListener('click', closeSubmitModal);
            });
            submitModal.addEventListener('click', function (e) {
                if (e.target === submitModal) closeSubmitModal();
            });
            var form = submitModal.querySelector('form');
            if (form) form.addEventListener('submit', handleSubmit);

            // identity selector in modal
            var identitySelect = submitModal.querySelector('#stf-submit-identity');
            if (identitySelect) {
                identitySelect.addEventListener('change', function () {
                    syncIdentityControls('stf-submit', identitySelect.value);
                });
            }

            // tag selector in modal
            var selector = submitModal.querySelector('#stf-submit-tag-selector');
            if (selector) {
                selector.addEventListener('click', function (e) {
                    var chip = e.target.closest('.select-tag');
                    if (!chip) return;
                    e.preventDefault();
                    var activeCount = selector.querySelectorAll('.select-tag.active').length;
                    if (!chip.classList.contains('active') && activeCount >= 5) {
                        showToast('最多选择5个标签');
                        return;
                    }
                    chip.classList.toggle('active');
                });
            }
        }

        /* 社区搜索（防抖） */
        var searchInput = document.getElementById('stf-search');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                searchQuery = searchInput.value.trim();
                var clearBtn = document.getElementById('stf-search-clear');
                if (clearBtn) clearBtn.hidden = !searchQuery;
                if (searchTimer) clearTimeout(searchTimer);
                searchTimer = setTimeout(function () {
                    communityPage = 0;
                    renderCommunity();
                }, 220);
            });
        }
        var searchClear = document.getElementById('stf-search-clear');
        if (searchClear) {
            searchClear.addEventListener('click', function () {
                searchQuery = '';
                if (searchInput) searchInput.value = '';
                searchClear.hidden = true;
                communityPage = 0;
                renderCommunity();
            });
        }

        /* 快捷发布框 / 投稿弹窗：正文输入即计数 + 存草稿 */
        ['stf-composer', 'stf-submit'].forEach(function (prefix) {
            var contentEl = document.getElementById(prefix + '-content');
            if (contentEl) {
                contentEl.addEventListener('input', function () {
                    updateCounter(prefix);
                    saveDraft(prefix);
                });
            }
        });

        /* 登录态变化 → 刷新两个表单的署名控件 */
        if (window.StarTorchAuth) window.StarTorchAuth.onChange(syncAuthUI);

        /* 调谐台彩蛋入口 */
        initTuner();
    }

    /* ============ Nav enhancements: mobile toggle + scrollspy ============ */
    function initNavEnhancements() {
        var toggle = document.getElementById('nav-toggle');
        var links = document.getElementById('nav-links');
        if (toggle && links) {
            toggle.addEventListener('click', function () {
                var open = links.classList.toggle('open');
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
            links.querySelectorAll('a').forEach(function (a) {
                a.addEventListener('click', function () {
                    links.classList.remove('open');
                    toggle.setAttribute('aria-expanded', 'false');
                });
            });
        }

        var navLinks = Array.prototype.slice.call(document.querySelectorAll('#nav-links .nav-link'));
        var map = navLinks.map(function (l) {
            var id = l.getAttribute('href');
            return (id && id.charAt(0) === '#') ? document.querySelector(id) : null;
        }).filter(Boolean);

        function onScroll() {
            if (!map.length) return;
            var pos = window.scrollY + 130;
            var current = map[0];
            map.forEach(function (sec) { if (sec.offsetTop <= pos) current = sec; });
            var currentId = current ? current.id : '';
            navLinks.forEach(function (l) {
                l.classList.toggle('active', l.getAttribute('href') === '#' + currentId);
            });
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ============ Tuner：深夜电台调谐台（彩蛋入口） ============ */
    function initTuner() {
        var wrap = document.getElementById('stf-tuner-dials');
        if (!wrap) return;

        var inputs = ['0', '1', '2', '3'].map(function (i) {
            return document.getElementById('stf-dial-' + i);
        });
        var stateEl = document.getElementById('stf-tuner-state');
        var ledEl = document.getElementById('stf-tuner-led');
        var fillEl = document.getElementById('stf-tuner-signal-fill');
        var numEl = document.getElementById('stf-tuner-signal-num');
        var hintEl = document.getElementById('stf-tuner-hint');
        var waveEl = document.getElementById('stf-tuner-wave');

        var TARGET_CODE = '9072';
        var TARGET_FREQ = 9072;
        var locked = false;

        /* —— 信号模型参数 ——
         * 真实接收机的响应不是「对了几位」，而是与目标频率的距离决定的。
         * 用双洛伦兹（宽捕获 + 窄锁定）叠加：远处给方向感，近处才陡峭上升。
         */
        var CAPTURE_WIDTH = 900;   /* 宽频段半高宽：负责"大方向对不对" */
        var LOCK_WIDTH    = 6;     /* 窄锁定半高宽：负责"临门一脚"      */
        var NOISE_FLOOR   = 1.5;   /* 本底噪声：永远不会真的是 0%       */

        var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        var trueSnr = NOISE_FLOOR;   /* 真实信噪比（无噪声）   */
        var shownSnr = NOISE_FLOOR;  /* 屏幕上平滑后的显示值   */
        var rafId = null;
        var lastFrame = 0;
        var lastHint = '';
        var visible = true;
        var DEFAULT_HINT = '拨动数字轮，或直接键入四位频率 —— 深夜里，总有人在某个频率上唱歌。';

        function cur(idx) { return parseInt((inputs[idx] && inputs[idx].value) || '0', 10) || 0; }

        function setDigit(idx, val) {
            var v = ((val % 10) + 10) % 10;
            if (inputs[idx]) inputs[idx].value = String(v);
        }

        function readCode() {
            return inputs.map(function (inp) { return (inp && inp.value) ? inp.value.charAt(0) : '0'; }).join('');
        }

        function readFreq() { return parseInt(readCode(), 10) || 0; }

        /* 谐振响应曲线 */
        function computeSnr() {
            var delta = Math.abs(readFreq() - TARGET_FREQ);
            if (delta === 0) return 100;
            var coarse = 100 / (1 + Math.pow(delta / CAPTURE_WIDTH, 2));
            var fine   = 100 / (1 + Math.pow(delta / LOCK_WIDTH, 2));
            return Math.max(NOISE_FLOOR, 0.35 * coarse + 0.65 * fine);
        }

        function tierText(snr) {
            if (snr >= 85) return '频率接近…';
            if (snr >= 40) return '捕获中';
            if (snr >= 8)  return '有信号';
            if (snr >= 3)  return '噪声';
            return '待机';
        }

        function directionHint(snr) {
            if (snr < 8) return DEFAULT_HINT;
            var freq = readFreq();
            if (freq === TARGET_FREQ) return DEFAULT_HINT;
            return freq < TARGET_FREQ
                ? '载波在更高的频率上 —— 往上拨 ▲'
                : '载波在更低的频率上 —— 往下拨 ▼';
        }

        /* 逐位反馈：拨对一位就立刻点亮那一位 */
        function paintDigits() {
            var code = readCode();
            for (var i = 0; i < 4; i++) {
                if (!inputs[i]) continue;
                inputs[i].classList.toggle('is-hit', !locked && code.charAt(i) === TARGET_CODE.charAt(i));
                inputs[i].classList.toggle('is-locked', locked);
            }
        }

        /* 把当前显示值刷到 DOM */
        function paint(snr) {
            var pct = Math.max(0, Math.min(100, snr));
            var shown = pct >= 99.5 ? 100 : Math.round(pct * 10) / 10;
            if (fillEl) fillEl.style.width = pct.toFixed(1) + '%';
            if (numEl) numEl.textContent = (pct >= 10 ? shown.toFixed(0) : shown.toFixed(1)) + '%';
            if (waveEl) waveEl.style.setProperty('--level', pct.toFixed(1) + '%');
            if (ledEl) {
                ledEl.classList.toggle('is-locked', locked);
                ledEl.classList.toggle('is-tuned', !locked && pct >= 40);
            }
        }

        /* 输入变化 → 立刻重算真实值并给出即时反馈（不等动画） */
        function updateSignal() {
            trueSnr = computeSnr();
            paintDigits();
            if (!locked) {
                if (stateEl) stateEl.textContent = tierText(trueSnr);
                var h = directionHint(trueSnr);
                if (hintEl && h !== lastHint) { hintEl.textContent = h; lastHint = h; }
            }
            if (reduceMotion || locked) {
                shownSnr = trueSnr;
                paint(shownSnr);
            } else {
                /* 立即给一次响应，避免"按了没反应"的迟滞感 */
                shownSnr += (trueSnr - shownSnr) * 0.55;
                paint(shownSnr);
                startLoop();
            }
        }

        /* 接收机噪声：信号越弱抖得越厉害，锁定后完全稳定 */
        function frame(ts) {
            rafId = null;
            if (!visible) return;
            if (ts - lastFrame < 60) { startLoop(); return; }   /* ~16fps，够真实也不烧 CPU */
            lastFrame = ts;

            shownSnr += (trueSnr - shownSnr) * 0.22;

            var display = shownSnr;
            if (!locked) {
                var q = Math.max(0, Math.min(1, trueSnr / 100));
                var amp = (1 - q) * 5.5 + 0.35;              /* 弱信号抖动大 */
                display = shownSnr + (Math.random() - 0.5) * 2 * amp;
                display = Math.max(0.2, Math.min(100, display));
            }
            paint(display);

            if (locked && Math.abs(trueSnr - shownSnr) < 0.05) { paint(trueSnr); return; }
            startLoop();
        }

        function startLoop() {
            if (rafId !== null || reduceMotion || !visible) return;
            rafId = requestAnimationFrame(frame);
        }

        function stopLoop() {
            if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
        }

        function checkLock() {
            if (locked) return;
            updateSignal();
            if (readCode() === TARGET_CODE) {
                locked = true;
                trueSnr = 100;
                shownSnr = 100;
                paint(100);
                paintDigits();
                if (stateEl) stateEl.textContent = '已锁定 · 9072';
                if (ledEl) { ledEl.classList.add('is-locked'); ledEl.classList.remove('is-tuned'); }
                if (hintEl) { hintEl.textContent = '信号锁定 —— 正在接通深夜电台…'; lastHint = hintEl.textContent; }
                stopLoop();
                if (window.playTransition) setTimeout(window.playTransition, 480);
            }
        }

        /* 步进按钮 */
        wrap.addEventListener('click', function (e) {
            var btn = e.target.closest('.stf-dial-step');
            if (!btn) return;
            var idx = parseInt(btn.getAttribute('data-index'), 10);
            var dir = btn.getAttribute('data-dial-step') === 'up' ? 1 : -1;
            setDigit(idx, cur(idx) + dir);
            checkLock();
        });

        inputs.forEach(function (inp, idx) {
            if (!inp) return;
            inp.addEventListener('keydown', function (e) {
                if (e.key === 'ArrowUp') { e.preventDefault(); setDigit(idx, cur(idx) + 1); checkLock(); return; }
                if (e.key === 'ArrowDown') { e.preventDefault(); setDigit(idx, cur(idx) - 1); checkLock(); return; }
                if (e.key === 'ArrowLeft' && idx > 0 && inputs[idx - 1]) { e.preventDefault(); inputs[idx - 1].focus(); return; }
                if (e.key === 'ArrowRight' && idx < 3 && inputs[idx + 1]) { e.preventDefault(); inputs[idx + 1].focus(); return; }
                if (/^\d$/.test(e.key)) {
                    e.preventDefault();
                    setDigit(idx, parseInt(e.key, 10));
                    if (idx < 3 && inputs[idx + 1]) inputs[idx + 1].focus();
                    checkLock();
                }
            });
            inp.addEventListener('input', function () {
                var d = (inp.value.replace(/\D/g, '') || '0').charAt(0);
                inp.value = d;
                if (idx < 3 && inputs[idx + 1]) inputs[idx + 1].focus();
                checkLock();
            });
            /* 滚轮微调：真实调谐台的手感 */
            inp.addEventListener('wheel', function (e) {
                if (locked) return;
                e.preventDefault();
                setDigit(idx, cur(idx) + (e.deltaY < 0 ? 1 : -1));
                checkLock();
            }, { passive: false });
        });

        /* 离开视口时停掉噪声循环，避免无谓耗电 */
        if (typeof IntersectionObserver !== 'undefined') {
            new IntersectionObserver(function (entries) {
                visible = entries[0].isIntersecting;
                if (visible) startLoop(); else stopLoop();
            }, { threshold: 0.05 }).observe(wrap);
        }
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) stopLoop(); else startLoop();
        });

        updateSignal();
    }

    /* ============ Init ============ */
    function init() {
        if (!window.StarTorchData) {
            console.warn('[StarTorchForum] Data layer not loaded');
            return;
        }
        StarTorchData.ensureSeedData();
        bindEvents();
        updateFilterUI();
        renderCommunity();
        initNavEnhancements();

        /* 投稿附件上传（独立模块，不依赖飞行雪绒站 UploadManager） */
        if (window.StarTorchUpload) {
            StarTorchUpload.attach('stf-composer');
            StarTorchUpload.attach('stf-submit');
        }
    }

    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);
})();
