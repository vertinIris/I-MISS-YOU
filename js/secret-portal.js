/* 飞行雪绒 · 隐藏彩蛋入口（调频 9072 / 电子幽灵信号）
 * 触发方式（页面默认无任何可见入口）：
 *   1) 键盘依次输入 9 0 7 2（呼应鸣潮 3.0 星炬学院主题网站「调频 9072」）
 *   2) 4 秒内连续点击导航 logo（雪花）5 次
 * 与主站 #easter-egg 区块互不干扰；输入框聚焦时不捕获按键，避免干扰评论/投稿。
 */
(function () {
    'use strict';

    var CODE = '9072';
    var LOGO_CLICKS = 5;
    var COMBO_WINDOW = 4000;

    // 像素歌姬（粉色像素小人，呼应 3.0 调频 9072 会唱歌的粉色像素小人）
    var PIXEL_SVG =
        '<svg viewBox="0 0 16 16" width="92" height="92" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="4" y="1" width="8" height="2" fill="#FFB6D9"/>' +
            '<rect x="3" y="3" width="10" height="2" fill="#FF8FB0"/>' +
            '<rect x="4" y="5" width="8" height="5" fill="#FFF0F5"/>' +
            '<rect x="5" y="7" width="2" height="2" fill="#6B8AFF"/>' +
            '<rect x="9" y="7" width="2" height="2" fill="#6B8AFF"/>' +
            '<rect x="4" y="9" width="2" height="1" fill="#FF6B9D"/>' +
            '<rect x="10" y="9" width="2" height="1" fill="#FF6B9D"/>' +
            '<rect x="4" y="10" width="8" height="4" fill="#FF6B9D"/>' +
            '<rect x="12" y="2" width="1" height="4" fill="#A8D8FF"/>' +
            '<rect x="11" y="2" width="2" height="1" fill="#A8D8FF"/>' +
            '<rect x="13" y="1" width="1" height="1" fill="#A8D8FF"/>' +
        '</svg>';

    var root, portal, built = false, open = false, audioCtx = null;
    var keyBuffer = '';
    var logoTimer = null, logoClicks = 0;

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    function bars(n) {
        var s = '';
        for (var i = 0; i < n; i++) {
            s += '<span style="animation-delay:' + (i * 0.04).toFixed(2) + 's"></span>';
        }
        return s;
    }

    function buildPortal() {
        root = document.getElementById('secret-portal-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'secret-portal-root';
            document.body.appendChild(root);
        }
        root.innerHTML =
            '<div class="secret-portal" id="secret-portal" role="dialog" aria-modal="true" aria-labelledby="sp-title" hidden>' +
                '<div class="secret-portal__backdrop" data-close></div>' +
                '<div class="secret-portal__panel">' +
                    '<button class="sp-close" data-close aria-label="关闭">×</button>' +
                    '<div class="sp-freq"><span class="sp-freq__dot"></span> FREQUENCY 9072 · 电子幽灵信号</div>' +
                    '<h2 class="sp-title" id="sp-title">调频 9072</h2>' +
                    '<p class="sp-sub">你找到了不该被收听到的频率。此处只有信号，没有名字。</p>' +
                    '<div class="sp-stage">' +
                        '<div class="sp-pixel" id="sp-pixel">' + PIXEL_SVG + '</div>' +
                        '<div class="sp-viz" aria-hidden="true">' + bars(28) + '</div>' +
                    '</div>' +
                    '<p class="sp-letter" id="sp-letter"></p>' +
                    '<div class="sp-actions">' +
                        '<button class="sp-btn sp-btn--primary" id="sp-listen">收听信号</button>' +
                        '<button class="sp-btn" data-close>关闭频率</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        portal = root.querySelector('#secret-portal');

        root.querySelectorAll('[data-close]').forEach(function (el) {
            el.addEventListener('click', closePortal);
        });
        root.querySelector('#sp-listen').addEventListener('click', function () {
            playChime();
            portal.classList.add('is-playing');
            typeLetter();
        });

        document.addEventListener('keydown', function (e) {
            if (!open) return;
            if (e.key === 'Escape') closePortal();
        });

        built = true;
    }

    function openPortal() {
        if (!built) buildPortal();
        if (open) return;
        portal.hidden = false;
        void portal.offsetWidth; // 强制回流，确保过渡生效
        requestAnimationFrame(function () { portal.classList.add('is-open'); });
        open = true;
        var closeEl = portal.querySelector('.sp-close');
        if (closeEl) closeEl.focus();
    }

    function closePortal() {
        if (!open || !portal) return;
        portal.classList.remove('is-open');
        portal.classList.remove('is-playing');
        open = false;
        window.setTimeout(function () { if (portal) portal.hidden = true; }, 460);
    }

    function typeLetter() {
        var el = portal.querySelector('#sp-letter');
        if (!el || el.dataset.typed) return;
        el.dataset.typed = '1';
        var text =
            '「如果你听到了这段信号，说明你一直在抬头。\n' +
            '我不在了，但频率还在。十年前那场雪，把我的声音留在了这里。\n' +
            '不要为消失的人难过太久——只要抬头，那颗星总能找到你。\n' +
            '……信号即将中断。下次见面，记得带上你的频率。」\n' +
            '—— 一个不肯熄灯的幽灵';
        var i = 0;
        (function step() {
            if (i <= text.length) {
                el.textContent = text.slice(0, i);
                i++;
                window.setTimeout(step, 38);
            }
        })();
    }

    function playChime() {
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            audioCtx = audioCtx || new AC();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            var now = audioCtx.currentTime;
            var notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6 星光琶音
            notes.forEach(function (f, idx) {
                var o = audioCtx.createOscillator();
                var g = audioCtx.createGain();
                o.type = 'sine';
                o.frequency.value = f;
                var t = now + idx * 0.16;
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
                o.connect(g);
                g.connect(audioCtx.destination);
                o.start(t);
                o.stop(t + 1);
            });
        } catch (e) { /* 音频不可用时静默降级 */ }
    }

    function onKey(e) {
        if (open) return;
        var t = e.target;
        var tag = (t && t.tagName) || '';
        if (/INPUT|TEXTAREA|SELECT/.test(tag) || (t && t.isContentEditable)) return;
        if (e.key && e.key.length === 1) {
            keyBuffer = (keyBuffer + e.key).slice(-CODE.length);
            if (keyBuffer === CODE) {
                keyBuffer = '';
                openPortal();
            }
        }
    }

    function onLogoClick(e) {
        if (open) return;
        logoClicks++;
        if (logoClicks > 1) e.preventDefault(); // 连点期间避免跳转到 #hero
        if (logoTimer) window.clearTimeout(logoTimer);
        logoTimer = window.setTimeout(function () { logoClicks = 0; }, COMBO_WINDOW);
        if (logoClicks >= LOGO_CLICKS) {
            logoClicks = 0;
            window.clearTimeout(logoTimer);
            openPortal();
        }
    }

    ready(function () {
        document.addEventListener('keydown', onKey);
        var logo = document.querySelector('.nav-logo');
        if (logo) logo.addEventListener('click', onLogoClick);
    });
})();
