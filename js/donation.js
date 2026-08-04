/**
 * donation.js — 请制作人喝杯咖啡 / 支持创作者
 *
 * - 在主站与论坛共用
 * - 右下角悬浮入口 + 弹窗（扫码微信/支付宝）
 * - 仅通过入口手动打开；已移除「复制账号」（收款以二维码为准）
 */
(function () {
    'use strict';

    var MODAL_ID = 'donate-modal';
    var FAB_ID = 'donate-fab';

    function $(id) { return document.getElementById(id); }

    function openModal() {
        var modal = $(MODAL_ID);
        if (!modal) return;
        modal.hidden = false;
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

    function switchMethod(modal, method) {
        if (!modal) return;
        var tabs = modal.querySelectorAll('.donate-tab');
        var imgs = modal.querySelectorAll('.donate-qr-img');
        tabs.forEach(function (tab) {
            var active = tab.getAttribute('data-method') === method;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
        });
        imgs.forEach(function (img) {
            img.classList.toggle('is-active', img.getAttribute('data-method') === method);
        });
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
            var laterBtn = modal.querySelector('.donate-later-btn');
            if (laterBtn) laterBtn.addEventListener('click', closeModal);
            var tabs = modal.querySelectorAll('.donate-tab');
            tabs.forEach(function (tab) {
                tab.addEventListener('click', function () {
                    var method = tab.getAttribute('data-method');
                    if (method) switchMethod(modal, method);
                });
            });
            document.addEventListener('keydown', onKeydown);
        }
    }

    function init() {
        bindOnce();
    }

    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);

    window.FlyingEdelweissDonate = {
        open: openModal,
        close: closeModal
    };
})();
