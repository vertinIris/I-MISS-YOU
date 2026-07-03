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

    function initLikeButtons() {
        var btns = document.querySelectorAll('.like-btn');
        for (var i = 0; i < btns.length; i++) {
            (function(btn) {
                var countEl = btn.querySelector('.like-count');
                var count = parseInt(btn.dataset.likes || '0', 10) || 0;
                btn.addEventListener('click', function() {
                    if (btn.classList.contains('liked')) { btn.classList.remove('liked'); count--; }
                    else { btn.classList.add('liked'); count++; createHeartParticle(btn); }
                    if (countEl) countEl.textContent = formatNumber(count);
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
            { name: '雪花落下的频率', meta: '环境音 · 六角形结晶的共振', duration: 330, notes: [72, 76, 79, 84, 79, 76], type: 'crystal' },
            { name: '双形态协奏曲', meta: '少女与机兵的协奏 · 两种感知重叠的瞬间', duration: 225, notes: [57, 60, 64, 57, 65, 60], type: 'dual' },
            { name: '银河信号河', meta: '天文台白噪音 · 远处仪器低频', duration: 480, notes: [48, 52, 55, 48, 60, 52], type: 'drone' }
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
            dialogueBubble.style.cssText = 'position:fixed;top:' + (rect.bottom + 12) + 'px;left:' + (rect.left + rect.width / 2) + 'px;transform:translateX(-50%);padding:10px 16px;background:rgba(15,15,24,0.95);border:1px solid rgba(255,107,157,0.3);border-radius:12px;color:#FAF8FF;font-size:0.85rem;z-index:9999;max-width:280px;white-space:normal;word-break:break-word;line-height:1.5;box-shadow:0 8px 25px rgba(0,0,0,0.3),0 0 15px rgba(255,107,157,0.15);animation:fadeInUp 0.3s ease;';
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
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:12px 24px;background:rgba(15,15,24,0.92);border:1px solid rgba(255,107,157,0.3);border-radius:16px;color:#FAF8FF;font-size:0.85rem;z-index:9999;box-shadow:0 8px 30px rgba(0,0,0,0.4),0 0 20px rgba(255,107,157,0.15);animation:fadeInUp 0.3s ease;';
        document.body.appendChild(toast);
        setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 2500);
        setTimeout(function() { toast.remove(); }, 3000);
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

        /* ===== 删除按钮事件委托 ===== */
        var commentLists = document.querySelectorAll('.comment-list');
        commentLists.forEach(function(list) {
            list.addEventListener('click', function(e) {
                var btn = e.target.closest('.comment-delete-btn');
                if (!btn) return;
                e.preventDefault();
                e.stopPropagation();

                /* 提取目标 ID（从父级 comment-area 的 id） */
                var area = btn.closest('.comment-area');
                if (!area) return;
                var targetId = area.id.replace('comments-', '');

                /* 提取评论数据 */
                var commentData = {
                    id:       btn.getAttribute('data-comment-id'),
                    authorId: btn.getAttribute('data-comment-author'),
                    name:     btn.getAttribute('data-comment-name'),
                    text:     btn.getAttribute('data-comment-text'),
                    time:     btn.getAttribute('data-comment-time')
                };

                handleDeleteComment(targetId, commentData, btn);
            });
        });

    }

    /** 云端就绪后订阅 Realtime（评论 INSERT/DELETE + 新投稿） */
    function setupCloudRealtime() {
        if (typeof SupabaseAdapter === 'undefined' || !SupabaseAdapter.isAuthenticated()) return;

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

        console.log('[Phase3] Realtime 订阅已启用');
    }

    function buildCommentAreaHTML(targetId) {
        return '<div class="comment-list" id="comment-list-' + targetId + '"></div>' +
               '<form class="comment-form">' +
               '<input type="text" class="comment-form-input comment-form-name" placeholder="昵称" maxlength="20" required>' +
               '<input type="text" class="comment-form-input" placeholder="写下你的评论……" maxlength="500" required>' +
               '<button type="submit" class="comment-submit-btn">发送</button>' +
               '</form>';
    }

    /* ===== Seed Comments — Multi-user pre-populated data ===== */
    var SEED_COMMENTS = {
        '1': [
            { name: '诺娃', text: '模拟舱的雪我也去看了！确实很美，但跟你比起来我堆的雪人简直像个歪掉的信号塔……', timeStr: '6月28日 15:02', color: '#A8D8FF' },
            { name: '埃拉拉', text: '拉海洛的雪原真的很美呢。下次我们一起回去看真正的雪吧？', timeStr: '6月28日 16:20', color: '#B66BFF' },
            { name: '学院路人A', text: '等等，模拟舱里还能飘雪？我怎么从来没发现这个功能！明天一定要去试试', timeStr: '6月29日 09:15', color: '#6B8AFF' },
            { name: '漂泊者信使', text: '拉海洛的雪……我也记得。那片雪原上有我们共同的脚印。', timeStr: '6月29日 11:42', color: '#FFD700' }
        ],
        '2': [
            { name: '塞莱斯特', text: '0.3秒的延迟……你的描述太精确了。不过有时候我觉得，那0.3秒里藏着最真实的你。', timeStr: '6月29日 22:15', color: '#FFB6D9' },
            { name: '诺娃', text: '频率不一样也没关系呀！我调了3次频道才收到你的信号呢～但收到的那一刻，所有等待都值了', timeStr: '6月30日 08:30', color: '#A8D8FF' },
            { name: '匿名信号源', text: '适格者的世界确实和别人不太一样……但不一样不代表不好。你看到的世界，比大多数人丰富得多', timeStr: '6月30日 14:55', color: '#6B8AFF' }
        ],
        '3': [
            { name: '埃拉拉', text: '深夜歌单我也要！天文台那段白噪音我听了三天，写论文的时候效率翻倍', timeStr: '6月30日 23:40', color: '#B66BFF' },
            { name: '调频9072', text: '宇宙在说话，但大多数人调到了错误的频道。你调到了对的那个。', timeStr: '7月1日 01:22', color: '#FFD700' },
            { name: '诺娃', text: '下次分享的时候记得加上你自己的歌！飞行雪绒的歌才是最好听的～', timeStr: '7月1日 09:10', color: '#A8D8FF' }
        ],
        '4': [
            { name: '洛瑟菈校长', text: '紫外线下显形的笑脸……这确实是一个很有创意的实验记录方式。不过下次请注意使用合规的实验耗材。', timeStr: '7月1日 17:30', color: '#6B8AFF' },
            { name: '塞莱斯特', text: '黑暗里才看得到的东西——你总是能看到别人看不到的世界。我很羡慕这一点', timeStr: '7月1日 18:45', color: '#FFB6D9' },
            { name: '诺娃', text: '三千字设备维护报告？？这也太狠了吧！不过我觉得你的笑脸值得三千字来描述', timeStr: '7月1日 19:20', color: '#A8D8FF' },
            { name: '匿名信号源', text: '有些东西就该在黑暗里才看得到。这句话我抄走了，谢谢', timeStr: '7月2日 02:15', color: '#FFFFFF' }
        ],
        '5': [
            { name: '埃拉拉', text: '少女形态的「嗒嗒嗒」和机兵形态的「————」……你真的太会描述了！听着听着我就笑了', timeStr: '7月2日 10:30', color: '#B66BFF' },
            { name: '漂泊者信使', text: '两条时间线叠在一起的那个瞬间——我也感受过。那是我最接近理解你的时刻', timeStr: '7月2日 14:18', color: '#FFD700' },
            { name: '诺娃', text: '机兵形态好酷！下次能不能让我看看？我保证不尖叫！……好吧可能会尖叫一下', timeStr: '7月2日 16:40', color: '#A8D8FF' },
            { name: '学院路人B', text: '声波在金属和空气里的传播速度差……这个物理细节太专业了，不愧是星炬学院优等生', timeStr: '7月2日 20:05', color: '#6B8AFF' }
        ],
        '6': [
            { name: '调频9072', text: '透过你的眼睛看到的星空，比透过任何望远镜看到的都美。因为那片星空里，有你', timeStr: '7月2日 22:30', color: '#FFD700' },
            { name: '诺娃', text: '银河信号河！这个名字也太浪漫了吧！我要把它写进我的观测日志标题', timeStr: '7月3日 07:50', color: '#A8D8FF' },
            { name: '塞莱斯特', text: '哪怕只有一秒钟……这句话让我想了很久。哪怕只有一秒，也足够让人记住一辈子', timeStr: '7月3日 12:35', color: '#FFB6D9' },
            { name: '匿名信号源', text: '数据包发射中——目标：正在读这条评论的你。内容：一颗星星', timeStr: '7月3日 18:00', color: '#FFFFFF' }
        ],
        'diary-1': [
            { name: '诺娃', text: '来自过去的温柔……这个描述让我眼泪都快掉下来了。你真的很擅长把伤感写成温暖', timeStr: '6月28日 23:50', color: '#A8D8FF' },
            { name: '埃拉拉', text: '咖啡机坏了第三天了——这才是最让人心碎的消息好吧！', timeStr: '6月29日 08:15', color: '#B66BFF' },
            { name: '漂泊者信使', text: '你留下的东西，一定会有人收到。我有信心', timeStr: '6月29日 10:20', color: '#FFD700' }
        ],
        'diary-2': [
            { name: '塞莱斯特', text: '"取决于谁在问"——这句话太厉害了。你对自己认知的清晰度远超大多数人', timeStr: '7月2日 20:30', color: '#FFB6D9' },
            { name: '诺娃', text: '零点几秒的转换瞬间……你居然能记住那种感觉？下次转换的时候能不能录下来给我听听？', timeStr: '7月2日 21:10', color: '#A8D8FF' },
            { name: '匿名信号源', text: '同时是少女也是机兵、同时是血肉也是金属——这个瞬间里的你，才是最完整的你', timeStr: '7月3日 00:45', color: '#FFFFFF' }
        ],
        'diary-3': [
            { name: '埃拉拉', text: '走廊尽头的那扇窗！我也经常在那里看夕阳！原来我们都在同一个地方偷懒啊', timeStr: '7月3日 18:50', color: '#B66BFF' },
            { name: '诺娃', text: '飞行雪绒这个名字真好听——比你学院档案上的编号好听一万倍。以后我就叫你这个名字了！', timeStr: '7月3日 19:30', color: '#A8D8FF' },
            { name: '漂泊者信使', text: '属于你的时间——你终于找到了。我很高兴', timeStr: '7月3日 21:15', color: '#FFD700' }
        ]
    };

    var SEED_VERSION = 'v7.8';

    /* ===== Seed Submissions (Community pre-population) ===== */
    var SEED_SUBMISSIONS = [
        {
            id: 'seed_1', name: '诺娃', type: 'story', title: '信号塔守望者',
            content: '我在信号塔上等了三个小时。不是因为职责，是因为你说过"今晚星星会很亮"。后来信号塔的灯真的亮了，但那不是星星，是你在模拟舱里偷偷调的天文台投影。\n\n谢谢你让我看到了那片星空，哪怕它是假的。',
            timeStr: '2026-06-28 23:15', likes: 12, liked: false, color: '#A8D8FF'
        },
        {
            id: 'seed_2', name: '埃拉拉', type: 'poem', title: '拉贝尔学部的黄昏',
            content: '走廊尽头那扇窗\n永远朝着夕阳的方向\n你每次经过都会停下\n用指尖在玻璃上画一颗星\n\n后来那扇窗被清洁机器人擦净了\n但我知道\n那颗星还在那里\n藏在玻璃的折射里\n等待下一个黄昏',
            timeStr: '2026-06-30 18:40', likes: 8, liked: false, color: '#B66BFF'
        },
        {
            id: 'seed_3', name: '调频9072', type: 'text', title: '频率使用指南',
            content: '9072不是随便能调到的频率。\n\n你需要：\n① 深夜（至少23:00以后）\n② 一台老式收音机（数字调谐的不行）\n③ 安静的环境（电磁干扰会屏蔽信号）\n④ 一个愿意相信的人\n\n最后一条最重要。信号不会发给不相信的人。',
            timeStr: '2026-07-01 01:22', likes: 15, liked: false, color: '#FFD700'
        },
        {
            id: 'seed_4', name: '塞莱斯特', type: 'art', title: '双形态素描',
            content: '我画了一幅速写：左边是少女形态的你，发丝飘动，眼睛里映着星光；右边是机兵形态的你，金属外壳流线型，能量核心发出淡蓝色的光。\n\n中间有一条线把它们连在一起——不是分界线，而是共振线。\n\n两个形态不是对立的，是同一首歌的不同乐章。',
            timeStr: '2026-07-02 15:30', likes: 6, liked: false, color: '#FFB6D9'
        },
        {
            id: 'seed_5', name: '学院路人C', type: 'music', title: '走廊白噪音',
            content: '录了一段拉贝尔学部走廊的白噪音——脚步声、远处实验室的嗡嗡声、偶尔传来的对话片段。\n\n有人说白噪音能帮助入睡，但我觉得这些声音本身就是一首曲子。每一脚步都是节拍，每一声嗡嗡都是和弦，每一句对话都是旋律。\n\n飞行雪绒应该会喜欢这个。',
            timeStr: '2026-07-02 20:05', likes: 4, liked: false, color: '#6B8AFF'
        },
        {
            id: 'seed_6', name: '漂泊者信使', type: 'poem', title: '写给星空的回信',
            content: '你说过：只要抬头，那颗星总能找到你。\n\n我试了。\n抬头的时候，找到了你留下的那颗。\n它没有消失，只是换了一个频率。\n\n我们的信号不需要同一个频道。\n只要都在发送，就总有人能收到。',
            timeStr: '2026-07-03 21:15', likes: 18, liked: false, color: '#FFD700'
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
                _renderCommentsList(list, comments);
            });
        } else {
            _renderCommentsList(list, result || []);
        }
    }

    function _renderCommentsList(list, comments) {
        if (comments.length === 0) {
            list.innerHTML = '<div class="comment-empty">还没有评论，来第一个留言吧 ~</div>';
            return;
        }
        var canDeleteAny = (typeof AdminAuth !== 'undefined') && AdminAuth.isAdmin();
        list.innerHTML = comments.map(function(c) {
            var initial = c.name.charAt(0).toUpperCase();
            var bgColor = c.color || 'var(--color-pink)';
            /* 仅当管理员或当前匿名用户是该评论作者时显示删除按钮 */
            var showDelete = canDeleteAny || (typeof AdminAuth !== 'undefined' && AdminAuth.canDelete(c));
            var deleteBtn = showDelete
                ? '<button class="comment-delete-btn" title="删除此评论" data-comment-id="' + (c.id || '') + '" data-comment-name="' + escapeHTML(c.name) + '" data-comment-text="' + escapeHTML(c.text) + '" data-comment-time="' + (c.time || 0) + '" data-comment-author="' + (c.authorId || '') + '">×</button>'
                : '';
            return '<div class="comment-item">' +
                '<div class="comment-avatar" style="background:' + bgColor + '">' + escapeHTML(initial) + '</div>' +
                '<div class="comment-body">' +
                '<div class="comment-meta">' +
                '<span class="comment-author">' + escapeHTML(c.name) + '</span>' +
                '<span class="comment-time">' + c.timeStr + '</span>' +
                '</div>' +
                '<div class="comment-text">' + escapeHTML(c.text) + '</div>' +
                '</div>' +
                deleteBtn +
                '</div>';
        }).join('');
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

        /* --- 速率限制 --- */
        if (typeof RateLimiter !== 'undefined') {
            var rl = RateLimiter.checkComment(targetId);
            if (!rl.allowed) {
                showSubmitToast(rl.reason, 4000);
                return;
            }
            RateLimiter.recordComment(targetId);
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
            color: autoColor
        };

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

        /* Phase 3: 同步写云端；完成后重新拉取并渲染，确保跨设备一致 */
        if (typeof DataRepository !== 'undefined') {
            DataRepository.addComment(targetId, { author: name, color: autoColor, text: text })
                .then(function() {
                    renderComments(targetId);
                })
                .catch(function(err) {
                    console.warn('[Main] 云端同步失败:', err);
                });
        }
        textInput.value = '';
    }

    /**
     * 删除一条评论
     * - 非管理员只能删自己的评论（匹配 authorId）
     * - 管理员可删任意评论
     * - 双写删除（本地 + 云端）
     */
    function handleDeleteComment(targetId, commentData, btn) {
        if (!commentData) return;

        var isAdmin = (typeof AdminAuth !== 'undefined') && AdminAuth.isAdmin();

        /* 确认对话框 */
        var confirmMsg = isAdmin
            ? '确定要删除此评论吗？（管理员操作）'
            : '确定要删除你的这条评论吗？';
        if (!confirm(confirmMsg)) return;

        /* 构造评论对象 */
        var comment = {
            id:       commentData.id       ? parseInt(commentData.id, 10) : null,
            authorId: commentData.authorId || '',
            name:     commentData.name     || '',
            text:     commentData.text     || '',
            time:     commentData.time     ? parseInt(commentData.time, 10) : 0
        };

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
                        if (list && list.querySelectorAll('.comment-item').length === 0) {
                            list.innerHTML = '<div class="comment-empty">还没有评论，来第一个留言吧 ~</div>';
                        }
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

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var rawName    = document.getElementById('submit-nickname').value.trim();
            var type       = document.getElementById('submit-type').value;
            var rawTitle   = document.getElementById('submit-title').value.trim();
            var rawContent = document.getElementById('submit-content').value.trim();

            /* --- 输入校验 --- */
            if (!rawName || !rawTitle || !rawContent) return;
            if (rawName.length > 20)    { showSubmitToast('昵称限20字以内'); return; }
            if (rawTitle.length > 100)  { showSubmitToast('标题限100字以内'); return; }
            if (rawContent.length > 2000) { showSubmitToast('内容限2000字以内'); return; }
            if (rawContent.length < 10)   { showSubmitToast('内容至少10个字～'); return; }

            /* --- 速率限制 --- */
            if (typeof RateLimiter !== 'undefined') {
                var rl = RateLimiter.checkSubmission();
                if (!rl.allowed) {
                    showSubmitToast(rl.reason, 4000);
                    return;
                }
                RateLimiter.recordSubmission();
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
                if (counter) counter.textContent = '0 / 2000';
                showSubmitToast('作品提交成功！已发布到社区 ✨');
                renderCommunity();

                /* Phase 3: 同步到云端 */
                if (typeof DataRepository !== 'undefined') {
                    DataRepository.addSubmission(newSub)
                        .then(function() { renderCommunity(); })
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

    function initCommunity() {
        var filterBtns = document.querySelectorAll('.community-filter-btn');
        filterBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                filterBtns.forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                communityFilter = btn.getAttribute('data-filter');
                renderCommunity();
            });
        });
        renderCommunity();
    }

    function renderCommunity() {
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
    }

    function _renderCommunityGrid(grid, empty, countEl, submissions) {
        if (countEl) countEl.textContent = submissions.length;

        var filtered = communityFilter === 'all'
            ? submissions
            : submissions.filter(function(s) { return s.type === communityFilter; });

        if (filtered.length === 0) {
            grid.innerHTML = '';
            if (empty) empty.classList.add('show');
            return;
        }

        if (empty) empty.classList.remove('show');

        var typeLabels = { text: '文字', story: '故事', poem: '诗歌', art: '插画', music: '音乐' };

        grid.innerHTML = filtered.map(function(s) {
            var initial = s.name.charAt(0).toUpperCase();
            var bgColor = s.color || 'var(--color-pink)';
            var contentClass = 'community-card-content';
            var expandBtn = '';
            if (s.content.length > 300) {
                expandBtn = '<button class="community-card-expand" data-action="expand">展开全文</button>';
            }
            return '<article class="community-card" data-id="' + s.id + '">' +
                '<div class="community-card-header">' +
                '<div class="community-card-avatar" style="background:' + bgColor + '">' + escapeHTML(initial) + '</div>' +
                '<div class="community-card-info">' +
                '<div class="community-card-author">' + escapeHTML(s.name) + '</div>' +
                '<div class="community-card-time">' + s.timeStr + '</div>' +
                '</div>' +
                '<span class="community-card-badge" data-type="' + s.type + '">' + (typeLabels[s.type] || s.type) + '</span>' +
                '</div>' +
                '<h3 class="community-card-title">' + escapeHTML(s.title) + '</h3>' +
                '<div class="' + contentClass + '">' + escapeHTML(s.content) + '</div>' +
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
                '</div>' +
                '<div class="community-card-comments" id="cc-comments-' + s.id + '">' +
                '<div class="comment-list" id="cc-list-' + s.id + '"></div>' +
                '<form class="comment-form" data-target="' + s.id + '">' +
                '<input type="text" class="comment-form-input comment-form-name" placeholder="昵称" maxlength="20" required>' +
                '<input type="text" class="comment-form-input" placeholder="写下你的评论……" maxlength="500" required>' +
                '<button type="submit" class="comment-submit-btn">发送</button>' +
                '</form>' +
                '</div>' +
                '</article>';
        }).join('');

        attachCommunityCardEvents();
    }

    function attachCommunityCardEvents() {
        document.querySelectorAll('.community-card').forEach(function(card) {
            var id = card.getAttribute('data-id');

            var likeBtn = card.querySelector('[data-action="like"]');
            if (likeBtn) {
                likeBtn.addEventListener('click', function() {
                    function _doLike(submissions) {
                        submissions = Array.isArray(submissions) ? submissions : [];
                        for (var i = 0; i < submissions.length; i++) {
                            if (String(submissions[i].id) !== String(id)) continue;
                            if (submissions[i].liked) {
                                submissions[i].liked = false;
                                submissions[i].likes--;
                            } else {
                                submissions[i].liked = true;
                                submissions[i].likes++;
                                /* 云端投稿（数字 id）同步点赞 */
                                if (/^\d+$/.test(String(id)) && typeof SupabaseAdapter !== 'undefined' && SupabaseAdapter.isAuthenticated()) {
                                    SupabaseAdapter.likeSubmission(parseInt(id, 10));
                                }
                            }
                            saveSubmissions(submissions);
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
                                     String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
                        });
                        saveComments('community_' + id, comments);
                        /* 乐观渲染 */
                        if (list) _renderCommunityCommentsList(list, comments);
                        /* 云端同步 */
                        if (typeof DataRepository !== 'undefined') {
                            DataRepository.addComment('community_' + id, { author: name, text: text })
                                .then(function() { renderCommunityComments(id); })
                                .catch(function(err) { console.warn('[Main] 社区评论云端同步失败:', err); });
                        }
                        textInput.value = '';
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
                        content.classList.toggle('expanded');
                        expandBtn.textContent = content.classList.contains('expanded') ? '收起' : '展开全文';
                    }
                });
            }
        });
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
        if (comments.length === 0) {
            list.innerHTML = '<div class="comment-empty">还没有评论 ~</div>';
            return;
        }
        list.innerHTML = comments.map(function(c) {
            var initial = c.name.charAt(0).toUpperCase();
            var bgColor = c.color || 'var(--color-pink)';
            return '<div class="comment-item">' +
                '<div class="comment-avatar" style="background:' + bgColor + '">' + escapeHTML(initial) + '</div>' +
                '<div class="comment-body">' +
                '<div class="comment-meta">' +
                '<span class="comment-author">' + escapeHTML(c.name) + '</span>' +
                '<span class="comment-time">' + c.timeStr + '</span>' +
                '</div>' +
                '<div class="comment-text">' + escapeHTML(c.text) + '</div>' +
                '</div>' +
                '</div>';
        }).join('');
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
            if (status.pending > 0) html += ' \xb7 \u5f85\u540c\u6b65: ' + status.pending;
        }

        /* 管理员标识 */
        if (typeof AdminAuth !== 'undefined' && AdminAuth.isAdmin()) {
            html = '\ud83d\udee1 ' + html + ' \xb7 \u7ba1\u7406\u5458';
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
                AdminAuth.login(function(success) {
                    if (success) {
                        updateSyncStatus();
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

        /* 主动同步按钮 */
        var syncBtn = document.getElementById('sync-now-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                handleManualSync(syncBtn);
            });
        }

        updateSyncStatus();
        setInterval(updateSyncStatus, 5000);
    }

    function handleManualSync(btn) {
        if (typeof SupabaseAdapter === 'undefined') {
            showSubmitToast('\u2601 \u4e91\u7aef\u6a21\u5757\u672a\u52a0\u8f7d\uff0c\u65e0\u6cd5\u540c\u6b65');
            return;
        }

        var status = SupabaseAdapter.getStatus();
        if (!status.configValid) {
            showSubmitToast('\u2601 Supabase \u672a\u914d\u7f6e\uff0c\u65e0\u6cd5\u540c\u6b65');
            return;
        }
        if (!status.ready || !status.user) {
            showSubmitToast('\u26a0 \u4e91\u7aef\u672a\u5c31\u7eea\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5');
            return;
        }

        if (btn) {
            btn.classList.add('syncing');
            btn.disabled = true;
        }

        showSubmitToast('\ud83d\udd04 \u6b63\u5728\u540c\u6b65\u5f85\u53d1\u9001\u6570\u636e\u2026');

        SupabaseAdapter.syncPendingQueue().then(function() {
            updateSyncStatus();
            var s = SupabaseAdapter.getStatus();
            if (s.pending === 0) {
                showSubmitToast('\u2705 \u540c\u6b65\u5b8c\u6210\uff0c\u6240\u6709\u6570\u636e\u5df2\u4e0a\u4f20\u4e91\u7aef');
                /* 刷新评论和社区以展示云端数据 */
                document.querySelectorAll('.comment-area').forEach(function(area) {
                    var id = area.id.replace('comments-', '');
                    renderComments(id);
                });
                if (typeof initCommunity === 'function') initCommunity();
            } else {
                showSubmitToast('\u26a0 \u540c\u6b65\u7ed3\u675f\uff0c\u4ecd\u6709 ' + s.pending + ' \u6761\u672a\u80fd\u53d1\u9001\uff08\u53ef\u80fd\u89e6\u53d1\u4e86\u901f\u7387\u9650\u5236\uff09');
            }
        }).catch(function(err) {
            console.warn('[Sync] 手动同步失败:', err);
            showSubmitToast('\u274c \u540c\u6b65\u5931\u8d25\uff1a' + (err.message || '\u672a\u77e5\u9519\u8bef'));
        }).finally(function() {
            if (btn) {
                btn.classList.remove('syncing');
                btn.disabled = false;
            }
        });
    }

    function init() {
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
        initSubmission();
        initCommunity();
        initSyncStatus();

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
                var status = SupabaseAdapter.getStatus();
                if (status.ready && status.user) {
                    console.log('[Phase3] 云端同步已就绪，用户:', status.user);
                    setupCloudRealtime();
                } else if (status.ready) {
                    console.warn('[Phase3] SDK 就绪但用户未认证，匿名登录可能未启用');
                } else {
                    console.warn('[Phase3] 云端同步未就绪:', status.error);
                }
            });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    /* ===== Architecture Extension Points (Phase 4 — NOT IMPLEMENTED) ===== */
    /*
     * These interfaces are reserved for future expansion.
     * They define the contract but do NOT execute any real logic.
     * When Phase 4 features are built, replace stubs with implementations.
     */

    /* Extension 1: Archive System — now delegates to DataRepository */
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
            return false; /* Stub */
        }
    };

    /* Extension 2: Cloud Sync Interface — delegates to SupabaseAdapter */
    var SyncAPI = {
        push: function() {
            if (typeof SupabaseAdapter !== 'undefined') return SupabaseAdapter.syncPendingQueue();
            return Promise.resolve(null);
        },
        pull: function() {
            /* Pulls cloud data and merges — triggers re-render */
            if (typeof DataRepository !== 'undefined') {
                DataRepository.getComments('post_1'); /* warm cache */
                if (typeof initCommunity === 'function') initCommunity();
            }
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
            return false; /* Stub — anonymous users don't log out */
        }
    };

    /* Expose APIs on window for future extension */
    window.__FXRE_API = {
        archive: ArchiveAPI,
        sync: SyncAPI,
        user: UserAPI,
        version: 'v7.8'
    };
})();
