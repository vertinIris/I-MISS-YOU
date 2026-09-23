/* 飞行雪绒 · Refined interactions
 * 原则：一次一处高光；仅 transform/opacity；触摸设备与 reduced-motion 禁用磁性。
 */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia("(pointer: coarse)").matches;

  /* 滚动渐显（错峰） */
  var reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* 磁性按钮（仅精确指针） */
  if (!reduce && !coarse) {
    document.querySelectorAll(".magnetic").forEach(function (btn) {
      var raf = null, tx = 0, ty = 0;
      btn.addEventListener("pointermove", function (ev) {
        var r = btn.getBoundingClientRect();
        tx = (ev.clientX - (r.left + r.width / 2)) * 0.18;
        ty = (ev.clientY - (r.top + r.height / 2)) * 0.28;
        if (!raf) raf = requestAnimationFrame(apply);
      });
      btn.addEventListener("pointerleave", function () { tx = ty = 0; if (!raf) raf = requestAnimationFrame(apply); });
      function apply() {
        btn.style.transform = "translate(" + tx + "px," + ty + "px)";
        raf = null;
      }
    });
  }

  /* 导航：下滚隐藏、上滚显示 */
  var nav = document.getElementById("nav");
  var last = 0, ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      if (y > 120 && y > last) nav.classList.add("hidden");
      else nav.classList.remove("hidden");
      last = y; ticking = false;
    });
  }, { passive: true });
})();
