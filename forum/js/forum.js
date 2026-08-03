/**
 * 星炬学院主论坛 · 独立前端逻辑
 * 不依赖飞行雪绒站 js/main.js 或 js/repository.js
 */
(function () {
    'use strict';

    var COMMUNITY_PAGE_SIZE = 6;
    var communityFilter = 'all';
    var communitySort = 'new';
    var communityPage = 0;
    var activeTags = [];

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

    function syncIdentityControls(prefix, identityId) {
        var nameInput = document.getElementById(prefix + '-nickname');
        var identitySelect = document.getElementById(prefix + '-identity');
        if (!nameInput || !identitySelect) return;
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
        var saved = StarTorchData.getNickname();
        var identityId = detectIdentityFromName(saved);
        if (identityId) {
            syncIdentityControls(prefix, identityId);
        } else {
            syncIdentityControls(prefix, '');
            if (nameInput) nameInput.value = saved || '';
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
        var submissions = StarTorchData.getSubmissions();
        var filtered = communityFilter === 'all'
            ? submissions
            : submissions.filter(function (s) { return s.type === communityFilter; });

        if (activeTags.length > 0) {
            filtered = filtered.filter(function (s) {
                if (!s.tags || !Array.isArray(s.tags)) return false;
                return activeTags.every(function (tag) { return s.tags.indexOf(tag) !== -1; });
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
        var subs = StarTorchData.getSubmissions();
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
        var bgColor = s.color || 'var(--drifter-blue)';
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

        var previewText = escapeHTML(previewText(s.content, 110));
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
                    '<div class="stf-card-preview">' + previewText + '</div>' +
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
        list.innerHTML = comments.map(function (c) {
            return '<div class="stf-comment">' +
                '<span class="stf-comment-name" style="color:' + (c.color || '#A8D8FF') + '">' + escapeHTML(c.name) + '</span>' +
                '<span class="stf-comment-text">' + escapeHTML(c.text) + '</span>' +
                '<span class="stf-comment-time">' + escapeHTML(c.timeStr) + '</span>' +
            '</div>';
        }).join('');
    }

    function renderPagination(total) {
        var nav = document.getElementById('stf-pagination');
        if (!nav) return;
        var pages = Math.ceil(total / COMMUNITY_PAGE_SIZE);
        if (pages <= 1) { nav.hidden = true; nav.innerHTML = ''; return; }
        nav.hidden = false;

        var html = '';
        for (var i = 0; i < pages; i++) {
            html += '<button class="stf-page-btn' + (i === communityPage ? ' active' : '') + '" data-page="' + i + '">' + (i + 1) + '</button>';
        }
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
            renderCommunity();
            showToast(s.bookmarked ? '已收藏 ★' : '已取消收藏');
        }
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
    function buildSubmission(name, type, title, content, tags, identityId) {
        var now = new Date();
        var identity = ANONYMOUS_IDENTITIES[identityId];
        var displayName = identity ? identity.name : name;
        return {
            id: 'stf_' + now.getTime(),
            name: escapeHTML(displayName),
            type: type,
            title: escapeHTML(title),
            content: escapeHTML(content),
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
            color: identity ? identity.color : '#6B8AFF',
            identity: identityId || null
        };
    }

    /* 持久化新投稿并刷新 + 新节点脉冲 */
    function persistNewSubmission(newSub) {
        var list = getAllSubmissions();
        list.unshift(newSub);
        StarTorchData.saveSubmissions(list);
        StarTorchData.setNickname(newSub.name);
        communityFilter = 'all';
        communityPage = 0;
        updateFilterUI();
        renderCommunity();
        pulseNewCard(newSub.id);
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

        if (!rawName || !rawTitle || !rawContent) { showToast('请填写完整信息'); return; }
        if (rawName.length > 20) { showToast('昵称限20字'); return; }
        if (rawTitle.length > 100) { showToast('标题限100字'); return; }
        if (rawContent.length > 2000) { showToast('内容限2000字'); return; }

        var selectedTags = readTagsFrom(modal.querySelector('#stf-submit-tag-selector'));

        var newSub = buildSubmission(rawName, type, rawTitle, rawContent, selectedTags, identityId);

        modal.querySelector('form').reset();
        modal.querySelectorAll('.select-tag.active').forEach(function (c) { c.classList.remove('active'); });
        syncIdentityControls('stf-submit', '');
        closeSubmitModal();
        persistNewSubmission(newSub);
        showToast('投稿成功，已发布到星炬学院论坛 ✨');
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

        if (!rawName || !rawTitle || !rawContent) { showToast('请填写完整信息'); return; }
        if (rawName.length > 20) { showToast('昵称限20字'); return; }
        if (rawTitle.length > 100) { showToast('标题限100字'); return; }
        if (rawContent.length > 2000) { showToast('内容限2000字'); return; }

        var selectedTags = readTagsFrom(form.querySelector('#stf-composer-tag-selector'));
        var newSub = buildSubmission(rawName, type, rawTitle, rawContent, selectedTags, identityId);

        form.reset();
        form.querySelectorAll('.select-tag.active').forEach(function (c) { c.classList.remove('active'); });
        syncIdentityControls('stf-composer', '');
        closeComposer();
        persistNewSubmission(newSub);
        showToast('已发布到星炬学院论坛 ✨');
    }

    function openComposer() {
        var composer = document.getElementById('stf-composer');
        var form = document.getElementById('stf-composer-form');
        var trigger = document.getElementById('stf-composer-trigger');
        if (!composer || !form) return;
        form.hidden = false;
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
        restoreNickname('stf-composer');
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
                if (!btn) return;
                communityPage = parseInt(btn.getAttribute('data-page'), 10);
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
    }

    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);
})();
