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
     */
    function buildSilhouetteSvg(kind) {
        if (kind === 'mecha') {
            return '<svg class="aimisi-form-sil aimisi-form-sil--mecha" viewBox="0 0 120 160" fill="none" aria-hidden="true">' +
                '<path d="M60 18 L78 40 L72 78 L88 96 L80 128 L60 148 L40 128 L32 96 L48 78 L42 40 Z" stroke="rgba(168,216,255,.85)" stroke-width="2" fill="rgba(107,138,255,.12)"/>' +
                '<path d="M42 48 L18 62 L28 78 M78 48 L102 62 L92 78" stroke="rgba(255,182,217,.7)" stroke-width="1.8"/>' +
                '<circle cx="60" cy="56" r="6" fill="rgba(255,107,157,.55)"/>' +
                '</svg>';
        }
        return '<svg class="aimisi-form-sil aimisi-form-sil--human" viewBox="0 0 120 160" fill="none" aria-hidden="true">' +
            '<ellipse cx="60" cy="36" rx="16" ry="18" fill="rgba(255,182,217,.35)" stroke="rgba(255,107,157,.7)" stroke-width="1.6"/>' +
            '<path d="M44 56 Q60 52 76 56 L82 118 Q60 132 38 118 Z" fill="rgba(255,107,157,.18)" stroke="rgba(255,182,217,.75)" stroke-width="1.6"/>' +
            '<path d="M48 70 L36 102 M72 70 L84 102" stroke="rgba(255,182,217,.55)" stroke-width="1.5"/>' +
            '</svg>';
    }

    function initFormSwitch(root) {
        var hosts = (root || document).querySelectorAll('[data-aimisi-form-switch]');
        hosts.forEach(function (host) {
            if (host.dataset.bound) return;
            host.dataset.bound = '1';
            if (!host.querySelector('.aimisi-form-sil')) {
                host.innerHTML = buildSilhouetteSvg('human') + buildSilhouetteSvg('mecha') +
                    '<span class="aimisi-form-hint">双击 / 长按 · 构型切换</span>';
            }
            host.setAttribute('tabindex', '0');
            host.setAttribute('role', 'button');
            host.setAttribute('aria-label', '构型切换：爱弥斯形态与机兵形态');

            var longTimer = null;
            var mecha = false;

            function toggle() {
                mecha = !mecha;
                host.classList.toggle('is-mecha', mecha);
                if (reduceMotion) {
                    host.querySelectorAll('.aimisi-form-sil').forEach(function (s) {
                        s.style.transition = 'none';
                    });
                }
                whisper(mecha ? '构型切换 —— 机兵形态。双翼已展开。' : '构型切换 —— 爱弥斯形态。迅刀在侧。', 2400);
            }

            host.addEventListener('dblclick', function (e) {
                e.preventDefault();
                toggle();
            });
            host.addEventListener('pointerdown', function (e) {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
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
