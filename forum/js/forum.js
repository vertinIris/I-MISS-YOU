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
        var preview = previewText(s.content, 280);
        var expandBtn = s.content.length > 280
            ? '<button class="stf-card-expand" data-action="expand">展开全文</button>'
            : '';
        var cardCharColor = charColorForSubmission(s);
        var cardCharStyle = cardCharColor ? ' style="--char:' + cardCharColor + '"' : '';

        var tagsHtml = '';
        if (s.tags && s.tags.length) {
            tagsHtml = '<div class="stf-card-tags">' +
                s.tags.map(function (t) { return '<span class="stf-card-tag">' + escapeHTML(t) + '</span>'; }).join('') +
                '</div>';
        }

        return '<article class="stf-card" data-id="' + s.id + '"' + cardCharStyle + '>' +
            '<div class="stf-card-header">' +
                '<div class="stf-card-avatar" style="background:' + bgColor + '">' + escapeHTML(initial) + '</div>' +
                '<div class="stf-card-info">' +
                    '<div class="stf-card-author">' + escapeHTML(s.name) + '</div>' +
                    '<div class="stf-card-time">' + escapeHTML(s.timeStr) + '</div>' +
                '</div>' +
                '<span class="stf-card-badge" data-type="' + s.type + '">' + (typeLabels[s.type] || s.type) + '</span>' +
            '</div>' +
            '<h3 class="stf-card-title">' + escapeHTML(s.title) + '</h3>' +
            '<div class="stf-card-content" data-full-content="' + escapeHTML(s.content) + '">' + escapeHTML(preview) + '</div>' +
            expandBtn +
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
        });
        if (s) {
            renderCommunity();
            showToast(s.bookmarked ? '已收藏 ★' : '已取消收藏');
        }
    }

    function toggleComments(id) {
        var panel = document.getElementById('stf-comments-' + id);
        if (panel) panel.classList.toggle('open');
    }

    function expandCard(card) {
        var content = card.querySelector('.stf-card-content');
        var btn = card.querySelector('.stf-card-expand');
        if (!content || !btn) return;
        content.textContent = content.getAttribute('data-full-content');
        btn.remove();
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
            var nameInput = modal.querySelector('#stf-submit-nickname');
            if (nameInput && StarTorchData.getNickname()) nameInput.value = StarTorchData.getNickname();
        }
    }

    function closeSubmitModal() {
        var modal = document.getElementById('stf-submit-modal');
        if (modal) {
            modal.classList.remove('open');
            setTimeout(function () { modal.hidden = true; }, 300);
        }
    }

    function handleSubmit(e) {
        e.preventDefault();
        var modal = document.getElementById('stf-submit-modal');
        if (!modal) return;

        var rawName = modal.querySelector('#stf-submit-nickname').value.trim();
        var type = modal.querySelector('#stf-submit-type').value;
        var rawTitle = modal.querySelector('#stf-submit-title').value.trim();
        var rawContent = modal.querySelector('#stf-submit-content').value.trim();

        if (!rawName || !rawTitle || !rawContent) { showToast('请填写完整信息'); return; }
        if (rawName.length > 20) { showToast('昵称限20字'); return; }
        if (rawTitle.length > 100) { showToast('标题限100字'); return; }
        if (rawContent.length > 2000) { showToast('内容限2000字'); return; }

        var selectedTags = [];
        modal.querySelectorAll('#stf-submit-tag-selector .select-tag.active').forEach(function (chip) {
            selectedTags.push(chip.getAttribute('data-tag'));
        });

        var now = new Date();
        var newSub = {
            id: 'stf_' + now.getTime(),
            name: escapeHTML(rawName),
            type: type,
            title: escapeHTML(rawTitle),
            content: escapeHTML(rawContent),
            realm: 'startorch',
            tags: selectedTags,
            time: now.getTime(),
            timeStr: now.getFullYear() + '-' +
                String(now.getMonth() + 1).padStart(2, '0') + '-' +
                String(now.getDate()).padStart(2, '0') + ' ' +
                String(now.getHours()).padStart(2, '0') + ':' +
                String(now.getMinutes()).padStart(2, '0'),
            likes: 0,
            liked: false,
            color: '#6B8AFF'
        };

        var list = getAllSubmissions();
        list.unshift(newSub);
        StarTorchData.saveSubmissions(list);
        StarTorchData.setNickname(escapeHTML(rawName));

        modal.querySelector('form').reset();
        modal.querySelectorAll('.select-tag.active').forEach(function (c) { c.classList.remove('active'); });
        closeSubmitModal();
        showToast('投稿成功，已发布到星炬学院论坛 ✨');
        communityFilter = 'all';
        communityPage = 0;
        updateFilterUI();
        renderCommunity();
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

                if (e.target.closest('[data-action="like"]')) { toggleLike(id); return; }
                if (e.target.closest('[data-action="comment"]')) { toggleComments(id); return; }
                if (e.target.closest('[data-action="bookmark"]')) { toggleBookmark(id); return; }
                if (e.target.closest('[data-action="expand"]')) { expandCard(card); return; }
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
