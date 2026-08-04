/* ============================================================
   星炬学院论坛 · 飞行雪绒隐藏入口
   完全独立实现：不依赖飞行雪绒站 secret-portal.js
   触发方式：页脚雪花 4 秒内连击 5 次 / 键盘输入 9072
   ============================================================ */
(function () {
    'use strict';

    var TARGET = '../index.html';
    var TRIGGER_CODE = '9072';
    var LOGO_CLICKS = 5;
    var LOGO_WINDOW = 4000;

    var keyBuffer = '';
    var clickCount = 0;
    var clickTimer = null;
    var active = false;

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    function createParticles(container) {
        var count = 40;
        var colors = ['#FF6B9D', '#FFB6D9', '#A8D8FF', '#B66BFF', '#FFFFFF'];
        var cx = window.innerWidth / 2;
        var cy = window.innerHeight / 2;
        container.innerHTML = '';
        for (var i = 0; i < count; i++) {
            var p = document.createElement('span');
            p.className = 'stf-easter-particle';
            var angle = Math.random() * Math.PI * 2;
            var dist = 120 + Math.random() * 280;
            var tx = Math.cos(angle) * dist;
            var ty = Math.sin(angle) * dist;
            p.style.left = cx + 'px';
            p.style.top = cy + 'px';
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            p.style.boxShadow = '0 0 10px 2px ' + p.style.background;
            p.style.setProperty('--tx', tx + 'px');
            p.style.setProperty('--ty', ty + 'px');
            p.style.animationDelay = (Math.random() * .2) + 's';
            container.appendChild(p);
        }
    }

    function createNotes(overlay) {
        var notes = ['♪', '♫', '♬', '✨'];
        var cx = window.innerWidth / 2;
        var cy = window.innerHeight / 2;
        for (var i = 0; i < 10; i++) {
            var n = document.createElement('span');
            n.className = 'stf-easter-note';
            n.textContent = notes[Math.floor(Math.random() * notes.length)];
            var angle = -Math.PI / 2 + (Math.random() - .5) * 1.4;
            var dist = 120 + Math.random() * 200;
            n.style.left = (cx + (Math.random() - .5) * 80) + 'px';
            n.style.top = (cy + (Math.random() - .5) * 60) + 'px';
            n.style.setProperty('--nx', (Math.cos(angle) * dist) + 'px');
            n.style.setProperty('--ny', (Math.sin(angle) * dist - 80) + 'px');
            n.style.setProperty('--nr', ((Math.random() - .5) * 30) + 'deg');
            n.style.animationDelay = (Math.random() * .6) + 's';
            overlay.appendChild(n);
        }
    }

    function playTransition() {
        if (active) return;
        active = true;

        var overlay = document.getElementById('stf-easter-overlay');
        var particles = document.getElementById('stf-easter-particles');
        if (!overlay) return;

        if (particles) createParticles(particles);
        createNotes(overlay);
        overlay.classList.add('is-active');

        // 同步播放轻量提示音（可选，失败静默）
        try {
            var AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                var ctx = new AudioCtx();
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + .4);
                gain.gain.setValueAtTime(.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .9);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 1);
            }
        } catch (e) { /* ignore */ }

        // 与像素飞出动画（2s）对齐后跳转
        setTimeout(function () {
            window.location.href = TARGET;
        }, 2000);
    }

    function onKey(e) {
        if (active) return;
        /* 登录/发帖/聊天输入时勿累积数字，避免口令含 9072 误触发跳转主站 */
        var t = e.target;
        if (t) {
            var tag = (t.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
            if (t.closest && (t.closest('.stf-modal') || t.closest('.stf-welcome') || t.closest('#stf-chat-card'))) return;
        }
        var ch = e.key;
        if (!/^\d$/.test(ch)) {
            keyBuffer = '';
            return;
        }
        keyBuffer += ch;
        if (keyBuffer.length > TRIGGER_CODE.length) keyBuffer = keyBuffer.slice(-TRIGGER_CODE.length);
        if (keyBuffer === TRIGGER_CODE) playTransition();
    }

    function onTriggerClick(e) {
        if (active) return;
        e.preventDefault();
        clickCount++;
        if (!clickTimer) {
            clickTimer = setTimeout(function () {
                clickCount = 0;
                clickTimer = null;
            }, LOGO_WINDOW);
        }
        if (clickCount >= LOGO_CLICKS) {
            clearTimeout(clickTimer);
            clickTimer = null;
            clickCount = 0;
            playTransition();
        }
    }

    /* 开场沉浸提示：仅首次访问，延迟 1.2s 出现 */
    function initWelcome() {
        try {
            if (localStorage.getItem('stf_welcome_seen') === '1') return;
        } catch (e) { return; }

        var welcome = document.getElementById('stf-welcome');
        if (!welcome) return;

        function openWelcome() {
            welcome.hidden = false;
            requestAnimationFrame(function () { welcome.classList.add('is-open'); });
        }
        function closeWelcome() {
            welcome.classList.remove('is-open');
            setTimeout(function () { welcome.hidden = true; }, 450);
            try { localStorage.setItem('stf_welcome_seen', '1'); } catch (e) {}
        }

        var timer = setTimeout(openWelcome, 1200);

        welcome.querySelectorAll('[data-welcome-close]').forEach(function (el) {
            el.addEventListener('click', closeWelcome);
        });
        var enterBtn = document.getElementById('stf-welcome-enter');
        if (enterBtn) enterBtn.addEventListener('click', closeWelcome);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && welcome.classList.contains('is-open')) closeWelcome();
        });

        // 页面隐藏时取消未触发的弹窗，避免切回后突然弹出
        document.addEventListener('visibilitychange', function () {
            if (document.hidden && timer) { clearTimeout(timer); timer = null; }
        });
    }

    /**
     * 走廊「三十七」连点彩蛋（论坛档案区）
     * 设定依据：characters/aimisi —「学院走廊里三十七个人和她擦肩，没有一个人转头」。
     * 连点档案区隐蔽触发点满 37 次；输入框内不累计。
     */
    function initCorridorThirtySeven() {
        var mark = document.getElementById('stf-corridor-mark');
        if (!mark) return;
        var count = 0;
        var unlocked = false;
        var resetTimer = null;
        var toast = document.getElementById('stf-easter-toast');

        function say(msg) {
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'stf-easter-toast';
                toast.className = 'stf-easter-toast';
                toast.setAttribute('role', 'status');
                document.body.appendChild(toast);
            }
            toast.textContent = msg;
            toast.classList.add('is-visible');
            clearTimeout(say._t);
            say._t = setTimeout(function () { toast.classList.remove('is-visible'); }, 3600);
        }

        mark.addEventListener('click', function (e) {
            if (unlocked) return;
            e.preventDefault();
            count += 1;
            clearTimeout(resetTimer);
            resetTimer = setTimeout(function () { count = 0; }, 28000);
            if (count === 10 || count === 20 || count === 30) say('走廊回声… (' + count + '/37)');
            if (count >= 37) {
                unlocked = true;
                say('第三十七个人转头了。——电子幽灵在看你。');
                mark.classList.add('is-found');
            }
        });
    }

    /**
     * 构型切换：爱弥斯档案卡剪影 crossfade
     * 设定依据：characters/aimisi — 爱弥斯形态 / 机兵形态「构型切换」。
     * 双击或长按爱弥斯卡图标；不拦截普通单击跳转（长按/双击专用）。
     */
    function initAimisiFormSwitch() {
        var card = document.querySelector('.archive-float--featured .character-archive-card.is-featured');
        if (!card) return;
        var icon = card.querySelector('.character-archive-icon');
        if (!icon) return;

        var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        var mecha = false;
        var longTimer = null;
        var toast = null;

        function say(msg) {
            toast = toast || document.getElementById('stf-easter-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'stf-easter-toast';
                toast.className = 'stf-easter-toast';
                toast.setAttribute('role', 'status');
                document.body.appendChild(toast);
            }
            toast.textContent = msg;
            toast.classList.add('is-visible');
            clearTimeout(say._t);
            say._t = setTimeout(function () { toast.classList.remove('is-visible'); }, 2800);
        }

        function toggle(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            mecha = !mecha;
            icon.classList.toggle('is-mecha-form', mecha);
            if (reduceMotion) icon.style.transition = 'none';
            say(mecha ? '构型切换 · 机兵形态' : '构型切换 · 爱弥斯形态');
        }

        icon.addEventListener('dblclick', toggle);
        icon.addEventListener('pointerdown', function (e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            longTimer = setTimeout(function () {
                longTimer = null;
                toggle(e);
            }, 650);
        });
        function clearLong() {
            if (longTimer) { clearTimeout(longTimer); longTimer = null; }
        }
        icon.addEventListener('pointerup', clearLong);
        icon.addEventListener('pointerleave', clearLong);
        icon.addEventListener('pointercancel', clearLong);
    }

    ready(function () {
        document.addEventListener('keydown', onKey);
        var trigger = document.getElementById('stf-hidden-trigger');
        if (trigger) trigger.addEventListener('click', onTriggerClick);
        initWelcome();
        initCorridorThirtySeven();
        initAimisiFormSwitch();
    });

    /* 供论坛主逻辑（调谐台）调用 */
    window.playTransition = playTransition;
})();
