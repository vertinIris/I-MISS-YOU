/**
 * Snow / STF Signature Weapon Utilities
 * S7 指纹涟漪、T10 扫描切换、T3 印章旋转、Side-Chip、Footer 时钟、T11 徽章切角反转切换
 */
(function () {
    'use strict';

    // ---------- S7: 指纹形 ripple（按钮点击涟漪坐标）----------
    function initRipple() {
        document.querySelectorAll('.sig-ripple, .btn-primary, .btn-music, .btn-ghost').forEach(function (el) {
            if (el.dataset.rippleReady) return;
            el.dataset.rippleReady = '1';
            el.classList.add('sig-ripple');
            el.addEventListener('pointerdown', function (e) {
                var rect = el.getBoundingClientRect();
                var x = Math.round(e.clientX - rect.left);
                var y = Math.round(e.clientY - rect.top);
                el.style.setProperty('--ripple-x', x + 'px');
                el.style.setProperty('--ripple-y', y + 'px');
            });
        });
    }

    // ---------- T3: 八角印章 ±1° 随机扰动（避免完全对称）----------
    function nudgeSeals() {
        document.querySelectorAll('.sig-seal, .stf-badge-seal, .stf-footer__seal, .sig-postmark').forEach(function (el) {
            var nudge = (Math.random() * 2 - 1).toFixed(1);  // -1.0 ~ 1.0
            var existing = el.style.transform;
            if (!existing || existing.indexOf('translate') === -1) {
                var baseRot = -6;
                var style = getComputedStyle(el);
                var match = (style.transform || '').match(/rotate\(([-\d.]+)deg\)/);
                if (match) baseRot = parseFloat(match[1]);
                // Keep simple; elements set rotation via CSS classes.
                el.style.transform = (existing ? existing + ' ' : '') + 'rotate(' + (parseFloat(nudge) + (el.classList.contains('sig-seal--var') ? 7 : 0)) + 'deg)';
            }
        });
    }

    // ---------- N9 Side-Chip: 滚动进度填充 + Section 标签 ----------
    var SECTION_LABELS = [
        { id: 'hero',      label: '§ 00 · HERO' },
        { id: 'profile',   label: '§ 01 · PROFILE' },
        { id: 'music',     label: '§ 02 · MUSIC' },
        { id: 'timeline',  label: '§ 03 · TIMELINE' },
        { id: 'diary',     label: '§ 04 · DIARY' },
        { id: 'submit',    label: '§ 05 · SUBMIT' },
        { id: 'community', label: '§ 06 · INBOX' }
    ];

    function initSideChip() {
        var fill = document.getElementById('sn-scroll-fill');
        var label = document.getElementById('sn-scroll-label');
        if (!fill || !label) return;
        function update() {
            var h = document.documentElement;
            var scrollTop = h.scrollTop || document.body.scrollTop;
            var total = (h.scrollHeight - h.clientHeight) || 1;
            var pct = Math.max(0, Math.min(100, (scrollTop / total) * 100));
            fill.style.height = pct.toFixed(1) + '%';

            var currentLabel = SECTION_LABELS[0].label;
            for (var i = 0; i < SECTION_LABELS.length; i++) {
                var sec = document.getElementById(SECTION_LABELS[i].id);
                if (sec) {
                    var top = sec.getBoundingClientRect().top;
                    if (top <= 120) currentLabel = SECTION_LABELS[i].label;
                    else break;
                }
            }
            label.textContent = currentLabel;
        }
        update();
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
    }

    // ---------- 雪绒 Footer 时钟 ----------
    function initFooterClock() {
        var time = document.getElementById('sn-footer-time');
        if (!time) return;
        function tick() {
            var d = new Date();
            var hh = String(d.getHours()).padStart(2, '0');
            var mm = String(d.getMinutes()).padStart(2, '0');
            var ss = String(d.getSeconds()).padStart(2, '0');
            time.textContent = hh + ':' + mm + ':' + ss + ' · BJT';
        }
        tick();
        setInterval(tick, 1000);
    }

    // ---------- T10: 旧内容横向扫描线退出（Realm 切换动画）----------
    function scanReplace(el, buildFn, opts) {
        opts = opts || {};
        return new Promise(function (resolve) {
            el.classList.remove('sig-scan-enter');
            el.classList.add('sig-scan-leave');
            setTimeout(function () {
                el.innerHTML = '';
                buildFn(el);
                el.classList.remove('sig-scan-leave');
                el.classList.add('sig-scan-enter');
                setTimeout(resolve, opts.enterMs || 360);
            }, opts.leaveMs || 160);
        });
    }

    // ---------- T11: 筛选徽章切角反转切换（sig-chip <-> sig-chip--active）----------
    function initChipToggle(container, activeClass) {
        var act = activeClass || 'sig-chip--active';
        if (!container) return;
        container.addEventListener('click', function (e) {
            var target = e.target.closest('.sig-chip');
            if (!target) return;
            if (target.dataset.single !== 'false') {
                container.querySelectorAll('.sig-chip').forEach(function (c) { c.classList.remove(act); });
            }
            target.classList.toggle(act);
        }, { passive: true });
    }

    // ---------- Quick Composer 展开/收起 ----------
    function initQuickComposer() {
        var expand = document.getElementById('stf-qc-expand');
        var fields = document.getElementById('stf-qc-fields');
        var cancel = document.getElementById('stf-qc-cancel');
        var count = document.getElementById('stf-qc-count');
        var textarea = document.getElementById('stf-qc-content');
        if (!expand || !fields) return;
        function toggle(force) {
            var willOpen = typeof force === 'boolean' ? force : fields.hasAttribute('hidden');
            if (willOpen) {
                fields.removeAttribute('hidden');
                expand.setAttribute('aria-expanded', 'true');
                if (textarea) setTimeout(function(){ textarea.focus(); }, 160);
            } else {
                fields.setAttribute('hidden', '');
                expand.setAttribute('aria-expanded', 'false');
            }
        }
        expand.addEventListener('click', function () { toggle(); });
        if (cancel) cancel.addEventListener('click', function () { toggle(false); });
        if (textarea && count) {
            textarea.addEventListener('input', function () {
                count.textContent = textarea.value.length;
            });
        }
        // 类型 chips 切换（单选）
        var typeWrap = document.querySelector('.stf-composer__types');
        if (typeWrap) initChipToggle(typeWrap, 'stf-chip-type--active');
        // 标签 chips（多选）
        var tagWrap = document.querySelector('.stf-composer__tags');
        if (tagWrap) {
            tagWrap.querySelectorAll('.sig-chip').forEach(function (c) { c.dataset.single = 'false'; });
            initChipToggle(tagWrap);
        }
    }

    // ---------- 暴露给全局 ----------
    window.__SNOW_SIG__ = {
        scanReplace: scanReplace,
        initChipToggle: initChipToggle
    };

    // ---------- 启动 ----------
    function start() {
        initRipple();
        nudgeSeals();
        initSideChip();
        initFooterClock();
        initQuickComposer();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
