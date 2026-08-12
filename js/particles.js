/* ========================================
   飞行雪绒 — Snowflake Particle System
   Three.js增强版 + 纯CSS降级方案
   兼容：Edge · 夸克 · Safari · 低性能设备
   P0：首屏默认 CSS 雪；Three.js 空闲后再升级；降粒子/禁 per-flake blur
   ======================================== */

(function() {
    'use strict';

    function isWebGLAvailable() {
        try {
            var canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext &&
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch(_) {
            return false;
        }
    }

    function isThreeLoaded() {
        return typeof window.THREE !== 'undefined' &&
               window.THREE.Scene &&
               window.THREE.WebGLRenderer &&
               window.THREE.PointsMaterial;
    }

    function isReducedMotion() {
        var mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        return mediaQuery && mediaQuery.matches;
    }

    function safeSetStorage(key, value) {
        try { window.localStorage.setItem(key, value); } catch(_) {}
    }

    function safeGetStorage(key) {
        try { return window.localStorage.getItem(key); } catch(_) { return null; }
    }

    function scheduleIdle(fn, timeoutMs) {
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(fn, { timeout: timeoutMs || 3000 });
        } else {
            setTimeout(fn, Math.min(timeoutMs || 3000, 1800));
        }
    }

    var scene, camera, renderer, particles, particleMaterial;
    var animationId = null;
    var mouseX = 0, mouseY = 0;
    var windowWidth = window.innerWidth || 800;
    var windowHeight = window.innerHeight || 600;
    var isVisible = true;
    var hasWebGLFailed = false;
    var resizeTimer = null;
    var threeBooted = false;

    var PARTICLE_COUNT = windowWidth < 768 ? 18 : 36;
    var PARTICLE_SIZE = 2.0;
    var PARTICLE_AREA = 80;

    function desiredParticleCount() {
        return windowWidth < 768 ? 18 : 36;
    }

    function initCSSFallback() {
        var container = document.getElementById('css-snow');
        if (!container) return;

        container.innerHTML = '';

        var symbols = ['\u2744', '\u2726', '\u2745', '\u2727', '\u2728', '\u2022'];
        var count = windowWidth < 768 ? 10 : 16;
        var fragment = document.createDocumentFragment();

        for (var i = 0; i < count; i++) {
            var flake = document.createElement('span');
            flake.className = 'css-snowflake';
            flake.textContent = symbols[Math.floor(Math.random() * symbols.length)];

            var left = Math.random() * 100;
            var duration = Math.random() * 5 + 6;
            var delay = Math.random() * -10;
            var drift = (Math.random() - 0.5) * 50;

            var isEthereal = Math.random() < 0.4;
            var size, opacity, shadow, color;

            if (isEthereal) {
                size = Math.random() * 0.5 + 0.28;
                opacity = Math.random() * 0.25 + 0.2;
                shadow = '0 0 ' + (Math.random() * 4 + 2) + 'px rgba(168, 216, 255, 0.35)';
                color = 'rgba(232, 244, 255, ' + (opacity + 0.15) + ')';
                flake.setAttribute('data-layer', 'ethereal');
            } else {
                size = Math.random() * 0.8 + 0.7;
                opacity = Math.random() * 0.3 + 0.7;
                shadow = '0 0 ' + (Math.random() * 8 + 4) + 'px rgba(255, 255, 255, ' + (Math.random() * 0.4 + 0.4) + ')';
                color = 'rgba(255, 255, 255, ' + opacity + ')';
                flake.setAttribute('data-layer', 'dense');
            }

            flake.style.left = left + '%';
            flake.style.fontSize = size + 'rem';
            flake.style.color = color;
            flake.style.textShadow = shadow;
            /* P0：不再对每个雪花设 filter:blur —— 多元素 blur 合成极贵 */
            flake.style.animationDuration = duration + 's';
            flake.style.animationDelay = delay + 's';
            flake.style.setProperty('--snow-opacity', opacity);
            flake.style.setProperty('--snow-drift', drift + 'px');

            fragment.appendChild(flake);
        }

        container.appendChild(fragment);
    }

    function showCSSFallback() {
        var container = document.getElementById('css-snow');
        if (container) container.classList.remove('hidden');
    }

    function hideCSSFallback() {
        var container = document.getElementById('css-snow');
        if (container) container.classList.add('hidden');
    }

    function initThree() {
        var canvas = document.getElementById('particle-canvas');
        if (!canvas || !isThreeLoaded() || !isWebGLAvailable()) {
            hasWebGLFailed = true;
            showCSSFallback();
            return false;
        }

        try {
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(75, windowWidth / windowHeight, 1, 1000);
            camera.position.z = 50;

            renderer = new THREE.WebGLRenderer({
                canvas: canvas,
                alpha: true,
                antialias: false,
                powerPreference: 'high-performance'
            });
            renderer.setSize(windowWidth, windowHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));

            PARTICLE_COUNT = desiredParticleCount();
            createParticles();

            if (window.addEventListener) {
                window.addEventListener('resize', onResize, { passive: true });
                document.addEventListener('mousemove', onMouseMove, { passive: true });
                document.addEventListener('visibilitychange', onVisibilityChange);
            }

            canvas.classList.add('active');
            hideCSSFallback();
            threeBooted = true;

            if (!isReducedMotion()) {
                animate();
            } else {
                renderer.render(scene, camera);
            }

            return true;
        } catch(e) {
            console.warn('Three.js particle init failed:', e);
            hasWebGLFailed = true;
            destroyThree();
            showCSSFallback();
            return false;
        }
    }

    function createParticles() {
        var geometry = new THREE.BufferGeometry();
        var positions = new Float32Array(PARTICLE_COUNT * 3);
        var sizes = new Float32Array(PARTICLE_COUNT);
        var speeds = new Float32Array(PARTICLE_COUNT);
        var opacities = new Float32Array(PARTICLE_COUNT);

        for (var i = 0; i < PARTICLE_COUNT; i++) {
            positions[i * 3] = (Math.random() - 0.5) * PARTICLE_AREA * 2;
            positions[i * 3 + 1] = (Math.random() - 0.5) * PARTICLE_AREA * 2;
            positions[i * 3 + 2] = (Math.random() - 0.5) * PARTICLE_AREA * 2;
            sizes[i] = Math.random() * PARTICLE_SIZE + 0.5;
            speeds[i] = Math.random() * 0.12 + 0.04;
            opacities[i] = Math.random() * 0.4 + 0.3;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        var theme = document.documentElement.getAttribute('data-theme') || 'dark';
        var color = theme === 'light' ? new THREE.Color(0xFF8FB0) : new THREE.Color(0xFFB6D9);
        var spriteTexture = createCircleTexture();

        particleMaterial = new THREE.PointsMaterial({
            size: PARTICLE_SIZE,
            map: spriteTexture,
            transparent: true,
            opacity: 0.7,
            color: color,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        particles = new THREE.Points(geometry, particleMaterial);
        scene.add(particles);
        particles.userData.speeds = speeds;
        particles.userData.opacities = opacities;
    }

    function createCircleTexture() {
        var canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        var ctx = canvas.getContext('2d');
        if (!ctx) return null;

        var gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.3, 'rgba(255,255,255,0.6)');
        gradient.addColorStop(0.7, 'rgba(255,255,255,0.15)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);

        var texture = new THREE.Texture(canvas);
        if (texture.needsUpdate) texture.needsUpdate = true;
        return texture;
    }

    function animate() {
        if (animationId) cancelAnimationFrame(animationId);
        animationId = requestAnimationFrame(animate);

        if (!isVisible || !particles || !renderer) return;
        if (document.body && document.body.classList.contains('fxre-anim-paused')) return;

        var positions = particles.geometry.attributes.position.array;
        var speeds = particles.userData.speeds;
        var time = Date.now() * 0.0005;

        for (var i = 0; i < PARTICLE_COUNT; i++) {
            positions[i * 3 + 1] -= speeds[i];
            positions[i * 3] += Math.sin(time + i * 0.5) * 0.015;
            if (positions[i * 3 + 1] < -PARTICLE_AREA) {
                positions[i * 3 + 1] = PARTICLE_AREA;
                positions[i * 3] = (Math.random() - 0.5) * PARTICLE_AREA * 2;
                positions[i * 3 + 2] = (Math.random() - 0.5) * PARTICLE_AREA * 2;
            }
        }

        particles.geometry.attributes.position.needsUpdate = true;
        particles.rotation.y += 0.0002;

        camera.position.x += (mouseX * 2 - camera.position.x) * 0.02;
        camera.position.y += (mouseY * 2 - camera.position.y) * 0.02;
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
    }

    function onMouseMove(event) {
        mouseX = ((event.clientX || 0) / windowWidth) * 2 - 1;
        mouseY = -((event.clientY || 0) / windowHeight) * 2 + 1;
    }

    function onResize() {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            windowWidth = window.innerWidth || 800;
            windowHeight = window.innerHeight || 600;
            PARTICLE_COUNT = desiredParticleCount();

            if (camera && renderer) {
                camera.aspect = windowWidth / windowHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(windowWidth, windowHeight);
            }

            if (hasWebGLFailed || !renderer) {
                initCSSFallback();
            }
        }, 200);
    }

    function onVisibilityChange() {
        isVisible = !document.hidden;
        if (document.body) {
            document.body.classList.toggle('fxre-anim-paused', document.hidden);
        }

        if (isVisible && !animationId && renderer && !isReducedMotion()) {
            animate();
        } else if (!isVisible && animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    function destroyThree() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (renderer) {
            try { renderer.dispose(); } catch(_) {}
            renderer = null;
        }
        scene = null;
        camera = null;
        particles = null;
        particleMaterial = null;
        threeBooted = false;

        var canvas = document.getElementById('particle-canvas');
        if (canvas) canvas.classList.remove('active');
    }

    function updateTheme() {
        if (!particleMaterial) return;
        var theme = document.documentElement.getAttribute('data-theme') || 'dark';
        particleMaterial.color = theme === 'light' ? new THREE.Color(0xFF8FB0) : new THREE.Color(0xFFB6D9);
        particleMaterial.opacity = theme === 'light' ? 0.5 : 0.75;
        if (particleMaterial.needsUpdate) particleMaterial.needsUpdate = true;
    }

    function loadThreeJS(callback) {
        if (isThreeLoaded()) {
            callback(true);
            return;
        }

        var cdnUrls = [
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
            'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
            'https://unpkg.com/three@0.128.0/build/three.min.js'
        ];
        var currentIndex = 0;

        function tryLoad() {
            if (currentIndex >= cdnUrls.length) {
                callback(false);
                return;
            }

            var script = document.createElement('script');
            script.async = true;
            script.src = cdnUrls[currentIndex];
            currentIndex++;

            script.onload = function() {
                if (isThreeLoaded()) callback(true);
                else tryLoad();
            };
            script.onerror = function() { tryLoad(); };
            document.head.appendChild(script);
        }

        tryLoad();
    }

    function tryUpgradeToThree() {
        if (threeBooted || hasWebGLFailed || isReducedMotion()) return;
        if (safeGetStorage('snowfluff-particles') === 'css') return;
        /* 窄屏默认停留在 CSS，避免首屏抢 WebGL */
        if ((window.innerWidth || 800) < 768 && safeGetStorage('snowfluff-particles') !== 'three') return;

        loadThreeJS(function(loaded) {
            if (loaded && !hasWebGLFailed) initThree();
            else showCSSFallback();
        });
    }

    function init() {
        initCSSFallback();
        showCSSFallback();

        var lowPerf = safeGetStorage('snowfluff-particles') === 'css';
        if (lowPerf || isReducedMotion()) return;

        document.addEventListener('visibilitychange', function() {
            if (document.body) {
                document.body.classList.toggle('fxre-anim-paused', document.hidden);
            }
        });

        /* P0：首屏只跑轻量 CSS 雪；空闲后再尝试 Three（减少同步 CDN + WebGL 启动卡顿） */
        scheduleIdle(tryUpgradeToThree, 2800);
    }

    window.SnowParticles = {
        init: init,
        updateTheme: updateTheme,
        useCSS: function() {
            safeSetStorage('snowfluff-particles', 'css');
            destroyThree();
            initCSSFallback();
            showCSSFallback();
        },
        useThree: function() {
            safeSetStorage('snowfluff-particles', 'three');
            if (!renderer) tryUpgradeToThree();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* P2-4: Mobile auto-degrade + idle pause */
    var isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
        var canvas = document.getElementById('particle-canvas');
        if (canvas) { canvas.style.display = 'none'; }
    }
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            if (window.SnowParticles && window.SnowParticles.useCSS) {
                window.SnowParticles.useCSS();
            }
        }
    });
})();
