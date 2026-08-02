/* ========================================
   飞行雪绒 — Main Interaction System
   Theme Toggle · Scroll Reveal · Like · Easter Egg · Magnetic
   增强浏览器兼容性：Edge · 夸克 · Safari · 旧版浏览器
   ======================================== */

(function() {
    'use strict';

    function safeSetItem(key, value) {
        try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
    }

    function safeGetItem(key) {
        try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }

    function addMediaListener(query, callback) {
        var mql = window.matchMedia(query);
        if (!mql) return;
        if (typeof mql.addEventListener === 'function') mql.addEventListener('change', callback);
        else if (typeof mql.addListener === 'function') mql.addListener(callback);
    }

    var rAF = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function(cb) { return setTimeout(cb, 16); };

    var THEME_KEY = 'snowfluff-theme';
    var themes = ['dark', 'light', 'auto'];
    var currentThemeIndex = 0;

    function getStoredTheme() { var s = safeGetItem(THEME_KEY); return (s && themes.indexOf(s) !== -1) ? s : 'dark'; }
    function getEffectiveTheme(theme) { if (theme === 'auto') { var m = window.matchMedia('(prefers-color-scheme: dark)'); return (m && m.matches) ? 'dark' : 'light'; } return theme; }

    function applyTheme(theme) {
        var html = document.documentElement;
        html.setAttribute('data-theme', getEffectiveTheme(theme));
        if (theme === 'auto') html.setAttribute('data-theme-pref', 'auto'); else html.removeAttribute('data-theme-pref');
        if (window.SnowParticles && window.SnowParticles.updateTheme) window.SnowParticles.updateTheme();
    }

    function cycleTheme() { currentThemeIndex = (currentThemeIndex + 1) % themes.length; safeSetItem(THEME_KEY, themes[currentThemeIndex]); applyTheme(themes[currentThemeIndex]); }

    function initTheme() { currentThemeIndex = themes.indexOf(getStoredTheme()); applyTheme(themes[currentThemeIndex]); addMediaListener('(prefers-color-scheme: dark)', function() { if (themes[currentThemeIndex] === 'auto') applyTheme('auto'); }); }

    function initMobileMenu() {
        var menuBtn = document.getElementById('menu-btn'), navLinks = document.getElementById('nav-links');
        if (!menuBtn || !navLinks) return;
        menuBtn.addEventListener('click', function() { menuBtn.classList.toggle('active'); navLinks.classList.toggle('active'); });
        var links = navLinks.querySelectorAll('.nav-link');
        for (var i = 0; i < links.length; i++) links[i].addEventListener('click', function() { menuBtn.classList.remove('active'); navLinks.classList.remove('active'); });
        document.addEventListener('click', function(e) { if (!menuBtn.contains(e.target) && !navLinks.contains(e.target)) { menuBtn.classList.remove('active'); navLinks.classList.remove('active'); } });
    }

    function initScrollReveal() {
        var reveals = document.querySelectorAll('.reveal');
        if (!('IntersectionObserver' in window)) { for (var i = 0; i < reveals.length; i++) reveals[i].classList.add('visible'); return; }
        var obs = new IntersectionObserver(function(entries) {
            for (var j = 0; j < entries.length; j++) {
                if (entries[j].isIntersecting) {
                    var siblings = Array.prototype.filter.call(entries[j].target.parentElement.children, function(c) { return c.classList.contains('reveal'); });
                    entries[j].target.style.transitionDelay = (siblings.indexOf(entries[j].target) * 0.1) + 's';
                    entries[j].target.classList.add('visible');
                    obs.unobserve(entries[j].target);
                }
            }
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
        for (var k = 0; k < reveals.length; k++) obs.observe(reveals[k]);
    }

    function formatNumber(num) { return num >= 10000 ? (num / 10000).toFixed(1) + 'w' : num.toLocaleString('zh-CN'); }

    function createHeartParticle(btn) {
        var rect = btn.getBoundingClientRect();
        var heart = document.createElement('span');
        heart.textContent = '♥';
        heart.style.cssText = 'position:fixed;left:' + (rect.left + rect.width / 2) + 'px;top:' + rect.top + 'px;color:var(--color-pink);font-size:1.2rem;pointer-events:none;z-index:9999;animation:floatHeart 0.8s ease-out forwards;';
        document.body.appendChild(heart);
        setTimeout(function() { heart.remove(); }, 800);
    }

    /* ===== 博文点赞状态持久化（G-09 修复）===== */
    var POST_LIKES_KEY = 'fxre_post_likes';
    function getPostLikedStates() {
        try { return JSON.parse(safeGetItem(POST_LIKES_KEY) || '{}'); } catch(e) { return {}; }
    }
    function savePostLikedStates(states) {
        safeSetItem(POST_LIKES_KEY, JSON.stringify(states));
    }

    function initLikeButtons() {
        var btns = document.querySelectorAll('.like-btn');
        var likedStates = getPostLikedStates();

        for (var i = 0; i < btns.length; i++) {
            (function(btn) {
                var countEl = btn.querySelector('.like-count');
                var baseCount = parseInt(btn.dataset.likes || '0', 10) || 0;

                /* 用 post-card 的 data-post-id 作为唯一标识 */
                var card = btn.closest('.post-card');
                var postId = card ? card.getAttribute('data-post-id') : ('idx-' + i);

                /* 恢复页面加载时的 liked 状态 */
                if (likedStates[postId]) {
                    btn.classList.add('liked');
                    if (countEl) countEl.textContent = formatNumber(baseCount + 1);
                }

                btn.addEventListener('click', function() {
                    var states = getPostLikedStates();
                    if (btn.classList.contains('liked')) {
                        btn.classList.remove('liked');
                        states[postId] = false;
                        if (countEl) countEl.textContent = formatNumber(baseCount);
                    } else {
                        btn.classList.add('liked');
                        states[postId] = true;
                        if (countEl) countEl.textContent = formatNumber(baseCount + 1);
                        createHeartParticle(btn);
                    }
                    savePostLikedStates(states);
                });
            })(btns[i]);
        }
    }

    var style = document.createElement('style');
    style.textContent = '@keyframes floatHeart { 0% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-40px) scale(1.5); } }';
    document.head.appendChild(style);

    function initStatCounters() {
        var counters = document.querySelectorAll('.stat-value[data-count]');
        if (!('IntersectionObserver' in window)) { for (var i = 0; i < counters.length; i++) counters[i].textContent = formatNumber(parseInt(counters[i].dataset.count, 10) || 0); return; }
        var obs = new IntersectionObserver(function(entries) { for (var j = 0; j < entries.length; j++) if (entries[j].isIntersecting) { animateCounter(entries[j].target); obs.unobserve(entries[j].target); } }, { threshold: 0.5 });
        for (var k = 0; k < counters.length; k++) obs.observe(counters[k]);
    }

    function animateCounter(el) {
        var target = parseInt(el.dataset.count, 10) || 0;
        var start = performance.now ? performance.now() : Date.now();
        function update(now) { var p = Math.min((now - start) / 1500, 1); var c = Math.floor((1 - Math.pow(1 - p, 3)) * target); el.textContent = formatNumber(c); if (p < 1) rAF(update); else el.textContent = formatNumber(target); }
        rAF(update);
    }

    function initEasterEgg() {
        var eggBtn = document.getElementById('egg-trigger'), eggResult = document.getElementById('egg-result'), eggTitle = document.querySelector('.egg-title'), eggCard = document.getElementById('egg-card');
        if (!eggBtn || !eggResult) return;
        var messages = ['信号微弱……请再试一次。📡', '检测到异常频率波动。⚠️', '连接中……██████████ 30%', '连接中……████████████████ 60%', '连接中……██████████████████████ 90%'];
        var clickCount = 0;
        eggBtn.addEventListener('click', function() {
            if (clickCount < 4) {
                eggResult.textContent = messages[clickCount++];
                eggResult.classList.add('show');
                if (eggTitle) { eggTitle.style.animation = 'glitch-1 0.3s infinite, glitch-2 0.3s infinite'; setTimeout(function() { eggTitle.style.animation = ''; }, 500); }
            } else {
                eggResult.innerHTML = '✨ 信号连接成功！飞行雪绒向你发送了一条消息：<br>"谢谢你找到了这里～下次深夜的时候，抬头看看星星吧。有一颗，总在对你闪烁。就像我知道，只要抬头，那颗星总能找到我一样。"';
                eggResult.classList.add('show');
                if (eggTitle) { eggTitle.textContent = '✦'; eggTitle.setAttribute('data-text', '✦'); }
                eggBtn.style.display = 'none';
                if (eggCard) { eggCard.style.borderColor = 'var(--color-pink)'; eggCard.style.boxShadow = '0 0 60px rgba(255, 107, 157, 0.35), 0 0 30px rgba(107, 138, 255, 0.2)'; }
                triggerSnowConfetti();
            }
        });
    }

    function triggerSnowConfetti() {
        var colors = ['#FF6B9D', '#FFB6D9', '#6B8AFF', '#A8D8FF', '#B66BFF', '#FFFFFF'], symbols = ['\u2744', '\u2726', '\u2745', '\u2727', '\u2728'];
        for (var i = 0; i < 30; i++) {
            (function(idx) { setTimeout(function() {
                var flake = document.createElement('span');
                flake.textContent = symbols[Math.floor(Math.random() * symbols.length)];
                flake.style.cssText = 'position:fixed;top:-20px;left:' + Math.random() * 100 + '%;color:' + colors[Math.floor(Math.random() * colors.length)] + ';font-size:' + (Math.random() * 1.5 + 0.8) + 'rem;pointer-events:none;z-index:9999;opacity:' + (Math.random() * 0.5 + 0.5) + ';animation:snowFall ' + (Math.random() * 3 + 3) + 's linear forwards;';
                document.body.appendChild(flake);
                setTimeout(function() { flake.remove(); }, 6000);
            }, idx * 50); })(i);
        }
    }

    var snowStyle = document.createElement('style');
    snowStyle.textContent = '@keyframes snowFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(360deg); opacity: 0; } }';
    document.head.appendChild(snowStyle);

    function initMagneticButtons() {
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;
        var btns = document.querySelectorAll('.magnetic');
        for (var i = 0; i < btns.length; i++) {
            (function(btn) {
                btn.addEventListener('mousemove', function(e) { var rect = btn.getBoundingClientRect(); var x = e.clientX - rect.left - rect.width / 2; var y = e.clientY - rect.top - rect.height / 2; btn.style.transform = 'translate(' + (x * 0.2) + 'px, ' + (y * 0.2) + 'px) translateY(-2px)'; });
                btn.addEventListener('mouseleave', function() { btn.style.transform = ''; });
            })(btns[i]);
        }
    }

    function initNavbarScroll() {
        var navbar = document.getElementById('navbar'); if (!navbar) return;
        var ticking = false;
        function update() { navbar.style.boxShadow = (window.pageYOffset || document.documentElement.scrollTop || 0) > 50 ? '0 4px 30px rgba(0,0,0,0.15)' : 'none'; ticking = false; }
        window.addEventListener('scroll', function() { if (!ticking) { rAF(update); ticking = true; } }, { passive: true });
    }

    function initSmoothScroll() {
        var anchors = document.querySelectorAll('a[href^="#"]');
        for (var i = 0; i < anchors.length; i++) {
            anchors[i].addEventListener('click', function(e) {
                var t = document.querySelector(this.getAttribute('href'));
                if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            });
        }
    }

    function initActiveNavLink() {
        var sections = document.querySelectorAll('section[id]'), links = document.querySelectorAll('.nav-link');
        var navOffset = 80;
        function updateActive() {
            var scrollPos = (window.pageYOffset || document.documentElement.scrollTop || 0) + navOffset + 120;
            var current = '';
            for (var i = 0; i < sections.length; i++) {
                var section = sections[i];
                var top = section.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0);
                if (top <= scrollPos) current = section.getAttribute('id');
            }
            if (!current && sections.length) current = sections[0].getAttribute('id');
            for (var j = 0; j < links.length; j++) {
                links[j].classList.toggle('active', links[j].getAttribute('href') === '#' + current);
            }
        }
        window.addEventListener('scroll', function() { rAF(updateActive); }, { passive: true });
        updateActive();
    }

    function initShootingStars() {
        var container = document.getElementById('shooting-stars');
        if (!container) return;
        var isReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (isReduced) return;

        var timeoutId = null;
        var isActive = true;

        function createStar(opts) {
            opts = opts || {};
            var star = document.createElement('div');
            star.className = 'shooting-star';

            var startX = opts.startX !== undefined ? opts.startX : (Math.random() * 80 + 10);
            var startY = opts.startY !== undefined ? opts.startY : (Math.random() * 30);
            var distance = opts.distance !== undefined ? opts.distance : (Math.random() * 300 + 200);
            var drop = opts.drop !== undefined ? opts.drop : (Math.random() * 200 + 120);
            var angle = opts.angle !== undefined ? opts.angle : (Math.random() * 25 + 15);
            var duration = opts.duration !== undefined ? opts.duration : (Math.random() * 2 + 1.2);

            /* Randomize trail length */
            var trailWidth = Math.random() * 60 + 50;
            var trailHeight = Math.random() * 1.5 + 1;

            /* Randomize size and glow */
            var size = Math.random() * 2 + 2;
            var glowIntensity = Math.random() * 0.4 + 0.5;

            star.style.left = startX + '%';
            star.style.top = startY + '%';
            star.style.width = size + 'px';
            star.style.height = size + 'px';
            star.style.boxShadow = '0 0 ' + (size * 3) + 'px ' + (size * 0.8) + 'px rgba(255, 255, 255, ' + glowIntensity + '),' +
                                   '0 0 ' + (size * 6) + 'px ' + (size * 1.5) + 'px rgba(255, 107, 157, ' + (glowIntensity * 0.5) + ')';
            star.style.setProperty('--distance', distance + 'px');
            star.style.setProperty('--drop', drop + 'px');
            star.style.setProperty('--angle', angle + 'deg');
            star.style.animation = 'shootStar ' + duration + 's ease-out forwards';

            /* Customize trail */
            var trail = document.createElement('style');
            var trailId = 'trail-' + Math.random().toString(36).substr(2, 9);
            star.setAttribute('data-trail', trailId);
            trail.textContent = '.shooting-star[data-trail="' + trailId + '"]::after{width:' + trailWidth + 'px;height:' + trailHeight + 'px;}';
            document.head.appendChild(trail);

            container.appendChild(star);
            setTimeout(function() {
                star.remove();
                trail.remove();
            }, duration * 1000 + 100);
        }

        function scheduleNext() {
            if (!isActive) return;

            /* Random interval: sometimes fast burst, sometimes long pause */
            var interval;
            var roll = Math.random();

            if (roll < 0.15) {
                /* Burst mode: 2-4 stars in quick succession */
                var burstCount = Math.floor(Math.random() * 3) + 2;
                var burstGap = Math.random() * 400 + 200;
                for (var i = 0; i < burstCount; i++) {
                    (function(idx) {
                        setTimeout(function() {
                            createStar({
                                duration: Math.random() * 1.5 + 1,
                                angle: Math.random() * 30 + 10
                            });
                        }, idx * burstGap);
                    })(i);
                }
                interval = Math.random() * 3000 + 5000;
            } else if (roll < 0.4) {
                /* Quick single star */
                createStar({ duration: Math.random() * 1 + 0.8 });
                interval = Math.random() * 2000 + 1500;
            } else if (roll < 0.75) {
                /* Normal star */
                createStar();
                interval = Math.random() * 4000 + 3000;
            } else {
                /* Long pause — a quiet moment in the sky */
                interval = Math.random() * 5000 + 6000;
            }

            timeoutId = setTimeout(scheduleNext, interval);
        }

        scheduleNext();

        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                isActive = false;
                if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
            } else {
                isActive = true;
                scheduleNext();
            }
        });
    }

    /* ============ Location Selector ============ */
    function initLocationSelector() {
        var selector = document.getElementById('location-selector');
        var dropdown = document.getElementById('location-dropdown');
        var current = document.getElementById('location-current');
        if (!selector || !dropdown || !current) return;

        var storedLoc = safeGetItem('snowfluff-location');

        selector.addEventListener('click', function(e) {
            if (e.target.closest('.location-option')) return;
            e.stopPropagation();
            selector.classList.toggle('open');
        });

        document.addEventListener('click', function(e) {
            if (!selector.contains(e.target)) selector.classList.remove('open');
        });

        var options = dropdown.querySelectorAll('.location-option');
        for (var i = 0; i < options.length; i++) {
            (function(opt) {
                opt.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var loc = opt.getAttribute('data-location');
                    current.textContent = '在线 · ' + loc;
                    for (var j = 0; j < options.length; j++) options[j].classList.remove('active');
                    opt.classList.add('active');
                    selector.classList.remove('open');
                    safeSetItem('snowfluff-location', loc);
                });
                if (storedLoc && opt.getAttribute('data-location') === storedLoc) {
                    current.textContent = '在线 · ' + storedLoc;
                    for (var j = 0; j < options.length; j++) options[j].classList.remove('active');
                    opt.classList.add('active');
                }
            })(options[i]);
        }
    }

    /* ============ Sparkle Particles ============ */
    function initSparkles() {
        var isReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (isReduced) return;

        var sections = document.querySelectorAll('.section, .hero');
        for (var s = 0; s < sections.length; s++) {
            var container = document.createElement('div');
            container.className = 'sparkle-particles';
            sections[s].appendChild(container);

            var count = 8;
            for (var i = 0; i < count; i++) {
                var sparkle = document.createElement('span');
                sparkle.className = 'sparkle';
                sparkle.style.left = Math.random() * 100 + '%';
                sparkle.style.animationDuration = (Math.random() * 8 + 6) + 's';
                sparkle.style.animationDelay = (Math.random() * -10) + 's';
                sparkle.style.width = sparkle.style.height = (Math.random() * 3 + 2) + 'px';
                container.appendChild(sparkle);
            }
        }
    }

    /* ============ Music Player (Web Audio API — Original Synthesis) ============ */
    var musicPlayer = {
        audioCtx: null,
        masterGain: null,
        analyser: null,
        activeNodes: [],
        vizCanvas: null,
        vizCtx: null,
        vizRAF: null,
        currentTrack: 0,
        isPlaying: false,
        playStartTime: 0,
        elapsed: 0,
        tracks: [
            { name: '星炬学院的深夜', meta: '钢琴 + 合成器 · 温柔而孤独', duration: 200, notes: [60, 64, 67, 72, 67, 64], type: 'piano' },
            { name: '信号中的回响', meta: '电子 · 模拟信号漂流感', duration: 255, notes: [55, 59, 62, 55, 67, 59], type: 'electronic' },
            { name: '渐湖的冰面', meta: '环境音 · 冰层下鱼游过的震动', duration: 330, notes: [72, 76, 79, 84, 79, 76], type: 'crystal' },
            { name: '双形态协奏曲', meta: '少女与机兵的协奏 · 两种感知重叠的瞬间', duration: 225, notes: [57, 60, 64, 57, 65, 60], type: 'dual' },
            { name: '调频9072', meta: '深夜广播 · 凌晨一点信号最清晰', duration: 480, notes: [48, 52, 55, 48, 60, 52], type: 'drone' }
        ]
    };

    function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

    function initMusic() {
        var playBtn = document.getElementById('play-btn');
        var prevBtn = document.getElementById('prev-track');
        var nextBtn = document.getElementById('next-track');
        var trackItems = document.querySelectorAll('.track-item');
        var trackName = document.getElementById('track-name');
        var trackMeta = document.getElementById('track-meta');
        var totalTime = document.getElementById('total-time');
        var disc = document.getElementById('music-disc');
        musicPlayer.vizCanvas = document.getElementById('viz-canvas');

        if (!playBtn) return;

        function formatTime(sec) {
            var m = Math.floor(sec / 60);
            var s = Math.floor(sec % 60);
            return m + ':' + (s < 10 ? '0' + s : s);
        }

        function updateTrackInfo() {
            var track = musicPlayer.tracks[musicPlayer.currentTrack];
            if (trackName) trackName.textContent = track.name;
            if (trackMeta) trackMeta.textContent = '飞行雪绒 · ' + track.meta;
            if (totalTime) totalTime.textContent = formatTime(track.duration);
            for (var i = 0; i < trackItems.length; i++) {
                trackItems[i].classList.toggle('active', parseInt(trackItems[i].getAttribute('data-track'), 10) === musicPlayer.currentTrack);
            }
        }

        function playTrack() {
            if (!musicPlayer.audioCtx) {
                try {
                    musicPlayer.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    musicPlayer.masterGain = musicPlayer.audioCtx.createGain();
                    musicPlayer.masterGain.gain.value = 0.15;
                    musicPlayer.analyser = musicPlayer.audioCtx.createAnalyser();
                    musicPlayer.analyser.fftSize = 128;
                    musicPlayer.masterGain.connect(musicPlayer.analyser);
                    musicPlayer.analyser.connect(musicPlayer.audioCtx.destination);
                } catch (e) {
                    console.warn('Web Audio API not available:', e);
                    return;
                }
            }

            if (musicPlayer.audioCtx.state === 'suspended') musicPlayer.audioCtx.resume();
            stopTrack();
            musicPlayer.isPlaying = true;
            musicPlayer.playStartTime = musicPlayer.audioCtx.currentTime - musicPlayer.elapsed;

            var track = musicPlayer.tracks[musicPlayer.currentTrack];
            scheduleNotes(track);

            playBtn.querySelector('.play-icon').style.display = 'none';
            playBtn.querySelector('.pause-icon').style.display = '';
            if (disc) disc.classList.add('playing');
            startVisualizer();
            updateProgress();
        }

        function stopTrack() {
            for (var i = 0; i < musicPlayer.activeNodes.length; i++) {
                try {
                    if (musicPlayer.activeNodes[i].stop) musicPlayer.activeNodes[i].stop();
                    if (musicPlayer.activeNodes[i].disconnect) musicPlayer.activeNodes[i].disconnect();
                } catch (e) {}
            }
            musicPlayer.activeNodes = [];
            musicPlayer.isPlaying = false;
        }

        function pauseTrack() {
            if (musicPlayer.audioCtx) musicPlayer.elapsed = musicPlayer.audioCtx.currentTime - musicPlayer.playStartTime;
            stopTrack();
            playBtn.querySelector('.play-icon').style.display = '';
            playBtn.querySelector('.pause-icon').style.display = 'none';
            if (disc) disc.classList.remove('playing');
            stopVisualizer();
        }

        function scheduleNotes(track) {
            if (!musicPlayer.audioCtx || !musicPlayer.isPlaying) return;
            var ctx = musicPlayer.audioCtx;
            var now = ctx.currentTime;
            var noteIdx = 0;
            var noteInterval = track.type === 'drone' ? 4 : (track.type === 'crystal' ? 1.5 : 1.2);

            function playNextNote() {
                if (!musicPlayer.isPlaying) return;
                var midi = track.notes[noteIdx % track.notes.length];
                var freq = midiToFreq(midi);
                var time = ctx.currentTime;

                if (track.type === 'piano') {
                    playPianoNote(freq, time, 2.5);
                } else if (track.type === 'electronic') {
                    playElectronicNote(freq, time, 1.8);
                } else if (track.type === 'crystal') {
                    playCrystalNote(freq, time, 3);
                } else if (track.type === 'dual') {
                    playPianoNote(freq, time, 2);
                    playMetallicNote(freq * 0.5, time, 2.5);
                } else if (track.type === 'drone') {
                    playDroneNote(freq, time, 5);
                }

                noteIdx++;
                var elapsed = ctx.currentTime - musicPlayer.playStartTime;
                if (elapsed >= track.duration) {
                    nextTrack();
                    return;
                }
                musicPlayer.activeNodes.push({ stop: function() {}, disconnect: function() {}, _timer: setTimeout(playNextNote, noteInterval * 1000) });
            }

            playNextNote();
        }

        function playPianoNote(freq, time, duration) {
            var ctx = musicPlayer.audioCtx;
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.3, time + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            osc.connect(gain);
            gain.connect(musicPlayer.masterGain);
            osc.start(time);
            osc.stop(time + duration);
            musicPlayer.activeNodes.push(osc, gain);
        }

        function playElectronicNote(freq, time, duration) {
            var ctx = musicPlayer.audioCtx;
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            var filter = ctx.createBiquadFilter();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, time);
            filter.frequency.linearRampToValueAtTime(200, time + duration);
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.15, time + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(musicPlayer.masterGain);
            osc.start(time);
            osc.stop(time + duration);
            musicPlayer.activeNodes.push(osc, gain, filter);
        }

        function playCrystalNote(freq, time, duration) {
            var ctx = musicPlayer.audioCtx;
            var osc1 = ctx.createOscillator();
            var osc2 = ctx.createOscillator();
            var gain = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.value = freq;
            osc2.type = 'sine';
            osc2.frequency.value = freq * 2.01;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.12, time + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(musicPlayer.masterGain);
            osc1.start(time);
            osc2.start(time);
            osc1.stop(time + duration);
            osc2.stop(time + duration);
            musicPlayer.activeNodes.push(osc1, osc2, gain);
        }

        function playMetallicNote(freq, time, duration) {
            var ctx = musicPlayer.audioCtx;
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            var filter = ctx.createBiquadFilter();
            osc.type = 'square';
            osc.frequency.value = freq;
            filter.type = 'bandpass';
            filter.frequency.value = freq * 3;
            filter.Q.value = 5;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.08, time + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(musicPlayer.masterGain);
            osc.start(time);
            osc.stop(time + duration);
            musicPlayer.activeNodes.push(osc, gain, filter);
        }

        function playDroneNote(freq, time, duration) {
            var ctx = musicPlayer.audioCtx;
            var osc = ctx.createOscillator();
            var noise = ctx.createBufferSource();
            var noiseGain = ctx.createGain();
            var gain = ctx.createGain();
            var filter = ctx.createBiquadFilter();
            osc.type = 'sine';
            osc.frequency.value = freq;
            filter.type = 'lowpass';
            filter.frequency.value = 300;

            var bufferSize = ctx.sampleRate * 2;
            var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            var data = buffer.getChannelData(0);
            for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
            noise.buffer = buffer;
            noise.loop = true;

            noiseGain.gain.value = 0.04;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.1, time + 0.5);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

            osc.connect(gain);
            noise.connect(noiseGain);
            noiseGain.connect(gain);
            gain.connect(musicPlayer.masterGain);

            osc.start(time);
            noise.start(time);
            osc.stop(time + duration);
            musicPlayer.activeNodes.push(osc, noise, gain, noiseGain, filter);
        }

        function startVisualizer() {
            if (!musicPlayer.vizCanvas || !musicPlayer.analyser) return;
            musicPlayer.vizCtx = musicPlayer.vizCanvas.getContext('2d');
            var canvas = musicPlayer.vizCanvas;
            var dpr = window.devicePixelRatio || 1;
            canvas.width = canvas.offsetWidth * dpr;
            canvas.height = canvas.offsetHeight * dpr;
            musicPlayer.vizCtx.scale(dpr, dpr);

            var bufferLength = musicPlayer.analyser.frequencyBinCount;
            var dataArray = new Uint8Array(bufferLength);

            function draw() {
                musicPlayer.vizRAF = rAF(draw);
                musicPlayer.analyser.getByteFrequencyData(dataArray);

                var w = canvas.offsetWidth;
                var h = canvas.offsetHeight;
                musicPlayer.vizCtx.clearRect(0, 0, w, h);

                var barCount = 32;
                var barWidth = w / barCount;
                for (var i = 0; i < barCount; i++) {
                    var value = dataArray[Math.floor(i * bufferLength / barCount)] || 0;
                    var barHeight = (value / 255) * h * 0.8 + 2;
                    var x = i * barWidth;
                    var grad = musicPlayer.vizCtx.createLinearGradient(0, h, 0, h - barHeight);
                    grad.addColorStop(0, 'rgba(255, 107, 157, 0.8)');
                    grad.addColorStop(0.5, 'rgba(182, 107, 255, 0.6)');
                    grad.addColorStop(1, 'rgba(107, 138, 255, 0.4)');
                    musicPlayer.vizCtx.fillStyle = grad;
                    musicPlayer.vizCtx.fillRect(x + 1, h - barHeight, barWidth - 2, barHeight);
                }
            }
            draw();
        }

        function stopVisualizer() {
            if (musicPlayer.vizRAF) {
                cancelAnimationFrame(musicPlayer.vizRAF);
                musicPlayer.vizRAF = null;
            }
            if (musicPlayer.vizCtx && musicPlayer.vizCanvas) {
                musicPlayer.vizCtx.clearRect(0, 0, musicPlayer.vizCanvas.offsetWidth, musicPlayer.vizCanvas.offsetHeight);
            }
        }

        function updateProgress() {
            if (!musicPlayer.isPlaying) return;
            var track = musicPlayer.tracks[musicPlayer.currentTrack];
            var elapsed = musicPlayer.audioCtx.currentTime - musicPlayer.playStartTime;
            if (elapsed >= track.duration) { nextTrack(); return; }
            var progressFill = document.getElementById('progress-fill');
            var currentTime = document.getElementById('current-time');
            if (progressFill) progressFill.style.width = (elapsed / track.duration * 100) + '%';
            if (currentTime) currentTime.textContent = formatTime(elapsed);
            setTimeout(updateProgress, 500);
        }

        function nextTrack() {
            pauseTrack();
            musicPlayer.elapsed = 0;
            musicPlayer.currentTrack = (musicPlayer.currentTrack + 1) % musicPlayer.tracks.length;
            updateTrackInfo();
            playTrack();
        }

        function prevTrack() {
            pauseTrack();
            musicPlayer.elapsed = 0;
            musicPlayer.currentTrack = (musicPlayer.currentTrack - 1 + musicPlayer.tracks.length) % musicPlayer.tracks.length;
            updateTrackInfo();
            playTrack();
        }

        playBtn.addEventListener('click', function() {
            if (musicPlayer.isPlaying) pauseTrack();
            else playTrack();
        });
        if (nextBtn) nextBtn.addEventListener('click', nextTrack);
        if (prevBtn) prevBtn.addEventListener('click', prevTrack);

        for (var i = 0; i < trackItems.length; i++) {
            (function(item) {
                item.addEventListener('click', function() {
                    pauseTrack();
                    musicPlayer.elapsed = 0;
                    musicPlayer.currentTrack = parseInt(item.getAttribute('data-track'), 10) || 0;
                    updateTrackInfo();
                    playTrack();
                });
            })(trackItems[i]);
        }

        var progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.addEventListener('click', function(e) {
                if (!musicPlayer.audioCtx || !musicPlayer.isPlaying) return;
                var rect = progressBar.getBoundingClientRect();
                var ratio = (e.clientX - rect.left) / rect.width;
                var track = musicPlayer.tracks[musicPlayer.currentTrack];
                musicPlayer.elapsed = ratio * track.duration;
                musicPlayer.playStartTime = musicPlayer.audioCtx.currentTime - musicPlayer.elapsed;
            });
        }

        updateTrackInfo();
    }

    /* === 鸣潮共振按钮特效系统 === */
    function initResonanceButtons() {
        var buttons = document.querySelectorAll('.btn-primary, .btn-ghost, .btn-music, .egg-btn, .music-btn-play');
        var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        for (var i = 0; i < buttons.length; i++) {
            (function(btn) {
                /* Ripple effect on click */
                btn.addEventListener('click', function(e) {
                    if (reducedMotion) return;
                    var rect = btn.getBoundingClientRect();
                    var ripple = document.createElement('span');
                    ripple.className = 'resonance-ripple';
                    var size = Math.max(rect.width, rect.height);
                    ripple.style.width = ripple.style.height = size + 'px';
                    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
                    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
                    btn.appendChild(ripple);
                    setTimeout(function() { if (ripple.parentNode) ripple.parentNode.removeChild(ripple); }, 600);
                });

                /* Particle emission on hover */
                var particleInterval = null;
                var particleColors;
                if (btn.classList.contains('btn-primary')) {
                    particleColors = ['#FF6B9D', '#FFD700', '#FFB6D9', '#FFF5F8'];
                } else if (btn.classList.contains('btn-ghost')) {
                    particleColors = ['#6B8AFF', '#A8D8FF', '#B66BFF', '#FFFFFF'];
                } else if (btn.classList.contains('btn-music')) {
                    particleColors = ['#FF6B9D', '#6B8AFF', '#B66BFF', '#A8D8FF'];
                } else if (btn.classList.contains('egg-btn')) {
                    particleColors = ['#00E5FF', '#6B8AFF', '#B66BFF', '#FFFFFF'];
                } else {
                    particleColors = ['#FF6B9D', '#B66BFF', '#6B8AFF'];
                }

                btn.addEventListener('mouseenter', function() {
                    if (reducedMotion) return;
                    particleInterval = setInterval(function() {
                        createButtonParticle(btn, particleColors);
                    }, 120);
                });

                btn.addEventListener('mouseleave', function() {
                    if (particleInterval) {
                        clearInterval(particleInterval);
                        particleInterval = null;
                    }
                });
            })(buttons[i]);
        }
    }

    function createButtonParticle(btn, colors) {
        var rect = btn.getBoundingClientRect();
        var particle = document.createElement('span');
        particle.className = 'resonance-particle';
        particle.style.left = Math.random() * rect.width + 'px';
        particle.style.top = Math.random() * rect.height + 'px';
        var color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.background = color;
        particle.style.color = color;
        var size = Math.random() * 3 + 2;
        particle.style.width = particle.style.height = size + 'px';
        var angle = Math.random() * Math.PI * 2;
        var distance = Math.random() * 30 + 20;
        particle.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
        particle.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
        btn.appendChild(particle);
        setTimeout(function() { if (particle.parentNode) particle.parentNode.removeChild(particle); }, 800);
    }

    /* ===== Phase 2+: New Easter Eggs & Interactions ===== */

    /* ① Avatar long-press hidden dialogue */
    function initAvatarEasterEgg() {
        var avatarWrap = document.querySelector('.profile-avatar-wrap');
        if (!avatarWrap) return;
        var pressTimer = null;
        var dialogueBubble = null;

        var hiddenDialogues = [
            '你找到我啦～其实我一直在这里等你呢。',
            '嗯？在盯着我看吗？……好吧，给你看一个只有这里才有的笑容。',
            '悄悄告诉你：天文台的咖啡机是我故意弄坏的，这样值夜班的时候就能多看一会儿星星了。',
            '调频9072——记住这个号码。深夜无聊的时候可以试试。',
            '有时候我觉得，像素世界里的我比现实里的我更自在。大概是因为这里没有形态切换吧。'
        ];
        var dialogueIndex = 0;

        function showDialogue() {
            if (dialogueBubble && dialogueBubble.parentNode) dialogueBubble.remove();
            dialogueBubble = document.createElement('div');
            dialogueBubble.className = 'avatar-dialogue-bubble';
            dialogueBubble.innerHTML = '<span class="dialogue-text">' + escapeHTML(hiddenDialogues[dialogueIndex % hiddenDialogues.length]) + '</span><span class="dialogue-close">&times;</span>';
            /* position:fixed escapes overflow:hidden on .profile-card */
            var rect = avatarWrap.getBoundingClientRect();
            dialogueBubble.style.cssText = 'position:fixed;top:' + (rect.bottom + 12) + 'px;left:' + (rect.left + rect.width / 2) + 'px;transform:translateX(-50%);padding:10px 16px;background:rgba(15,15,24,0.95);border:1px solid rgba(168,216,255,0.25);border-radius:12px;color:#FAF8FF;font-size:0.85rem;z-index:9999;max-width:280px;white-space:normal;word-break:break-word;line-height:1.5;box-shadow:0 8px 25px rgba(0,0,0,0.35);animation:fadeInUp 0.3s ease;';
            document.body.appendChild(dialogueBubble);
            dialogueIndex++;

            dialogueBubble.querySelector('.dialogue-close').addEventListener('click', function(e) {
                e.stopPropagation();
                dialogueBubble.remove();
                dialogueBubble = null;
            });
            /* Click outside to close */
            var outsideHandler = function(e) {
                if (dialogueBubble && !dialogueBubble.contains(e.target) && e.target !== avatarWrap) {
                    dialogueBubble.remove();
                    dialogueBubble = null;
                    document.removeEventListener('click', outsideHandler, true);
                }
            };
            setTimeout(function() { document.addEventListener('click', outsideHandler, true); }, 100);
        }

        avatarWrap.addEventListener('mousedown', function() { pressTimer = setTimeout(showDialogue, 800); });
        avatarWrap.addEventListener('mouseup', function() { clearTimeout(pressTimer); });
        avatarWrap.addEventListener('mouseleave', function() { clearTimeout(pressTimer); });
        avatarWrap.addEventListener('touchstart', function() { pressTimer = setTimeout(showDialogue, 800); }, { passive: true });
        avatarWrap.addEventListener('touchend', function() { clearTimeout(pressTimer); });
    }

    /* ② Double-tap diary title — signal flash */
    function initDiarySignalFlash() {
        var diaryTitles = document.querySelectorAll('.diary-title');
        diaryTitles.forEach(function(title) {
            var lastTap = 0;
            title.style.cursor = 'pointer';
            title.addEventListener('click', function() {
                var now = Date.now();
                if (now - lastTap < 400) {
                    triggerSignalFlash(title);
                    lastTap = 0;
                } else {
                    lastTap = now;
                }
            });
        });
    }

    function triggerSignalFlash(element) {
        var card = element.closest('.diary-entry');
        if (!card) return;
        /* Flash effect */
        card.style.transition = 'box-shadow 0.15s ease';
        card.style.boxShadow = '0 0 40px rgba(168,216,255,0.6), 0 0 60px rgba(107,138,255,0.4), 0 0 80px rgba(182,107,255,0.3)';
        setTimeout(function() {
            card.style.boxShadow = '0 0 25px rgba(168,216,255,0.3), 0 0 40px rgba(107,138,255,0.2)';
        }, 300);
        setTimeout(function() {
            card.style.boxShadow = '';
            card.style.transition = '';
        }, 600);
        /* Signal text popup */
        var signal = document.createElement('div');
        signal.className = 'signal-flash-text';
        signal.textContent = '⚡ 信号已同步';
        signal.style.cssText = 'position:absolute;top:8px;right:12px;padding:4px 12px;background:rgba(107,138,255,0.2);border:1px solid rgba(168,216,255,0.4);border-radius:8px;color:#A8D8FF;font-size:0.75rem;animation:fadeInUp 0.3s ease;z-index:10;';
        card.style.position = 'relative';
        card.appendChild(signal);
        setTimeout(function() { signal.remove(); }, 2000);
    }

    /* ③ Comment keyword easter egg trigger */
    function initCommentKeywordEgg() {
        var keywords = {
            '星星': '✨ 你提到了星星！飞行雪绒悄悄给你点了个赞～',
            '拉海洛': '🏔️ 拉海洛……那片雪原上的回忆，永远都不会褪色',
            '漂泊者': '🛸 你知道漂泊者吗？……嗯，有些话，只能在信号里说',
            '调频9072': '📡 你怎么知道这个频率的？！……好吧，看来你也是深夜不睡觉的人',
            '雪': '❄️ 雪啊……无论模拟舱里的还是拉海洛的，都让人想起最温暖的那些时光',
            '咖啡': '☕ 天文台的咖啡机又坏了！谁来修修啊——第三次了！',
            '信号': '📶 信号收到了！……你也在调频吗？',
            '六角形': '❄️ 六角形的雪花结构！你果然也在关注那些只有适格者才能看到的细节'
        };

        document.addEventListener('submit', function(e) {
            if (!e.target.classList.contains('comment-form')) return;
            var textInput = e.target.querySelectorAll('.comment-form-input')[1];
            if (!textInput) return;
            var text = textInput.value.trim().toLowerCase();
            for (var kw in keywords) {
                if (text.indexOf(kw.toLowerCase()) !== -1) {
                    showToast(keywords[kw]);
                    break;
                }
            }
        });
    }

    function showToast(msg) {
        var toast = document.createElement('div');
        toast.className = 'egg-toast';
        toast.textContent = msg;
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:12px 24px;background:rgba(15,15,24,0.92);border:1px solid rgba(168,216,255,0.25);border-radius:16px;color:#FAF8FF;font-size:0.85rem;z-index:9999;box-shadow:0 8px 30px rgba(0,0,0,0.4);animation:fadeInUp 0.3s ease;';
        document.body.appendChild(toast);
        setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 2500);
        setTimeout(function() { toast.remove(); }, 3000);
    }

    /* ===== Profile 昵称预填 ===== */
    function applyProfileToForms(nickname) {
        if (!nickname || nickname === '匿名信号源') return;
        document.querySelectorAll('.comment-form-name').forEach(function(input) {
            if (!input.value.trim()) input.value = nickname;
        });
        var submitNick = document.getElementById('submit-nickname');
        if (submitNick && !submitNick.value.trim()) submitNick.value = nickname;
    }

    function loadUserProfile() {
        if (typeof AuthManager === 'undefined' || !AuthManager.fetchProfile) {
            var cached = (typeof AuthManager !== 'undefined' && AuthManager.getCachedProfile)
                ? AuthManager.getCachedProfile() : {};
            if (cached.nickname) applyProfileToForms(cached.nickname);
            return Promise.resolve();
        }
        return AuthManager.fetchProfile().then(function(profile) {
            if (profile && profile.nickname) applyProfileToForms(profile.nickname);
        }).catch(function() { /* ignore */ });
    }

    function persistNicknameIfNeeded(rawName) {
        if (!rawName || typeof AuthManager === 'undefined' || !AuthManager.saveNickname) return;
        var current = AuthManager.session.nickname || (AuthManager.getCachedProfile() || {}).nickname;
        if (current === rawName) return;
        AuthManager.saveNickname(rawName);
    }

    /* ===== 分享 ===== */
    function getSiteBaseUrl() {
        var base = window.location.href.split('#')[0];
        return base.endsWith('/') ? base.slice(0, -1) : base;
    }

    function copyShareLink(url, text) {
        var payload = text ? (text + '\n' + url) : url;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(payload).then(function() {
                showSubmitToast('链接已复制，可粘贴分享 ✓', 2500);
            }).catch(function() {
                showSubmitToast('复制失败，请手动复制地址栏链接', 3000);
            });
        }
        try {
            var ta = document.createElement('textarea');
            ta.value = payload;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showSubmitToast('链接已复制 ✓', 2500);
        } catch (e) {
            showSubmitToast('请手动复制：' + url, 4000);
        }
        return Promise.resolve();
    }

    function sharePostCard(card) {
        if (!card) return;
        var postId = card.getAttribute('data-post-id');
        var authorEl = card.querySelector('.post-author');
        var author = authorEl ? authorEl.textContent.trim() : '飞行雪绒';
        var hash = postId ? ('#post-' + postId) : '#timeline';
        var url = getSiteBaseUrl() + hash;
        var text = '「' + author + '」在飞行雪绒的动态 — 星炬学院的日常';
        if (navigator.share) {
            navigator.share({ title: '飞行雪绒 ✨', text: text, url: url }).catch(function() {
                copyShareLink(url, text);
            });
        } else {
            copyShareLink(url, text);
        }
    }

    function initShareButtons() {
        document.querySelectorAll('.post-card[data-post-id]').forEach(function(card) {
            var actions = card.querySelectorAll('.post-action');
            if (actions.length < 3) return;
            var shareBtn = actions[2];
            var span = shareBtn.querySelector('span');
            if (!span || span.textContent.trim() !== '分享') return;
            shareBtn.classList.add('post-share-btn');
            shareBtn.setAttribute('title', '复制分享链接');
            shareBtn.style.cursor = 'pointer';
            if (shareBtn.dataset.shareBound) return;
            shareBtn.dataset.shareBound = '1';
            shareBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                sharePostCard(card);
            });
        });
    }

    /* ===== Phase 3: Comment System ===== */
    function initComments() {
        var posts = document.querySelectorAll('.post-card[data-post-id]');
        var diaries = document.querySelectorAll('.diary-entry');

        posts.forEach(function(post) {
            var postId = post.getAttribute('data-post-id');
            var actions = post.querySelector('.post-actions');
            if (!actions) return;

            var commentArea = document.createElement('div');
            commentArea.className = 'comment-area';
            commentArea.id = 'comments-' + postId;
            commentArea.innerHTML = buildCommentAreaHTML(postId);
            post.appendChild(commentArea);

            var commentBtn = actions.querySelectorAll('.post-action')[1];
            if (commentBtn) {
                commentBtn.style.cursor = 'pointer';
                commentBtn.addEventListener('click', function() {
                    commentArea.classList.toggle('open');
                });
            }

            renderComments(postId);
            var form = commentArea.querySelector('.comment-form');
            if (form) {
                form.addEventListener('submit', function(e) {
                    e.preventDefault();
                    handleCommentSubmit(postId, form);
                });
            }
        });

        diaries.forEach(function(diary, idx) {
            var diaryId = 'diary-' + (idx + 1);
            diary.setAttribute('data-diary-id', diaryId);
            var content = diary.querySelector('.diary-content');
            if (!content) return;

            var commentArea = document.createElement('div');
            commentArea.className = 'comment-area';
            commentArea.id = 'comments-' + diaryId;
            commentArea.style.padding = '0';
            commentArea.style.marginTop = '16px';
            commentArea.style.borderTop = '1px solid var(--glass-border)';
            commentArea.style.paddingTop = '16px';
            commentArea.innerHTML = buildCommentAreaHTML(diaryId);
            content.appendChild(commentArea);

            var toggleBtn = document.createElement('button');
            toggleBtn.className = 'community-card-action';
            toggleBtn.style.cssText = 'margin-top:12px;align-self:flex-start;';
            toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>评论</span>';
            content.appendChild(toggleBtn);

            toggleBtn.addEventListener('click', function() {
                commentArea.classList.toggle('open');
            });

            renderComments(diaryId);
            var form = commentArea.querySelector('.comment-form');
            if (form) {
                form.addEventListener('submit', function(e) {
                    e.preventDefault();
                    handleCommentSubmit(diaryId, form);
                });
            }
        });

        initCommentReplyDelegation();
        initCommentDeleteDelegation();
    }

    function resolveCommentTargetFromBtn(btn) {
        var communityTarget = btn.getAttribute('data-community-target');
        if (communityTarget) {
            return 'community_' + communityTarget.replace('cc-list-', '');
        }
        var area = btn.closest('.comment-area');
        if (area) return area.id.replace('comments-', '');
        var list = btn.closest('.comment-list');
        if (list && list.id && list.id.indexOf('cc-list-') === 0) {
            return 'community_' + list.id.replace('cc-list-', '');
        }
        return null;
    }

    function initCommentDeleteDelegation() {
        if (__fxreCommentDeleteDelegationInit) return;
        __fxreCommentDeleteDelegationInit = true;

        document.addEventListener('click', function(e) {
            var deleteBtn = e.target.closest('.comment-delete-btn');
            if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();
                var targetId = resolveCommentTargetFromBtn(deleteBtn);
                if (!targetId) return;
                var commentData = {
                    id:       deleteBtn.getAttribute('data-comment-id'),
                    authorId: deleteBtn.getAttribute('data-comment-author'),
                    name:     deleteBtn.getAttribute('data-comment-name'),
                    text:     deleteBtn.getAttribute('data-comment-text'),
                    time:     deleteBtn.getAttribute('data-comment-time')
                };
                handleDeleteComment(targetId, commentData, deleteBtn);
                return;
            }

            var hideBtn = e.target.closest('.comment-hide-btn');
            if (hideBtn) {
                e.preventDefault();
                e.stopPropagation();
                var targetId = resolveCommentTargetFromBtn(hideBtn);
                if (!targetId) return;
                var commentId = hideBtn.getAttribute('data-comment-id');
                if (!commentId) return;
                if (!confirm('确定要隐藏此评论吗？（版主操作）')) return;
                if (typeof SupabaseAdapter !== 'undefined' && SupabaseAdapter.moderateComment) {
                    SupabaseAdapter.moderateComment(parseInt(commentId, 10), 'hide', '版主隐藏').then(function(success) {
                        if (success) {
                            _removeCommentFromUI(targetId, hideBtn);
                            showSubmitToast('评论已隐藏', 2000);
                        } else {
                            showSubmitToast('隐藏失败', 4000);
                        }
                    });
                }
            }
        });
    }

    /**
     * v10.1: 轮询全量对账——云端权威剔除 + upsert。
     * 本地带云端 id 但本次云端结果缺失（远端已删除/隐藏）→ 剔除；
     * 无 id 乐观项保留。随后逐条 upsert 云端条目（复用 applyRealtimeCommentEvent）。
     * 调用前提：comments 是云端真实返回（出错时为 null，SyncManager 已跳过本轮）。
     */
    function reconcileCommentsBulk(targetId, cloudComments) {
        cloudComments = Array.isArray(cloudComments) ? cloudComments : [];
        var local = [];
        try { local = JSON.parse(safeGetItem('fxre_comments_' + targetId) || '[]'); } catch (e) {}
        var cloudIds = {};
        cloudComments.forEach(function(cc) { if (cc && cc.id != null) cloudIds[String(cc.id)] = 1; });
        var kept = local.filter(function(c) { return !c.id || cloudIds[String(c.id)]; });
        saveComments(targetId, kept);
        cloudComments.forEach(function(cc) {
            applyRealtimeCommentEvent(targetId, 'UPDATE', { new: cc });
        });
    }

    function makeCommunityCommentHandlers(subId) {
        var targetId = 'community_' + subId;
        return {
            onNewComment: function(comment) {
                applyRealtimeCommentEvent(targetId, 'INSERT', { new: comment });
            },
            onUpdateComment: function(newData, oldData) {
                applyRealtimeCommentEvent(targetId, 'UPDATE', { new: newData, old: oldData });
            },
            onDeleteComment: function(oldData) {
                applyRealtimeCommentEvent(targetId, 'DELETE', { old: oldData });
            },
            /* R4/v10.1: 轮询降级时全量对账（含远端删除剔除） */
            onBulkComments: function(comments) {
                reconcileCommentsBulk(targetId, comments);
            }
        };
    }

    function subscribeCommunityCommentRealtime(submissions) {
        if (typeof SyncManager === 'undefined') return;
        (submissions || []).forEach(function(s) {
            if (!s || !/^\d+$/.test(String(s.id))) return;
            SyncManager.connectComments('community_' + s.id, makeCommunityCommentHandlers(s.id));
        });
    }

    /** 云端就绪后订阅 Realtime，并全量拉取云端评论 */
    function setupCloudRealtime() {
        if (typeof SupabaseAdapter === 'undefined' || !SupabaseAdapter.isAuthenticated()) return;

        refreshAllCommentsFromCloud();

        /* R7: 云端就绪时冲刷离线队列，避免离线投稿/评论需刷新页面才同步 */
        if (typeof SupabaseAdapter !== 'undefined' && SupabaseAdapter.syncPendingQueue) {
            SupabaseAdapter.syncPendingQueue().catch(function(e) { console.warn('[v9.6] 离线队列冲刷失败:', e); });
        }

        /* v9.0: 使用 SyncManager 替代直接 subscribeComments */
        if (typeof SyncManager !== 'undefined') {
            document.querySelectorAll('.comment-area').forEach(function(area) {
                var targetId = area.id.replace('comments-', '');
                SyncManager.connectComments(targetId, {
                    onNewComment: function(comment) {
                        applyRealtimeCommentEvent(targetId, 'INSERT', { new: comment });
                    },
                    onUpdateComment: function(newData, oldData) {
                        applyRealtimeCommentEvent(targetId, 'UPDATE', { new: newData, old: oldData });
                    },
                    onDeleteComment: function(oldData) {
                        applyRealtimeCommentEvent(targetId, 'DELETE', { old: oldData });
                    },
                    /* R4/v10.1: 轮询降级时全量对账（含远端删除剔除） */
                    onBulkComments: function(comments) {
                        reconcileCommentsBulk(targetId, comments);
                    }
                });
            });

            /* 投稿变更同步 —— 必须传对象 { onNewSubmission, onUpdateSubmission }，
               详见 js/sync-manager.js:205 connectSubmissions(handlers) 的契约 */
            SyncManager.connectSubmissions({
                onNewSubmission: function(submission) {
                    renderCommunity();
                },
                onUpdateSubmission: function(newData, oldData) {
                    renderCommunity();
                },
                /* v10.1: 投稿硬删除事件（migration-017 后 DELETE 事件可正常广播） */
                onDeleteSubmission: function(oldData) {
                    renderCommunity();
                },
                /* v10.1: 轮询降级时的投稿刷新（此前投稿无轮询兜底，断连即停更） */
                onPollSubmissions: function(subs) {
                    renderCommunity();
                }
            });

            var subsResult = getSubmissions();
            if (subsResult && typeof subsResult.then === 'function') {
                subsResult.then(function(subs) {
                    subscribeCommunityCommentRealtime(subs);
                });
            } else {
                subscribeCommunityCommentRealtime(subsResult || getSubmissionsSync());
            }
        } else {
            /* 降级：使用旧的订阅方式 */
            document.querySelectorAll('.comment-area').forEach(function(area) {
                var targetId = area.id.replace('comments-', '');
                SupabaseAdapter.subscribeComments(
                    targetId,
                    function() { renderComments(targetId); },
                    function() { renderComments(targetId); }
                );
            });

            SupabaseAdapter.subscribeSubmissions(function() {
                renderCommunity();
            });
        }

        /* R6: 移除独立的 __fxreCommentPoll 双轮询——降级轮询已由 SyncManager.startPolling 统一兜底（带状态感知），避免重复流量 */

        console.log('[v9.0] Realtime 同步已启用' + (typeof SyncManager !== 'undefined' ? ' (SyncManager)' : ' (legacy)'));
    }

    /** 从云端拉取全部评论区并写回 localStorage + 刷新 UI */
    function refreshAllCommentsFromCloud() {
        if (typeof DataRepository === 'undefined') return Promise.resolve();

        var areas = document.querySelectorAll('.comment-area');
        var tasks = [];
        areas.forEach(function(area) {
            var targetId = area.id.replace('comments-', '');
            tasks.push(
                DataRepository.pullCommentsAndPersist(targetId).then(function(comments) {
                    var list = document.getElementById('comment-list-' + targetId);
                    if (list) _renderCommentsList(list, comments || []);
                })
            );
        });

        return Promise.all(tasks).then(function() {
            renderCommunity();
        });
    }

    /* ===== 评论回复状态 ===== */
    var commentReplyState = {};
    var __fxrePendingAttachment = null;
    var __fxreReplyDelegationInit = false;
    var __fxreCommentDeleteDelegationInit = false;
    var __fxreCommunityInited = false;

    function getCommentFormTargetId(form) {
        if (!form) return null;
        var dataTarget = form.getAttribute('data-target');
        if (dataTarget) return 'community_' + dataTarget;
        var area = form.closest('.comment-area');
        if (area && area.id) return area.id.replace('comments-', '');
        return null;
    }

    function setCommentReplyMode(targetId, parentId, replyToName, form) {
        commentReplyState[targetId] = { parentId: parentId, replyToName: replyToName };
        var bar = form ? form.parentElement.querySelector('.comment-reply-bar') : null;
        if (!bar && form) {
            bar = document.getElementById('reply-bar-' + targetId);
        }
        if (bar) {
            bar.hidden = false;
            var label = bar.querySelector('.comment-reply-label');
            if (label) label.textContent = '回复 @' + replyToName;
        }
        var textInput = form ? form.querySelectorAll('.comment-form-input')[1] : null;
        if (textInput) {
            textInput.placeholder = '回复 @' + replyToName + '……';
            textInput.focus();
        }
    }

    function clearCommentReplyMode(targetId, form) {
        delete commentReplyState[targetId];
        var bar = form ? form.parentElement.querySelector('.comment-reply-bar') : null;
        if (!bar) bar = document.getElementById('reply-bar-' + targetId);
        if (bar) bar.hidden = true;
        if (form) {
            var textInput = form.querySelectorAll('.comment-form-input')[1];
            if (textInput) textInput.placeholder = '写下你的评论……';
        }
    }

    function buildCommentItemHtml(c, opts, isReply) {
        opts = opts || {};
        var initial = c.name.charAt(0).toUpperCase();
        var bgColor = c.color || 'var(--color-pink)';
        var canDeleteAny = (typeof AdminAuth !== 'undefined') && AdminAuth.isAdmin();
        var canModerate = (typeof AuthManager !== 'undefined') && AuthManager.canHideComment();
        var showDelete = canDeleteAny || canModerate;
        if (!showDelete && typeof AuthManager !== 'undefined') {
            showDelete = AuthManager.canDeleteComment(c);
        }
        if (!showDelete && (typeof AdminAuth !== 'undefined' && AdminAuth.canDelete(c))) {
            showDelete = true;
        }
        var communityAttr = opts.communityListId
            ? ' data-community-target="' + opts.communityListId + '"'
            : '';
        var deleteBtn = showDelete
            ? '<button class="comment-delete-btn" title="删除此评论" data-comment-id="' + (c.id || '') + '" data-comment-name="' + escapeHTML(c.name) + '" data-comment-text="' + escapeHTML(c.text) + '" data-comment-time="' + (c.time || 0) + '" data-comment-author="' + (c.authorId || '') + '"' + communityAttr + '>×</button>'
            : '';
        var hideBtn = (canModerate && !showDelete)
            ? '<button class="comment-hide-btn" title="隐藏此评论（版主操作）" data-comment-id="' + (c.id || '') + '"' + communityAttr + '>' +
              '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>' +
              '<line x1="1" y1="1" x2="23" y2="23"/></svg></button>'
            : '';
        var modActions = (deleteBtn || hideBtn)
            ? '<div class="comment-mod-actions">' + hideBtn + deleteBtn + '</div>'
            : '';
        var replyBtn = (c.id && !isReply)
            ? '<button type="button" class="comment-reply-btn" data-comment-id="' + c.id + '" data-comment-name="' + escapeHTML(c.name) + '" data-target-id="' + escapeHTML(opts.targetId || '') + '">回复</button>'
            : '';
        var reportBtn = c.id
            ? '<button type="button" class="comment-report-btn" data-report-type="comment" data-report-id="' + c.id + '">举报</button>'
            : '';
        var footerActions = (replyBtn || reportBtn)
            ? '<div class="comment-footer-actions">' + replyBtn + reportBtn + '</div>'
            : '';
        var replyPrefix = isReply ? '<span class="comment-reply-tag">回复</span> ' : '';
        return '<div class="comment-item' + (isReply ? ' comment-item-reply' : '') + '" data-comment-id="' + (c.id || '') + '">' +
            '<div class="comment-avatar" style="background:' + bgColor + '">' + escapeHTML(initial) + '</div>' +
            '<div class="comment-body">' +
            '<div class="comment-meta">' +
            replyPrefix +
            '<span class="comment-author">' + escapeHTML(c.name) + '</span>' +
            '<span class="comment-time">' + c.timeStr + '</span>' +
            '</div>' +
            '<div class="comment-text">' + escapeHTML(c.text) + '</div>' +
            footerActions +
            '</div>' +
            modActions +
            '</div>';
    }

    function renderCommentsThread(comments, opts) {
        opts = opts || {};
        var byId = {};
        comments.forEach(function(c) {
            if (c.id) byId[c.id] = c;
        });
        var roots = [];
        var replyMap = {};
        comments.forEach(function(c) {
            var pid = c.parentId;
            if (pid && byId[pid]) {
                if (!replyMap[pid]) replyMap[pid] = [];
                replyMap[pid].push(c);
            } else {
                roots.push(c);
            }
        });
        var html = '';
        roots.forEach(function(c) {
            html += buildCommentItemHtml(c, opts, false);
            (replyMap[c.id] || []).forEach(function(r) {
                html += buildCommentItemHtml(r, opts, true);
            });
        });
        return html;
    }

    /* ===== R19: 评论列表增量 DOM 协调（按 data-comment-id keyed reconcile，替代整列表 innerHTML 重绘） ===== */
    function buildCommentNode(c, opts, isReply) {
        var html = buildCommentItemHtml(c, opts, isReply);
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        var el = tmp.firstElementChild;
        if (el) el.__cmtHtml = html;
        return el;
    }

    function reconcileCommentThread(list, comments, opts) {
        opts = opts || {};
        var targetId = opts.targetId || '';
        updatePostCommentCount(targetId.replace(/^community_/, ''), comments ? comments.length : 0);
        if (!comments || comments.length === 0) {
            list.querySelectorAll('.comment-item, .comment-load-more').forEach(function(n) { n.remove(); });
            if (!list.querySelector('.comment-empty')) {
                var empty = document.createElement('div');
                empty.className = 'comment-empty';
                empty.textContent = (list.id && list.id.indexOf('cc-list-') === 0)
                    ? '还没有评论 ~' : '还没有评论，来第一个留言吧 ~';
                list.appendChild(empty);
            }
            return;
        }
        var emptyEl = list.querySelector('.comment-empty');
        if (emptyEl) emptyEl.remove();

        var limit = commentDisplayLimits[targetId] || COMMENT_PAGE_SIZE;
        var sorted = comments.slice().sort(function(a, b) { return (b.time || 0) - (a.time || 0); });
        var visible = sorted.slice(0, limit);

        var byId = {};
        visible.forEach(function(c) { if (c.id != null) byId[c.id] = c; });
        var roots = [], replyMap = {};
        visible.forEach(function(c) {
            var pid = c.parentId;
            if (pid != null && byId[pid]) { (replyMap[pid] = replyMap[pid] || []).push(c); }
            else roots.push(c);
        });
        var desired = [];
        roots.forEach(function(c) {
            desired.push({ c: c, reply: false });
            (replyMap[c.id] || []).forEach(function(r) { desired.push({ c: r, reply: true }); });
        });

        list.querySelectorAll('.comment-item').forEach(function(node) {
            var id = node.getAttribute('data-comment-id');
            var found = false;
            for (var i = 0; i < desired.length; i++) {
                if (String(desired[i].c.id) === String(id)) { found = true; break; }
            }
            if (!found) node.remove();
        });

        var existing = {};
        list.querySelectorAll('.comment-item').forEach(function(node) {
            existing[node.getAttribute('data-comment-id')] = node;
        });

        var prev = null;
        desired.forEach(function(d) {
            var id = String(d.c.id);
            var fresh = buildCommentNode(d.c, opts, d.reply);
            if (!fresh) return;
            var node = existing[id];
            var inDom;
            if (node) {
                if (node.__cmtHtml !== fresh.__cmtHtml) {
                    node.replaceWith(fresh);
                    inDom = fresh;
                } else {
                    inDom = node;
                }
            } else {
                if (prev) {
                    prev.after(fresh);
                } else {
                    var firstItem = list.querySelector('.comment-item');
                    if (firstItem && firstItem !== fresh) list.insertBefore(fresh, firstItem);
                    else {
                        var more0 = list.querySelector('.comment-load-more');
                        if (more0) list.insertBefore(fresh, more0);
                        else list.appendChild(fresh);
                    }
                }
                inDom = fresh;
            }
            prev = inDom;
        });

        var hasMore = comments.length > limit;
        var moreBtn = list.querySelector('.comment-load-more');
        if (hasMore) {
            if (!moreBtn) {
                moreBtn = document.createElement('button');
                moreBtn.type = 'button';
                moreBtn.className = 'comment-load-more';
                moreBtn.setAttribute('data-target-id', targetId);
                moreBtn.addEventListener('click', function() {
                    commentDisplayLimits[targetId] = (commentDisplayLimits[targetId] || COMMENT_PAGE_SIZE) + COMMENT_PAGE_SIZE;
                    var cur = [];
                    try { cur = JSON.parse(safeGetItem('fxre_comments_' + targetId) || '[]'); } catch (e) {}
                    reconcileCommentThread(list, cur, opts);
                });
                list.appendChild(moreBtn);
            }
            moreBtn.textContent = '加载更多（还有 ' + (comments.length - limit) + ' 条）';
        } else if (moreBtn) {
            moreBtn.remove();
        }
    }

    function initCommentReplyDelegation() {
        if (__fxreReplyDelegationInit) return;
        __fxreReplyDelegationInit = true;

        document.addEventListener('click', function(e) {
            var replyBtn = e.target.closest('.comment-reply-btn');
            if (replyBtn) {
                e.preventDefault();
                var targetId = replyBtn.getAttribute('data-target-id');
                var parentId = parseInt(replyBtn.getAttribute('data-comment-id'), 10);
                var replyToName = replyBtn.getAttribute('data-comment-name') || '';
                var form = null;
                if (targetId.indexOf('community_') === 0) {
                    var subId = targetId.replace('community_', '');
                    var card = document.querySelector('.community-card[data-id="' + subId + '"]');
                    if (card) {
                        form = card.querySelector('.comment-form');
                        var commentsBox = card.querySelector('.community-card-comments');
                        if (commentsBox) commentsBox.classList.add('open');
                    }
                } else {
                    var area = document.getElementById('comments-' + targetId);
                    if (area) {
                        area.classList.add('open');
                        form = area.querySelector('.comment-form');
                    }
                }
                if (form && parentId) setCommentReplyMode(targetId, parentId, replyToName, form);
                return;
            }

            var cancelBtn = e.target.closest('.comment-reply-cancel');
            if (cancelBtn) {
                e.preventDefault();
                var bar = cancelBtn.closest('.comment-reply-bar');
                var form = bar && bar.nextElementSibling && bar.nextElementSibling.classList.contains('comment-form')
                    ? bar.nextElementSibling : cancelBtn.closest('.community-card-comments, .comment-area');
                if (form && form.querySelector) form = form.querySelector('.comment-form') || form;
                var targetId = getCommentFormTargetId(form);
                if (targetId) clearCommentReplyMode(targetId, form);
            }
        });
    }

    /* ===== 收藏云端同步 ===== */
    var __fxreBookmarkCollectionFilter = null;
    var __fxreReportTarget = null;

    function syncBookmarksToLocal(rows) {
        try {
            var bookmarks = {};
            (rows || []).forEach(function(row) {
                var sid = row.submission_id || row;
                if (sid != null) {
                    bookmarks[sid] = {
                        time: Date.now(),
                        cloud: true,
                        collection_id: row.collection_id || null
                    };
                }
            });
            localStorage.setItem('fxre_bookmarks', JSON.stringify(bookmarks));
        } catch (e) { /* ignore */ }
    }

    function syncCloudBookmarks() {
        if (typeof SupabaseAdapter === 'undefined' || !SupabaseAdapter.isReady || !SupabaseAdapter.isAuthenticated()) {
            return Promise.resolve();
        }
        if (!SupabaseAdapter.getUserBookmarks) return Promise.resolve();
        return SupabaseAdapter.getUserBookmarks().then(function(rows) {
            if (rows && rows.length) syncBookmarksToLocal(rows);
            return rows;
        }).catch(function() { return []; });
    }

    function applyBookmarkFlags(submissions) {
        var localBookmarks = {};
        try { localBookmarks = JSON.parse(localStorage.getItem('fxre_bookmarks') || '{}'); } catch (e) {}
        submissions.forEach(function(s) {
            s.bookmarked = !!localBookmarks[s.id];
        });
        return submissions;
    }

    function openBookmarksPanel() {
        var panel = document.getElementById('bookmarks-panel');
        if (!panel) return;
        panel.hidden = false;
        renderBookmarksPanel();
    }

    function closeBookmarksPanel() {
        var panel = document.getElementById('bookmarks-panel');
        if (panel) panel.hidden = true;
    }

    function renderBookmarksPanel() {
        var listEl = document.getElementById('bookmarks-list');
        var emptyEl = document.getElementById('bookmarks-empty');
        var hintEl = document.getElementById('bookmarks-panel-hint');
        var collectionsListEl = document.getElementById('bookmarks-collections-list');
        if (!listEl) return;

        var isCloud = typeof SupabaseAdapter !== 'undefined' && SupabaseAdapter.isAuthenticated();
        if (hintEl) {
            hintEl.textContent = isCloud
                ? '收藏已与云端同步；可创建收藏夹分组，点击条目定位作品。'
                : '当前为本地收藏；绑定邮箱登录后可跨设备同步与分组。';
        }

        function renderCollectionChips(collections) {
            if (!collectionsListEl) return;
            var html = '<button type="button" class="bookmarks-col-chip' +
                (__fxreBookmarkCollectionFilter === null ? ' active' : '') +
                '" data-collection-id="">全部</button>';
            (collections || []).forEach(function(col) {
                html += '<button type="button" class="bookmarks-col-chip' +
                    (__fxreBookmarkCollectionFilter === col.id ? ' active' : '') +
                    (col.is_public ? ' is-public' : '') +
                    '" data-collection-id="' + col.id + '">' + escapeHTML(col.name) + '</button>';
            });
            collectionsListEl.innerHTML = html;
            collectionsListEl.querySelectorAll('.bookmarks-col-chip').forEach(function(chip) {
                chip.addEventListener('click', function() {
                    var raw = chip.getAttribute('data-collection-id');
                    __fxreBookmarkCollectionFilter = raw ? parseInt(raw, 10) : null;
                    renderBookmarksPanel();
                });
            });
            updateCollectionActionsBar(collections || []);
        }

        function updateCollectionActionsBar(collections) {
            var actionsBar = document.getElementById('bookmarks-collection-actions');
            if (!actionsBar) return;
            if (!isCloud || __fxreBookmarkCollectionFilter === null) {
                actionsBar.hidden = true;
                return;
            }
            actionsBar.hidden = false;
            var col = null;
            for (var i = 0; i < collections.length; i++) {
                if (collections[i].id === __fxreBookmarkCollectionFilter) {
                    col = collections[i];
                    break;
                }
            }
            var toggle = document.getElementById('collection-public-toggle');
            if (toggle) {
                toggle.checked = !!(col && col.is_public);
                toggle.onchange = function() {
                    SupabaseAdapter.setBookmarkCollectionPublic(__fxreBookmarkCollectionFilter, toggle.checked)
                        .then(function(ok) {
                            if (ok) {
                                showSubmitToast(toggle.checked ? '收藏夹已公开，可分享链接' : '已设为私密', 2500);
                                renderBookmarksPanel();
                            } else {
                                showSubmitToast('设置失败', 3000);
                                toggle.checked = !toggle.checked;
                            }
                        });
                };
            }
            var shareBtn = document.getElementById('collection-share-btn');
            if (shareBtn) {
                shareBtn.onclick = function() {
                    if (!col || !col.is_public) {
                        showSubmitToast('请先将收藏夹设为公开', 3000);
                        return;
                    }
                    var url = location.href.split('#')[0] + '#collection-' + __fxreBookmarkCollectionFilter;
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(url).then(function() {
                            showSubmitToast('分享链接已复制', 2000);
                        }).catch(function() {
                            prompt('复制此链接：', url);
                        });
                    } else {
                        prompt('复制此链接：', url);
                    }
                };
            }
            var renameBtn = document.getElementById('collection-rename-btn');
            if (renameBtn) {
                renameBtn.onclick = function() {
                    if (!col) return;
                    var newName = prompt('收藏夹新名称', col.name);
                    if (!newName || !newName.trim() || newName.trim() === col.name) return;
                    SupabaseAdapter.updateBookmarkCollection(__fxreBookmarkCollectionFilter, { name: newName.trim() })
                        .then(function(ok) {
                            if (ok) {
                                showSubmitToast('已重命名', 2000);
                                renderBookmarksPanel();
                            } else {
                                showSubmitToast('重命名失败', 3000);
                            }
                        });
                };
            }
            var deleteColBtn = document.getElementById('collection-delete-btn');
            if (deleteColBtn) {
                deleteColBtn.onclick = function() {
                    if (!col) return;
                    if (!confirm('确定删除收藏夹「' + col.name + '」？书签会保留为未分组。')) return;
                    SupabaseAdapter.deleteBookmarkCollection(__fxreBookmarkCollectionFilter).then(function(ok) {
                        if (ok) {
                            __fxreBookmarkCollectionFilter = null;
                            showSubmitToast('收藏夹已删除', 2000);
                            renderBookmarksPanel();
                        } else {
                            showSubmitToast('删除失败', 3000);
                        }
                    });
                };
            }
        }

        function paint(submissions, bookmarkRows) {
            submissions = applyBookmarkFlags(submissions || []);
            var bookmarkMap = {};
            try { bookmarkMap = JSON.parse(localStorage.getItem('fxre_bookmarks') || '{}'); } catch (e) {}

            var bookmarked = submissions.filter(function(s) {
                if (!s.bookmarked) return false;
                if (__fxreBookmarkCollectionFilter === null) return true;
                var meta = bookmarkMap[s.id];
                return meta && meta.collection_id === __fxreBookmarkCollectionFilter;
            });

            if (bookmarked.length === 0) {
                listEl.innerHTML = '';
                if (emptyEl) emptyEl.hidden = false;
                return;
            }
            if (emptyEl) emptyEl.hidden = true;

            listEl.innerHTML = bookmarked.map(function(s) {
                var meta = bookmarkMap[s.id] || {};
                var colSelect = '';
                if (isCloud && bookmarkRows) {
                    colSelect = '<select class="bookmarks-col-select" data-submission-id="' + s.id + '">' +
                        '<option value="">未分组</option></select>';
                }
                return '<li class="bookmarks-item">' +
                    '<button type="button" class="bookmarks-item-btn" data-submission-id="' + s.id + '">' +
                    '<span class="bookmarks-item-title">' + escapeHTML(s.title) + '</span>' +
                    '<span class="bookmarks-item-meta">' + escapeHTML(s.name) + ' · ' + s.timeStr + '</span>' +
                    '</button>' + colSelect + '</li>';
            }).join('');

            if (isCloud && typeof SupabaseAdapter.getBookmarkCollections === 'function') {
                SupabaseAdapter.getBookmarkCollections().then(function(collections) {
                    renderCollectionChips(collections);
                    listEl.querySelectorAll('.bookmarks-col-select').forEach(function(sel) {
                        collections.forEach(function(col) {
                            var opt = document.createElement('option');
                            opt.value = col.id;
                            opt.textContent = col.name;
                            sel.appendChild(opt);
                        });
                        var sid = sel.getAttribute('data-submission-id');
                        var meta = bookmarkMap[sid];
                        if (meta && meta.collection_id) sel.value = String(meta.collection_id);
                        sel.addEventListener('change', function() {
                            var submissionId = parseInt(sel.getAttribute('data-submission-id'), 10);
                            var colId = sel.value ? parseInt(sel.value, 10) : null;
                            SupabaseAdapter.setBookmarkCollection(submissionId, colId).then(function(ok) {
                                if (ok) {
                                    meta.collection_id = colId;
                                    bookmarkMap[sid] = meta;
                                    localStorage.setItem('fxre_bookmarks', JSON.stringify(bookmarkMap));
                                    showSubmitToast('已移入收藏夹', 1500);
                                }
                            });
                        });
                    });
                });
            } else {
                renderCollectionChips([]);
            }

            listEl.querySelectorAll('.bookmarks-item-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var sid = btn.getAttribute('data-submission-id');
                    closeBookmarksPanel();
                    var card = document.querySelector('.community-card[data-id="' + sid + '"]');
                    if (card) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        card.classList.add('bookmark-highlight');
                        setTimeout(function() { card.classList.remove('bookmark-highlight'); }, 2000);
                    } else {
                        showSubmitToast('该作品可能在当前筛选下不可见', 3000);
                    }
                });
            });
        }

        Promise.all([
            syncCloudBookmarks(),
            (isCloud && SupabaseAdapter.getUserBookmarks)
                ? SupabaseAdapter.getUserBookmarks() : Promise.resolve([])
        ]).then(function(results) {
            var bookmarkRows = results[1] || [];
            var result = getSubmissions();
            if (result && typeof result.then === 'function') {
                result.then(function(subs) { paint(subs, bookmarkRows); });
            } else {
                paint(result || [], bookmarkRows);
            }
        });
    }

    function initBookmarksPanel() {
        var openBtn = document.getElementById('bookmarks-open-btn');
        var closeBtn = document.getElementById('bookmarks-close-btn');
        var panel = document.getElementById('bookmarks-panel');
        if (openBtn) openBtn.addEventListener('click', openBookmarksPanel);
        if (closeBtn) closeBtn.addEventListener('click', closeBookmarksPanel);
        if (panel) {
            panel.addEventListener('click', function(e) {
                if (e.target === panel) closeBookmarksPanel();
            });
        }
        var newBtn = document.getElementById('bookmarks-new-collection-btn');
        if (newBtn) {
            newBtn.addEventListener('click', function() {
                if (typeof SupabaseAdapter === 'undefined' || !SupabaseAdapter.isAuthenticated()) {
                    showSubmitToast('请先登录后再创建收藏夹', 3000);
                    return;
                }
                var name = prompt('收藏夹名称（最多 20 字）');
                if (!name || !name.trim()) return;
                SupabaseAdapter.createBookmarkCollection(name.trim()).then(function(col) {
                    if (col) {
                        showSubmitToast('收藏夹「' + col.name + '」已创建', 2000);
                        renderBookmarksPanel();
                    } else {
                        showSubmitToast('创建失败', 3000);
                    }
                });
            });
        }
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && panel && !panel.hidden) closeBookmarksPanel();
        });
    }

    function initPublicCollectionPanel() {
        var panel = document.getElementById('public-collection-panel');
        var closeBtn = document.getElementById('public-collection-close');
        if (closeBtn) closeBtn.addEventListener('click', function() {
            if (panel) panel.hidden = true;
        });
        if (panel) {
            panel.addEventListener('click', function(e) {
                if (e.target === panel) panel.hidden = true;
            });
        }
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && panel && !panel.hidden) panel.hidden = true;
        });
    }

    function initCharacterHub() {
        document.querySelectorAll('.character-card[data-character-tag]').forEach(function(card) {
            card.addEventListener('click', function() {
                var tag = card.getAttribute('data-character-tag');
                document.querySelectorAll('#tag-filter-bar .tag-chip').forEach(function(chip) {
                    chip.classList.toggle('active', chip.getAttribute('data-tag') === tag);
                });
                communityFilter = 'all';
                communityPage = 0;
                document.querySelectorAll('.community-filter-btn').forEach(function(btn) {
                    btn.classList.toggle('active', btn.getAttribute('data-filter') === 'all');
                });
                var section = document.getElementById('community');
                if (section) section.scrollIntoView({ behavior: 'smooth' });
                renderCommunity();
            });
        });
    }

    function openModal(id) {
        var el = document.getElementById(id);
        if (el) el.hidden = false;
    }

    function closeModal(id) {
        var el = document.getElementById(id);
        if (el) el.hidden = true;
    }

    function initModals() {
        document.querySelectorAll('.modal-close[data-close]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                closeModal(btn.getAttribute('data-close'));
            });
        });
        document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) overlay.hidden = true;
            });
        });

        var guidelinesBtn = document.getElementById('guidelines-open-btn');
        if (guidelinesBtn) {
            guidelinesBtn.addEventListener('click', function() { openModal('guidelines-modal'); });
        }

        document.addEventListener('click', function(e) {
            var reportBtn = e.target.closest('.comment-report-btn, [data-action="report"]');
            if (!reportBtn) return;
            e.preventDefault();
            e.stopPropagation();
            var type = reportBtn.getAttribute('data-report-type') || 'submission';
            var id = parseInt(reportBtn.getAttribute('data-report-id'), 10);
            if (!id) return;
            __fxreReportTarget = { type: type, id: id };
            var labelEl = document.getElementById('report-target-label');
            if (labelEl) labelEl.textContent = '举报' + (type === 'comment' ? '评论' : '投稿') + ' #' + id;
            var errEl = document.getElementById('report-error');
            if (errEl) errEl.hidden = true;
            openModal('report-modal');
        });

        var reportSubmit = document.getElementById('report-submit-btn');
        if (reportSubmit) {
            reportSubmit.addEventListener('click', function() {
                if (!__fxreReportTarget) return;
                var reason = (document.getElementById('report-reason') || {}).value || '';
                var errEl = document.getElementById('report-error');
                if (typeof SupabaseAdapter === 'undefined' || !SupabaseAdapter.submitContentReport) {
                    if (errEl) { errEl.textContent = '云端未就绪'; errEl.hidden = false; }
                    return;
                }
                reportSubmit.disabled = true;
                SupabaseAdapter.submitContentReport(__fxreReportTarget.type, __fxreReportTarget.id, reason.trim())
                    .then(function(result) {
                        reportSubmit.disabled = false;
                        if (result && result.success) {
                            closeModal('report-modal');
                            showSubmitToast(result.message || '举报已提交', 3000);
                            if (document.getElementById('report-reason')) {
                                document.getElementById('report-reason').value = '';
                            }
                        } else {
                            if (errEl) {
                                errEl.textContent = (result && result.reason) || '提交失败';
                                errEl.hidden = false;
                            }
                        }
                    }).catch(function(err) {
                        reportSubmit.disabled = false;
                        if (errEl) {
                            errEl.textContent = err.message || '提交失败';
                            errEl.hidden = false;
                        }
                    });
            });
        }
    }

    function clearUploadPreview() {
        __fxrePendingAttachment = null;
        var preview = document.getElementById('upload-preview');
        var img = document.getElementById('upload-preview-img');
        var nameEl = document.getElementById('upload-preview-name');
        if (preview) preview.hidden = true;
        if (img) img.removeAttribute('src');
        if (nameEl) nameEl.textContent = '';
        if (typeof UploadManager !== 'undefined' && UploadManager.clearCurrentFile) {
            UploadManager.clearCurrentFile();
        }
    }

    function showUploadPreview(fileData) {
        var preview = document.getElementById('upload-preview');
        var img = document.getElementById('upload-preview-img');
        var nameEl = document.getElementById('upload-preview-name');
        if (!preview) return;
        if (fileData.type === 'image' && fileData.url) {
            __fxrePendingAttachment = { type: 'image', url: fileData.url, name: fileData.filename };
            if (img) img.src = fileData.url;
            if (nameEl) nameEl.textContent = fileData.filename + '（将随投稿一并发布）';
            preview.hidden = false;
            var typeSelect = document.getElementById('submit-type');
            if (typeSelect) typeSelect.value = 'art';
        } else if (fileData.type === 'text') {
            __fxrePendingAttachment = null;
        }
    }

    function buildCommentAreaHTML(targetId) {
        return '<div class="comment-list" id="comment-list-' + targetId + '"></div>' +
               '<div class="comment-reply-bar" id="reply-bar-' + targetId + '" hidden>' +
               '<span class="comment-reply-label"></span>' +
               '<button type="button" class="comment-reply-cancel">取消回复</button></div>' +
               '<form class="comment-form">' +
               '<input type="text" class="comment-form-input comment-form-name" placeholder="昵称" maxlength="20" required>' +
               '<input type="text" class="comment-form-input" placeholder="写下你的评论……" maxlength="500" required>' +
               '<button type="submit" class="comment-submit-btn">发送</button>' +
               '</form>';
    }

    /* ===== Seed Comments — Multi-user pre-populated data ===== */
    var SEED_COMMENTS = {
        '1': [
            { name: '西格莉卡', text: '泡泡的温控参数是多少？我记得虚质隔离层的热传导系数和室温有关，下次你犯困的时候我帮你算一下最佳温度区间。', timeStr: '7月5日 15:30', color: '#7FD99E' },
            { name: '漂泊者', text: '梦里那个残影……是不是虚质空间深处的回声？黑海岸也收到过类似的信号碎片。', timeStr: '7月5日 18:42', color: '#FFD700' },
            { name: '学院路人A', text: '达妮娅同学上课的泡泡真的很漂亮，折射出来的虹光在教室天花板上画了一道彩虹', timeStr: '7月6日 09:15', color: '#6B8AFF' }
        ],
        '2': [
            { name: '达妮娅', text: '西格莉卡老师批注写太多了啦！不过当年你帮我看作业的时候确实很仔细……谢谢西西。', timeStr: '7月4日 08:20', color: '#FFB6D9' },
            { name: '漂泊者', text: '「守护」和「禁锢」——符号几乎一样，但方向相反。这个比喻很好。', timeStr: '7月4日 10:55', color: '#FFD700' },
            { name: '飞行雪绒', text: '深夜的天文台窗外真的能看到星星哦。助教辛苦了，晚安。', timeStr: '7月4日 23:10', color: '#A8D8FF' }
        ],
        '3': [
            { name: '漂泊者', text: '「好呀」这两个字，我也听到了。她笑的时候，嘴角是歪的。', timeStr: '7月1日 17:30', color: '#FFD700' },
            { name: '飞行雪绒', text: '草莓千层……我虽然不可见，但我可以帮你们占座。学校门口那家我观察过，靠窗的位置光线最好。', timeStr: '7月1日 20:45', color: '#A8D8FF' },
            { name: '学院路人B', text: '在花园看到她们两个聊天了。虽然听不到说什么，但画面很温柔。', timeStr: '7月2日 09:30', color: '#6B8AFF' }
        ],
        '4': [
            { name: '西格莉卡', text: '她带你去天文台了吗？她以前说过，那里看星星最近。……我没问出口的话，谢谢你替我陪了她一天。', timeStr: '7月1日 09:20', color: '#7FD99E' },
            { name: '飞行雪绒', text: '她哼的那段旋律我录到了。三个音符，do-sol-la。调频9072里存着呢。', timeStr: '7月1日 14:30', color: '#A8D8FF' },
            { name: '漂泊者信使', text: '有些告别不需要说出口。但有些人，值得被记住她告别的样子。', timeStr: '7月1日 22:15', color: '#FFD700' }
        ],
        '5': [
            { name: '达妮娅', text: '三十七个人……我下次帮你数。不对，你看不见我数数。那我帮你挡一下走廊的灯，让你多走一会儿。', timeStr: '6月29日 10:20', color: '#FFB6D9' },
            { name: '西格莉卡', text: '调频9072我试过。深夜一点以后，信号最清晰。你在唱什么歌？我只听到了旋律，没有歌词。', timeStr: '6月29日 14:35', color: '#7FD99E' },
            { name: '漂泊者', text: '甲虫翻石子那段——你在花坛边蹲了多久？我经过的时候看到了石子在动，但没看到你。', timeStr: '6月29日 18:50', color: '#FFD700' },
            { name: '匿名信号源', text: '你看得见全世界，但全世界看不见你。——可你不知道的是，有人一直在看着你看世界的样子。', timeStr: '6月30日 01:22', color: '#FFFFFF' }
        ],
        '6': [
            { name: '漂泊者', text: '雪绒海豹……拉海洛的？我小时候在黑海岸的资料里看到过。它们真的会用尾巴搓雪球吗？', timeStr: '6月26日 08:15', color: '#FFD700' },
            { name: '达妮娅', text: '围巾绕两圈才打结……我爸爸也是这样系的。原来不止我们家的爸爸会这样。', timeStr: '6月26日 11:40', color: '#FFB6D9' },
            { name: '西格莉卡', text: '罗伊冰原离拉海洛不远。我们罗伊人管那片海叫"白被子"，因为冬天海面冻住了，从岸边看过去就是一片白。雪绒海豹是很温柔的生物。', timeStr: '6月26日 19:20', color: '#7FD99E' }
        ],
        '7': [
            { name: '达妮娅', text: '开高达！！！我也想看机兵形态！能不能发个照片——哦对，你没有朋友圈。那我下次路过训练场的时候偷看。', timeStr: '6月21日 09:30', color: '#FFB6D9' },
            { name: '西格莉卡', text: '自运转逻辑是你自己写的？隧者兵装的自判断系统通常需要三个学期的课程才能搭起来。你用了多久？', timeStr: '6月21日 13:55', color: '#7FD99E' },
            { name: '漂泊者', text: '星辉在兵装表面流淌的声音——我在黑海岸也听到过类似的。但那不是星辉，是虚质粒子的低频共振。也许本质上是一样的东西。', timeStr: '6月21日 22:10', color: '#FFD700' }
        ],
        'diary-1': [
            { name: '西格莉卡', text: '空房间里放一盏灯……娅娅，如果你看到这条评论——灯不会灭的。我保证。', timeStr: '7月6日 10:30', color: '#7FD99E' },
            { name: '漂泊者', text: '半透明的手指穿过手心。这种梦，黑海岸的漂泊者也会做。你不是唯一一个空荡荡的人。', timeStr: '7月6日 14:15', color: '#FFD700' },
            { name: '飞行雪绒', text: '灯会灭的。但歌不会。调频9072永远在线。', timeStr: '7月6日 23:50', color: '#A8D8FF' }
        ],
        'diary-2': [
            { name: '达妮娅', text: '第三个符文……你差点在冰原上出事那次吗？我一直想问，但不敢问。', timeStr: '6月29日 20:10', color: '#FFB6D9' },
            { name: '漂泊者', text: '天赋告诉你意思，但理解需要活过。这句话我记住了。', timeStr: '6月30日 08:45', color: '#FFD700' },
            { name: '飞行雪绒', text: '她在消失。你也知道。但知道和承认是两件事——就像符文的意思和符文的点亮是两件事。', timeStr: '6月30日 02:15', color: '#A8D8FF' }
        ],
        'diary-3': [
            { name: '西格莉卡', text: '她去了那棵老树下面吗？……那是我们第一次一起做课题的地方。树皮确实比以前粗糙了。我也比以前粗糙了。', timeStr: '7月1日 11:20', color: '#7FD99E' },
            { name: '达妮娅', text: '生日快乐——你说这两个字的时候，她一定很开心。虽然她没说。', timeStr: '7月1日 15:40', color: '#FFB6D9' },
            { name: '飞行雪绒', text: '她哼的那段旋律，我收到了。三个音符，do-sol-la。我在9072里循环播放了一整夜。', timeStr: '7月1日 23:30', color: '#A8D8FF' }
        ],
        'diary-4': [
            { name: '西格莉卡', text: '娅娅。我看到这篇日记了。原来你记得那天。我也记得。发烧退了之后，我其实还有一句话没说出口：「因为娅娅值得。」', timeStr: '7月2日 09:15', color: '#7FD99E' },
            { name: '漂泊者', text: '名字不是被赋予的，是被叫出来的。——这句话我会写进黑海岸的值班日志里。', timeStr: '7月2日 12:30', color: '#FFD700' },
            { name: '飞行雪绒', text: '比名字更像你的名字。比达妮娅更像你。——娅娅，这个名字也会在我的歌里。', timeStr: '7月2日 23:45', color: '#A8D8FF' }
        ],
        'diary-5': [
            { name: '漂泊者', text: '飞过冰海去看看对面的陆地——拉海洛对面是什么？我查过地图，是索诺拉荒原。如果你有一天能飞过去，替我看看那里的日落。', timeStr: '6月21日 10:45', color: '#FFD700' },
            { name: '琳奈', text: '隧者兵装的自运转逻辑？我在教材上看过理论模型，但从来没听说有适格者真的把它写出来过……爱弥斯同学你到底是什么时候学的编程？', timeStr: '6月21日 15:20', color: '#D4A0FF' },
            { name: '达妮娅', text: '妈妈哄你睡觉时哼的调子——你还记得吗？如果记得的话，能不能在9072哼一遍？我也想听。', timeStr: '6月21日 22:30', color: '#FFB6D9' }
        ],
        'diary-6': [
            { name: '漂泊者', text: '渐湖。我在黑海岸的数据库里查到了这个地名——坐标标注是"民用居住点，已废弃"。但数据库不知道那里住过一个会飞的小姑娘。', timeStr: '6月26日 03:15', color: '#FFD700' },
            { name: '西格莉卡', text: '雪绒手套！我们罗伊人也这么叫它们！小时候在冰原上揉过它们的脑袋，毛确实很软。爱弥斯同学去过罗伊冰原附近吗？', timeStr: '6月26日 09:40', color: '#7FD99E' },
            { name: '达妮娅', text: '爸爸每隔两天去凿冰钓鱼。我……我没有爸爸。但我能想象那个画面。冰面很厚，凿的时候要很用力，碎冰会溅到脸上。很冷。但回家之后有热汤喝。', timeStr: '6月26日 14:55', color: '#FFB6D9' }
        ]
    };

    var SEED_VERSION = 'v9.1';

    /* ===== Seed Submissions (Community pre-population) ===== */
    var SEED_SUBMISSIONS = [
        {
            id: 'seed_1', name: '达妮娅', type: 'poem', title: '泡泡',
            content: '我吹了一个泡泡\n它是圆的，透明的，漂亮的\n光线穿过它的时候\n会变成彩虹\n\n它飘啊飘\n碰到墙壁也不破\n因为我的泡泡\n比墙壁还硬\n\n可是你伸出手的时候\n它就碎了\n\n不是因为你的手太重\n是因为泡泡本来就\n一碰就碎\n\n就像我',
            timeStr: '2026-07-05 14:20', likes: 23, liked: false, color: '#FFB6D9'
        },
        {
            id: 'seed_2', name: '西格莉卡', type: 'story', title: '第三个符文',
            content: '罗伊冰原的夜晚很安静。安静到能听见自己血液流动的声音。\n\n我蹲在雪地上，用匕首在空气中画第三个符文。刀尖很稳——我练了很多年，手不会抖。笔画也对——我背过所有符文的形态，一笔不差。\n\n但它没有亮。\n\n后来我想了很久，终于明白：那个符文的意思是「守护」。不是防御的守护，是那种——你明知道守护的东西终将失去，却依然选择站在它面前的守护。\n\n那时候的我，还没有失去过什么。所以符文不认我。\n\n现在，我好像快要失去什么了。可符文依然没有亮。\n\n也许是因为，我还不敢承认。',
            timeStr: '2026-07-03 23:15', likes: 31, liked: false, color: '#7FD99E'
        },
        {
            id: 'seed_3', name: '漂泊者', type: 'text', title: '来自黑海岸的信号',
            content: '在黑海岸值夜的时候，收到了一段不明信号。\n\n频率：9072Hz\n持续时间：0.3秒\n间隔：不规律\n\n信号内容被噪音覆盖了大半，但有一段能勉强辨识——像是一个人唱歌的声音。不是完整的旋律，只有几个音符，反复出现。\n\n我把那几个音符记了下来。如果你在星炬学院听到有人哼同样的调子，请告诉我。\n\n我在找一个声音的主人。也许她不知道自己被听见了。',
            timeStr: '2026-07-01 02:40', likes: 19, liked: false, color: '#A8D8FF'
        },
        {
            id: 'seed_4', name: '达妮娅', type: 'story', title: '最后一个生日',
            content: '今天我过生日。\n\n其实不是真的。但漂泊者没有拆穿我，我就当是真的了。\n\n我带她去了天文台。那里的穹顶可以看到整片天空。我想记住星星的位置，这样以后就算看不见了，也能在脑子里画出来。\n\n我去了训练场。站在中间哼了一首歌。那首歌是我自己编的，没有歌词，只有旋律。以前在西格莉卡面前哼过一次，她说好听。我说是随便哼的，其实练了很多遍。\n\n我去了花园。那棵老树下面，是我和西格莉卡第一次一起做课题的地方。树皮比以前粗糙了。我也比以前粗糙了。\n\n我去了图书馆露台。夕阳被云遮住了。我假装没关系，说「下次再来看」。其实我知道没有下次了。\n\n漂泊者一直在旁边看着，什么也没说。她说「生日快乐」的时候，声音很轻。像是怕说重了，这个生日就会碎掉。\n\n谢谢你。今天。\n\n这是我过得最好的一个生日。虽然它是假的。但开心是真的。',
            timeStr: '2026-06-30 21:00', likes: 42, liked: false, color: '#FFB6D9'
        },
        {
            id: 'seed_5', name: '西格莉卡', type: 'poem', title: '写给娅娅的信',
            content: '娅娅：\n\n这封信我写了很多遍，但一次也没有寄出去。\n\n因为每次写到一半，我就会发现：我写的不是信，是遗书。而你还活着。你还站在我面前，笑着说「没事呀」。\n\n所以我把信收起来，告诉自己：等她好了，我再寄。等她好了，我当面念给她听。\n\n可是娅娅，你什么时候才能好呢？\n\n你上次来花园看我的时候，手在发抖。你以为我没看到，但我看到了。你笑的时候，嘴角是歪的——不是平时那种可爱的歪，是在用力的歪。好像不用力，笑容就会掉下来。\n\n我想抓住你的手。但我的手也在抖。\n\n天赋告诉我你在消失。可我宁愿相信你说的「没事」。\n\n因为如果你真的在消失，那我这些年来学的所有符文、解的所有谜题、拼了命也要成为的昭日者——有什么用呢？\n\n我连一个人都守护不了。\n\n第三个符文，还是没有亮。\n\n——你的西西',
            timeStr: '2026-07-02 01:30', likes: 38, liked: false, color: '#7FD99E'
        },
        {
            id: 'seed_6', name: '漂泊者信使', type: 'story', title: '信号塔守望者',
            content: '我在信号塔上等了三个小时。\n\n不是因为职责。是因为她说「今晚的星星会很亮」。后来信号塔的灯真的亮了，但那不是星星，是有人在模拟舱里偷偷调的天文台投影。\n\n我知道是谁。只有她会把星星的频率调到9072。\n\n我没有上去找她。有些歌，只有在没有人听的时候才唱得出来。有些星星，只有在没有人看的时候才亮得起来。\n\n我只是在塔下站了一会儿，抬头看了看那片假星空。\n\n——虽然不是真的，但很美。\n\n谢谢你让我看到了。',
            timeStr: '2026-06-28 23:15', likes: 27, liked: false, color: '#FFD700'
        },
        {
            id: 'seed_7', name: '达妮娅×西格莉卡', type: 'art', title: '花园里的两个影子',
            content: '【画作构思】\n\n画面中央是一座花园。阳光从右侧斜照进来，将花圃切成明暗两半。\n\n左侧阴影中，一个女孩背对画面坐着。白发渐变成浅紫色，长发散落在草地上。她手里抱着一只小熊玩偶。她的周围飘着几个透明的泡泡，折射出淡淡的虹光。\n\n右侧阳光中，另一个女孩面朝阴影站着。她穿着星炬学院的制服，花型头饰在阳光下几乎透明。她伸出手，像是要触碰阴影中的人，但手指停在半空——差一点点，就能碰到了。\n\n两个人之间，有一道光与影的分界线。\n\n画的标题是：「差一点点」。\n\n——有时候，差一点点，就是一辈子。',
            timeStr: '2026-07-04 16:45', likes: 35, liked: false, color: '#D4A0FF'
        },
        {
            id: 'seed_8', name: '飞行雪绒', type: 'music', title: '9072的频率',
            content: '今天在天文台捕捉到了一个很特别的频率：9072Hz。\n\n它不是任何已知天体的辐射频率，也不是学院设备的运行噪音。它很干净，很轻，像有人在很远很远的地方，轻轻地哼了一声。\n\n我把这段频率录下来，放慢了十倍听。听起来像是一段旋律的开头——只有三个音符，do-sol-la。\n\n我试着往下接。do-sol-la之后是什么？是si？是do？还是沉默？\n\n最后我选择了沉默。\n\n因为有些旋律，不是一个人能完成的。它需要另一个人来接下一段。也许那个人正在某个地方，也在等一个9072的信号。\n\n调频9072。深夜开放。\n\n——如果你听到了，请回应我。',
            timeStr: '2026-06-28 03:22', likes: 56, liked: false, color: '#A8D8FF'
        },
        {
            id: 'seed_9', name: '飞行雪绒', type: 'music', title: '纸飞机',
            content: '折了一架纸飞机。\n\n不是真的纸飞机。是数据系统里模拟的——调出折纸的步骤，一步一步折，最后从天文台的窗户扔出去。它在数据空间里飞了很远，翻了一个跟头，然后掉了下来。\n\n我想起小时候在渐湖，爸爸教我折纸飞机。他折的飞机总是飞得又直又远，我折的不是歪就是打转。他说没关系，打转的飞机也有打转的飞法。\n\n后来我明白了他的意思。不是每架飞机都要飞到终点。有的飞机在半空转个圈，看到的风景比直飞的还多。\n\n我给这架纸飞机写了一段旋律。很短，四个小节，大概够它飞一圈的时间。\n\n如果有一天我能发EP的话，第一首就叫《纸飞机》。开头要致敬一个很老很老的画面——一架破损的飞行器残骸躺在荒野里，但旁边长出了一朵花。\n\n那朵花就是我。',
            timeStr: '2026-06-20 01:15', likes: 48, liked: false, color: '#A8D8FF'
        },
        {
            id: 'seed_10', name: '飞行雪绒', type: 'text', title: '调频9072的第一次广播',
            content: '今天调频9072第一次正式开播了。\n\n说"正式"有点夸张。设备是我从学院广播室的报废堆里拼出来的，天线是食堂的旧铁架改造的，信号覆盖范围大概只有三栋楼。但我还是在凌晨一点准时按下了播放键。\n\n播什么呢？我其实没想好。就播了环境音——天文台穹顶下面的风声，花坛里甲虫翻石子的沙沙声，训练场空无一人的时候回音壁里的嗡嗡声。\n\n没有人听。我知道没有人听。电子幽灵的广播，谁会调到9072这个奇怪的频率呢。\n\n但播完之后，我收到了一条信号反馈。只有三个字：\n\n"收到了。"\n\n不知道是谁。不知道在哪儿。但有人听到了。\n\n这就够了。\n\n调频9072，每晚凌晨一点。不见不散。',
            timeStr: '2026-06-15 02:00', likes: 33, liked: false, color: '#A8D8FF'
        },
        {
            id: 'seed_11', name: '琳奈', type: 'story', title: '关于爱弥斯同学的一些事',
            content: '我是星炬学院拉贝尔学部的学生，和爱弥斯同学同班。\n\n我想写一些关于她的事，因为她已经不在了。\n\n爱弥斯同学很开朗。真的很开朗。不是那种硬撑出来的开朗，是那种——好像世界上所有的好事都会发生一样的开朗。她会在走廊上跟所有人打招呼，包括不认识的。她会在别人的生日会上唱最大声的歌，虽然跑调跑得离谱。\n\n她送过我一个隧者手办。很小的那种，自己做的，用的材料我认不出来。她说："琳奈，总有一天我们一起去看真正的星空。"\n\n我说好呀。\n\n然后她就失踪了。\n\n校长洛瑟菈女士把她的档案调走了。我问过辅导员，辅导员说"不清楚"。我问过同班的千咲，千咲说她最后一次见爱弥斯是在隧者训练场，那天爱弥斯说要去试一个新的共鸣模态。\n\n后来我在网上看到一个叫"飞行雪绒"的歌手。声音很像她。歌里有一些只有我们班才知道的梗——比如"渐湖的冰面下面有鱼"。\n\n我不确定是不是她。但如果真的是的话：\n\n爱弥斯同学，星空还在。你看到了吗？',
            timeStr: '2026-07-03 18:30', likes: 29, liked: false, color: '#D4A0FF'
        }
    ];

    /* Phase 3: 种子数据统一走 DataRepository */
    ;
    if (typeof DataRepository !== 'undefined') {
        DataRepository.ensureSeedData(SEED_VERSION, SEED_COMMENTS, SEED_SUBMISSIONS);
    }

    function getComments(targetId) {
        if (typeof DataRepository !== 'undefined') return DataRepository.getComments(targetId);
        var data = safeGetItem('fxre_comments_' + targetId);
        if (data) { try { return JSON.parse(data); } catch(e) { return []; } }
        return [];
    }

    function saveComments(targetId, comments) {
        safeSetItem('fxre_comments_' + targetId, JSON.stringify(comments));
    }

    function renderComments(targetId) {
        var list = document.getElementById('comment-list-' + targetId);
        if (!list) return;
        var result = getComments(targetId);
        if (result && typeof result.then === 'function') {
            result.then(function(comments) {
                comments = comments || [];
                saveComments(targetId, comments);
                _renderCommentsList(list, comments);
            });
        } else {
            _renderCommentsList(list, result || []);
        }
    }

    function updatePostCommentCount(targetId, count) {
        /* 博文卡片：data-post-id + 第2个 .post-action 按钮的 span */
        var post = document.querySelector('.post-card[data-post-id="' + targetId + '"]');
        var actionBtn = null;
        if (post) {
            var actions = post.querySelector('.post-actions');
            if (actions) {
                var btns = actions.querySelectorAll('.post-action');
                if (btns.length >= 2) actionBtn = btns[1]; /* 第2个按钮 = 评论 */
            }
        }
        if (actionBtn) {
            var span = actionBtn.querySelector('span');
            if (span) span.textContent = formatNumber(count);
        }

        /* 日志区：评论切换按钮显示数量 */
        var diary = document.querySelector('.diary-entry[data-diary-id="' + targetId + '"]');
        if (diary) {
            var toggleSpan = diary.querySelector('.community-card-action span');
            if (toggleSpan) {
                toggleSpan.textContent = count > 0 ? ('评论 ' + formatNumber(count)) : '评论';
            }
        }
    }

    function syncAllPostCommentCounts() {
        document.querySelectorAll('.post-card[data-post-id]').forEach(function(card) {
            var postId = card.getAttribute('data-post-id');
            var result = getComments(postId);
            function apply(comments) {
                comments = (comments || []).filter(function(c) { return !c.is_hidden; });
                updatePostCommentCount(postId, comments.length);
            }
            if (result && typeof result.then === 'function') result.then(apply);
            else apply(result);
        });
        document.querySelectorAll('.diary-entry[data-diary-id]').forEach(function(entry) {
            var did = entry.getAttribute('data-diary-id');
            var result = getComments(did);
            function apply(comments) {
                comments = (comments || []).filter(function(c) { return !c.is_hidden; });
                updatePostCommentCount(did, comments.length);
            }
            if (result && typeof result.then === 'function') result.then(apply);
            else apply(result);
        });
    }

    function mapRealtimeCommentRow(row) {
        if (!row) return null;
        var d = new Date(row.created_at || Date.now());
        return {
            id: row.id,
            authorId: row.author_id || '',
            name: row.author_name || '匿名信号源',
            color: row.author_color || '#6B8AFF',
            text: row.content || row.text || '',
            parentId: row.parent_id || null,
            time: d.getTime(),
            is_hidden: row.is_hidden === true,
            timeStr: (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
                String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
        };
    }

    function refreshCommentListUI(targetId, comments) {
        if (targetId.indexOf('community_') === 0) {
            var subId = targetId.replace('community_', '');
            var box = document.getElementById('cc-comments-' + subId);
            if (box && box.classList.contains('open')) {
                var list = document.getElementById('cc-list-' + subId);
                if (list) {
                    if (comments) _renderCommunityCommentsList(list, comments);
                    else renderCommunityComments(subId);
                }
            }
            return;
        }
        var list = document.getElementById('comment-list-' + targetId);
        if (list) {
            if (comments) _renderCommentsList(list, comments);
            else renderComments(targetId);
        }
    }

    function applyRealtimeCommentEvent(targetId, event, payload) {
        payload = payload || {};
        var row = payload.new || payload.old;
        if (event === 'DELETE' || (event === 'UPDATE' && payload.new && payload.new.is_hidden)) {
            var removeId = payload.old ? payload.old.id : (payload.new ? payload.new.id : null);
            if (removeId) {
                var local = [];
                try { local = JSON.parse(safeGetItem('fxre_comments_' + targetId) || '[]'); } catch (e) {}
                local = local.filter(function(c) { return String(c.id) !== String(removeId); });
                saveComments(targetId, local);
                refreshCommentListUI(targetId, local);
                updatePostCommentCount(targetId.replace(/^community_/, ''), local.length);
            } else {
                refreshCommentListUI(targetId);
            }
            return;
        }
        if (event === 'INSERT' || event === 'UPDATE') {
            var c = mapRealtimeCommentRow(row);
            if (!c) { refreshCommentListUI(targetId); return; }
            var comments = [];
            try { comments = JSON.parse(safeGetItem('fxre_comments_' + targetId) || '[]'); } catch (e) {}
            var found = false;
            for (var i = 0; i < comments.length; i++) {
                if (c.id && String(comments[i].id) === String(c.id)) {
                    comments[i] = c;
                    found = true;
                    break;
                }
            }
            if (!found && !c.is_hidden) comments.push(c);
            if (c.is_hidden) {
                comments = comments.filter(function(x) { return String(x.id) !== String(c.id); });
            }
            saveComments(targetId, comments);
            refreshCommentListUI(targetId, comments);
            var countId = targetId.indexOf('community_') === 0 ? targetId.replace('community_', '') : targetId;
            updatePostCommentCount(countId, comments.length);
        }
    }

    var commentDisplayLimits = {};
    var COMMENT_PAGE_SIZE = 30;

    function _renderCommentsList(list, comments) {
        /* R19: 增量协调，替代整列表 innerHTML 重绘 */
        var targetId = list.id.replace('comment-list-', '');
        reconcileCommentThread(list, comments, { targetId: targetId, communityListId: null });
    }

    function handleCommentSubmit(targetId, form) {
        var nameInput = form.querySelector('.comment-form-name');
        var textInput = form.querySelectorAll('.comment-form-input')[1];
        var rawName = nameInput.value.trim();
        var rawText = textInput.value.trim();

        /* --- 输入校验 --- */
        if (!rawName || !rawText) return;
        if (rawName.length > 20) { showSubmitToast('昵称限20字以内'); return; }
        if (rawText.length > 500) { showSubmitToast('评论限500字以内'); return; }
        if (rawText.length < 2) { showSubmitToast('评论至少2个字～'); return; }

        /* R8: 封禁用户禁止评论（封禁须实际生效，而非仅存储标记） */
        if (typeof AuthManager !== 'undefined' && AuthManager.isBanned && AuthManager.isBanned()) {
            showSubmitToast('账号已被封禁，无法评论', 4000);
            return;
        }

        if (typeof SecurityShield !== 'undefined') {
            var nameGuard = SecurityShield.guardUserInput(rawName, 'comment_name');
            var textGuard = SecurityShield.guardUserInput(rawText, 'comment_text');
            if (!nameGuard.ok) { showSubmitToast(nameGuard.reason, 4000); return; }
            if (!textGuard.ok) { showSubmitToast(textGuard.reason, 4000); return; }
            rawName = nameGuard.text;
            rawText = textGuard.text;
        }

        persistNicknameIfNeeded(rawName);

        var replyState = commentReplyState[targetId];
        var parentId = replyState ? replyState.parentId : null;

        /* --- 速率限制 --- */
        if (typeof RateLimiter !== 'undefined') {
            var rl = RateLimiter.checkComment(targetId);
            if (!rl.allowed) {
                showSubmitToast(rl.reason, 4000);
                return;
            }
            RateLimiter.recordComment(targetId);
        }

        /* v9.0: 客户端限流增强（冷却 + 重复检测） */
        if (typeof ClientRateLimiter !== 'undefined') {
            var clCheck = ClientRateLimiter.canSendComment(rawText);
            if (!clCheck.allowed) {
                showSubmitToast(clCheck.reason, 4000);
                return;
            }
        }

        /* 安全转义 */
        var name = escapeHTML(rawName);
        var text = escapeHTML(rawText);

        var now = new Date();
        var nameHash = 0;
        for (var h = 0; h < name.length; h++) { nameHash = ((nameHash << 5) - nameHash) + name.charCodeAt(h); }
        var autoColors = ['#FF6B9D', '#A8D8FF', '#B66BFF', '#6B8AFF', '#FFD700', '#FFB6D9', '#FFFFFF'];
        var autoColor = autoColors[Math.abs(nameHash) % autoColors.length];

        var newComment = {
            name: name,
            text: text,
            time: now.getTime(),
            timeStr: now.getMonth() + 1 + '月' + now.getDate() + '日 ' +
                     String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
            color: autoColor,
            parentId: parentId || null
        };

        /* v9.0: 生成删除令牌 */
        var deleteToken = (typeof AuthManager !== 'undefined') ? AuthManager.generateToken() : null;

        var list = document.getElementById('comment-list-' + targetId);

        function _doSubmit(comments) {
            comments = Array.isArray(comments) ? comments : [];
            comments.push(newComment);
            saveComments(targetId, comments);
            /* 乐观渲染：直接展示本地合并后的列表 */
            if (list) _renderCommentsList(list, comments);
        }

        var result = getComments(targetId);
        if (result && typeof result.then === 'function') {
            result.then(_doSubmit);
        } else {
            _doSubmit(result || []);
        }

        /* Phase 3: 同步写云端；完成后合并并刷新，确保跨设备一致 */
        if (typeof DataRepository !== 'undefined') {
            var commentExtra = deleteToken ? { delete_token: deleteToken } : {};
            if (parentId) commentExtra.parent_id = parentId;
            DataRepository.addComment(targetId, { author: name, color: autoColor, text: text }, Object.keys(commentExtra).length ? commentExtra : null)
                .then(function(cloudRow) {
                    if (cloudRow && cloudRow._error) {
                        showSubmitToast('评论已显示，但云端同步失败：' + cloudRow._error, 6000);
                        updateSyncStatus();
                        return;
                    }
                    if (cloudRow && cloudRow.id) {
                        /* v9.0: 存储删除令牌 */
                        if (deleteToken && typeof AuthManager !== 'undefined') {
                            AuthManager.storeDeleteToken(cloudRow.id, deleteToken);
                        }
                        /* v9.0: 记录限流 */
                        if (typeof ClientRateLimiter !== 'undefined') {
                            ClientRateLimiter.recordCommentSent(rawText);
                        }
                        var stored = getComments(targetId);
                        function patchList(comments) {
                            comments = Array.isArray(comments) ? comments : [];
                            for (var i = comments.length - 1; i >= 0; i--) {
                                var item = comments[i];
                                if (!item || !newComment) continue;
                                if (item.time === newComment.time &&
                                    item.text === newComment.text &&
                                    item.name === newComment.name &&
                                    !item.id) {   /* R5: 只补未赋 id 的乐观项 */
                                    item.id = cloudRow.id;
                                    item.authorId = cloudRow.authorId || '';
                                    break;
                                }
                            }
                            /* R5: 乐观插入与实时回显竞态——按 id 去重，移除实时副本，防重复评论 */
                            var seenIds = {};
                            comments = comments.filter(function(c) {
                                if (c.id == null) return true;      /* 其他未同步的乐观项保留 */
                                var k = String(c.id);
                                if (seenIds[k]) return false;
                                seenIds[k] = true;
                                return true;
                            });
                            saveComments(targetId, comments);
                        }
                        if (stored && typeof stored.then === 'function') {
                            stored.then(patchList).then(function() {
                                renderComments(targetId);
                                updateSyncStatus();
                            });
                        } else {
                            patchList(stored || []);
                            renderComments(targetId);
                            updateSyncStatus();
                        }
                    } else {
                        showSubmitToast('评论已本地保存，等待云端同步…', 3000);
                        renderComments(targetId);
                    }
                })
                .catch(function(err) {
                    console.warn('[Main] 云端同步失败:', err);
                });
        }
        textInput.value = '';
        clearCommentReplyMode(targetId, form);
    }
    function _removeCommentFromUI(targetId, btn) {
        var item = btn ? btn.closest('.comment-item') : null;
        if (item) {
            item.style.opacity = '0';
            item.style.transform = 'translateX(20px)';
            item.style.transition = 'all 0.3s ease';
            setTimeout(function() {
                item.remove();
                var list = document.getElementById('comment-list-' + targetId);
                var remaining = list ? list.querySelectorAll('.comment-item').length : 0;
                if (list && remaining === 0) {
                    list.innerHTML = '<div class="comment-empty">还没有评论，来第一个留言吧 ~</div>';
                }
                updatePostCommentCount(targetId, Math.max(0, remaining));
            }, 300);
        } else {
            renderComments(targetId);
        }
    }

    /**
     * 删除一条评论
     * - v9.0: 令牌删除（匿名用户）/ 身份删除（注册用户）/ 版主隐藏 / 管理员删除
     * - 双写删除（本地 + 云端）
     */
    function handleDeleteComment(targetId, commentData, btn) {
        if (!commentData) return;

        var isAdmin = (typeof AdminAuth !== 'undefined') && AdminAuth.isAdmin();
        var commentId = commentData.id ? parseInt(commentData.id, 10) : null;

        /* v9.0: 优先检查删除令牌（匿名用户） */
        var deleteToken = null;
        if (typeof AuthManager !== 'undefined' && commentId) {
            deleteToken = AuthManager.getDeleteToken(commentId);
        }

        /* v9.0: 版主权限 */
        var canModerate = (typeof AuthManager !== 'undefined') && AuthManager.canHideComment();

        /* 确认对话框 */
        var confirmMsg;
        if (isAdmin) confirmMsg = '确定要删除此评论吗？（管理员操作）';
        else if (canModerate) confirmMsg = '确定要隐藏此评论吗？（版主操作）';
        else confirmMsg = '确定要删除你的这条评论吗？';
        if (!confirm(confirmMsg)) return;

        /* 构造评论对象 */
        var comment = {
            id:       commentId,
            authorId: commentData.authorId || '',
            name:     commentData.name     || '',
            text:     commentData.text     || '',
            time:     commentData.time     ? parseInt(commentData.time, 10) : 0
        };

        /* v9.0: 令牌删除路径 */
        if (deleteToken && typeof SupabaseAdapter !== 'undefined' && SupabaseAdapter.deleteCommentWithToken) {
            SupabaseAdapter.deleteCommentWithToken(commentId, deleteToken).then(function(success) {
                if (success) {
                    if (typeof AuthManager !== 'undefined') AuthManager.removeDeleteToken(commentId);
                    _removeCommentFromUI(targetId, btn);
                    showSubmitToast('评论已删除', 2000);
                } else {
                    showSubmitToast('删除失败：令牌可能已失效', 4000);
                }
            }).catch(function(err) {
                console.warn('[v9.0] 令牌删除失败:', err);
                showSubmitToast('删除失败，请稍后重试', 4000);
            });
            return;
        }

        /* v9.0: 版主隐藏路径 */
        if (canModerate && !isAdmin && typeof SupabaseAdapter !== 'undefined' && SupabaseAdapter.moderateComment) {
            SupabaseAdapter.moderateComment(commentId, 'hide', '版主隐藏').then(function(success) {
                if (success) {
                    _removeCommentFromUI(targetId, btn);
                    showSubmitToast('评论已隐藏', 2000);
                } else {
                    showSubmitToast('隐藏失败', 4000);
                }
            });
            return;
        }

        /* 原有路径：管理员/本地删除 */
        if (typeof DataRepository !== 'undefined') {
            DataRepository.deleteComment(targetId, comment, { admin: isAdmin }).then(function(result) {
                var ok = result && (result.local || result === true);
                if (!ok) return;
                if (result.adminLocalOnly) {
                    showSubmitToast('已从本页移除；他人云端评论需在 Supabase Dashboard 删除', 5000);
                } else if (result.cloud === false && comment.id) {
                    showSubmitToast('已从本页移除；云端删除失败（可能已超过10分钟）', 4000);
                }
                /* UI 移除（按钮所在 item 淡出） */
                var item = btn ? btn.closest('.comment-item') : null;
                if (item) {
                    item.style.opacity = '0';
                    item.style.transform = 'translateX(20px)';
                    item.style.transition = 'all 0.3s ease';
                    setTimeout(function() {
                        item.remove();
                        var list = document.getElementById('comment-list-' + targetId);
                        var remaining = list ? list.querySelectorAll('.comment-item').length : 0;
                        if (list && remaining === 0) {
                            list.innerHTML = '<div class="comment-empty">还没有评论，来第一个留言吧 ~</div>';
                        }
                        /* 博文评论计数 -1 */
                        updatePostCommentCount(targetId, Math.max(0, remaining));
                    }, 300);
                } else {
                    renderComments(targetId);
                }
            });
        } else {
            /* 降级：仅本地删除 + 刷新 */
            var key = 'fxre_comments_' + targetId;
            try {
                var data = localStorage.getItem(key);
                if (data) {
                    var list = JSON.parse(data);
                    list = list.filter(function(c) {
                        return !(c.name === comment.name && c.text === comment.text && c.time === comment.time);
                    });
                    localStorage.setItem(key, JSON.stringify(list));
                }
            } catch(e) {}
            renderComments(targetId);
        }
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /* ===== Phase 3: Submission System ===== */
    function initSubmission() {
        var form = document.getElementById('submit-form');
        if (!form) return;

        var textarea = document.getElementById('submit-content');
        var counter = document.getElementById('submit-counter');
        if (textarea && counter) {
            textarea.addEventListener('input', function() {
                counter.textContent = textarea.value.length + ' / 2000';
            });
        }

        /* v9.0: 投稿标签选择器交互 */
        var submissionTagSelector = document.getElementById('submission-tag-selector');
        if (submissionTagSelector) {
            submissionTagSelector.addEventListener('click', function(e) {
                var chip = e.target.closest('.select-tag');
                if (!chip) return;
                e.preventDefault();
                /* 限制最多5个 */
                var activeCount = submissionTagSelector.querySelectorAll('.select-tag.active').length;
                if (!chip.classList.contains('active') && activeCount >= 5) {
                    showSubmitToast('最多选择5个标签', 2000);
                    return;
                }
                chip.classList.toggle('active');
            });
        }

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var rawName    = document.getElementById('submit-nickname').value.trim();
            var type       = document.getElementById('submit-type').value;
            var rawTitle   = document.getElementById('submit-title').value.trim();
            var rawContent = document.getElementById('submit-content').value.trim();

            if (__fxrePendingAttachment && __fxrePendingAttachment.url) {
                rawContent = rawContent + '\n\n[插图] ' + __fxrePendingAttachment.url;
            }

            /* --- 输入校验 --- */
            if (!rawName || !rawTitle || !rawContent) return;
            if (rawName.length > 20)    { showSubmitToast('昵称限20字以内'); return; }
            if (rawTitle.length > 100)  { showSubmitToast('标题限100字以内'); return; }
            if (rawContent.length > 2000) { showSubmitToast('内容限2000字以内'); return; }
            if (rawContent.length < 10)   { showSubmitToast('内容至少10个字～'); return; }

            /* R8: 封禁用户禁止投稿 */
            if (typeof AuthManager !== 'undefined' && AuthManager.isBanned && AuthManager.isBanned()) {
                showSubmitToast('账号已被封禁，无法投稿', 4000);
                return;
            }

            if (typeof SecurityShield !== 'undefined') {
                var sgName = SecurityShield.guardUserInput(rawName, 'submission_name');
                var sgTitle = SecurityShield.guardUserInput(rawTitle, 'submission_title');
                var sgContent = SecurityShield.guardUserInput(rawContent, 'submission_content');
                if (!sgName.ok || !sgTitle.ok || !sgContent.ok) {
                    showSubmitToast((sgName.reason || sgTitle.reason || sgContent.reason), 4000);
                    return;
                }
                rawName = sgName.text;
                rawTitle = sgTitle.text;
                rawContent = sgContent.text;
            }

            persistNicknameIfNeeded(rawName);

            /* --- 速率限制 --- */
            if (typeof RateLimiter !== 'undefined') {
                var rl = RateLimiter.checkSubmission();
                if (!rl.allowed) {
                    showSubmitToast(rl.reason, 4000);
                    return;
                }
                RateLimiter.recordSubmission();
            }

            /* v9.0: 客户端限流增强（冷却 + 字数校验） */
            if (typeof ClientRateLimiter !== 'undefined') {
                var clCheck = ClientRateLimiter.canSubmitWork(rawTitle, rawContent);
                if (!clCheck.allowed) {
                    showSubmitToast(clCheck.reason, 4000);
                    return;
                }
            }

            /* v9.0: 生成删除令牌（匿名用户） */
            var submissionDeleteToken = (typeof AuthManager !== 'undefined') ? AuthManager.generateToken() : null;

            /* v9.0: 获取选中的标签 */
            var selectedTags = [];
            var tagChips = document.querySelectorAll('#submission-tag-selector .select-tag.active');
            tagChips.forEach(function(chip) {
                selectedTags.push(chip.getAttribute('data-tag'));
            });
            if (selectedTags.length > 5) {
                showSubmitToast('最多选择5个标签');
                return;
            }

            /* 安全转义 */
            var name    = escapeHTML(rawName);
            var title   = escapeHTML(rawTitle);
            var content = escapeHTML(rawContent);

            var now = new Date();
            var newSub = {
                id: 'sub_' + now.getTime(),
                name: name,
                type: type,
                title: title,
                content: content,
                tags: selectedTags,
                time: now.getTime(),
                timeStr: now.getFullYear() + '-' +
                         String(now.getMonth() + 1).padStart(2, '0') + '-' +
                         String(now.getDate()).padStart(2, '0') + ' ' +
                         String(now.getHours()).padStart(2, '0') + ':' +
                         String(now.getMinutes()).padStart(2, '0'),
                likes: 0,
                liked: false
            };

            function _doSubmit(submissions) {
                submissions = Array.isArray(submissions) ? submissions : [];
                submissions.unshift(newSub);
                saveSubmissions(submissions);
                form.reset();
                clearUploadPreview();
                if (counter) counter.textContent = '0 / 2000';
                /* v9.0: 清除标签选择 */
                if (submissionTagSelector) {
                    submissionTagSelector.querySelectorAll('.select-tag.active').forEach(function(c) {
                        c.classList.remove('active');
                    });
                }
                showSubmitToast('作品提交成功！已发布到社区 ✨');
                renderCommunity();

                /* v9.0: 记录投稿限流 */
                if (typeof ClientRateLimiter !== 'undefined') {
                    ClientRateLimiter.recordSubmissionSent();
                }

                /* Phase 3: 同步到云端（附带删除令牌和标签） */
                if (typeof DataRepository !== 'undefined') {
                    var subExtraFields = {};
                    if (submissionDeleteToken) {
                        subExtraFields.delete_token = submissionDeleteToken;
                    }
                    if (selectedTags.length > 0) {
                        subExtraFields.tags = selectedTags;
                    }
                    DataRepository.addSubmission(newSub, Object.keys(subExtraFields).length > 0 ? subExtraFields : null)
                        .then(function(cloudRow) {
                            if (cloudRow && cloudRow.id && String(cloudRow.id) !== String(newSub.id)) {
                                var localId = newSub.id;
                                var latest = getSubmissionsSync();
                                for (var pi = 0; pi < latest.length; pi++) {
                                    var pItem = latest[pi];
                                    if (!pItem) continue;
                                    if (String(pItem.id) === String(localId)) {
                                        pItem.id = cloudRow.id;
                                        if (cloudRow.time) pItem.time = cloudRow.time;
                                        saveSubmissions(latest);
                                        break;
                                    }
                                }
                            }
                            if (cloudRow && cloudRow.id && submissionDeleteToken && typeof AuthManager !== 'undefined') {
                                AuthManager.storeDeleteToken(cloudRow.id, submissionDeleteToken);
                            }
                            if (cloudRow && cloudRow.id && selectedTags.length > 0 &&
                                typeof SupabaseAdapter !== 'undefined' && SupabaseAdapter.addSubmissionTags) {
                                SupabaseAdapter.addSubmissionTags(cloudRow.id, selectedTags)
                                    .catch(function(err) { console.warn('[v9.0] 标签同步失败:', err); });
                            }
                            renderCommunity();
                        })
                        .catch(function(err) { console.warn('[Main] 投稿云端同步失败:', err); });
                }
            }

            var result = getSubmissions();
            if (result && typeof result.then === 'function') {
                result.then(_doSubmit);
            } else {
                _doSubmit(result || []);
            }
        });
    }

    function getSubmissions() {
        if (typeof DataRepository !== 'undefined') return DataRepository.getSubmissions();
        var data = safeGetItem('fxre_submissions');
        if (data) { try { return JSON.parse(data); } catch(e) { return []; } }
        return [];
    }

    function saveSubmissions(submissions) {
        safeSetItem('fxre_submissions', JSON.stringify(submissions));
    }

    /** 同步读取 localStorage 中的投稿（不调云端，用于乐观更新后修正） */
    function getSubmissionsSync() {
        var data = safeGetItem('fxre_submissions');
        if (data) { try { return JSON.parse(data); } catch(e) { return []; } }
        return [];
    }

    function showSubmitToast(msg) {
        var toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;top:90px;left:50%;transform:translateX(-50%);' +
            'padding:14px 28px;border-radius:9999px;font-size:0.9rem;font-weight:600;z-index:9999;' +
            'background:linear-gradient(135deg,#FF6B9D,#6B8AFF);color:white;' +
            'box-shadow:0 8px 30px rgba(255,107,157,0.4);opacity:0;transition:opacity 0.3s,transform 0.3s;';
        toast.textContent = msg;
        document.body.appendChild(toast);
        requestAnimationFrame(function() {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });
        setTimeout(function() {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-10px)';
            setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
        }, 2800);
    }

    /* ===== Phase 3: Community Board ===== */
    var communityFilter = 'all';
    var communityPage = 0;
    var COMMUNITY_PAGE_SIZE = 12;

    function getDailyPickIndex(list) {
        if (!list.length) return 0;
        var now = new Date();
        var seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
        return seed % list.length;
    }

    function renderTodayPick(submissions) {
        var el = document.getElementById('today-pick');
        var body = document.getElementById('today-pick-body');
        if (!el || !body) return;
        if (!submissions || submissions.length === 0) {
            el.hidden = true;
            return;
        }
        var pick = submissions[getDailyPickIndex(submissions)];
        var excerpt = (typeof ContentUtils !== 'undefined')
            ? ContentUtils.previewText(pick.content, 160)
            : pick.content.substring(0, 160);
        body.innerHTML =
            '<h3 class="today-pick-title">' + escapeHTML(pick.title) + '</h3>' +
            '<div class="today-pick-meta">' + escapeHTML(pick.name) + ' · ' + pick.timeStr + '</div>' +
            '<p class="today-pick-excerpt">' + escapeHTML(excerpt) + '</p>' +
            '<button type="button" class="today-pick-link" data-pick-id="' + pick.id + '">查看作品 →</button>';
        el.hidden = false;
        var linkBtn = body.querySelector('.today-pick-link');
        if (linkBtn) {
            linkBtn.addEventListener('click', function() {
                var sid = linkBtn.getAttribute('data-pick-id');
                var card = document.querySelector('.community-card[data-id="' + sid + '"]');
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.classList.add('bookmark-highlight');
                    setTimeout(function() { card.classList.remove('bookmark-highlight'); }, 2000);
                } else {
                    showSubmitToast('作品可能在其他分页，请切换页码查看', 3500);
                }
            });
        }
    }

    function renderCommunityPagination(totalItems) {
        var nav = document.getElementById('community-pagination');
        if (!nav) return;
        var totalPages = Math.max(1, Math.ceil(totalItems / COMMUNITY_PAGE_SIZE));
        if (totalPages <= 1) {
            nav.hidden = true;
            nav.innerHTML = '';
            return;
        }
        if (communityPage >= totalPages) communityPage = totalPages - 1;
        nav.hidden = false;
        var html = '';
        if (communityPage > 0) {
            html += '<button type="button" class="community-page-btn" data-page="' + (communityPage - 1) + '">上一页</button>';
        }
        html += '<span class="community-page-info">' + (communityPage + 1) + ' / ' + totalPages + '</span>';
        if (communityPage < totalPages - 1) {
            html += '<button type="button" class="community-page-btn" data-page="' + (communityPage + 1) + '">下一页</button>';
        }
        nav.innerHTML = html;
        nav.querySelectorAll('.community-page-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                communityPage = parseInt(btn.getAttribute('data-page'), 10);
                renderCommunity();
                var section = document.getElementById('community-grid');
                if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    function openPublicCollectionView(collectionId) {
        var panel = document.getElementById('public-collection-panel');
        var titleEl = document.getElementById('public-collection-title');
        var descEl = document.getElementById('public-collection-desc');
        var listEl = document.getElementById('public-collection-list');
        var emptyEl = document.getElementById('public-collection-empty');
        if (!panel || typeof SupabaseAdapter === 'undefined' || !SupabaseAdapter.getPublicCollection) return;

        SupabaseAdapter.getPublicCollection(collectionId).then(function(data) {
            if (!data || !data.collection) {
                showSubmitToast('收藏夹不存在或未公开', 3500);
                return;
            }
            if (titleEl) titleEl.textContent = data.collection.name;
            if (descEl) descEl.textContent = data.collection.description || '来自星炬学院的精选收藏';
            if (!data.items.length) {
                if (listEl) listEl.innerHTML = '';
                if (emptyEl) emptyEl.hidden = false;
            } else {
                if (emptyEl) emptyEl.hidden = true;
                if (listEl) {
                    listEl.innerHTML = data.items.map(function(item) {
                        return '<li><button type="button" data-submission-id="' + item.submissionId + '">' +
                            '<strong>' + escapeHTML(item.title) + '</strong><br>' +
                            '<span style="opacity:0.6;font-size:0.8rem">' + escapeHTML(item.name) + '</span>' +
                            '</button></li>';
                    }).join('');
                    listEl.querySelectorAll('button[data-submission-id]').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            var sid = btn.getAttribute('data-submission-id');
                            panel.hidden = true;
                            location.hash = '#community';
                            setTimeout(function() {
                                var card = document.querySelector('.community-card[data-id="' + sid + '"]');
                                if (card) {
                                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    card.classList.add('bookmark-highlight');
                                    setTimeout(function() { card.classList.remove('bookmark-highlight'); }, 2000);
                                }
                            }, 300);
                        });
                    });
                }
            }
            panel.hidden = false;
        });
    }

    function handleDeepLinks() {
        var hash = location.hash || '';
        if (hash.indexOf('#collection-') === 0) {
            var id = parseInt(hash.replace('#collection-', ''), 10);
            if (!isNaN(id)) openPublicCollectionView(id);
        }
    }

    function handleSubmissionEdit(submissionId, card) {
        var numericId = parseInt(submissionId, 10);
        if (isNaN(numericId)) return;

        var titleEl = card.querySelector('.community-card-title');
        var contentEl = card.querySelector('.community-card-content');
        if (!titleEl || !contentEl) return;

        var currentTitle = titleEl.textContent;
        var currentContent = contentEl.getAttribute('data-full-content') || contentEl.textContent;

        var newTitle = prompt('编辑标题（24 小时内有效）', currentTitle);
        if (newTitle === null) return;
        newTitle = newTitle.trim();
        if (!newTitle) { showSubmitToast('标题不能为空', 3000); return; }

        var newContent = prompt('编辑正文', currentContent);
        if (newContent === null) return;
        newContent = newContent.trim();
        if (newContent.length < 10) { showSubmitToast('内容至少 10 字', 3000); return; }

        var token = (typeof AuthManager !== 'undefined') ? (AuthManager.getDeleteToken(numericId) || '') : '';

        if (typeof SupabaseAdapter === 'undefined' || !SupabaseAdapter.updateSubmissionWithToken) {
            showSubmitToast('云端未就绪', 3000);
            return;
        }

        SupabaseAdapter.updateSubmissionWithToken(numericId, token, newTitle, newContent)
            .then(function(result) {
                if (result && result.success) {
                    var subs = getSubmissionsSync();
                    for (var i = 0; i < subs.length; i++) {
                        if (String(subs[i].id) === String(numericId)) {
                            subs[i].title = escapeHTML(newTitle);
                            subs[i].content = escapeHTML(newContent);
                            break;
                        }
                    }
                    saveSubmissions(subs);
                    renderCommunity();
                    showSubmitToast('投稿已更新', 2000);
                } else {
                    showSubmitToast((result && result.reason) || '编辑失败', 4000);
                }
            });
    }

    function handleSubmissionDelete(submissionId) {
        var numericId = parseInt(submissionId, 10);
        if (isNaN(numericId)) return;
        if (!confirm('确定删除此投稿？删除后不可恢复。')) return;

        var token = (typeof AuthManager !== 'undefined') ? AuthManager.getDeleteToken(numericId) : null;

        function removeLocal() {
            var subs = getSubmissionsSync().filter(function(s) {
                return String(s.id) !== String(numericId);
            });
            saveSubmissions(subs);
            if (typeof AuthManager !== 'undefined') AuthManager.removeDeleteToken(numericId);
            renderCommunity();
            showSubmitToast('投稿已删除', 2000);
        }

        if (typeof SupabaseAdapter !== 'undefined' && SupabaseAdapter.deleteSubmissionWithToken) {
            SupabaseAdapter.deleteSubmissionWithToken(numericId, token || '').then(function(result) {
                var ok = result === true || (result && result.success === true);
                if (ok) removeLocal();
                else showSubmitToast((result && result.reason) || '删除失败，可能无权限或已超时', 4000);
            });
        } else {
            removeLocal();
        }
    }

    function initCommunity() {
        if (!__fxreCommunityInited) {
            __fxreCommunityInited = true;
            var filterBtns = document.querySelectorAll('.community-filter-btn');
            filterBtns.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    filterBtns.forEach(function(b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    communityFilter = btn.getAttribute('data-filter');
                    communityPage = 0;
                    renderCommunity();
                });
            });
        }
        renderCommunity();
    }

    function renderCommunity() {
        syncCloudBookmarks().finally(function() {
            var grid = document.getElementById('community-grid');
            var empty = document.getElementById('community-empty');
            var countEl = document.getElementById('community-count');
            if (!grid) return;

            var result = getSubmissions();
            if (result && typeof result.then === 'function') {
                result.then(function(submissions) {
                    _renderCommunityGrid(grid, empty, countEl, submissions);
                });
            } else {
                _renderCommunityGrid(grid, empty, countEl, result || []);
            }
        });
    }

    function _renderCommunityGrid(grid, empty, countEl, submissions) {
        var filtered = communityFilter === 'all'
            ? submissions
            : submissions.filter(function(s) { return s.type === communityFilter; });

        var activeTagChips = document.querySelectorAll('.tag-chip.active');
        var activeTags = [];
        activeTagChips.forEach(function(chip) {
            activeTags.push(chip.getAttribute('data-tag'));
        });
        if (activeTags.length > 0) {
            filtered = filtered.filter(function(s) {
                if (!s.tags || !Array.isArray(s.tags)) return false;
                return activeTags.every(function(tag) {
                    return s.tags.indexOf(tag) !== -1;
                });
            });
        }

        filtered = applyBookmarkFlags(filtered);
        var totalFiltered = filtered.length;

        if (countEl) countEl.textContent = totalFiltered;

        renderTodayPick(submissions);
        renderCommunityPagination(totalFiltered);

        if (filtered.length === 0) {
            reconcileCommunityGrid(grid, []);
            if (empty) empty.classList.add('show');
            return;
        }

        if (empty) empty.classList.remove('show');

        var pageStart = communityPage * COMMUNITY_PAGE_SIZE;
        var pageItems = filtered.slice(pageStart, pageStart + COMMUNITY_PAGE_SIZE);

        /* R19: 增量协调卡片节点，替代整网格 innerHTML 重建 */
        reconcileCommunityGrid(grid, pageItems);

        attachCommunityCardEvents();
        subscribeCommunityCommentRealtime(pageItems);
    }

    /* ===== R19: 投稿卡片构建 + 增量 DOM 协调（替代整网格 innerHTML 重建） ===== */
    var CHAR_COLOR_MAP = {
        '爱弥斯': 'var(--aimisi-pink)',
        '达妮娅': 'var(--denia-lavender)',
        '西格莉卡': 'var(--sigrica-green)',
        '琳奈': 'var(--linne-purple)',
        '莫宁': 'var(--mornye-red)',
        '洛瑟菈': 'var(--lucilla-gold)',
        '漂泊者': 'var(--drifter-blue)'
    };
    function charColorForSubmission(s) {
        if (!s || !s.tags || !Array.isArray(s.tags)) return '';
        for (var i = 0; i < s.tags.length; i++) {
            if (CHAR_COLOR_MAP[s.tags[i]]) return CHAR_COLOR_MAP[s.tags[i]];
        }
        return '';
    }
    function buildSubmissionCardHTML(s) {
        var typeLabels = { text: '文字', story: '故事', poem: '诗歌', art: '插画', music: '音乐' };
        var initial = s.name.charAt(0).toUpperCase();
        var bgColor = s.color || 'var(--color-pink)';
        var contentClass = 'community-card-content';
        var previewText = (typeof ContentUtils !== 'undefined')
            ? ContentUtils.previewText(s.content, 300)
            : s.content;
        var imgUrl = (typeof ContentUtils !== 'undefined')
            ? ContentUtils.extractImageUrl(s.content)
            : null;
        var expandBtn = '';
        if (s.content.length > 300) {
            expandBtn = '<button class="community-card-expand" data-action="expand">展开全文</button>';
        }
        var canEdit = (typeof AuthManager !== 'undefined') && AuthManager.canEditSubmission(s);
        var canDelete = (typeof AuthManager !== 'undefined') && AuthManager.canDeleteSubmission(s);
        var ownerActions = '';
        if (canEdit || canDelete) {
            ownerActions = '<div class="community-card-owner-actions">' +
                (canEdit ? '<button type="button" class="community-owner-btn" data-action="edit-submission">编辑</button>' : '') +
                (canDelete ? '<button type="button" class="community-owner-btn" data-action="delete-submission">删除</button>' : '') +
                '</div>';
        }
        var imgHtml = imgUrl
            ? '<img class="community-card-image" src="' + escapeHTML(imgUrl) + '" alt="" loading="lazy">'
            : '';
        var cardCharColor = charColorForSubmission(s);
        var cardCharStyle = cardCharColor ? ' style="--char:' + cardCharColor + '"' : '';
        return '<article class="community-card" data-id="' + s.id + '"' + cardCharStyle + '>' +
            '<div class="community-card-header">' +
            '<div class="community-card-avatar" style="background:' + bgColor + '">' + escapeHTML(initial) + '</div>' +
            '<div class="community-card-info">' +
            '<div class="community-card-author">' + escapeHTML(s.name) + '</div>' +
            '<div class="community-card-time">' + s.timeStr + '</div>' +
            '</div>' +
            '<span class="community-card-badge" data-type="' + s.type + '">' + (typeLabels[s.type] || s.type) + '</span>' +
            ownerActions +
            '</div>' +
            '<h3 class="community-card-title">' + escapeHTML(s.title) + '</h3>' +
            imgHtml +
            '<div class="' + contentClass + '" data-full-content="' + escapeHTML(s.content) + '">' + escapeHTML(previewText) + '</div>' +
            expandBtn +
            '<div class="community-card-actions">' +
            '<button class="community-card-action' + (s.liked ? ' liked' : '') + '" data-action="like">' +
            '<svg viewBox="0 0 24 24" fill="' + (s.liked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2">' +
            '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' +
            '</svg><span>' + s.likes + '</span></button>' +
            '<button class="community-card-action" data-action="comment">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
            '</svg><span>评论</span></button>' +
            '<button class="community-card-action bookmark-btn' + (s.bookmarked ? ' bookmarked' : '') + '" data-action="bookmark" data-submission-id="' + s.id + '" title="收藏">' +
            '<svg viewBox="0 0 24 24" fill="' + (s.bookmarked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2">' +
            '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>' +
            '</svg><span>收藏</span></button>' +
            (/^\d+$/.test(String(s.id))
                ? '<button class="community-card-action" data-action="report" data-report-type="submission" data-report-id="' + s.id + '" title="举报">⚑</button>'
                : '') +
            '</div>' +
            '<div class="community-card-comments" id="cc-comments-' + s.id + '">' +
            '<div class="comment-list" id="cc-list-' + s.id + '"></div>' +
            '<div class="comment-reply-bar" id="reply-bar-community_' + s.id + '" hidden>' +
            '<span class="comment-reply-label"></span>' +
            '<button type="button" class="comment-reply-cancel">取消回复</button></div>' +
            '<form class="comment-form" data-target="' + s.id + '">' +
            '<input type="text" class="comment-form-input comment-form-name" placeholder="昵称" maxlength="20" required>' +
            '<input type="text" class="comment-form-input" placeholder="写下你的评论……" maxlength="500" required>' +
            '<button type="submit" class="comment-submit-btn">发送</button>' +
            '</form>' +
            '</div>' +
            '</article>';
    }

    function buildSubmissionCardNode(s) {
        var html = buildSubmissionCardHTML(s);
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        var el = tmp.firstElementChild;
        if (el) el.__subHtml = html;
        return el;
    }

    function reconcileCommunityGrid(grid, pageItems) {
        pageItems = pageItems || [];
        var ids = {};
        pageItems.forEach(function(s) { ids[String(s.id)] = true; });
        grid.querySelectorAll('.community-card').forEach(function(card) {
            var id = card.getAttribute('data-id');
            if (id == null || !(String(id) in ids)) card.remove();
        });
        var existing = {};
        grid.querySelectorAll('.community-card').forEach(function(card) {
            existing[card.getAttribute('data-id')] = card;
        });
        var prev = null;
        pageItems.forEach(function(s) {
            var id = String(s.id);
            var fresh = buildSubmissionCardNode(s);
            if (!fresh) return;
            var node = existing[id];
            var inDom;
            if (node) {
                /* 用户正在该卡片内输入（回复/表单聚焦）时不替换，避免丢失草稿；下次整页渲染再同步 */
                var interacting = node.contains(document.activeElement) &&
                    node.querySelector('.comment-reply-bar:not([hidden]), .comment-form-input');
                if (interacting) {
                    inDom = node;
                } else if (node.__subHtml !== fresh.__subHtml) {
                    node.replaceWith(fresh);
                    inDom = fresh;
                } else {
                    inDom = node;
                }
            } else {
                if (prev) {
                    prev.after(fresh);
                } else {
                    var firstCard = grid.querySelector('.community-card');
                    if (firstCard && firstCard !== fresh) grid.insertBefore(fresh, firstCard);
                    else grid.appendChild(fresh);
                }
                inDom = fresh;
            }
            prev = inDom;
        });
    }

    function attachCommunityCardEvents() {
        document.querySelectorAll('.community-card:not([data-fxre-bound])').forEach(function(card) {
            card.setAttribute('data-fxre-bound', '1');
            var id = card.getAttribute('data-id');

            var likeBtn = card.querySelector('[data-action="like"]');
            if (likeBtn) {
                likeBtn.addEventListener('click', function() {
                    var cloudOk = /^\d+$/.test(String(id)) && typeof SupabaseAdapter !== 'undefined' && SupabaseAdapter.isAuthenticated();

                    function _doLike(submissions) {
                        submissions = Array.isArray(submissions) ? submissions : [];
                        for (var i = 0; i < submissions.length; i++) {
                            if (String(submissions[i].id) !== String(id)) continue;

                            var wasLiked = submissions[i].liked;
                            submissions[i].liked = !wasLiked;

                            /* 乐观更新本地计数 */
                            if (wasLiked) {
                                submissions[i].likes = Math.max(0, (submissions[i].likes || 1) - 1);
                            } else {
                                submissions[i].likes = (submissions[i].likes || 0) + 1;
                            }

                            saveSubmissions(submissions);

                            /* 云端同步 + 用返回值修正真实计数（G-10 修复） */
                            if (cloudOk) {
                                var numericId = parseInt(id, 10);
                                if (wasLiked) {
                                    SupabaseAdapter.unlikeSubmission(numericId).then(function(newLikes) {
                                        if (newLikes > 0) {
                                            /* 刷新本地为云端权威值 */
                                            var latest = getSubmissionsSync();
                                            for (var j = 0; j < latest.length; j++) {
                                                if (String(latest[j].id) === String(id)) {
                                                    latest[j].likes = newLikes;
                                                    saveSubmissions(latest);
                                                    break;
                                                }
                                            }
                                            renderCommunity();
                                        }
                                    });
                                } else {
                                    SupabaseAdapter.likeSubmission(numericId).then(function(newLikes) {
                                        if (newLikes > 0) {
                                            var latest = getSubmissionsSync();
                                            for (var j = 0; j < latest.length; j++) {
                                                if (String(latest[j].id) === String(id)) {
                                                    latest[j].likes = newLikes;
                                                    saveSubmissions(latest);
                                                    break;
                                                }
                                            }
                                            renderCommunity();
                                        }
                                    });
                                }
                            }

                            break;
                        }
                        renderCommunity();
                    }
                    var result = getSubmissions();
                    if (result && typeof result.then === 'function') {
                        result.then(_doLike);
                    } else {
                        _doLike(result || []);
                    }
                });
            }

            var commentBtn = card.querySelector('[data-action="comment"]');
            var commentArea = card.querySelector('.community-card-comments');
            if (commentBtn && commentArea) {
                commentBtn.addEventListener('click', function() {
                    commentArea.classList.toggle('open');
                    if (commentArea.classList.contains('open')) {
                        renderCommunityComments(id);
                    }
                });
            }

            /* v9.0: 书签收藏按钮 */
            var bookmarkBtn = card.querySelector('[data-action="bookmark"]');
            if (bookmarkBtn) {
                bookmarkBtn.addEventListener('click', function() {
                    var numericId = parseInt(id, 10);
                    var isBookmarked = bookmarkBtn.classList.contains('bookmarked');

                    /* 乐观更新 UI */
                    bookmarkBtn.classList.toggle('bookmarked');
                    var svg = bookmarkBtn.querySelector('svg');
                    if (svg) svg.setAttribute('fill', !isBookmarked ? 'currentColor' : 'none');

                    /* 云端同步 */
                    if (!isNaN(numericId) && typeof SupabaseAdapter !== 'undefined' && SupabaseAdapter.isAuthenticated()) {
                        SupabaseAdapter.toggleBookmark(numericId).then(function(result) {
                            if (result && result.success) {
                                try {
                                    var bookmarks = JSON.parse(localStorage.getItem('fxre_bookmarks') || '{}');
                                    if (result.action === 'removed') delete bookmarks[id];
                                    else bookmarks[id] = { time: Date.now(), cloud: true };
                                    localStorage.setItem('fxre_bookmarks', JSON.stringify(bookmarks));
                                } catch (e) {}
                                showSubmitToast(!isBookmarked ? '已收藏' : '已取消收藏', 1500);
                            } else if (result && result.reason) {
                                showSubmitToast(result.reason, 3000);
                                bookmarkBtn.classList.toggle('bookmarked');
                                if (svg) svg.setAttribute('fill', isBookmarked ? 'currentColor' : 'none');
                            }
                        }).catch(function(err) {
                            console.warn('[v9.0] 书签操作失败:', err);
                            /* 回滚 UI */
                            bookmarkBtn.classList.toggle('bookmarked');
                            if (svg) svg.setAttribute('fill', isBookmarked ? 'currentColor' : 'none');
                        });
                    } else {
                        /* 本地存储降级 */
                        var bookmarkKey = 'fxre_bookmarks';
                        try {
                            var bookmarks = JSON.parse(localStorage.getItem(bookmarkKey) || '{}');
                            if (isBookmarked) {
                                delete bookmarks[id];
                            } else {
                                bookmarks[id] = { time: Date.now() };
                            }
                            localStorage.setItem(bookmarkKey, JSON.stringify(bookmarks));
                            showSubmitToast(!isBookmarked ? '已收藏（本地）' : '已取消收藏', 1500);
                        } catch(e) {}
                    }
                });
            }

            var commentForm = card.querySelector('.comment-form[data-target]');
            if (commentForm) {
                commentForm.addEventListener('submit', function(e) {
                    e.preventDefault();
                    var nameInput = commentForm.querySelector('.comment-form-name');
                    var textInput = commentForm.querySelectorAll('.comment-form-input')[1];
                    var rawName = nameInput.value.trim();
                    var rawText = textInput.value.trim();

                    /* --- 输入校验 --- */
                    if (!rawName || !rawText) return;
                    if (rawName.length > 20) { showSubmitToast('昵称限20字以内'); return; }
                    if (rawText.length > 500) { showSubmitToast('评论限500字以内'); return; }
                    if (rawText.length < 2) { showSubmitToast('评论至少2个字～'); return; }

                    if (typeof SecurityShield !== 'undefined') {
                        var sgName = SecurityShield.guardUserInput(rawName, 'comment_name');
                        var sgText = SecurityShield.guardUserInput(rawText, 'comment_text');
                        if (!sgName.ok) { showSubmitToast(sgName.reason, 4000); return; }
                        if (!sgText.ok) { showSubmitToast(sgText.reason, 4000); return; }
                        rawName = sgName.text;
                        rawText = sgText.text;
                    }

                    persistNicknameIfNeeded(rawName);

                    var commTargetId = 'community_' + id;
                    var replyState = commentReplyState[commTargetId];
                    var parentId = replyState ? replyState.parentId : null;

                    /* --- 速率限制 --- */
                    if (typeof RateLimiter !== 'undefined') {
                        var rl = RateLimiter.checkComment('community_' + id);
                        if (!rl.allowed) {
                            showSubmitToast(rl.reason, 4000);
                            return;
                        }
                        RateLimiter.recordComment('community_' + id);
                    }

                    var name = escapeHTML(rawName);
                    var text = escapeHTML(rawText);

                    var commentsResult = getComments('community_' + id);
                    var list = document.getElementById('cc-list-' + id);
                    var submitCommunityComment = function(comments) {
                        var now = new Date();
                        comments.push({
                            name: name,
                            text: text,
                            time: now.getTime(),
                            timeStr: now.getMonth() + 1 + '月' + now.getDate() + '日 ' +
                                     String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
                            parentId: parentId || null
                        });
                        saveComments('community_' + id, comments);
                        if (list) _renderCommunityCommentsList(list, comments);
                        if (typeof DataRepository !== 'undefined') {
                            var extra = parentId ? { parent_id: parentId } : null;
                            DataRepository.addComment('community_' + id, { author: name, text: text }, extra)
                                .then(function() { renderCommunityComments(id); })
                                .catch(function(err) { console.warn('[Main] 社区评论云端同步失败:', err); });
                        }
                        textInput.value = '';
                        clearCommentReplyMode(commTargetId, commentForm);
                    };
                    if (commentsResult && typeof commentsResult.then === 'function') {
                        commentsResult.then(submitCommunityComment);
                    } else {
                        submitCommunityComment(commentsResult || []);
                    }
                });
            }

            var expandBtn = card.querySelector('[data-action="expand"]');
            if (expandBtn) {
                expandBtn.addEventListener('click', function() {
                    var content = card.querySelector('.community-card-content');
                    if (content) {
                        var full = content.getAttribute('data-full-content') || content.textContent;
                        var isExpanded = content.classList.contains('expanded');
                        if (isExpanded) {
                            var preview = (typeof ContentUtils !== 'undefined')
                                ? ContentUtils.previewText(full, 300)
                                : full.substring(0, 300);
                            content.textContent = preview;
                            content.classList.remove('expanded');
                            expandBtn.textContent = '展开全文';
                        } else {
                            content.textContent = full;
                            content.classList.add('expanded');
                            expandBtn.textContent = '收起';
                        }
                    }
                });
            }

            var editBtn = card.querySelector('[data-action="edit-submission"]');
            if (editBtn) {
                editBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    handleSubmissionEdit(id, card);
                });
            }

            var deleteBtn = card.querySelector('[data-action="delete-submission"]');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    handleSubmissionDelete(id);
                });
            }
        });

        loadUserProfile();
    }

    function renderCommunityComments(id) {
        var list = document.getElementById('cc-list-' + id);
        if (!list) return;
        var result = getComments('community_' + id);
        if (result && typeof result.then === 'function') {
            result.then(function(comments) {
                _renderCommunityCommentsList(list, comments);
            });
        } else {
            _renderCommunityCommentsList(list, result || []);
        }
    }

    function _renderCommunityCommentsList(list, comments) {
        /* R19: 增量协调，替代整列表 innerHTML 重绘 */
        var subId = list.id.replace('cc-list-', '');
        var targetId = 'community_' + subId;
        reconcileCommentThread(list, comments, { targetId: targetId, communityListId: list.id });
    }

    function updateSyncStatus() {
        var el = document.getElementById('sync-status');
        if (!el) return;
        if (typeof SupabaseAdapter === 'undefined') {
            el.innerHTML = '\u2601 \u672c\u5730\u6a21\u5f0f';
            el.className = 'footer-sync';
            el.title = '\u672a\u52a0\u8f7d\u4e91\u7aef\u6a21\u5757';
            return;
        }
        var status = SupabaseAdapter.getStatus();
        var provider = (typeof DataRepository !== 'undefined') ? DataRepository.getProvider() : 'localStorage';
        var html = '';
        var cls = 'footer-sync';

        if (!status.configValid) {
            html = '\u2601 \u672a\u914d\u7f6e\u4e91\u7aef';
            cls += ' status-offline';
        } else if (!status.ready) {
            html = '\u2601 \u4e91\u7aef\u672a\u5c31\u7eea';
            cls += ' status-offline';
            if (status.error) {
                el.title = '\u9519\u8bef: ' + status.error;
            }
        } else if (!status.user) {
            html = '\u26a0 \u4e91\u7aef\u672a\u8ba4\u8bc1';
            cls += ' status-error';
            el.title = '\u8ba4\u8bc1\u5931\u8d25\uff0c\u70b9\u51fb\u67e5\u770b\u8bca\u65ad \u2192';
        } else {
            html = '\u2705 \u4e91\u7aef\u5728\u7ebf';
            cls += ' status-online';
            if (status.pending > 0) {
                html += ' \xb7 \u5f85\u540c\u6b65: ' + status.pending;
                el.title = '\u6709 ' + status.pending + ' \u6761\u672c\u5730\u5185\u5bb9\u5f85\u4e0a\u4f20\uff0c\u70b9\u51fb\u53f3\u4e0b\u89d2 \ud83d\udd04 \u540c\u6b65';
            }
        }

        /* 管理员标识 */
        if (typeof AdminAuth !== 'undefined' && AdminAuth.isAdmin()) {
            html = '\ud83d\udee1 ' + html + ' \xb7 \u7ba1\u7406\u5458';
        }

        /* v9.0 AuthManager 角色 */
        if (typeof AuthManager !== 'undefined' && AuthManager.session.role === 'admin') {
            html = '\ud83d\udee1 ' + html + ' \xb7 \u7ba1\u7406\u5458(DB)';
        } else if (typeof AuthManager !== 'undefined' && AuthManager.session.role === 'moderator') {
            html += ' \xb7 \u7248\u4e3b';
        }

        el.innerHTML = html;
        el.className = cls;
        el.dataset.diagnostic = JSON.stringify({
            provider: provider,
            ready: status.ready,
            user: status.user,
            pending: status.pending,
            error: status.error,
            time: new Date().toISOString()
        });

        if (typeof SyncManager !== 'undefined' && SyncManager.refreshPendingIndicator) {
            SyncManager.refreshPendingIndicator();
        }
    }

    function initSyncStatus() {
        var el = document.getElementById('sync-status');
        if (!el) return;
        el.style.cursor = 'pointer';
        el.addEventListener('click', function() {
            var status = (typeof SupabaseAdapter !== 'undefined') ? SupabaseAdapter.getStatus() : null;
            if (status && status.ready && !status.user) {
                /* 认证失败 → 弹出具体指引 */
                showSubmitToast('\u2601 \u4e91\u7aef\u8ba4\u8bc1\u5931\u8d25\uff01\u8bf7\u5230 Supabase Dashboard \u2192 Authentication \u2192 Settings \u2192 \u542f\u7528 Anonymous Sign-ins', 6000);
                return;
            }
            var diag = el.dataset.diagnostic || '{}';
            try {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(diag).then(function() {
                        showSubmitToast('\u8bca\u65ad\u4fe1\u606f\u5df2\u590d\u5236 \u2713');
                    });
                } else {
                    var ta = document.createElement('textarea');
                    ta.value = diag;
                    ta.style.position = 'fixed'; ta.style.left = '-9999px';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    showSubmitToast('\u8bca\u65ad\u4fe1\u606f\u5df2\u590d\u5236 \u2713');
                }
            } catch(e) {}
        });

        /* 双击页脚 → 管理员登录 */
        el.addEventListener('dblclick', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof AdminAuth === 'undefined') {
                alert('管理员模块未加载');
                return;
            }
            if (AdminAuth.isAdmin()) {
                if (confirm('当前已是管理员模式，要退出吗？')) {
                    AdminAuth.logout();
                    updateSyncStatus();
                    showSubmitToast('已退出管理员模式');
                    /* 刷新评论区以隐藏删除按钮 */
                    document.querySelectorAll('.comment-area').forEach(function(area) {
                        var id = area.id.replace('comments-', '');
                        renderComments(id);
                    });
                }
            } else {
                AdminAuth.openLoginModal(function(success) {
                    if (success) {
                        updateSyncStatus();
                        if (typeof AdminPanel !== 'undefined') AdminPanel.updateNavButton();
                        showSubmitToast('\u2705 \u7ba1\u7406\u5458\u6a21\u5f0f\u5df2\u5f00\u542f\uff0c\u53ef\u5220\u9664\u4efb\u610f\u8bc4\u8bba');
                        /* 刷新评论区以显示删除按钮 */
                        document.querySelectorAll('.comment-area').forEach(function(area) {
                            var id = area.id.replace('comments-', '');
                            renderComments(id);
                        });
                    }
                });
            }
        });

        /* 长按 800ms 触发管理员登录（移动端友好，替代不可靠的双击） */
        var __adminPressTimer = null;
        function __startAdminPress() {
            if (__adminPressTimer) return;
            __adminPressTimer = setTimeout(function() {
                __adminPressTimer = null;
                if (typeof AdminAuth === 'undefined') { alert('管理员模块未加载'); return; }
                AdminAuth.openLoginModal(function(success) {
                    if (success) {
                        updateSyncStatus();
                        if (typeof AdminPanel !== 'undefined') AdminPanel.updateNavButton();
                        showSubmitToast('✅ 管理员模式已开启，可删除任意评论');
                        document.querySelectorAll('.comment-area').forEach(function(area) {
                            var id = area.id.replace('comments-', '');
                            renderComments(id);
                        });
                    }
                });
            }, 800);
        }
        function __cancelAdminPress() {
            if (__adminPressTimer) { clearTimeout(__adminPressTimer); __adminPressTimer = null; }
        }
        el.addEventListener('touchstart', __startAdminPress, { passive: true });
        el.addEventListener('touchend', __cancelAdminPress);
        el.addEventListener('touchcancel', __cancelAdminPress);
        el.addEventListener('mousedown', __startAdminPress);
        el.addEventListener('mouseup', __cancelAdminPress);
        el.addEventListener('mouseleave', __cancelAdminPress);

        /* 页脚同步按钮已移至右下角 SyncManager 指示器 */
        updateSyncStatus();
        setInterval(updateSyncStatus, 5000);
    }

    var __fxreRealtimeSetup = false;
    var __fxreAuthStateInit = false;

    /**
     * 确保已认证并启用 Realtime（认证延迟 / 邮箱登录后重试）
     */
    function ensureCloudConnected() {
        if (typeof SupabaseAdapter === 'undefined') return Promise.resolve(false);

        return SupabaseAdapter.refreshSession()
            .then(function() { return SupabaseAdapter.ensureAuth(); })
            .then(function(user) {
                if (!user) return false;
                if (!__fxreAuthStateInit) {
                    initAuthState();
                    __fxreAuthStateInit = true;
                }
                if (!__fxreRealtimeSetup) {
                    setupCloudRealtime();
                    __fxreRealtimeSetup = true;
                }
                updateSyncStatus();
                return true;
            })
            .catch(function() { return false; });
    }

    function finishSyncUI(btn) {
        if (btn) {
            btn.classList.remove('syncing');
            btn.disabled = false;
        }
        updateSyncStatus();
    }

    /**
     * 全量云端同步：上传 pending + 补传本地-only + 拉取全部评论区 + 刷新 UI
     */
    function performFullCloudSync(btn) {
        if (typeof SupabaseAdapter === 'undefined') {
            showSubmitToast('\u2601 \u4e91\u7aef\u6a21\u5757\u672a\u52a0\u8f7d\uff0c\u65e0\u6cd5\u540c\u6b65');
            return Promise.resolve();
        }

        var status = SupabaseAdapter.getStatus();
        if (!status.configValid) {
            showSubmitToast('\u2601 Supabase \u672a\u914d\u7f6e\uff0c\u65e0\u6cd5\u540c\u6b65');
            return Promise.resolve();
        }
        if (!status.ready) {
            showSubmitToast('\u26a0 \u4e91\u7aef\u672a\u5c31\u7eea\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5');
            return Promise.resolve();
        }

        if (typeof SecurityShield !== 'undefined') {
            var syncGuard = SecurityShield.guardSyncAction();
            if (!syncGuard.ok) {
                showSubmitToast(syncGuard.reason, 4000);
                return Promise.resolve();
            }
        }

        if (btn) {
            btn.classList.add('syncing');
            btn.disabled = true;
        }
        if (typeof SyncManager !== 'undefined') {
            SyncManager.setState(SyncManager.STATE.SYNCING);
        }

        showSubmitToast('\ud83d\udd04 \u6b63\u5728\u540c\u6b65\uff08\u4e0a\u4f20 + \u62c9\u53d6\u2026\uff09');

        return ensureCloudConnected().then(function(connected) {
            if (!connected) {
                showSubmitToast('\u26a0 \u4e91\u7aef\u672a\u8ba4\u8bc1\uff01\u8bf7\u5230 Supabase \u2192 Authentication \u2192 \u542f\u7528 Anonymous Sign-ins', 6000);
                throw new Error('not_authenticated');
            }
            if (typeof DataRepository !== 'undefined' && DataRepository.fullCloudSync) {
                return DataRepository.fullCloudSync();
            }
            return SupabaseAdapter.syncPendingQueue().then(function(s) {
                return { pushStats: s, pulledTargets: 0 };
            });
        }).then(function(result) {
            var stats = result.pushStats || result;
            var uploaded = stats.synced || 0;
            var failed = stats.failed || stats.remaining || 0;
            var quotaSkipped = stats.quotaSkipped || 0;

            document.querySelectorAll('.comment-area').forEach(function(area) {
                var id = area.id.replace('comments-', '');
                renderComments(id);
            });
            renderCommunity();

            if (typeof SyncManager !== 'undefined') {
                var errMsg = (stats.errors && stats.errors[0]) ? stats.errors[0].error : '';
                SyncManager.setLastSyncResult({
                    time: Date.now(),
                    uploaded: uploaded,
                    failed: failed,
                    quotaSkipped: quotaSkipped,
                    pulled: result.pulledTargets || 0,
                    errorMsg: failed > 0 ? errMsg : ''
                });
                if (SyncManager.getState() === SyncManager.STATE.SYNCING) {
                    SyncManager.setState(__fxreRealtimeSetup ? SyncManager.STATE.REALTIME : SyncManager.STATE.OFFLINE);
                }
            }

            updateSyncStatus();

            if (failed > 0) {
                var errMsg = (stats.errors && stats.errors[0]) ? stats.errors[0].error : '';
                showSubmitToast('\u26a0 \u540c\u6b65\u7ed3\u675f\uff1a\u6210\u529f ' + uploaded + ' \u6761\uff0c\u5931\u8d25 ' + failed + ' \u6761' +
                    (quotaSkipped > 0 ? '\uff0c\u914d\u989d\u9650\u5236\u8df3\u8fc7 ' + quotaSkipped + ' \u6761' : '') +
                    (errMsg ? '\uff08' + errMsg + '\uff09' : ''), 6000);
            } else if (quotaSkipped > 0) {
                showSubmitToast('\u26a0 \u540c\u6b65\u5b8c\u6210\uff0c' + quotaSkipped + ' \u6761\u56e0\u914d\u989d\u9650\u5236\u672a\u4e0a\u4f20', 5000);
            } else if (uploaded > 0) {
                showSubmitToast('\u2705 \u5df2\u4e0a\u4f20 ' + uploaded + ' \u6761\u5230\u4e91\u7aef', 3000);
            } else {
                showSubmitToast('\u2705 \u5df2\u4ece\u4e91\u7aef\u62c9\u53d6\u6700\u65b0\u6570\u636e', 3000);
            }
        }).catch(function(err) {
            if (err && err.message !== 'not_authenticated') {
                console.warn('[Sync] \u5168\u91cf\u540c\u6b65\u5931\u8d25:', err);
                console.error('[Sync] \u5168\u91cf\u540c\u6b65\u9519\u8bef\u5806\u6808:', err && err.stack ? err.stack : '\u65e0\u5806\u6808');
                showSubmitToast('\u274c \u540c\u6b65\u5931\u8d25\uff1a' + (err.message || '\u672a\u77e5\u9519\u8bef'), 5000);
            }
        }).finally(function() {
            finishSyncUI(btn);
        });
    }

    function handleManualSync(btn) {
        return performFullCloudSync(btn);
    }

    /**
     * v9.0: 认证状态初始化
     * - 设置 onAuthStateChange 监听器
     * - 从 Supabase 获取当前用户并更新 AuthManager
     * - 从 profiles 表获取角色
     * - 更新 UI（auth-status-text / auth-upgrade-toggle）
     */
    function initAuthState() {
        if (__fxreAuthStateInit) return;
        if (!window.supabaseClient || typeof AuthManager === 'undefined') return;
        __fxreAuthStateInit = true;

        /* 监听认证状态变化 */
        supabaseClient.auth.onAuthStateChange(function(event, session) {
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                if (session && session.user) {
                    AuthManager.updateSession(session.user);
                    /* 从 profiles 获取角色 */
                    AuthManager.fetchRole().then(function(role) {
                        return (AuthManager.ensureProfile ? AuthManager.ensureProfile() : Promise.resolve()).then(function() {
                            return loadUserProfile();
                        }).then(function() {
                            updateAuthUI(session.user, role);
                        });
                    }).catch(function() {
                        loadUserProfile().then(function() {
                            updateAuthUI(session.user, null);
                        });
                    });
                }
            } else if (event === 'SIGNED_OUT') {
                AuthManager.updateSession(null);
                updateAuthUI(null, null);
                /* 重新匿名登录 */
                if (typeof SupabaseAdapter !== 'undefined') {
                    SupabaseAdapter.ensureAuth().then(function() {
                        if (typeof SyncManager !== 'undefined') SyncManager.manualRefresh();
                    });
                }
            } else if (event === 'TOKEN_REFRESHED') {
                if (session && session.user) {
                    AuthManager.updateSession(session.user);
                }
            }
        });

        /* 初始状态检查 */
        var user = SupabaseAdapter.getCurrentUser();
        if (user) {
            AuthManager.updateSession(user);
            AuthManager.fetchRole().then(function(role) {
                return (AuthManager.ensureProfile ? AuthManager.ensureProfile() : Promise.resolve()).then(function() {
                    return loadUserProfile();
                }).then(function() {
                    updateAuthUI(user, role);
                });
            }).catch(function() {
                loadUserProfile().then(function() {
                    updateAuthUI(user, null);
                });
            });
        } else {
            updateAuthUI(null, null);
        }
    }

    /**
     * v9.1: 更新认证 UI（投稿区摘要 + 导航账号面板）
     */
    function isRegisteredUser(user) {
        /* 已绑邮箱即显示账号态（含待确认） */
        return !!(user && user.email);
    }

    function setAccountPanelError(msg) {
        var errEl = document.getElementById('account-panel-error');
        if (!errEl) return;
        if (msg) {
            errEl.textContent = msg;
            errEl.hidden = false;
        } else {
            errEl.textContent = '';
            errEl.hidden = true;
        }
    }

    function openAccountPanel(tab) {
        var wrap = document.getElementById('nav-account');
        var panel = document.getElementById('account-panel');
        var btn = document.getElementById('nav-account-btn');
        if (!wrap || !panel || !btn) return;
        panel.hidden = false;
        wrap.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        if (tab) switchAccountTab(tab);
        setAccountPanelError('');
    }

    function closeAccountPanel() {
        var wrap = document.getElementById('nav-account');
        var panel = document.getElementById('account-panel');
        var btn = document.getElementById('nav-account-btn');
        if (!wrap || !panel || !btn) return;
        panel.hidden = true;
        wrap.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        setAccountPanelError('');
    }

    function switchAccountTab(tab) {
        var tabs = document.querySelectorAll('.account-tab');
        var registerPanel = document.getElementById('account-tab-register');
        var loginPanel = document.getElementById('account-tab-login');
        tabs.forEach(function(t) {
            var active = t.getAttribute('data-tab') === tab;
            t.classList.toggle('active', active);
            t.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        if (registerPanel) registerPanel.hidden = tab !== 'register';
        if (loginPanel) loginPanel.hidden = tab !== 'login';
        setAccountPanelError('');
    }

    function refreshAccountPanel(user, role) {
        var guest = document.getElementById('account-panel-guest');
        var userPane = document.getElementById('account-panel-user');
        var roleEl = document.getElementById('account-user-role');
        var emailEl = document.getElementById('account-user-email');
        var confirmHint = document.getElementById('account-confirm-hint');
        var navLabel = document.getElementById('nav-account-label');
        var registered = isRegisteredUser(user) || !!(user && user.email && typeof AuthManager !== 'undefined' && AuthManager.session && !AuthManager.session.isAnonymous);

        if (registered) {
            if (guest) guest.hidden = true;
            if (userPane) userPane.hidden = false;
            var roleLabels = { user: '注册用户', moderator: '版主', admin: '管理员' };
            var label = roleLabels[role] || '注册用户';
            if (roleEl) roleEl.textContent = label;
            if (emailEl) emailEl.textContent = user.email || '';
            var pending = (typeof AuthManager !== 'undefined' && AuthManager.needsEmailConfirm)
                ? AuthManager.needsEmailConfirm(user)
                : !(user.email_confirmed_at || user.confirmed_at);
            if (confirmHint) confirmHint.hidden = !pending;
            if (navLabel) navLabel.textContent = '已登录';

            /* 管理员按钮状态 */
            var adminLoginBtn = document.getElementById('account-admin-login-btn');
            var adminLogoutBtn = document.getElementById('account-admin-logout-btn');
            var adminPanelBtn = document.getElementById('account-admin-panel-btn');
            var isDbStaff = role === 'moderator' || role === 'admin';
            var isTmpAdmin = typeof AdminAuth !== 'undefined' && AdminAuth.isAdmin();
            if (adminLoginBtn) adminLoginBtn.hidden = isDbStaff || isTmpAdmin;
            if (adminLogoutBtn) adminLogoutBtn.hidden = !isTmpAdmin || isDbStaff;
            if (adminPanelBtn) adminPanelBtn.hidden = !(isDbStaff || isTmpAdmin);
        } else {
            if (guest) guest.hidden = false;
            if (userPane) userPane.hidden = true;
            if (confirmHint) confirmHint.hidden = true;
            if (navLabel) navLabel.textContent = '账号';
        }
    }

    function updateAuthUI(user, role) {
        var statusText = document.getElementById('auth-status-text');
        var upgradeToggle = document.getElementById('auth-upgrade-toggle');
        var statusBar = document.getElementById('auth-status');
        var roleLabels = { user: '注册用户', moderator: '版主', admin: '管理员' };

        if (user && role && role !== 'anonymous' && (isRegisteredUser(user) || user.email)) {
            var label = roleLabels[role] || '注册用户';
            var email = user.email || '';
            if (statusText) statusText.textContent = label + (email ? ' · ' + email : '');
            if (upgradeToggle) {
                upgradeToggle.style.display = 'inline-block';
                upgradeToggle.textContent = '账号';
            }
            if (statusBar) {
                statusBar.classList.toggle('auth-registered', true);
                statusBar.classList.toggle('auth-admin', role === 'admin');
            }
        } else if (user && user.email && user.is_anonymous === false) {
            if (statusText) statusText.textContent = '注册用户 · ' + user.email;
            if (upgradeToggle) {
                upgradeToggle.style.display = 'inline-block';
                upgradeToggle.textContent = '账号';
            }
            if (statusBar) {
                statusBar.classList.add('auth-registered');
                statusBar.classList.remove('auth-admin');
            }
        } else {
            if (statusText) statusText.textContent = '匿名用户';
            if (upgradeToggle) {
                upgradeToggle.style.display = 'inline-block';
                upgradeToggle.textContent = '打开账号';
            }
            if (statusBar) {
                statusBar.classList.remove('auth-registered', 'auth-admin');
            }
        }

        refreshAccountPanel(user, role || (typeof AuthManager !== 'undefined' ? AuthManager.session.role : 'user'));
        updateSyncStatus();
        if (typeof AdminPanel !== 'undefined') AdminPanel.updateNavButton();
    }

    function afterAuthSuccess(user, toastMsg) {
        if (typeof AuthManager !== 'undefined' && AuthManager.fetchRole) {
            AuthManager.fetchRole().then(function(role) {
                return loadUserProfile().then(function() {
                    updateAuthUI(user, role);
                });
            }).catch(function() {
                loadUserProfile().then(function() {
                    updateAuthUI(user, 'user');
                });
            });
        } else {
            loadUserProfile().then(function() {
                updateAuthUI(user, 'user');
            });
        }
        if (toastMsg) showSubmitToast(toastMsg, 4000);
        syncCloudBookmarks().then(function() { renderCommunity(); });
        if (typeof SupabaseAdapter !== 'undefined' && SupabaseAdapter.refreshSession) {
            SupabaseAdapter.refreshSession();
        }
    }

    function initAccountPanel() {
        var wrap = document.getElementById('nav-account');
        var btn = document.getElementById('nav-account-btn');
        var panel = document.getElementById('account-panel');
        if (!wrap || !btn || !panel) return;

        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (panel.hidden) openAccountPanel();
            else closeAccountPanel();
        });

        document.querySelectorAll('.account-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                switchAccountTab(tab.getAttribute('data-tab'));
            });
        });

        document.addEventListener('click', function(e) {
            if (!panel.hidden && !wrap.contains(e.target)) closeAccountPanel();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !panel.hidden) closeAccountPanel();
        });

        var statusBar = document.getElementById('auth-status');
        var openBtn = document.getElementById('auth-upgrade-toggle');
        function openFromSubmit(e) {
            if (e) e.preventDefault();
            openAccountPanel('upgrade');
            btn.focus();
        }
        if (openBtn) openBtn.addEventListener('click', openFromSubmit);
        if (statusBar) {
            statusBar.addEventListener('click', function(e) {
                if (e.target && e.target.id === 'auth-upgrade-toggle') return;
                openFromSubmit(e);
            });
        }

        var registerSubmit = document.getElementById('account-register-submit');
        if (registerSubmit) {
            registerSubmit.addEventListener('click', function() {
                if (typeof AuthManager === 'undefined') {
                    setAccountPanelError('认证模块未加载');
                    return;
                }
                var email = (document.getElementById('account-register-email') || {}).value || '';
                var password = (document.getElementById('account-register-password') || {}).value || '';
                var password2 = (document.getElementById('account-register-password2') || {}).value || '';
                email = email.trim();
                if (!email || password.length < 6) {
                    setAccountPanelError('邮箱必填，密码至少 6 位');
                    return;
                }
                if (password !== password2) {
                    setAccountPanelError('两次密码不一致');
                    return;
                }
                registerSubmit.disabled = true;
                setAccountPanelError('');
                AuthManager.registerUser(email, password).then(function(result) {
                    registerSubmit.disabled = false;
                    if (!result || !result.success) {
                        setAccountPanelError((result && result.error) || '注册失败');
                        return;
                    }
                    afterAuthSuccess(result.user, result.message || '注册成功');
                    if (!result.needsConfirmation) closeAccountPanel();
                }).catch(function(err) {
                    registerSubmit.disabled = false;
                    setAccountPanelError((err && err.message) || '注册失败');
                });
            });
        }

        var loginSubmit = document.getElementById('account-login-submit');
        if (loginSubmit) {
            loginSubmit.addEventListener('click', function() {
                if (typeof AuthManager === 'undefined') {
                    setAccountPanelError('认证模块未加载');
                    return;
                }
                var email = ((document.getElementById('account-login-email') || {}).value || '').trim();
                var password = (document.getElementById('account-login-password') || {}).value || '';
                if (!email || !password) {
                    setAccountPanelError('请填写邮箱和密码');
                    return;
                }
                loginSubmit.disabled = true;
                setAccountPanelError('');
                AuthManager.signIn(email, password).then(function(result) {
                    loginSubmit.disabled = false;
                    if (!result || !result.success) {
                        setAccountPanelError((result && result.error) || '登录失败');
                        return;
                    }
                    afterAuthSuccess(result.user, result.needsConfirmation
                        ? '已登录，请查收确认邮件完成验证'
                        : '登录成功');
                    if (!result.needsConfirmation) closeAccountPanel();
                }).catch(function(err) {
                    loginSubmit.disabled = false;
                    setAccountPanelError((err && err.message) || '登录失败');
                });
            });
        }

        var signOutBtn = document.getElementById('account-signout-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', function() {
                if (typeof AuthManager === 'undefined') return;
                signOutBtn.disabled = true;
                AuthManager.signOut().then(function(result) {
                    signOutBtn.disabled = false;
                    if (!result || !result.success) {
                        setAccountPanelError((result && result.error) || '退出失败');
                        return;
                    }
                    updateAuthUI(result.user, result.user ? 'anonymous' : null);
                    if (typeof AuthManager !== 'undefined' && result.user) {
                        AuthManager.updateSession(result.user);
                        AuthManager.fetchRole().then(function(role) {
                            updateAuthUI(result.user, role);
                        }).catch(function() {
                            updateAuthUI(result.user, null);
                        });
                    }
                    showSubmitToast('已退出，已切换为匿名模式', 3000);
                    closeAccountPanel();
                    if (typeof SupabaseAdapter !== 'undefined' && SupabaseAdapter.refreshSession) {
                        SupabaseAdapter.refreshSession();
                    }
                }).catch(function(err) {
                    signOutBtn.disabled = false;
                    setAccountPanelError((err && err.message) || '退出失败');
                });
            });
        }

        var resendBtn = document.getElementById('account-resend-btn');
        if (resendBtn) {
            resendBtn.addEventListener('click', function() {
                if (typeof AuthManager === 'undefined') return;
                resendBtn.disabled = true;
                AuthManager.resendConfirmation().then(function(result) {
                    resendBtn.disabled = false;
                    if (!result || !result.success) {
                        setAccountPanelError((result && result.error) || '发送失败');
                        return;
                    }
                    showSubmitToast(result.message || '确认邮件已发送', 4000);
                    setAccountPanelError('');
                }).catch(function(err) {
                    resendBtn.disabled = false;
                    setAccountPanelError((err && err.message) || '发送失败');
                });
            });
        }

        var forgotBtn = document.getElementById('account-forgot-btn');
        if (forgotBtn) {
            forgotBtn.addEventListener('click', function() {
                if (typeof AuthManager === 'undefined') {
                    setAccountPanelError('认证模块未加载');
                    return;
                }
                var email = ((document.getElementById('account-login-email') || {}).value || '').trim();
                if (!email) {
                    setAccountPanelError('请先填写登录邮箱');
                    return;
                }
                forgotBtn.disabled = true;
                setAccountPanelError('');
                AuthManager.resetPassword(email).then(function(result) {
                    forgotBtn.disabled = false;
                    if (!result || !result.success) {
                        setAccountPanelError((result && result.error) || '发送失败');
                        return;
                    }
                    showSubmitToast(result.message || '重置邮件已发送', 4000);
                }).catch(function(err) {
                    forgotBtn.disabled = false;
                    setAccountPanelError((err && err.message) || '发送失败');
                });
            });
        }

        /* 账号面板：管理员登录 / 退出 / 管理后台 */
        var adminLoginBtn = document.getElementById('account-admin-login-btn');
        if (adminLoginBtn) {
            adminLoginBtn.addEventListener('click', function() {
                if (typeof AdminAuth === 'undefined') {
                    setAccountPanelError('管理员模块未加载');
                    return;
                }
                AdminAuth.openLoginModal(function(ok) {
                    if (!ok) return;
                    var user = (typeof AuthManager !== 'undefined' && AuthManager.session)
                        ? { email: AuthManager.session.email || '' }
                        : { email: '' };
                    var role = (typeof AuthManager !== 'undefined' && AuthManager.session)
                        ? AuthManager.session.role : 'user';
                    refreshAccountPanel(user, role);
                    if (typeof AdminPanel !== 'undefined') AdminPanel.updateNavButton();
                    showSubmitToast('管理员模式已开启', 3000);
                });
            });
        }

        var adminLogoutBtn = document.getElementById('account-admin-logout-btn');
        if (adminLogoutBtn) {
            adminLogoutBtn.addEventListener('click', function() {
                if (typeof AdminAuth !== 'undefined') AdminAuth.logout();
                var user = (typeof AuthManager !== 'undefined' && AuthManager.session)
                    ? { email: AuthManager.session.email || '' }
                    : { email: '' };
                var role = (typeof AuthManager !== 'undefined' && AuthManager.session)
                    ? AuthManager.session.role : 'user';
                refreshAccountPanel(user, role);
                if (typeof AdminPanel !== 'undefined') AdminPanel.updateNavButton();
                showSubmitToast('已退出管理员模式', 3000);
            });
        }

        var adminPanelBtn = document.getElementById('account-admin-panel-btn');
        if (adminPanelBtn) {
            adminPanelBtn.addEventListener('click', function() {
                if (typeof AdminPanel === 'undefined') {
                    setAccountPanelError('管理面板未加载');
                    return;
                }
                AdminPanel.openPanel();
                closeAccountPanel();
            });
        }
    }

    function init() {
        if (typeof SecurityShield !== 'undefined') SecurityShield.init();
        initTheme();
        initMobileMenu();
        initScrollReveal();
        initLikeButtons();
        initStatCounters();
        initEasterEgg();
        initMagneticButtons();
        initNavbarScroll();
        initSmoothScroll();
        initActiveNavLink();
        initShootingStars();
        initLocationSelector();
        initSparkles();
        initMusic();
        initResonanceButtons();
        initAvatarEasterEgg();
        initDiarySignalFlash();
        initCommentKeywordEgg();
        initComments();
        syncAllPostCommentCounts();
        initShareButtons();
        initCharacterHub();
        initModals();
        loadUserProfile();
        initSubmission();
        initCommunity();
        initBookmarksPanel();
        initPublicCollectionPanel();
        if (typeof AdminPanel !== 'undefined') AdminPanel.init();
        initSyncStatus();

        /* v9.0: 初始化新模块 */
        if (typeof AuthManager !== 'undefined') AuthManager.init();
        if (typeof SyncManager !== 'undefined') {
            SyncManager.createSyncIndicator();
            SyncManager.setManualSyncHandler(performFullCloudSync);
        }

        /* v9.0: 初始化拖拽上传 */
        if (typeof UploadManager !== 'undefined' && UploadManager.init) {
            window.showToast = function(msg) { showSubmitToast(msg, 4000); };
            UploadManager.init('upload-drop-zone', 'upload-file-input', 'upload-progress', function(fileData) {
                if (fileData.type === 'text') {
                    var contentEl = document.getElementById('submit-content');
                    var titleEl = document.getElementById('submit-title');
                    if (contentEl && fileData.content) {
                        contentEl.value = fileData.content.substring(0, 2000);
                        var counter = document.getElementById('submit-counter');
                        if (counter) counter.textContent = contentEl.value.length + ' / 2000';
                    }
                    if (titleEl && !titleEl.value && fileData.name) {
                        titleEl.value = fileData.name.replace(/\.(txt|md)$/i, '').substring(0, 100);
                    }
                    showUploadPreview(fileData);
                    showSubmitToast('文件内容已填入', 2000);
                } else if (fileData.type === 'image') {
                    showUploadPreview(fileData);
                    showSubmitToast('图片已上传，将随投稿发布', 3000);
                }
            });
            var previewClear = document.getElementById('upload-preview-clear');
            if (previewClear) previewClear.addEventListener('click', clearUploadPreview);
        }

        /* v9.1: 导航账号面板（升级 / 登录 / 退出） */
        initAccountPanel();

        /* v9.0: 标签筛选交互 */
        var tagChips = document.querySelectorAll('.tag-chip');
        tagChips.forEach(function(chip) {
            chip.addEventListener('click', function() {
                chip.classList.toggle('active');
                communityPage = 0;
                renderCommunity();
            });
        });

        handleDeepLinks();
        window.addEventListener('hashchange', handleDeepLinks);

        var themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', cycleTheme);
            themeToggle.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleTheme(); } });
        }

        if (window.console && window.console.log) {
            console.log('%c\u2744 \u98de\u884c\u96ea\u7ed2 \u2728', 'color: #FF6B9D; font-size: 16px; font-weight: bold;');
            console.log('%c\u7c89\u00b7\u84dd\u00b7\u767d \u52a8\u6001\u6e10\u53d8 \u00b7 \u7231\u5f25\u65af \u00d7 \u6f02\u6cca\u8005', 'color: #6B8AFF; font-size: 12px;');
        }

        /* Phase 3: 自动初始化云端同步（如果 Supabase SDK 已加载） */
        if (typeof DataRepository !== 'undefined' && typeof SupabaseAdapter !== 'undefined') {
            DataRepository.initCloud().then(function() {
                updateSyncStatus();
                return ensureCloudConnected();
            }).then(function(connected) {
                refreshAllCommentsFromCloud();
                loadUserProfile();
                if (connected) {
                    console.log('[Phase3] 云端同步已就绪，用户:', SupabaseAdapter.getStatus().user);
                } else {
                    var status = SupabaseAdapter.getStatus();
                    if (status.ready) {
                        console.warn('[Phase3] SDK 就绪但用户未认证，将只读拉取 + 可点右下角同步重试');
                    } else {
                        console.warn('[Phase3] 云端同步未就绪:', status.error);
                    }
                }
            });
        }

        /* 切回标签页时刷新评论 */
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'visible' &&
                typeof SupabaseAdapter !== 'undefined' &&
                SupabaseAdapter.getStatus().ready) {
                if (typeof SyncManager !== 'undefined' &&
                    SyncManager.getState() === SyncManager.STATE.REALTIME) {
                    return;
                }
                refreshAllCommentsFromCloud();
            }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    /* ===== Architecture Extension Points (Phase 4 — NOT IMPLEMENTED) ===== */
    /*
     * These interfaces are reserved for future expansion.
     * They define the contract but do NOT execute any real logic.
     * When Phase 4 features are built, replace stubs with implementations.
     */

    /* Extension 1: Archive System — delegates to DataRepository */
    var ArchiveAPI = {
        exportData: function() {
            if (typeof DataRepository !== 'undefined') return DataRepository.exportData();
            return Promise.resolve(null);
        },
        importData: function(jsonString) {
            if (typeof DataRepository !== 'undefined') return DataRepository.importData(jsonString);
            return false;
        },
        clearArchive: function() {
            try {
                var keys = [];
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && (k.indexOf('fxre_comments_') === 0 || k === 'fxre_submissions' || k === 'fxre_bookmarks')) {
                        keys.push(k);
                    }
                }
                keys.forEach(function(k) { localStorage.removeItem(k); });
                if (typeof renderCommunity === 'function') renderCommunity();
                document.querySelectorAll('.comment-area').forEach(function(area) {
                    var tid = area.id.replace('comments-', '');
                    if (typeof renderComments === 'function') renderComments(tid);
                });
                if (typeof syncAllPostCommentCounts === 'function') syncAllPostCommentCounts();
                return true;
            } catch (e) {
                return false;
            }
        }
    };

    /* Extension 2: Cloud Sync Interface — delegates to SupabaseAdapter */
    var SyncAPI = {
        push: function() {
            if (typeof SupabaseAdapter !== 'undefined') return SupabaseAdapter.syncPendingQueue();
            return Promise.resolve(null);
        },
        pull: function() {
            if (typeof performFullCloudSync === 'function') {
                return performFullCloudSync().then(function() {
                    if (typeof refreshAllCommentsFromCloud === 'function') {
                        return refreshAllCommentsFromCloud();
                    }
                });
            }
            if (typeof renderCommunity === 'function') renderCommunity();
            return Promise.resolve(null);
        },
        getStatus: function() {
            if (typeof SupabaseAdapter !== 'undefined') return SupabaseAdapter.getStatus();
            return { lastSync: null, pendingChanges: 0, connected: false };
        }
    };

    /* Extension 3: User Identity — delegates to Supabase Auth */
    var UserAPI = {
        getCurrentUser: function() {
            if (typeof SupabaseAdapter !== 'undefined') return SupabaseAdapter.getCurrentUser();
            return null;
        },
        login: function(credentials) {
            if (typeof SupabaseAdapter !== 'undefined') return SupabaseAdapter.ensureAuth();
            return Promise.resolve(null);
        },
        logout: function() {
            if (typeof AuthManager !== 'undefined' && AuthManager.signOut) {
                return AuthManager.signOut();
            }
            return Promise.resolve({ success: false, error: '未初始化' });
        }
    };

    /* Expose APIs on window for future extension */
    window.__FXRE_API = {
        archive: ArchiveAPI,
        sync: SyncAPI,
        user: UserAPI,
        version: 'v9.6'
    };
})();

