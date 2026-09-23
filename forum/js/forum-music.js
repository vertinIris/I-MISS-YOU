/* ============================================================
   飞行雪绒 · 星炬学院论坛 — 音乐播放器（移植主站夜电台播放器）
   说明：站点仓库未提交音频文件，故播放为“界面级”模拟——
   播放/暂停、上下首、进度推进、唱片/磁带旋转、频谱可视化均为真实交互，
   仅音频本体为占位（无音频文件时静默推进）。接入真实音频时，
   把 TRACKS 的 src 指向文件并将 play()/timeupdate 接到 <audio> 即可。
   遵循 prefers-reduced-motion：关闭频谱与旋转动画。
   ============================================================ */
(function () {
    "use strict";

    var TRACKS = [
        { name: "渐湖小屋的雪", meta: "爱弥斯 · 环境音", dur: 180, src: "" },
        { name: "9072 频段的私语", meta: "飞行雪绒 · 夜电台", dur: 160, src: "" },
        { name: "黑海岸的潮声", meta: "漂泊者 · 环境音", dur: 252, src: "" }
    ];

    function $(id) { return document.getElementById(id); }

    var playBtn = $("play-btn");
    var prevBtn = $("prev-track");
    var nextBtn = $("next-track");
    var disc = $("music-disc");
    var tape = $("tape-deck");
    var nameEl = $("track-name");
    var metaEl = $("track-meta");
    var curEl = $("current-time");
    var totEl = $("total-time");
    var fill = $("progress-fill");
    var bar = $("progress-bar");
    var canvas = $("viz-canvas");
    var footerTime = $("sn-footer-time");

    // 任一必要节点缺失则不初始化，避免报错
    if (!playBtn || !prevBtn || !nextBtn) return;

    var reduceMotion = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var idx = 0;
    var elapsed = 0;
    var playing = false;
    var rafId = null;
    var lastTs = 0;

    function fmt(s) {
        s = Math.max(0, Math.floor(s));
        var m = Math.floor(s / 60);
        var r = s % 60;
        return m + ":" + (r < 10 ? "0" : "") + r;
    }

    function render() {
        var t = TRACKS[idx];
        nameEl.textContent = t.name;
        metaEl.textContent = t.meta;
        totEl.textContent = fmt(t.dur);
        curEl.textContent = fmt(elapsed);
        var pct = t.dur ? (elapsed / t.dur) * 100 : 0;
        fill.style.width = pct.toFixed(2) + "%";
    }

    function setPlaying(on) {
        playing = on;
        playBtn.classList.toggle("is-playing", on);
        if (disc) disc.classList.toggle("playing", on);
        if (tape) tape.classList.toggle("playing", on);
        playBtn.setAttribute("aria-label", on ? "暂停" : "播放");
        if (on) {
            lastTs = 0;
            loop(0);
            if (!reduceMotion) drawViz();
        } else {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = null;
            clearViz();
        }
    }

    function loop(ts) {
        if (!playing) return;
        if (!lastTs) lastTs = ts;
        var dt = (ts - lastTs) / 1000;
        lastTs = ts;
        // 以真实时间步进，约 1x 速度推进进度
        elapsed += dt;
        var t = TRACKS[idx];
        if (elapsed >= t.dur) {
            elapsed = 0;
            idx = (idx + 1) % TRACKS.length;
            render();
        } else {
            render();
        }
        rafId = requestAnimationFrame(loop);
    }

    function loadTrack(i, keepPlaying) {
        idx = (i + TRACKS.length) % TRACKS.length;
        elapsed = 0;
        render();
        if (keepPlaying) { lastTs = 0; }
    }

    playBtn.addEventListener("click", function () { setPlaying(!playing); });
    nextBtn.addEventListener("click", function () { loadTrack(idx + 1, playing); });
    prevBtn.addEventListener("click", function () {
        // 播放超 3 秒则回到本曲开头，否则上一首（通用播放器习惯）
        if (elapsed > 3) { elapsed = 0; render(); }
        else { loadTrack(idx - 1, playing); }
    });

    if (bar) {
        bar.addEventListener("click", function (e) {
            var rect = bar.getBoundingClientRect();
            var ratio = (e.clientX - rect.left) / rect.width;
            ratio = Math.min(1, Math.max(0, ratio));
            elapsed = ratio * TRACKS[idx].dur;
            render();
        });
    }

    /* ---- 频谱可视化（占位音频时的装饰性绘制） ---- */
    var ctx = canvas ? canvas.getContext("2d") : null;
    function resizeCanvas() {
        if (!canvas || !ctx) return;
        var r = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(r.width));
        canvas.height = Math.max(1, Math.floor(r.height));
    }
    function clearViz() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    var vizPhase = 0;
    function drawViz() {
        if (!ctx || !playing) return;
        var w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        var bars = 36;
        var bw = w / bars;
        vizPhase += 0.05;
        for (var i = 0; i < bars; i++) {
            var amp = (Math.sin(vizPhase + i * 0.5) * 0.5 + 0.5) *
                      (Math.sin(vizPhase * 0.7 + i * 0.2) * 0.5 + 0.5);
            var bh = Math.max(2, amp * h * 0.8);
            var g = ctx.createLinearGradient(0, h, 0, h - bh);
            g.addColorStop(0, "rgba(168,216,255,0.9)");
            g.addColorStop(1, "rgba(244,114,155,0.9)");
            ctx.fillStyle = g;
            ctx.fillRect(i * bw + 1, h - bh, bw - 2, bh);
        }
        rafId = requestAnimationFrame(drawViz);
    }

    /* ---- 尾页时钟 ---- */
    function tickClock() {
        if (!footerTime) return;
        var d = new Date();
        var p = function (n) { return (n < 10 ? "0" : "") + n; };
        footerTime.textContent = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    }
    if (footerTime) { tickClock(); setInterval(tickClock, 1000); }

    /* ---- 初始化 ---- */
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    render();
    // 默认载入首曲但不自动播放（尊重用户与自动播放策略）
})();
