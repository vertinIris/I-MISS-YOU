/* ============================================================
   飞行雪绒主站 · 爱弥斯设定彩蛋（W4–W5）
   设定依据见各函数头注释。输入框聚焦时不捕获，避免误触。
   ============================================================ */
(function () {
    'use strict';

    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    function isTypingTarget(t) {
        if (!t) return false;
        var tag = (t.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return true;
        if (t.closest && (t.closest('[contenteditable="true"]') || t.closest('.account-panel') || t.closest('.admin-modal'))) return true;
        return false;
    }

    /* 静默提示气泡 */
    function whisper(text, ms) {
        var el = document.getElementById('snow-whisper');
        if (!el) {
            el = document.createElement('div');
            el.id = 'snow-whisper';
            el.className = 'snow-whisper';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        el.textContent = text;
        el.classList.add('is-visible');
        clearTimeout(whisper._t);
        whisper._t = setTimeout(function () {
            el.classList.remove('is-visible');
        }, ms || 3200);
    }

    /**
     * 走廊「三十七」计数彩蛋
     * 设定依据：characters/aimisi —「学院走廊里三十七个人和她擦肩，没有一个人转头」；
     * 主站动态原文同述。连点至 37 次触发静默回应。
     */
    function initCorridorThirtySeven() {
        var nodes = document.querySelectorAll('[data-easter-corridor]');
        if (!nodes.length) {
            /* 自动把动态里的「三十七」包成触发点（不改文案语义） */
            document.querySelectorAll('.post-content p').forEach(function (p) {
                if (p.dataset.easterWrapped) return;
                if (!/三十七/.test(p.textContent || '')) return;
                p.dataset.easterWrapped = '1';
                p.innerHTML = (p.innerHTML || '').replace(
                    /三十七/,
                    '<button type="button" class="easter-corridor-mark" data-easter-corridor aria-label="走廊计数彩蛋">三十七</button>'
                );
            });
            nodes = document.querySelectorAll('[data-easter-corridor]');
        }
        if (!nodes.length) return;

        var count = 0;
        var resetTimer = null;
        var unlocked = false;

        function resetSoon() {
            clearTimeout(resetTimer);
            resetTimer = setTimeout(function () { count = 0; }, 28000);
        }

        function onTap(e) {
            if (unlocked) return;
            if (isTypingTarget(e.target)) return;
            e.preventDefault();
            count += 1;
            resetSoon();
            if (count === 10 || count === 20 || count === 30) {
                whisper('……又有人从身边走过去了。(' + count + '/37)', 1800);
            }
            if (count >= 37) {
                unlocked = true;
                /* 设定：电子幽灵不可见，但广播端终于有人调到了频率 */
                whisper('第三十七步——你转头了。调频 9072，我在。', 4200);
            }
        }

        nodes.forEach(function (n) {
            n.addEventListener('click', onTap);
        });
    }

    /**
     * 构型切换：爱弥斯 / 机兵剪影 crossfade
     * 设定依据：characters/aimisi 能力体系 —「爱弥斯形态 / 机兵形态，通过构型切换自由转换」。
     * 触发：双击或长按剪影；reduced-motion 下瞬间切换无动画。
     * 提示仅走 title / aria / hover 微标，避免常驻文案叠在剪影上破版。
     */
    var formSilUid = 0;

    function buildSilhouetteSvg(kind) {
        var id = 'afs' + (++formSilUid);
        if (kind === 'mecha') {
            return '<svg class="aimisi-form-sil aimisi-form-sil--mecha" viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
                '<defs>' +
                '<linearGradient id="' + id + 'm" x1="0" y1="0" x2="1" y2="1">' +
                '<stop offset="0%" stop-color="#A8D8FF"/><stop offset="55%" stop-color="#6B8AFF"/><stop offset="100%" stop-color="#FFB6D9"/>' +
                '</linearGradient>' +
                '<linearGradient id="' + id + 'w" x1="0" y1="0.2" x2="1" y2="0.8">' +
                '<stop offset="0%" stop-color="#FF6B9D"/><stop offset="100%" stop-color="#A8D8FF"/>' +
                '</linearGradient>' +
                '</defs>' +
                /* 双翼（略内收，避免小尺寸 overflow 裁切） */
                '<path d="M50 60 C24 52 16 76 28 94 C36 86 44 78 50 72 Z" fill="url(#' + id + 'w)" opacity="0.72"/>' +
                '<path d="M70 60 C96 52 104 76 92 94 C84 86 76 78 70 72 Z" fill="url(#' + id + 'w)" opacity="0.72"/>' +
                /* 机兵躯干 */
                '<path fill="url(#' + id + 'm)" opacity="0.95" d="M60 22 L74 36 L70 52 L82 68 L76 96 L88 112 L78 138 L60 152 L42 138 L32 112 L44 96 L38 68 L50 52 L46 36 Z"/>' +
                '<circle cx="60" cy="48" r="5" fill="#0A0A12" opacity="0.85"/>' +
                '<path d="M52 70 L60 78 L68 70" stroke="#0A0A12" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.55"/>' +
                '<circle cx="28" cy="52" r="2" fill="#FFFFFF" opacity="0.45"/>' +
                '<circle cx="92" cy="52" r="2" fill="#FFFFFF" opacity="0.45"/>' +
                '</svg>';
        }
        return '<svg class="aimisi-form-sil aimisi-form-sil--human" viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            '<defs>' +
            '<linearGradient id="' + id + 'h" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#FF6B9D"/><stop offset="55%" stop-color="#FFB6D9"/><stop offset="100%" stop-color="#A8D8FF"/>' +
            '</linearGradient>' +
            '</defs>' +
            '<path fill="url(#' + id + 'h)" opacity="0.95" d="M60 18c-9 0-16 6-18 14-1 4-1 8 0 12-10 3-18 12-20 22-1 5 0 10 2 15-6 4-10 11-10 19 0 12 9 22 21 24 4 8 12 14 21 16 2 0 4 0 6 0h4c2 0 4 0 6 0 9-2 17-8 21-16 12-2 21-12 21-24 0-8-4-15-10-19 2-5 3-10 2-15-2-10-10-19-20-22 1-4 1-8 0-12-2-8-9-14-18-14z"/>' +
            '<circle cx="46" cy="64" r="3.5" fill="#0A0A12"/>' +
            '<circle cx="74" cy="64" r="3.5" fill="#0A0A12"/>' +
            '<path d="M52 74c3 2 13 2 16 0" stroke="#0A0A12" stroke-width="1.8" stroke-linecap="round"/>' +
            '<path d="M60 28c-8 0-14 4-16 10 6-3 16-3 22 0 0 0-2-10-6-10z" fill="#FFFFFF" opacity="0.32"/>' +
            '<circle cx="22" cy="48" r="2.2" fill="#FFFFFF" opacity="0.5"/>' +
            '<circle cx="98" cy="48" r="2" fill="#FFFFFF" opacity="0.42"/>' +
            '</svg>';
    }

    function initFormSwitch(root) {
        var hosts = (root || document).querySelectorAll('[data-aimisi-form-switch]');
        hosts.forEach(function (host) {
            if (host.dataset.bound) return;
            host.dataset.bound = '1';
            if (!host.querySelector('.aimisi-form-sil')) {
                host.innerHTML =
                    '<span class="aimisi-form-frame" aria-hidden="true">' +
                    buildSilhouetteSvg('human') +
                    buildSilhouetteSvg('mecha') +
                    '</span>';
            }
            host.setAttribute('tabindex', '0');
            host.setAttribute('role', 'button');
            host.setAttribute('title', '双击、长按或按 Enter / 空格切换构型');
            host.setAttribute('aria-label', '构型切换：双击、长按或按 Enter、空格，在爱弥斯形态与机兵形态间切换');
            host.setAttribute('aria-pressed', 'false');

            var longTimer = null;
            var mecha = false;

            function toggle() {
                mecha = !mecha;
                host.classList.toggle('is-mecha', mecha);
                host.setAttribute('aria-pressed', mecha ? 'true' : 'false');
                if (reduceMotion) {
                    host.querySelectorAll('.aimisi-form-sil').forEach(function (s) {
                        s.style.transition = 'none';
                    });
                }
                whisper(mecha ? '构型切换 —— 机兵形态。双翼已展开。' : '构型切换 —— 爱弥斯形态。迅刀在侧。', 2400);
            }

            host.addEventListener('dblclick', function (e) {
                e.preventDefault();
                e.stopPropagation();
                toggle();
            });
            host.addEventListener('pointerdown', function (e) {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                e.stopPropagation();
                longTimer = setTimeout(function () {
                    longTimer = null;
                    toggle();
                }, 620);
            });
            function clearLong() {
                if (longTimer) { clearTimeout(longTimer); longTimer = null; }
            }
            host.addEventListener('pointerup', clearLong);
            host.addEventListener('pointerleave', clearLong);
            host.addEventListener('pointercancel', clearLong);
            host.addEventListener('contextmenu', function (e) {
                e.preventDefault();
            });
            host.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                }
            });
        });
    }

    /**
     * 口头禅静默提示
     * 设定依据：characters/aimisi —「要轻松快乐地活着」口头禅。
     * 空闲约 90s 后轻提示一次/会话；不打断输入。
     */
    function initCatchphraseIdle() {
        var shown = false;
        var idleMs = 90000;
        var timer = null;

        function arm() {
            clearTimeout(timer);
            if (shown) return;
            timer = setTimeout(function () {
                if (shown) return;
                if (document.hidden) { arm(); return; }
                shown = true;
                whisper('要轻松快乐地活着。——飞行雪绒', 3800);
            }, idleMs);
        }

        ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) {
            document.addEventListener(ev, arm, { passive: true });
        });
        arm();
    }

    /**
     * 渐湖 ripple
     * 设定依据：characters/aimisi — 幼年于渐湖坠入，漂泊者伸手相救。
     * 点击带 data-easter-lake 的地点/文案时产生涟漪；reduced-motion 仅 whisper。
     */
    function initLakeRipple() {
        document.addEventListener('click', function (e) {
            var t = e.target.closest('[data-easter-lake]');
            if (!t || isTypingTarget(e.target)) return;
            if (!reduceMotion) {
                var host = t.classList.contains('lake-ripple-host') ? t : t;
                host.classList.add('lake-ripple-host');
                var rect = host.getBoundingClientRect();
                var r = document.createElement('span');
                r.className = 'lake-ripple';
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;
                var size = Math.max(rect.width, rect.height);
                r.style.width = r.style.height = size + 'px';
                r.style.left = x + 'px';
                r.style.top = y + 'px';
                host.appendChild(r);
                setTimeout(function () { r.remove(); }, 1200);
            }
            whisper('渐湖的冰面碎过一次。有人把手伸过来了。', 3000);
        });
    }

    ready(function () {
        initCorridorThirtySeven();
        initFormSwitch(document);
        initCatchphraseIdle();
        initLakeRipple();
        window.SnowEaster = {
            whisper: whisper,
            initFormSwitch: initFormSwitch
        };
    });
})();
