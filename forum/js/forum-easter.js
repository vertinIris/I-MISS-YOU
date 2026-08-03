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

    ready(function () {
        document.addEventListener('keydown', onKey);
        var trigger = document.getElementById('stf-hidden-trigger');
        if (trigger) trigger.addEventListener('click', onTriggerClick);
    });
})();
