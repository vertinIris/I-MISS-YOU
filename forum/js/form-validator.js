/**
 * Just-Validate 表单验证增强（window.FXRE_FormValidator）
 * --------------------------------------------------
 * 用 Just-Validate 为论坛注册/登录表单增加前端验证层。
 * 不替换现有提交逻辑，仅在 submit 前拦截无效输入，显示友好的错误提示。
 *
 * 依赖：vendor/just-validate/just-validate.production.min.js
 * 加载顺序：just-validate(defer) → 本模块(defer) → bundle-forum.js(defer)
 */
(function () {
    'use strict';

    function initRegisterForm() {
        var form = document.getElementById('stf-register-form');
        if (!form || typeof JustValidate === 'undefined') return;

        var validator = new JustValidate(form, {
            errorFieldCssClass: 'is-invalid',
            errorLabelCssClass: 'stf-form-error',
            errorLabelStyle: { color: '#e74c3c', fontSize: '13px', marginTop: '4px' },
            focusInvalidField: true,
            lockForm: false
        });

        var emailField = form.querySelector('#stf-register-email');
        var nameField = form.querySelector('#stf-register-name');
        var pwdField = form.querySelector('#stf-register-pwd');
        var pwd2Field = form.querySelector('#stf-register-pwd2');

        if (emailField) {
            validator.addField(emailField, [
                { rule: 'required', errorMessage: '请填写邮箱' },
                { rule: 'email', errorMessage: '邮箱格式不正确' }
            ]);
        }
        if (nameField) {
            validator.addField(nameField, [
                { rule: 'required', errorMessage: '请填写显示名' },
                { rule: 'minLength', value: 2, errorMessage: '至少 2 个字符' },
                { rule: 'maxLength', value: 20, errorMessage: '最多 20 个字符' }
            ]);
        }
        if (pwdField) {
            validator.addField(pwdField, [
                { rule: 'required', errorMessage: '请设置口令' },
                { rule: 'minLength', value: 6, errorMessage: '至少 6 位' }
            ]);
        }
        if (pwd2Field) {
            validator.addField(pwd2Field, [
                { rule: 'required', errorMessage: '请再次输入口令' },
                { validator: function (v, fields) {
                    return v === fields['#stf-register-pwd'].elem.value;
                }, errorMessage: '两次口令不一致' }
            ]);
        }

        /* 拦截 submit：验证通过才放行给 forum.js 原有逻辑 */
        form.addEventListener('submit', function (e) {
            validator.revalidate().then(function (isValid) {
                if (!isValid) { e.preventDefault(); e.stopImmediatePropagation(); }
            });
        }, true); // 捕获阶段先于 forum.js 的冒泡监听

        return validator;
    }

    function initLoginForm() {
        var form = document.getElementById('stf-login-form');
        if (!form || typeof JustValidate === 'undefined') return;

        var validator = new JustValidate(form, {
            errorFieldCssClass: 'is-invalid',
            errorLabelCssClass: 'stf-form-error',
            errorLabelStyle: { color: '#e74c3c', fontSize: '13px', marginTop: '4px' },
            focusInvalidField: true,
            lockForm: false
        });

        var emailField = form.querySelector('#stf-login-email');
        var pwdField = form.querySelector('#stf-login-pwd');

        if (emailField) {
            validator.addField(emailField, [
                { rule: 'required', errorMessage: '请填写邮箱' },
                { rule: 'email', errorMessage: '邮箱格式不正确' }
            ]);
        }
        if (pwdField) {
            validator.addField(pwdField, [
                { rule: 'required', errorMessage: '请输入口令' },
                { rule: 'minLength', value: 6, errorMessage: '至少 6 位' }
            ]);
        }

        form.addEventListener('submit', function (e) {
            validator.revalidate().then(function (isValid) {
                if (!isValid) { e.preventDefault(); e.stopImmediatePropagation(); }
            });
        }, true);

        return validator;
    }

    function init() {
        try {
            initRegisterForm();
            initLoginForm();
        } catch (e) {
            console.warn('[FormValidator] 初始化失败，降级为浏览器原生验证:', e.message || e);
        }
    }

    window.FXRE_FormValidator = { init: init };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