/* ============================================================
   P0-2 模态框可访问性：焦点陷阱 + 焦点归还 (WCAG 2.1 AA)
   - 监听任意 [role="dialog"] 的 hidden 属性变化
   - 打开：记录触发元素，聚焦首个可聚焦控件
   - 关闭：焦点归还触发元素
   - Tab/Shift+Tab 在对话框内循环（焦点陷阱）
   纯装饰层 aria-hidden 不参与；非对话框的 hidden 元素（如空状态提示）被忽略。
   ============================================================ */
(function () {
    'use strict';
    var FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    var lastFocused = null;

    function getFocusable(dialog) {
        return Array.prototype.slice.call(dialog.querySelectorAll(FOCUSABLE)).filter(function (el) {
            return !el.disabled && el.offsetParent !== null;
        });
    }

    var dialogs = Array.prototype.slice.call(document.querySelectorAll('[role="dialog"]'));
    if (!('MutationObserver' in window) || !dialogs.length) return;

    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
            var el = m.target;
            if (el.hidden) {
                if (lastFocused && document.contains(lastFocused)) {
                    try { lastFocused.focus(); } catch (e) {}
                }
                lastFocused = null;
            } else {
                lastFocused = document.activeElement;
                var f = getFocusable(el);
                if (f.length) { try { f[0].focus(); } catch (e) {} }
                else { try { el.focus(); } catch (e) {} }
            }
        });
    });
    dialogs.forEach(function (d) {
        observer.observe(d, { attributes: true, attributeFilter: ['hidden'] });
    });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var d = document.querySelector('[role="dialog"]:not([hidden])');
        if (!d) return;
        var f = getFocusable(d);
        if (!f.length) { e.preventDefault(); return; }
        var first = f[0], last = f[f.length - 1];
        if (!d.contains(document.activeElement)) {
            e.preventDefault(); first.focus(); return;
        }
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        }
    });
})();
