#!/usr/bin/env node
/**
 * 极端自检：XSS 粗检、会话符号、migration 缺口、静态路径可达性
 * 用法: node scripts/extreme-audit.mjs [baseUrl]
 * 例:   node scripts/extreme-audit.mjs http://127.0.0.1:8848
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.argv[2] || '';
let failed = 0;
let warned = 0;

function ok(msg) { console.log('OK  ', msg); }
function fail(msg) { console.log('FAIL', msg); failed++; }
function note(msg) { console.log('NOTE', msg); warned++; }

function read(rel) {
    return readFileSync(join(root, rel), 'utf8');
}

console.log('=== XSS / 渲染安全粗检 ===');
const shield = read('js/security-shield.js');
if (/return !DANGEROUS_URL\.test\(url\)/.test(shield)) fail('isSafeUrl 仍为 allow-by-default');
else ok('isSafeUrl 白名单拒绝默认');
if (/url\.indexOf\('\/\/'\) === 0\)\s*return true/.test(shield)) fail('isSafeUrl 仍无校验放行协议相对 //');
else ok('isSafeUrl 拒绝协议相对 //');
if (/data:image\/\(png\|jpe\?g\|gif\|webp\|svg\\\+xml\)/.test(shield)) fail('isSafeUrl 仍允许 data:image/svg+xml');
else ok('isSafeUrl 禁止 svg+xml data URI');
if (/sanitizeColor:\s*sanitizeColor/.test(shield)) ok('sanitizeColor export');
else fail('sanitizeColor export');
if (/logViolation:\s*logViolation/.test(shield)) ok('logViolation export');
else fail('logViolation export');
if (/DANGEROUS_URL|javascript\s*\|/.test(shield)) ok('dangerous scheme 检测');
else fail('dangerous scheme 检测');

const forumJs = read('forum/js/forum.js');
if (forumJs.includes('safeMediaUrl') && forumJs.includes('SecurityShield.init')) ok('forum safeMediaUrl + SecurityShield.init');
else fail('forum 缺少 safeMediaUrl 或 SecurityShield.init');

const mainJs = read('js/main.js');
if (mainJs.includes('sanitizeColor') && /SecurityShield\.isSafeUrl/.test(mainJs)) ok('main sanitizeColor + isSafeUrl');
else fail('main 社区卡片颜色/URL 消毒不完整');

/* 粗检：帖卡封面不得直接拼未消毒的 s.image */
if (/src="' \+ escapeHTML\(s\.image\)/.test(forumJs) || /src="' \+ s\.image/.test(forumJs)) {
    fail('forum 封面仍直接使用 s.image');
} else {
    ok('forum 封面经 safeMediaUrl');
}

console.log('\n=== 双站会话 / Auth 符号 ===');
const authForum = read('forum/js/forum-auth.js');
const authMain = read('js/auth-manager.js');
const cloud = read('forum/js/forum-cloud.js');
const forumSb = read('forum/js/forum-supabase.js');
const mainSb = read('js/supabase-adapter.js');
[
    [authForum, 'applyUser', 'forum-auth applyUser'],
    [authForum, 'stf_explicit_logout', 'forum 显式退出标记'],
    [authForum, "scope: 'global'", 'forum logout global'],
    [authForum, '双套 Auth 边界', 'forum-auth 双套边界注释'],
    [cloud, 'ensureSession', 'forum-cloud ensureSession'],
    [cloud, 'signInAnonymously', '匿名 ensureSession'],
    [authMain, 'ensureProfile', '主站 ensureProfile'],
    [authMain, 'fxre_auth_session', '主站会话镜像'],
    [authMain, '双套 Auth 边界', 'auth-manager 双套边界注释'],
    [forumSb, 'persistSession: true', 'forum persistSession'],
    [mainSb, 'persistSession: true', '主站 persistSession'],
    [forumSb, 'lmlyfyjffaaddysiliht', 'forum 同项目 URL'],
    [mainSb, 'lmlyfyjffaaddysiliht', '主站同项目 URL']
].forEach(([src, needle, label]) => {
    if (src.includes(needle)) ok(label);
    else fail(label);
});
if (existsSync(join(root, 'docs/STATUS.md'))) ok('docs/STATUS.md');
else note('缺 docs/STATUS.md');
if (existsSync(join(root, '.github/workflows/static-checks.yml'))) ok('CI static-checks workflow');
else note('缺 .github/workflows/static-checks.yml');

console.log('\n=== 论坛体验关键路径 ===');
const chat = read('forum/js/forum-chat.js');
const forumCss = read('forum/forum.css');
[
    [chat, 'setChatExpanded', '聊天放大'],
    [chat, 'touchSelfPresence', 'presence'],
    [chat, 'BroadcastChannel', '多标签 presence'],
    [forumCss, 'transform: none !important', '放大态禁用 transform'],
    [forumJs, 'initArchiveOrbit', '角色环'],
    [forumJs, 'frameEl', '调频 frame 不遮蔽 onTunerFrame'],
    [read('js/snow-easter.js'), 'isTypingTarget', '主站彩蛋输入豁免'],
    [read('forum/js/forum-easter.js'), "t.closest('#stf-chat-card')", '论坛彩蛋输入豁免']
].forEach(([src, needle, label]) => {
    if (src.includes(needle)) ok(label);
    else fail(label);
});

