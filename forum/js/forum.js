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

    var COMMUNITY_PAGE_SIZE = 8;
    var communityFilter = 'all';
    var communitySort = 'new';
    var communityPage = 0;
    var activeTags = [];
    var searchQuery = '';
    var searchTimer = null;
    var ESSENCE_LIKE_MIN = 20;
    var PINNED_MAX = 3;

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

    /* 登录态变化时，实时刷新署名控件 + 管理按钮可见性 */
    function syncAuthUI() {
        ['stf-composer', 'stf-submit'].forEach(function (prefix) {
            if (document.getElementById(prefix + '-nickname')) restoreNickname(prefix);
        });
        var trigger = document.querySelector('.stf-composer-placeholder');
        if (trigger) {
            var user = currentUser();
            trigger.textContent = user
                ? (user.name + '，说点什么…')
                : '说点什么，或分享你的鸣潮同人…';
        }
        updateStaffBar();
        /* 登录后补上隐藏按钮；登出后移除 */
        try { renderCommunity(); } catch (e) { /* 尚未初始化时忽略 */ }
    }

    function isStaff() {
        return !!(window.StarTorchAuth && (
            (window.StarTorchAuth.isForumStaff && window.StarTorchAuth.isForumStaff()) ||
            (window.StarTorchAuth.isForumAdmin && window.StarTorchAuth.isForumAdmin())
        ));
    }

    function updateStaffBar() {
        var bar = document.getElementById('stf-staff-bar');
        if (!bar) return;
        var on = isStaff();
        bar.hidden = !on;
        var roleEl = document.getElementById('stf-staff-role');
        if (roleEl && on) {
            var u = currentUser();
            var role = (u && u.role) || 'admin';
            roleEl.textContent = role === 'moderator' ? '版主模式' : '管理员模式';
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

    function isEssencePost(s) {
        if (!s) return false;
        if ((s.likes || 0) >= ESSENCE_LIKE_MIN) return true;
        if (!s.tags || !Array.isArray(s.tags)) return false;
        return s.tags.some(function (t) {
            return t === '精华' || t === '置顶' || t === '公告';
        });
    }

    function getPinnedCandidates(pool) {
        var tagged = [];
        var hot = [];
        (pool || []).forEach(function (s) {
            var hasPinTag = s.tags && s.tags.some(function (t) {
                return t === '置顶' || t === '公告' || t === '精华';
            });
            if (hasPinTag) tagged.push(s);
            else if ((s.likes || 0) >= ESSENCE_LIKE_MIN) hot.push(s);
        });
        tagged.sort(function (a, b) { return (b.likes || 0) - (a.likes || 0); });
        hot.sort(function (a, b) { return (b.likes || 0) - (a.likes || 0); });
        var merged = tagged.concat(hot);
        var seen = {};
        var out = [];
        for (var i = 0; i < merged.length && out.length < PINNED_MAX; i++) {
            if (seen[merged[i].id]) continue;
            seen[merged[i].id] = true;
            out.push(merged[i]);
        }
        return out;
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

        if (communitySort === 'essence') {
            filtered = filtered.filter(isEssencePost);
            return filtered.sort(function (a, b) {
                var la = a.likes || 0, lb = b.likes || 0;
                if (lb !== la) return lb - la;
                return (b.time || 0) - (a.time || 0);
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
        var members = new Set(subs.map(function (s) { return s.name; })).size;
        var w = document.getElementById('stf-stat-works');
        var m = document.getElementById('stf-stat-members');
        if (w) w.textContent = works;
        if (m) m.textContent = members;
    }

    function displayTitle(s) {
        if (s && s.title && String(s.title).trim()) return String(s.title).trim();
        var body = (s && s.content) ? String(s.content).replace(/\s+/g, ' ').trim() : '';
        if (!body) return '无标题讨论';
        return body.length > 36 ? body.slice(0, 36) + '…' : body;
    }

    function buildCardHTML(s) {
        var initial = s.name.charAt(0).toUpperCase();
        var bgColor = sanitizeColor(s.color);
        var cardCharColor = charColorForSubmission(s);
        var cardCharStyle = cardCharColor ? ' style="--char:' + cardCharColor + '"' : '';
        var commentCount = (StarTorchData.getComments(s.id) || []).length;
        var title = displayTitle(s);
        var fullLen = (s.content || '').length;
        var needsExpand = fullLen > 90;
        var preview = escapeHTML(previewText(s.content, 90));

        var tagsHtml = '';
        if (s.tags && s.tags.length) {
            tagsHtml = '<div class="stf-card-tags">' +
                s.tags.map(function (t) { return '<span class="stf-card-tag">' + escapeHTML(t) + '</span>'; }).join('') +
                '</div>';
        }

        var coverHtml = s.image
            ? '<img class="stf-card-cover" src="' + escapeHTML(s.image) + '" alt="" loading="lazy">'
            : '';

        var essenceBadge = isEssencePost(s)
            ? '<span class="stf-card-badge" data-type="essence" title="精华">精华</span>'
            : '';

        return '<article class="stf-card" data-id="' + s.id + '"' + cardCharStyle + '>' +
            '<div class="stf-card-header">' +
                '<div class="stf-card-avatar" style="background:' + bgColor + '">' + escapeHTML(initial) + '</div>' +
                '<div class="stf-card-info">' +
                    '<div class="stf-card-author">' + escapeHTML(s.name) + '</div>' +
                    '<div class="stf-card-time">' + escapeHTML(s.timeStr) + '</div>' +
                '</div>' +
                essenceBadge +
                '<span class="stf-card-badge" data-type="' + s.type + '">' + (typeLabels[s.type] || s.type) + '</span>' +
            '</div>' +
            '<h3 class="stf-card-title">' + escapeHTML(title) + '</h3>' +
            coverHtml +
            '<div class="stf-card-preview">' + preview + '</div>' +
            '<div class="stf-card-content">' + escapeHTML(s.content) + '</div>' +
            (needsExpand
                ? '<button type="button" class="stf-card-expand-btn" data-action="expand">' +
                    (needsExpand ? '展开全文' : '') + '</button>'
                : '') +
            tagsHtml +
            '<div class="stf-card-actions">' +
                '<button type="button" class="stf-card-action' + (s.liked ? ' liked' : '') + '" data-action="like" title="点赞">' +
                    '<svg viewBox="0 0 24 24" fill="' + (s.liked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
                    '<span>' + (s.likes || 0) + '</span>' +
                '</button>' +
                '<button type="button" class="stf-card-action" data-action="comment" title="评论">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
                    '<span>' + commentCount + '</span>' +
                '</button>' +
                '<button type="button" class="stf-card-action' + (s.bookmarked ? ' bookmarked' : '') + '" data-action="bookmark" title="收藏">' +
                    '<svg viewBox="0 0 24 24" fill="' + (s.bookmarked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
                    '<span>收藏</span>' +
                '</button>' +
                (isStaff() ? '<button type="button" class="stf-card-action stf-admin-hide" data-action="admin-hide" title="版主/管理员：隐藏该帖">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>' +
                    '<span>隐藏</span>' +
                '</button>' : '') +
            '</div>' +
            '<div class="stf-card-comments" id="stf-comments-' + s.id + '">' +
                '<div class="stf-comment-list" id="stf-comment-list-' + s.id + '"></div>' +
                '<form class="stf-comment-form" data-target="' + s.id + '">' +
                    '<input type="text" class="stf-comment-name" placeholder="昵称" maxlength="20" required>' +
                    '<input type="text" class="stf-comment-input" placeholder="写下你的评论……" maxlength="500" required>' +
                    '<button type="submit" class="stf-comment-submit">发送</button>' +
                '</form>' +
            '</div>' +
        '</article>';
    }

    function renderPinned() {
        var wrap = document.getElementById('stf-pinned');
        var list = document.getElementById('stf-pinned-list');
        if (!wrap || !list) return;
        var pool = StarTorchData.getSubmissions().filter(function (s) { return !s.is_hidden; });
        var pins = getPinnedCandidates(pool);
        if (!pins.length) {
            wrap.hidden = true;
            list.innerHTML = '';
            return;
        }
        wrap.hidden = false;
        list.innerHTML = pins.map(function (s) {
            var badge = (s.tags && s.tags.indexOf('公告') !== -1) ? '公告'
                : (s.tags && s.tags.indexOf('置顶') !== -1) ? '置顶' : '精华';
            return '<li><button type="button" class="stf-pinned-item" data-pin-id="' + escapeHTML(s.id) + '">' +
                '<span class="stf-pinned-badge">' + badge + '</span>' +
                '<span class="stf-pinned-title">' + escapeHTML(displayTitle(s)) + '</span>' +
                '<span class="stf-pinned-meta">❤ ' + (s.likes || 0) + '</span>' +
            '</button></li>';
        }).join('');
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
                (isStaff() ? '<button type="button" class="stf-comment-hide" data-action="admin-hide-comment" data-hide-sub="' + targetId + '" data-hide-name="' + escapeHTML(c.name) + '" data-hide-text="' + escapeHTML(c.text) + '" title="版主/管理员：隐藏该评论">✕</button>' : '') +
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
        renderPinned();
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

    /* 版主/管理员操作（UI 由 isStaff 控制；云端由 is_forum_admin()/profiles.role 裁定） */
    function hideSubmission(id) {
        if (!isStaff()) return;
        if (!window.confirm('确认隐藏该帖？隐藏后普通访客将不可见。')) return;
        var s = updateSubmission(id, function (item) { item.is_hidden = true; });
        if (s) {
            if (window.StarTorchCloud) window.StarTorchCloud.updateSubmission(s, function () {});
            renderCommunity();
            showToast('已隐藏该帖');
        }
    }

    function hideComment(targetId, name, text) {
        if (!isStaff()) return;
        if (!window.confirm('确认隐藏该评论？')) return;
        var list = StarTorchData.getComments(targetId);
        var updated = (list || []).map(function (c) {
            if (c.name === name && c.text === text) c.is_hidden = true;
            return c;
        });
        StarTorchData.saveComments(targetId, updated);
        if (window.StarTorchCloud) window.StarTorchCloud.hideComment(targetId, name, text, function () {});
        renderComments(targetId);
        showToast('已隐藏该评论');
    }

    function toggleComments(id) {
        var panel = document.getElementById('stf-comments-' + id);
        if (!panel) return;
        var card = panel.closest('.stf-card');
        var open = panel.classList.toggle('open');
        if (card) card.classList.toggle('comments-open', open);
    }

    /* 展开/收起全文（替代立体翻转） */
    function toggleExpand(card) {
        if (!card) return;
        var expanded = card.classList.toggle('is-expanded');
        var btn = card.querySelector('[data-action="expand"]');
        if (btn) btn.textContent = expanded ? '收起' : '展开全文';
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
        var finalTitle = (title && String(title).trim()) || '';
        if (!finalTitle) {
            var snippet = String(body || '').replace(/\s+/g, ' ').trim();
            finalTitle = snippet ? (snippet.length > 36 ? snippet.slice(0, 36) + '…' : snippet) : '无标题讨论';
        }
        return {
            id: 'stf_' + now.getTime(),
            name: displayName,
            type: type,
            title: finalTitle,
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
        showToast('发帖成功，已发布到讨论区 ✨');
    }

    /* 统一字段校验：标题可选，正文必填 */
    function validateFields(name, title, content) {
        if (!name || !content) { showToast('请填写昵称和正文'); return false; }
        if (name.length > LIMIT_NAME) { showToast('昵称限 ' + LIMIT_NAME + ' 字'); return false; }
        if (title && title.length > LIMIT_TITLE) { showToast('标题限 ' + LIMIT_TITLE + ' 字'); return false; }
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
        showToast('已发布到讨论区 ✨');
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

        // sort toggle (全部 / 热门 / 精华) — 新 Tab 与旧 sort 按钮兼容
        document.querySelectorAll('.stf-feed-tab, .stf-sort-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                communitySort = btn.getAttribute('data-sort') || 'new';
                document.querySelectorAll('.stf-feed-tab, .stf-sort-btn').forEach(function (b) {
                    var on = b.getAttribute('data-sort') === communitySort;
                    b.classList.toggle('active', on);
                    if (b.getAttribute('role') === 'tab') b.setAttribute('aria-selected', on ? 'true' : 'false');
                });
                communityPage = 0;
                renderCommunity();
            });
        });

        // 置顶区收起 + 跳转
        var pinnedToggle = document.getElementById('stf-pinned-toggle');
        if (pinnedToggle) {
            pinnedToggle.addEventListener('click', function () {
                var wrap = document.getElementById('stf-pinned');
                if (!wrap) return;
                var collapsed = wrap.classList.toggle('is-collapsed');
                pinnedToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                pinnedToggle.textContent = collapsed ? '展开' : '收起';
            });
        }
        var pinnedList = document.getElementById('stf-pinned-list');
        if (pinnedList) {
            pinnedList.addEventListener('click', function (e) {
                var item = e.target.closest('[data-pin-id]');
                if (!item) return;
                var id = item.getAttribute('data-pin-id');
                var card = document.querySelector('.stf-card[data-id="' + id + '"]');
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.classList.add('is-expanded');
                    var expandBtn = card.querySelector('[data-action="expand"]');
                    if (expandBtn) expandBtn.textContent = '收起';
                } else {
                    searchQuery = '';
                    var searchEl = document.getElementById('stf-search');
                    if (searchEl) searchEl.value = '';
                    communityFilter = 'all';
                    communitySort = 'hot';
                    communityPage = 0;
                    updateFilterUI();
                    document.querySelectorAll('.stf-feed-tab').forEach(function (b) {
                        var on = b.getAttribute('data-sort') === 'hot';
                        b.classList.toggle('active', on);
                        b.setAttribute('aria-selected', on ? 'true' : 'false');
                    });
                    renderCommunity();
                    setTimeout(function () {
                        var c = document.querySelector('.stf-card[data-id="' + id + '"]');
                        if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 80);
                }
            });
        }

        // 公共频段（次要聊天入口）折叠
        var chatEntry = document.getElementById('stf-chat-entry');
        var chatPanel = document.getElementById('stf-chat-panel');
        if (chatEntry && chatPanel) {
            chatEntry.addEventListener('click', function () {
                var open = chatPanel.hasAttribute('hidden');
                if (open) chatPanel.removeAttribute('hidden');
                else chatPanel.setAttribute('hidden', '');
                chatEntry.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        }

        // grid actions
        var grid = document.getElementById('stf-community-grid');
        if (grid) {
            grid.addEventListener('click', function (e) {
                var card = e.target.closest('.stf-card');
                if (!card) return;
                var id = card.getAttribute('data-id');

                if (e.target.closest('.stf-comment-form, .stf-card-comments, .stf-comment-list')) return;

                if (e.target.closest('[data-action="like"]')) { toggleLike(id); return; }
                if (e.target.closest('[data-action="comment"]')) { toggleComments(id); return; }
                if (e.target.closest('[data-action="bookmark"]')) { toggleBookmark(id); return; }
                if (e.target.closest('[data-action="admin-hide"]')) { hideSubmission(id); return; }
                if (e.target.closest('[data-action="expand"]')) { toggleExpand(card); return; }
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

            /* 管理员：隐藏评论 */
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

        /* 调谐台彩蛋入口 + 左下角浮钮双态；各自隔离，避免一处抛错阻断角色环 */
        try { initTuner(); } catch (err) { console.error('[StarTorchForum] initTuner failed', err); }
        try { initTunerCollapse(); } catch (err) { console.error('[StarTorchForum] initTunerCollapse failed', err); }
        try { initTunerFab(); } catch (err) { console.error('[StarTorchForum] initTunerFab failed', err); }
        try { initArchiveOrbit(); } catch (err) { console.error('[StarTorchForum] initArchiveOrbit failed', err); }
    }

    /* ============ 左下角浮钮 + 调频台收展 ============
     * 交互约定：
     * 1) 调频台默认收成胶囊（#stf-tuner-compact）：主路径为直接输入四位频率；
     *    「完整面板」为次要入口，展开后可用拨轮 / 方向键。
     * 2) 左下角浮钮：始终打开飞行雪绒频道页（../index.html），不再引导展开调频。
     * 3) 通行证/设置改走顶栏「登录」按钮。
     * 「成功进入」：对调频台完成至少一次有效拨频（步进 / 方向键 / 数字 / 滚轮 / 胶囊输入）。
     * 状态键：localStorage['stf_tuner_entered'] === '1'（保留，供其它逻辑使用）
     * 文案约定：论坛为社区主体，勿把「飞行雪绒」写成「主站」。
     */
    var TUNER_ENTERED_KEY = 'stf_tuner_entered';
    var FLYING_CHANNEL_URL = '../index.html';
    var FAB_LABEL_CHANNEL = '打开飞行雪绒频道';
    var FAB_ARIA_CHANNEL = '打开飞行雪绒频道页';

    function hasEnteredTuner() {
        try { return localStorage.getItem(TUNER_ENTERED_KEY) === '1'; } catch (e) { return false; }
    }

    function markTunerEntered() {
        if (hasEnteredTuner()) return;
        try { localStorage.setItem(TUNER_ENTERED_KEY, '1'); } catch (e) { /* private mode */ }
    }

    function applyTunerFabMode() {
        var fab = document.getElementById('stf-back-home');
        if (!fab) return;
        var label = fab.querySelector('.stf-back-home-text');
        var iconTuner = fab.querySelector('.stf-back-home-svg--tuner');
        var iconHome = fab.querySelector('.stf-back-home-svg--home');
        fab.classList.add('is-home');
        fab.classList.remove('is-settings');
        if (label) label.textContent = FAB_LABEL_CHANNEL;
        if (iconTuner) iconTuner.hidden = true;
        if (iconHome) iconHome.hidden = false;
        fab.setAttribute('aria-label', FAB_ARIA_CHANNEL);
        fab.setAttribute('title', FAB_ARIA_CHANNEL);
    }

    function setTunerExpanded(on) {
        var tuner = document.getElementById('stf-tuner');
        var frame = document.getElementById('stf-tuner-frame');
        var compact = document.getElementById('stf-tuner-compact');
        var expandBtn = document.getElementById('stf-tuner-compact-expand');
        if (!tuner) return;
        tuner.classList.toggle('is-collapsed', !on);
        tuner.classList.toggle('is-expanded', !!on);
        if (frame) frame.hidden = !on;
        if (compact) compact.hidden = !!on;
        if (expandBtn) expandBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
        /* 展开后启动静噪床；收起淡出。须在用户手势路径内 unlock。 */
        if (on) TunerAudio.unlockAndStart();
        else TunerAudio.stop();
    }

    /* ---------- 调频静噪音效（手势后解锁 · band-pass 噪声床） ---------- */
    var TunerAudio = (function () {
        var ctx = null;
        var master = null;
        var noiseSrc = null;
        var filter = null;
        var started = false;
        var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

        function ensure() {
            if (ctx) return ctx;
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
            master = ctx.createGain();
            master.gain.value = 0;
            master.connect(ctx.destination);

            var seconds = 2;
            var buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
            var data = buffer.getChannelData(0);
            for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

            noiseSrc = ctx.createBufferSource();
            noiseSrc.buffer = buffer;
            noiseSrc.loop = true;

            filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 980;
            filter.Q.value = 0.7;

            noiseSrc.connect(filter);
            filter.connect(master);
            try { noiseSrc.start(); } catch (e) { /* already started */ }
            return ctx;
        }

        function unlockAndStart() {
            if (reduceMotion) return;
            var c = ensure();
            if (!c || !master) return;
            if (c.state === 'suspended') {
                c.resume().catch(function () { /* autoplay blocked */ });
            }
            var now = c.currentTime;
            master.gain.cancelScheduledValues(now);
            master.gain.setValueAtTime(master.gain.value, now);
            master.gain.linearRampToValueAtTime(0.028, now + 0.55);
            started = true;
        }

        function stop() {
            if (!ctx || !master || !started) return;
            var now = ctx.currentTime;
            master.gain.cancelScheduledValues(now);
            master.gain.setValueAtTime(master.gain.value, now);
            master.gain.linearRampToValueAtTime(0, now + 0.4);
            started = false;
        }

        function setProximity(snr, locked) {
            if (!ctx || !filter || !master || !started) return;
            var q = Math.max(0, Math.min(1, (snr || 0) / 100));
            var targetFreq = locked ? 720 : 1400 - q * 620;
            var targetGain = locked ? 0.012 : 0.018 + (1 - q) * 0.022;
            var now = ctx.currentTime;
            filter.frequency.setTargetAtTime(targetFreq, now, 0.12);
            master.gain.setTargetAtTime(targetGain, now, 0.15);
        }

        return { unlockAndStart: unlockAndStart, stop: stop, setProximity: setProximity };
    })();

    function expandAndFocusTuner() {
        var tuner = document.getElementById('stf-tuner');
        if (!tuner) return;
        setTunerExpanded(true);
        var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        tuner.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        try {
            if (history.replaceState) history.replaceState(null, '', '#stf-tuner');
            else window.location.hash = 'stf-tuner';
        } catch (e) { /* ignore */ }
        var dial0 = document.getElementById('stf-dial-0');
        if (dial0) {
            setTimeout(function () {
                try { dial0.focus({ preventScroll: true }); } catch (err) { dial0.focus(); }
            }, reduceMotion ? 0 : 420);
        }
    }

    function openFlyingEdelweissChannel() {
        window.location.href = FLYING_CHANNEL_URL;
    }

    function initTunerCollapse() {
        var expandBtn = document.getElementById('stf-tuner-compact-expand');
        var minify = document.getElementById('stf-tuner-minify');
        setTunerExpanded(false);
        if (expandBtn) {
            expandBtn.addEventListener('click', function () { expandAndFocusTuner(); });
        }
        if (minify) {
            minify.addEventListener('click', function () { setTunerExpanded(false); });
        }
        if (window.location.hash === '#stf-tuner') {
            setTunerExpanded(true);
        }
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) TunerAudio.stop();
        });
    }

    function initTunerFab() {
        var fab = document.getElementById('stf-back-home');
        if (!fab) return;
        applyTunerFabMode();
        fab.addEventListener('click', function () {
            openFlyingEdelweissChannel();
        });
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
        var compactFreqEl = document.getElementById('stf-tuner-compact-freq');
        var compactInput = document.getElementById('stf-tuner-compact-input');
        var compactLed = document.querySelector('#stf-tuner-compact .stf-tuner-compact-led');
        /* 勿命名为 frame：会遮蔽下方 rAF 回调 function onTunerFrame，导致 initArchiveOrbit 从未执行 */
        var frameEl = document.getElementById('stf-tuner-frame');

        var TARGET_CODE = '9072';
        var TARGET_FREQ = 9072;
        var locked = false;
        var syncingCompact = false;

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
            /* 任意有效拨频即记为「成功进入调频台」（见 TUNER_ENTERED_KEY 注释） */
            markTunerEntered();
        }

        function readCode() {
            return inputs.map(function (inp) { return (inp && inp.value) ? inp.value.charAt(0) : '0'; }).join('');
        }

        function readFreq() { return parseInt(readCode(), 10) || 0; }

        function padFreqCode(raw) {
            return (String(raw || '').replace(/\D/g, '') + '0000').slice(0, 4);
        }

        function formatFreqDisplay(code) {
            code = padFreqCode(code);
            return code.slice(0, 2) + '·' + code.slice(2);
        }

        /* 把四位频率写入拨轮（不触发 compact 回写循环） */
        function applyCodeToDials(code) {
            code = padFreqCode(code);
            for (var i = 0; i < 4; i++) {
                if (inputs[i]) inputs[i].value = code.charAt(i);
            }
            markTunerEntered();
        }

        function syncCompactDisplay(code) {
            code = padFreqCode(code);
            if (compactFreqEl) compactFreqEl.textContent = formatFreqDisplay(code);
            if (compactInput && document.activeElement !== compactInput) {
                syncingCompact = true;
                compactInput.value = code;
                syncingCompact = false;
            }
        }

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

        /* 逐位反馈：拨对一位就立刻点亮那一位；同步收起态频率胶囊 */
        function paintDigits() {
            var code = readCode();
            for (var i = 0; i < 4; i++) {
                if (!inputs[i]) continue;
                inputs[i].classList.toggle('is-hit', !locked && code.charAt(i) === TARGET_CODE.charAt(i));
                inputs[i].classList.toggle('is-locked', locked);
            }
            syncCompactDisplay(code);
            if (compactLed) {
                compactLed.classList.toggle('is-tuned', !locked && trueSnr >= 40);
                compactLed.classList.toggle('is-locked', locked);
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
            /* W4：临近锁定时微响应（金弧信号，不染粉）；设定：调频 9072 深夜广播 */
            if (frameEl) frameEl.classList.toggle('is-close', !locked && pct >= 78);
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
        function onTunerFrame(ts) {
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

            /* 静噪床：随 SNR / 锁定态调 cutoff 与音量 */
            TunerAudio.setProximity(trueSnr, locked);
            if (locked && Math.abs(trueSnr - shownSnr) < 0.05) { paint(trueSnr); return; }
            startLoop();
        }

        function startLoop() {
            if (rafId !== null || reduceMotion || !visible) return;
            rafId = requestAnimationFrame(onTunerFrame);
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
                if (frameEl) frameEl.classList.remove('is-close');
                /* 设定：调频 9072 第一次广播曾收到「收到了。」反馈 */
                if (hintEl) { hintEl.textContent = '信号锁定 —— 收到了。正在接通深夜电台…'; lastHint = hintEl.textContent; }
                if (compactInput) {
                    compactInput.setAttribute('readonly', 'readonly');
                    compactInput.setAttribute('aria-readonly', 'true');
                }
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
                markTunerEntered();
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

        /* 收起胶囊：四位频率输入 ↔ 拨轮 / 锁定状态打通（input 已豁免全局 9072 彩蛋） */
        if (compactInput) {
            var compactRoot = document.getElementById('stf-tuner-compact');
            if (compactRoot) {
                compactRoot.addEventListener('click', function (e) {
                    if (e.target.closest && e.target.closest('.stf-tuner-compact-expand')) return;
                    if (e.target === compactInput) return;
                    try { compactInput.focus({ preventScroll: true }); } catch (err) { compactInput.focus(); }
                });
            }

            function commitCompactInput() {
                if (syncingCompact || locked) return;
                var typed = String(compactInput.value || '').replace(/\D/g, '').slice(0, 4);
                syncingCompact = true;
                compactInput.value = typed;
                syncingCompact = false;
                if (compactFreqEl) {
                    compactFreqEl.textContent = formatFreqDisplay(typed);
                }
                applyCodeToDials(typed);
                /* 收起态输入也算用户手势：解锁静噪床，便于临近锁定反馈 */
                TunerAudio.unlockAndStart();
                checkLock();
            }

            compactInput.addEventListener('focus', function () {
                if (locked) return;
                syncingCompact = true;
                compactInput.value = readCode();
                syncingCompact = false;
                try { compactInput.select(); } catch (e) { /* ignore */ }
            });

            compactInput.addEventListener('input', commitCompactInput);

            compactInput.addEventListener('keydown', function (e) {
                if (locked) {
                    if (/^\d$/.test(e.key) || e.key === 'Backspace' || e.key === 'Delete') e.preventDefault();
                    return;
                }
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    var code = readCode().split('');
                    var caret = compactInput.selectionStart || 0;
                    var idx = Math.min(3, Math.max(0, caret >= 4 ? 3 : caret));
                    var next = ((parseInt(code[idx], 10) || 0) + (e.key === 'ArrowUp' ? 1 : -1) + 10) % 10;
                    code[idx] = String(next);
                    applyCodeToDials(code.join(''));
                    syncingCompact = true;
                    compactInput.value = code.join('');
                    syncingCompact = false;
                    if (compactFreqEl) compactFreqEl.textContent = formatFreqDisplay(code.join(''));
                    try { compactInput.setSelectionRange(idx, idx + 1); } catch (err) { /* ignore */ }
                    TunerAudio.unlockAndStart();
                    checkLock();
                }
            });

            compactInput.addEventListener('blur', function () {
                syncingCompact = true;
                compactInput.value = readCode();
                syncingCompact = false;
                if (compactFreqEl) compactFreqEl.textContent = formatFreqDisplay(readCode());
                /* 收起态失焦后停静噪，避免论坛页持续底噪 */
                var tuner = document.getElementById('stf-tuner');
                if (tuner && tuner.classList.contains('is-collapsed')) TunerAudio.stop();
            });
        }

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

    /* ============ 角色档案：倾斜 3D 竖环（billboard）/ 移动端横向 snap ============ */
    function initArchiveOrbit() {
        var grid = document.getElementById('archive-album-grid');
        var orbit = document.getElementById('archive-orbit');
        var ring = document.getElementById('archive-orbit-ring');
        if (!grid || !orbit || !ring) return;

        var mq = window.matchMedia
            ? window.matchMedia('(min-width: 900px) and (prefers-reduced-motion: no-preference)')
            : null;
        var cards = Array.prototype.slice.call(grid.querySelectorAll('.archive-float'));
        if (!cards.length) return;

        var paused = false;
        var rafId = 0;
        var baseAngle = 0;
        var DEG_PER_MS = 360 / 58000;

        function layoutMetrics() {
            var w = orbit.clientWidth || 720;
            /* W2 重标定：倾斜后半径略增、yLift 上移，避免卡片挤中 */
            var radius = Math.min(340, Math.max(220, Math.floor(w * 0.36)));
            return { radius: radius, yLift: -28 };
        }

        function paint(angleDeg) {
            var n = cards.length;
            var m = layoutMetrics();
            var step = 360 / n;
            cards.forEach(function (card, i) {
                var a = (angleDeg + step * i) * Math.PI / 180;
                /* XZ 绕 Y 公转；卡片本身不 rotateY → 始终正面朝向镜头（billboard） */
                var x = Math.sin(a) * m.radius;
                var z = Math.cos(a) * m.radius;
                var depth = (z + m.radius) / (2 * m.radius);
                var scale = 0.74 + depth * 0.32;
                var opacity = 0.4 + depth * 0.6;
                var bright = 0.6 + depth * 0.44;
                card.style.transform =
                    'translate(-50%, -50%) translate3d(' + x.toFixed(1) + 'px,' + m.yLift + 'px,' + z.toFixed(1) + 'px) scale(' + scale.toFixed(3) + ')';
                card.style.zIndex = String(100 + Math.round(depth * 100));
                card.style.opacity = String(opacity.toFixed(3));
                card.style.filter = 'brightness(' + bright.toFixed(3) + ')';
                card.classList.add('is-orbit-item');
            });
        }

        function loop(ts) {
            if (!document.documentElement.classList.contains('archive-orbit-active')) {
                rafId = 0;
                return;
            }
            var last = loop._last || ts;
            var dt = Math.min(48, ts - last);
            loop._last = ts;
            if (!paused) baseAngle = (baseAngle + DEG_PER_MS * dt) % 360;
            paint(baseAngle);
            rafId = requestAnimationFrame(loop);
        }

        function startLoop() {
            if (rafId) return;
            loop._last = 0;
            rafId = requestAnimationFrame(loop);
        }

        function stopLoop() {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
        }

        function enableOrbit(on) {
            orbit.hidden = !on;
            grid.classList.toggle('is-orbit-source', !!on);
            document.documentElement.classList.toggle('archive-orbit-active', !!on);
            if (on) {
                cards.forEach(function (card) { ring.appendChild(card); });
                paint(baseAngle);
                startLoop();
            } else {
                stopLoop();
                cards.forEach(function (card) {
                    card.classList.remove('is-orbit-item');
                    card.style.removeProperty('transform');
                    card.style.removeProperty('z-index');
                    card.style.removeProperty('opacity');
                    card.style.removeProperty('filter');
                    grid.appendChild(card);
                });
            }
        }

        function sync() {
            enableOrbit(!!(mq && mq.matches));
        }

        sync();
        if (mq) {
            if (mq.addEventListener) mq.addEventListener('change', sync);
            else if (mq.addListener) mq.addListener(sync);
        }
        window.addEventListener('resize', function () {
            if (document.documentElement.classList.contains('archive-orbit-active')) paint(baseAngle);
        }, { passive: true });

        function setPaused(v) {
            paused = !!v;
            ring.classList.toggle('is-paused', paused);
        }
        ring.addEventListener('mouseenter', function () { setPaused(true); });
        ring.addEventListener('mouseleave', function () { setPaused(false); });
        ring.addEventListener('focusin', function () { setPaused(true); });
        ring.addEventListener('focusout', function () {
            if (!ring.contains(document.activeElement)) setPaused(false);
        });
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) stopLoop();
            else if (document.documentElement.classList.contains('archive-orbit-active')) startLoop();
        });
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
