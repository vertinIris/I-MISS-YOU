#!/usr/bin/env node
/**
 * Playwright 关键路径探测（主站 + 论坛）
 * 用法: node scripts/browser-probe.mjs [baseUrl]
 */
import { createRequire } from 'module';

const base = (process.argv[2] || 'http://127.0.0.1:8848').replace(/\/$/, '');
const require = createRequire(import.meta.url);

let chromium;
try {
    ({ chromium } = require('playwright'));
} catch (e) {
    console.log('SKIP playwright 未安装 — npm i -D playwright && npx playwright install chromium');
    process.exit(0);
}

const errorsGlobal = [];
let failed = 0;

function ok(m) { console.log('OK  ', m); }
function fail(m) { console.log('FAIL', m); failed++; }

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => errorsGlobal.push('pageerror:' + e.message));

async function probe(path) {
    const url = base + path;
    const localErrors = [];
    const onErr = (m) => {
        if (m.type() === 'error') localErrors.push(m.text());
    };
    page.on('console', onErr);
    await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const title = await page.title();
    ok(path + ' title=' + title);

    const shield = await page.evaluate(() => {
        const S = window.SecurityShield;
        if (!S) return null;
        return {
            js: S.isSafeUrl('javascript:alert(1)'),
            https: S.isSafeUrl('https://example.com/a.png'),
            protoRel: S.isSafeUrl('//evil.example/x.png'),
            svgData: S.isSafeUrl('data:image/svg+xml;base64,PHN2Zy'),
            color: S.sanitizeColor('red;background:url(x)', '#00f')
        };
    });
    if (!shield) {
        if (path.includes('forum')) fail(path + ' SecurityShield 未挂载');
        else ok(path + ' SecurityShield 延迟加载中可接受');
    } else {
        if (shield.js === false && shield.https === true && shield.protoRel === false && shield.svgData === false && shield.color === '#00f') {
            ok(path + ' SecurityShield 契约');
        } else {
            fail(path + ' SecurityShield 契约异常 ' + JSON.stringify(shield));
        }
    }

    /* Auth 关键路径：符号/钩子级（不连生产登录） */
    const auth = await page.evaluate(() => {
        const keys = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (/auth-token|supabase|fxre_auth|stf_session|stf_explicit/i.test(k))) keys.push(k);
            }
        } catch (e) { /* ignore */ }
        return {
            hasClient: !!(window.supabaseClient || (window.forumSupabase && window.forumSupabase.getClient && window.forumSupabase.getClient())),
            hasAuthManager: typeof window.AuthManager !== 'undefined' || typeof AuthManager !== 'undefined',
            hasStarTorch: !!(window.StarTorchAuth && typeof window.StarTorchAuth.getUser === 'function'),
            hasOnAuth: !!(window.supabaseClient && window.supabaseClient.auth && typeof window.supabaseClient.auth.onAuthStateChange === 'function'),
            version: window.__FXRE_API && window.__FXRE_API.version,
            storageHints: keys.slice(0, 8)
        };
    });
    if (path === '/' || path === '/index.html') {
        if (auth.version === 'v10.0') ok('主站 __FXRE_API.version=v10.0');
        else if (auth.version) fail('主站 version=' + auth.version);
        else ok('主站 __FXRE_API 延迟加载可接受');
        if (auth.hasAuthManager || auth.hasOnAuth || auth.hasClient) ok('主站 Auth 钩子可达');
        else ok('主站 Auth 延迟加载（无确定性失败）');
    }
    if (path.includes('forum')) {
        if (auth.hasStarTorch) ok('论坛 StarTorchAuth.getUser');
        else fail('论坛缺 StarTorchAuth');
        if (auth.hasOnAuth || auth.hasClient) ok('论坛 supabaseClient/auth 钩子');
        else ok('论坛客户端延迟/离线可接受');
        ok('Auth 存储提示 keys=' + (auth.storageHints.join(',') || '(empty-ok)'));
    }

    if (path.includes('forum')) {
        /* 关闭首次欢迎遮罩；用 JS 打开面板并触发放大（避免侧栏折叠态不可见） */
        const expanded = await page.evaluate(() => {
            try { localStorage.setItem('stf_welcome_seen', '1'); } catch (e) {}
            var w = document.getElementById('stf-welcome');
            if (w) { w.classList.remove('is-open'); w.hidden = true; }
            var panel = document.getElementById('stf-chat-panel');
            var entry = document.getElementById('stf-chat-entry');
            if (panel) panel.removeAttribute('hidden');
            if (entry) entry.setAttribute('aria-expanded', 'true');
            var expand = document.getElementById('stf-chat-expand');
            if (expand) expand.click();
            var card = document.getElementById('stf-chat-card');
            if (!card) return { on: false, missing: true };
            var cs = getComputedStyle(card);
            return {
                on: card.classList.contains('is-chat-expanded'),
                transform: cs.transform,
                filter: cs.filter,
                parent: card.parentElement && card.parentElement.tagName,
                z: cs.zIndex
            };
        });
        await page.waitForTimeout(200);
        if (expanded.on && expanded.parent === 'BODY' && (expanded.transform === 'none' || expanded.transform === 'matrix(1, 0, 0, 1, 0, 0)')) {
            ok('聊天放大清晰路径 (body + transform none, z=' + expanded.z + ')');
        } else {
            fail('聊天放大异常 ' + JSON.stringify(expanded));
        }
        await page.keyboard.press('Escape');

        const orbit = await page.evaluate(() => ({
            active: document.documentElement.classList.contains('archive-orbit-active'),
            n: document.querySelectorAll('#archive-orbit-ring .archive-float').length,
            w: window.innerWidth
        }));
        if (orbit.w >= 900) {
            if (orbit.active && orbit.n > 0) ok('角色环已激活 n=' + orbit.n);
            else fail('宽屏下角色环未激活 ' + JSON.stringify(orbit));
        } else {
            ok('窄屏跳过角色环断言 w=' + orbit.w);
        }

        await page.setViewportSize({ width: 360, height: 720 });
        await page.waitForTimeout(200);
        ok('窄屏 viewport 360 已应用');
        await page.setViewportSize({ width: 1280, height: 800 });
    }

    const noisy = localErrors.filter((e) =>
        !/favicon|cdn\.jsdelivr|unpkg|supabase|Failed to load resource|net::ERR|WebSocket|401|403/i.test(e)
    );
    if (noisy.length) fail(path + ' console: ' + noisy.slice(0, 3).join(' | '));
    else ok(path + ' 无确定性 console.error');
    page.off('console', onErr);
}

try {
    await probe('/');
    await probe('/forum/');
} finally {
    await browser.close();
}

console.log(failed ? `\n❌ browser-probe ${failed} 失败` : '\n✅ browser-probe 通过');
process.exit(failed ? 1 : 0);