console.log('\n=== Migration 链 ===');
const migFiles = existsSync(join(root, 'db')) ? readdirSync(join(root, 'db')) : [];
for (let n = 1; n <= 27; n++) {
    const prefix = `migration-${String(n).padStart(3, '0')}`;
    if (migFiles.some(f => f.startsWith(prefix))) ok(prefix);
    else fail('缺 ' + prefix);
}
const m020 = migFiles.filter(f => f.startsWith('migration-020'));
if (m020.length > 1) note('migration-020 多文件：仅 tables 有效；chat 已废弃，用 023 — ' + m020.join(', '));
if (!migFiles.some(f => f.includes('027'))) note('027 nickname RLS 需在云端 SQL Editor 执行');

console.log('\n=== package.json 脚本与版本 ===');
try {
    const pkg = JSON.parse(read('package.json'));
    if (pkg.scripts && pkg.scripts['smoke-check']) ok('smoke-check script');
    else fail('缺 smoke-check script');
    if (String(pkg.version) === '10.0.0') ok('version ' + pkg.version);
    else if (String(pkg.version).startsWith('10.')) note('version=' + pkg.version + '（期望 10.0.0）');
    else fail('version=' + pkg.version + '（期望 10.0.0）');
    const m020 = String(pkg.scripts && pkg.scripts['db:migrate-020'] || '');
    if (/migration-020-forum-tables/.test(m020) && /023/.test(m020) && !/then migration-020-forum-chat/.test(m020)) {
        ok('db:migrate-020 指引 tables + 023（非废弃 chat）');
    } else {
        fail('db:migrate-020 仍指向废弃 chat 或指引不全');
    }
    if (/version:\s*'v10\.0'/.test(mainJs)) ok('__FXRE_API.version v10.0');
    else fail('__FXRE_API.version 未对齐 v10.0');
    if (read('index.html').includes('v10.0')) ok('主站页脚 v10.0');
    else fail('主站页脚缺 v10.0');
    if (read('forum/index.html').includes('v10.0')) ok('论坛页脚 v10.0');
    else fail('论坛页脚缺 v10.0');
} catch (e) {
    fail('package.json 解析失败');
}

if (baseUrl) {
    console.log('\n=== HTTP 静态路径 (' + baseUrl + ') ===');
    const paths = ['/', '/index.html', '/forum/', '/forum/index.html', '/css/style.css', '/forum/forum.css', '/js/main.js', '/forum/js/forum.js', '/assets/favicon.svg', '/reset-password.html'];
    for (const p of paths) {
        try {
            const res = await fetch(baseUrl.replace(/\/$/, '') + p, { redirect: 'follow' });
            if (res.ok) ok(p + ' → ' + res.status);
            else fail(p + ' → ' + res.status);
        } catch (e) {
            fail(p + ' → ' + (e.message || e));
        }
    }
} else {
    note('未传 baseUrl，跳过 HTTP 探测（可先 npm run serve）');
}

/* 内联单元：isSafeUrl 逻辑复现（须与 js/security-shield.js 保持一致） */
console.log('\n=== isSafeUrl 逻辑断言（源码契约） ===');
const cases = [
    ['https://x.com/a.png', true],
    ['http://x.com/a.png', true],
    ['data:image/png;base64,aaa', true],
    ['data:image/svg+xml;base64,PHN2Zy', false],
    ['//evil.example/x.png', false],
    ['/assets/foo.png', true],
    ['javascript:alert(1)', false],
    ['data:text/html,<script>', false],
    ['ftp://x/y', false],
    ['assets/foo.png', true]
];
function evalIsSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    url = url.trim();
    const DANGEROUS_URL = /^(javascript|vbscript|data\s*:\s*text\/html|file):/i;
    if (!url || DANGEROUS_URL.test(url)) return false;
    if (url.indexOf('//') === 0) return false;
    if (/^https?:\/\//i.test(url)) return true;
    if (url.indexOf('/') === 0) return true;
    if (/^blob:/i.test(url)) return true;
    if (/^data:image\/svg\+xml/i.test(url)) return false;
    if (/^data:image\/(png|jpe?g|gif|webp);/i.test(url)) return true;
    if (/^[a-zA-Z0-9][\w./%-]*$/.test(url) && url.indexOf('..') === -1) return true;
    return false;
}
cases.forEach(([u, expect]) => {
    const got = evalIsSafeUrl(u);
    if (got === expect) ok('isSafeUrl(' + u.slice(0, 28) + ')=' + got);
    else fail('isSafeUrl(' + u + ') got ' + got + ' expect ' + expect);
});

console.log(failed ? `\n❌ extreme-audit ${failed} 失败` + (warned ? `，${warned} 提示` : '') : `\n✅ extreme-audit 通过` + (warned ? `（${warned} 提示）` : ''));
process.exit(failed ? 1 : 0);
