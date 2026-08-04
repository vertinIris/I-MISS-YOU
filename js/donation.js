/**
 * donation.js — 请制作人喝杯咖啡 / 支持创作者
 *
 * - 在主站与论坛共用
 * - 提供右下角悬浮入口 + 弹窗
 * - 仅通过入口手动打开，不再自动弹出
 */
(function () {
    'use strict';

    var MODAL_ID = 'donate-modal';
    var FAB_ID = 'donate-fab';
    var PAY_ACCOUNT = 'vertiniris@example.com'; // 占位，替换为真实收款账号

    function $(id) { return document.getElementById(id); }

    function escapeHTML(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function openModal() {
        var modal = $(MODAL_ID);
        if (!modal) return;
        modal.hidden = false;
        // 强制重绘以触发 transition
        void modal.offsetWidth;
        modal.classList.add('open');
        var panel = modal.querySelector('.donate-panel');
        if (panel) panel.focus();
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        var modal = $(MODAL_ID);
        if (!modal) return;
        modal.classList.remove('open');
        setTimeout(function () {
            if (!modal.classList.contains('open')) modal.hidden = true;
        }, 300);
        document.body.style.overflow = '';
    }

    function copyAccount() {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(PAY_ACCOUNT).then(function () {
                    showMiniToast('收款账号已复制');
                }).catch(function () {
                    fallbackCopy();
                });
            } else {
                fallbackCopy();
            }
        } catch (e) { fallbackCopy(); }
    }

    function fallbackCopy() {
        var ta = document.createElement('textarea');
        ta.value = PAY_ACCOUNT;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); showMiniToast('收款账号已复制'); }
        catch (e) { showMiniToast('复制失败，请手动复制'); }
        document.body.removeChild(ta);
    }

    function showMiniToast(text) {
        var existing = document.querySelector('.donate-mini-toast');
        if (existing) existing.remove();
        var el = document.createElement('div');
        el.className = 'donate-mini-toast';
        el.textContent = text;
        el.setAttribute('role', 'status');
        el.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:10002;padding:8px 16px;border-radius:999px;background:rgba(20,20,35,.92);color:#fff;font-size:.85rem;box-shadow:0 4px 16px rgba(0,0,0,.35);opacity:0;transition:opacity .25s ease;';
        document.body.appendChild(el);
        requestAnimationFrame(function () { el.style.opacity = '1'; });
        setTimeout(function () {
            el.style.opacity = '0';
            setTimeout(function () { el.remove(); }, 250);
        }, 1800);
    }

    function onKeydown(e) {
        if (e.key === 'Escape') closeModal();
    }

    function bindOnce() {
        var fab = $(FAB_ID);
        var modal = $(MODAL_ID);
        if (!modal) return;
        if (fab && !fab.__donateBound) {
            fab.__donateBound = true;
            fab.addEventListener('click', openModal);
        }
        if (!modal.__donateBound) {
            modal.__donateBound = true;
            modal.addEventListener('click', function (e) {
                if (e.target === modal) closeModal();
            });
            var closeBtn = modal.querySelector('.donate-close');
            if (closeBtn) closeBtn.addEventListener('click', closeModal);
            var copyBtn = modal.querySelector('.donate-copy-btn');
            if (copyBtn) copyBtn.addEventListener('click', copyAccount);
            var laterBtn = modal.querySelector('.donate-later-btn');
            if (laterBtn) laterBtn.addEventListener('click', closeModal);
            document.addEventListener('keydown', onKeydown);
        }
    }

    function init() {
        bindOnce();
        // 仅通过悬浮入口手动打开，不再自动弹出
    }

    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);

    // 暴露全局 API，方便手动触发
    window.FlyingEdelweissDonate = { open: openModal, close: closeModal };
})();
