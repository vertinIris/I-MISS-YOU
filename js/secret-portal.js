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

    // 像素歌姬（圆形粉发双团、蓝眼、腮红、蓝白领子、右下角粉色通知点，贴近游戏内头像）
    var PIXEL_SVG =
        '<svg viewBox="0 0 64 64" width="92" height="92" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">' +
            '<defs>' +
                '<clipPath id="sp-pixel-clip">' +
                    '<circle cx="32" cy="32" r="30"/>' +
                '</clipPath>' +
            '</defs>' +
            '<circle cx="32" cy="32" r="30" fill="#1A0E1C"/>' +
            '<g clip-path="url(#sp-pixel-clip)">' +
                '<rect x="14" y="8" width="36" height="28" fill="#FF6B9D"/>' +
                '<rect x="8" y="6" width="14" height="14" fill="#FF6B9D"/>' +
                '<rect x="10" y="8" width="10" height="10" fill="#FFB6D9"/>' +
                '<rect x="42" y="6" width="14" height="14" fill="#FF6B9D"/>' +
                '<rect x="44" y="8" width="10" height="10" fill="#FFB6D9"/>' +
                '<rect x="20" y="16" width="24" height="22" fill="#FFE0CC"/>' +
                '<rect x="20" y="16" width="24" height="6" fill="#FF6B9D"/>' +
                '<rect x="22" y="18" width="6" height="4" fill="#FFB6D9"/>' +
                '<rect x="36" y="18" width="6" height="4" fill="#FFB6D9"/>' +
                '<rect x="25" y="24" width="5" height="6" fill="#6B8AFF"/>' +
                '<rect x="34" y="24" width="5" height="6" fill="#6B8AFF"/>' +
                '<rect x="26" y="25" width="2" height="2" fill="#FFFFFF"/>' +
                '<rect x="35" y="25" width="2" height="2" fill="#FFFFFF"/>' +
                '<rect x="22" y="30" width="5" height="3" fill="#FF9EC4"/>' +
                '<rect x="37" y="30" width="5" height="3" fill="#FF9EC4"/>' +
                '<rect x="29" y="34" width="6" height="2" fill="#C25B7A"/>' +
                '<rect x="18" y="38" width="28" height="18" fill="#6B8AFF"/>' +
                '<rect x="20" y="40" width="24" height="6" fill="#FFFFFF"/>' +
                '<rect x="24" y="42" width="16" height="4" fill="#A8D8FF"/>' +
            '</g>' +
            '<circle cx="32" cy="32" r="30" fill="none" stroke="#FF6B9D" stroke-width="2" stroke-opacity="0.55"/>' +
            '<circle cx="54" cy="54" r="7" fill="#FF6B9D"/>' +
            '<circle cx="54" cy="54" r="4" fill="#FFB6D9"/>' +
        '</svg>';

    var root, portal, built = false, open = false, audioCtx = null;
    var keyBuffer = '';
    var logoTimer = null, logoClicks = 0;

    // 爱弥斯入场剪影（秘门特效，独立 SVG，不依赖构型切换模块）
    var entranceSilUid = 0;
    function getEntranceSilhouette() {
        var id = 'sp-ent-' + (++entranceSilUid);
        return (
            '<svg class="sp-entrance-silhouette" viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            '<defs>' +
            '<linearGradient id="' + id + 'hair" x1="0.5" y1="0" x2="0.5" y2="1">' +
            '<stop offset="0%" stop-color="#FFE8F2"/><stop offset="40%" stop-color="#FF8FB0"/>' +
            '<stop offset="100%" stop-color="#E84C7E"/>' +
            '</linearGradient>' +
            '<linearGradient id="' + id + 'hairSide" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#FFD7E8"/><stop offset="100%" stop-color="#FF6B9D"/>' +
            '</linearGradient>' +
            '<linearGradient id="' + id + 'outfit" x1="0.25" y1="0" x2="0.8" y2="1">' +
            '<stop offset="0%" stop-color="#B4C6FF"/><stop offset="50%" stop-color="#6B8AFF"/>' +
            '<stop offset="100%" stop-color="#4A6AE0"/>' +
            '</linearGradient>' +
            '<radialGradient id="' + id + 'ghost" cx="50%" cy="45%" r="55%">' +
            '<stop offset="0%" stop-color="#FFB6D9" stop-opacity="0.28"/>' +
            '<stop offset="100%" stop-color="#A8D8FF" stop-opacity="0"/>' +
            '</radialGradient>' +
            '</defs>' +
            '<ellipse cx="60" cy="84" rx="34" ry="48" fill="url(#' + id + 'ghost)"/>' +
            '<path fill="#FFB6D9" opacity="0.22" d="M42 70 C28 66 20 78 24 90 C30 84 36 78 42 76 Z"/>' +
            '<path fill="#A8D8FF" opacity="0.22" d="M78 70 C92 66 100 78 96 90 C90 84 84 78 78 76 Z"/>' +
            '<path fill="url(#' + id + 'hairSide)" d="M44 38 C34 50 30 70 32 96 C34 118 40 136 48 146 L52 132 C48 116 46 98 48 76 C50 58 52 46 56 40 Z"/>' +
            '<path fill="url(#' + id + 'hairSide)" d="M76 38 C86 50 90 70 88 96 C86 118 80 136 72 146 L68 132 C72 116 74 98 72 76 C70 58 68 46 64 40 Z"/>' +
            '<path fill="url(#' + id + 'hair)" opacity="0.85" d="M40 52 C36 68 36 88 40 108 L46 104 C44 86 44 68 48 56 Z"/>' +
            '<path fill="url(#' + id + 'hair)" opacity="0.85" d="M80 52 C84 68 84 88 80 108 L74 104 C76 86 76 68 72 56 Z"/>' +
            '<path fill="url(#' + id + 'hair)" d="M46 34 C48 18 54 12 60 12 C66 12 72 18 74 34 C70 24 65 20 60 20 C55 20 50 24 46 34 Z"/>' +
            '<path fill="url(#' + id + 'hair)" d="M48 32 C52 26 56 24 60 24 C64 24 68 26 72 32 C68 30 64 28 60 28 C56 28 52 30 48 32 Z"/>' +
            '<ellipse cx="60" cy="44" rx="12" ry="13.5" fill="#FFF5F8"/>' +
            '<path fill="url(#' + id + 'hair)" d="M48 36 C46 44 46 54 48 62 L52 58 C51 48 51 40 54 36 Z"/>' +
            '<path fill="url(#' + id + 'hair)" d="M72 36 C74 44 74 54 72 62 L68 58 C69 48 69 40 66 36 Z"/>' +
            '<rect x="51" y="41" width="5" height="5" rx="1" fill="#6B8AFF"/>' +
            '<rect x="64" y="41" width="5" height="5" rx="1" fill="#6B8AFF"/>' +
            '<rect x="52" y="41.5" width="2" height="2" fill="#A8D8FF"/>' +
            '<rect x="65" y="41.5" width="2" height="2" fill="#A8D8FF"/>' +
            '<rect x="54" y="41" width="1.5" height="1.5" fill="#FFFFFF"/>' +
            '<rect x="67" y="41" width="1.5" height="1.5" fill="#FFFFFF"/>' +
            '<ellipse cx="49" cy="50" rx="2.4" ry="1.5" fill="#FFB6D9" opacity="0.8"/>' +
            '<ellipse cx="71" cy="50" rx="2.4" ry="1.5" fill="#FFB6D9" opacity="0.8"/>' +
            '<path d="M56 51.5 C58.5 53.5 61.5 53.5 64 51.5" stroke="#FF6B9D" stroke-width="1.25" stroke-linecap="round" fill="none"/>' +
            '<path fill="#FFF5F8" d="M55 55 H65 L66 66 H54 Z"/>' +
            '<path fill="url(#' + id + 'outfit)" d="M50 66 C44 70 40 82 42 98 L46 122 L54 146 L60 150 L66 146 L74 122 L78 98 C80 82 76 70 70 66 C66 72 54 72 50 66 Z"/>' +
            '<path fill="#9AB3FF" opacity="0.9" d="M51 66 H69 L67 74 H53 Z"/>' +
            '<path fill="#FFFFFF" d="M60 88 L62.5 92.5 L60 97 L57.5 92.5 Z"/>' +
            '<path fill="#A8D8FF" d="M55.5 92.5 L60 90 L64.5 92.5 L60 95 Z"/>' +
            '<path fill="#B66BFF" opacity="0.5" d="M42 76 L48 70 L50 80 Z"/>' +
            '<path fill="#B66BFF" opacity="0.5" d="M78 76 L72 70 L70 80 Z"/>' +
            '<path fill="#FF8FB0" d="M42 74 L36 96 L42 100 L48 80 Z"/>' +
            '<path fill="#FF8FB0" d="M78 74 L84 96 L78 100 L72 80 Z"/>' +
            '<path stroke="#F2F7FF" stroke-width="2.1" stroke-linecap="round" d="M84 98 L102 134" opacity="0.8"/>' +
            '<path stroke="#FF6B9D" stroke-width="1.3" stroke-linecap="round" d="M82 96 L86 100"/>' +
            '<rect x="51" y="16" width="2.4" height="2.4" rx="0.4" fill="#FFD700"/>' +
            '<rect x="66.5" y="16" width="2.4" height="2.4" rx="0.4" fill="#FFD700"/>' +
            '<circle cx="16" cy="48" r="1.5" fill="#FFFFFF" opacity="0.75"/>' +
            '<circle cx="104" cy="56" r="1.3" fill="#FFFFFF" opacity="0.55"/>' +
            '<circle cx="22" cy="92" r="1.1" fill="#FFB6D9" opacity="0.55"/>' +
            '<circle cx="98" cy="100" r="1.1" fill="#A8D8FF" opacity="0.55"/>' +
            '<path fill="#FFFFFF" opacity="0.3" d="M54 18 C57 14 63 14 66 18 C63 16 57 16 54 18 Z"/>' +
            '</svg>'
        );
    }

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

        // 入口标题旁标注待完善
        var title = portal.querySelector('#sp-title');
        if (title && !title.querySelector('.sp-wip-badge')) {
            title.innerHTML = title.textContent + '<span class="sp-wip-badge">待完善</span>';
        }

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

    function createEntranceOverlay() {
        var overlay = document.createElement('div');
        overlay.className = 'sp-entrance';
        overlay.id = 'sp-entrance';
        overlay.setAttribute('aria-hidden', 'true');

        var burst = document.createElement('div');
        burst.className = 'sp-entrance-burst';
        overlay.appendChild(burst);

        var ring = document.createElement('div');
        ring.className = 'sp-entrance-ring';
        overlay.appendChild(ring);

        // 粒子爆发
        for (var i = 0; i < 24; i++) {
            var p = document.createElement('span');
            p.className = 'sp-entrance-particle';
            var angle = (Math.PI * 2 * i) / 24;
            var dist = 90 + Math.random() * 110;
            var tx = Math.cos(angle) * dist + 'px';
            var ty = Math.sin(angle) * dist + 'px';
            var size = 4 + Math.random() * 6;
            p.style.cssText =
                'left:50%;top:50%;width:' + size + 'px;height:' + size + 'px;' +
                'margin-left:' + (-size / 2) + 'px;margin-top:' + (-size / 2) + 'px;' +
                '--tx:' + tx + ';--ty:' + ty + ';animation-delay:' + (Math.random() * 0.15).toFixed(3) + 's;';
            var colors = ['#FF6B9D', '#FFB6D9', '#A8D8FF', '#B66BFF', '#FFFFFF'];
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            overlay.appendChild(p);
        }

        overlay.insertAdjacentHTML('beforeend', getEntranceSilhouette());
        document.body.appendChild(overlay);
        return overlay;
    }

    function playEntranceThenOpen() {
        if (!built) buildPortal();
        if (open) return;
        var overlay = document.getElementById('sp-entrance') || createEntranceOverlay();
        overlay.classList.remove('is-active');
        void overlay.offsetWidth;
        overlay.classList.add('is-active');

        // 同步播放星光琶音，营造入场仪式感
        playChime();

        window.setTimeout(function () {
            overlay.classList.remove('is-active');
            portal.hidden = false;
            void portal.offsetWidth;
            requestAnimationFrame(function () { portal.classList.add('is-open'); });
            open = true;
            var closeEl = portal.querySelector('.sp-close');
            if (closeEl) closeEl.focus();
        }, 1100);
    }

    function openPortal() {
        playEntranceThenOpen();
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

        // 在导航 logo 旁插入彩蛋入口标识，明确入口位置与待完善状态
        var navContainer = document.querySelector('.nav-container');
        if (navContainer && !document.getElementById('egg-entry-marker')) {
            var marker = document.createElement('span');
            marker.id = 'egg-entry-marker';
            marker.className = 'egg-entry-marker';
            marker.setAttribute('role', 'img');
            marker.setAttribute('aria-label', '彩蛋入口：输入 9072 或连点雪花 logo 5 次（待完善）');
            marker.setAttribute('tabindex', '0');
            marker.title = '彩蛋入口：输入 9072 或连点雪花 logo 5 次（待完善）';
            navContainer.insertBefore(marker, navContainer.children[1] || null);
        }
    });
})();
