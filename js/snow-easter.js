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
        initCatchphraseIdle();
        initLakeRipple();
        window.SnowEaster = {
            whisper: whisper
        };
    });
})();
