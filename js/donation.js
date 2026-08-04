/**
 * donation.js — 请制作人喝杯咖啡 / 支持创作者
 *
 * - 在主站与论坛共用
 * - 提供右下角悬浮入口 + 弹窗
 * - 仅通过入口手动打开，不再自动弹出
 * - 复制账号：Clipboard API + execCommand 降级；成功 toast
 */
(function () {
    'use strict';

    var MODAL_ID = 'donate-modal';
    var FAB_ID = 'donate-fab';
    /* 占位收款账号：请替换为真实微信/支付宝账号、爱发电链接等 */
    var FALLBACK_ACCOUNT = 'vertiniris@example.com';

    function $(id) { return document.getElementById(id); }

    function resolveAccount() {
        var el = document.querySelector('.donate-account-value') || $('donate-account-value');
        if (el) {
            var fromData = (el.getAttribute('data-account') || '').trim();
            var fromText = (el.textContent || '').trim();
            if (fromData) return fromData;
            if (fromText) return fromText;
        }
        return FALLBACK_ACCOUNT;
    }

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

    function showMiniToast(text) {
        var existing = document.querySelector('.donate-mini-toast');
        if (existing) existing.remove();
        var el = document.createElement('div');
        el.className = 'donate-mini-toast';
        el.textContent = text;
        el.setAttribute('role', 'status');
        el.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:10002;padding:8px 16px;border-radius:999px;background:rgba(20,20,35,.92);color:#fff;font-size:.85rem;box-shadow:0 4px 16px rgba(0,0,0,.35);opacity:0;transition:opacity .25s ease;pointer-events:none;';
        document.body.appendChild(el);
        requestAnimationFrame(function () { el.style.opacity = '1'; });
        setTimeout(function () {
            el.style.opacity = '0';
            setTimeout(function () { el.remove(); }, 250);
        }, 1800);
    }

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.setAttribute('aria-hidden', 'true');
        ta.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;padding:0;border:none;outline:none;box-shadow:none;background:transparent;opacity:0;';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, text.length);
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        if (ok) showMiniToast('收款账号已复制');
        else showMiniToast('复制失败，请手动复制：' + text);
        return ok;
    }

    function copyAccount() {
        var account = resolveAccount();
        if (!account) {
            showMiniToast('暂无收款账号，请联系制作人补充');
            return;
        }
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(account).then(function () {
                    showMiniToast('收款账号已复制');
                }).catch(function () {
                    fallbackCopy(account);
                });
                return;
            }
        } catch (e) { /* fallback */ }
        fallbackCopy(account);
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
            var copyBtn = modal.querySelector('.donate-copy-btn');
            if (copyBtn) copyBtn.addEventListener('click', function (e) {
                e.preventDefault();
                copyAccount();
            });
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
        close: closeModal,
        copyAccount: copyAccount,
        getAccount: resolveAccount
    };
})();
