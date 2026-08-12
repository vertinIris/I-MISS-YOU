/**
 * PhotoSwipe 画廊初始化（type="module"）
 * --------------------------------------------------
 * 为论坛帖子详情大图启用 PhotoSwipe 灯箱（手势缩放/键盘导航/移动端友好）。
 * 自动监听动态插入的 .stf-detail-cover 图片，点击时打开灯箱。
 *
 * 依赖：vendor/photoswipe/photoswipe.min.css + photoswipe-lightbox.esm.min.js + photoswipe.esm.min.js
 * 加载方式：ESM 动态 import（PhotoSwipe v5 仅提供 ESM bundle）
 */
import PhotoSwipeLightbox from '../vendor/photoswipe/photoswipe-lightbox.esm.min.js';

let lightbox = null;
const observed = new WeakSet();

function initLightbox() {
    if (lightbox) return;
    lightbox = new PhotoSwipeLightbox({
        gallery: '.stf-post-detail, #stf-post-detail',
        children: 'img.stf-detail-cover',
        pswpModule: () => import('../vendor/photoswipe/photoswipe.esm.min.js'),
        /* 从 <img> 提取大图 URL 与尺寸（帖子封面即原图） */
        dataSource: (el) => {
            const src = el.src;
            return {
                src: src,
                width: el.naturalWidth || 1200,
                height: el.naturalHeight || 800,
                alt: el.alt || ''
            };
        }
    });
    lightbox.init();
}

function observeNewImages() {
    /* 监听动态插入的帖子详情图片 */
    const observer = new MutationObserver(() => {
        const imgs = document.querySelectorAll('img.stf-detail-cover');
        imgs.forEach((img) => {
            if (!observed.has(img)) {
                observed.add(img);
                img.style.cursor = 'zoom-in';
                img.addEventListener('click', () => {
                    if (lightbox) {
                        lightbox.loadAndOpen(0, { gallery: img.closest('.stf-post-detail, #stf-post-detail, .stf-detail-content'), children: 'img.stf-detail-cover' });
                    }
                });
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initLightbox(); observeNewImages(); });
} else {
    initLightbox();
    observeNewImages();
}
