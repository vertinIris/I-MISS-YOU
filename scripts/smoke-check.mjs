#!/usr/bin/env node
/**
 * 飞行雪绒 / 星炬学院 smoke-check — 语法 + 资源 + 关键符号 + migration 链
 * 用法: node scripts/smoke-check.mjs
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const jsFiles = [
    'js/main.js', 'js/repository.js', 'js/supabase-adapter.js', 'js/auth-manager.js',
    'js/sync-manager.js', 'js/admin-panel.js', 'js/admin-auth.js', 'js/content-utils.js',
    'js/upload-manager.js', 'js/security-shield.js', 'js/rate-limiter.js',
    'js/rate-limiter-client.js', 'js/donation.js', 'js/particles.js',
    'js/snow-easter.js', 'js/secret-portal.js', 'js/snow-realm.js',
    'forum/js/forum.js', 'forum/js/forum-auth.js', 'forum/js/forum-cloud.js',
    'forum/js/forum-chat.js', 'forum/js/forum-data.js', 'forum/js/forum-sync.js',
    'forum/js/forum-upload.js', 'forum/js/forum-easter.js', 'forum/js/forum-supabase.js'
];

const assets = [
    'index.html', 'reset-password.html', 'forum/index.html',
    'assets/favicon.svg', 'assets/og-cover.png',
    'forum/forum.css', 'forum/forum-theme.css', 'css/donation.css'
];

const symbolChecks = [
    { file: 'js/admin-panel.js', includes: ['batchModerateComments', 'admin-tab'] },
    { file: 'js/supabase-adapter.js', includes: ['getRecentComments', 'upsertProfile', 'deleteBookmarkCollection'] },
    { file: 'js/auth-manager.js', includes: ['ensureProfile'] },
    { file: 'js/main.js', includes: ['syncAllPostCommentCounts', 'applyRealtimeCommentEvent', 'sanitizeColor'] },
    { file: 'js/security-shield.js', includes: ['isSafeUrl', 'sanitizeColor', 'logViolation'] },
    { file: 'index.html', includes: ['admin-tab', 'collection-rename-btn', 'v10.0'] },
    { file: 'forum/index.html', includes: ['v10.0', 'stf-hidden-trigger'] },
    { file: 'js/main.js', includes: ["version: 'v10.0'"] },
    { file: 'docs/STATUS.md', includes: ['v10.0', 'migration-023'] },
    { file: '.github/workflows/static-checks.yml', includes: ['smoke-check', 'extreme-audit'] },
    { file: 'forum/js/forum.js', includes: ['safeMediaUrl', 'SecurityShield.init', 'submitBusy', 'openPostDetail', 'is_pinned', 'initForumRealmSelector', 'initScrollReveal'] },
    { file: 'js/snow-realm.js', includes: ['snowfluff-realm-sync', 'FORUM_COPY', 'BroadcastChannel'] },
    { file: 'forum/index.html', includes: ['stf-realm-dropdown', 'snow-realm.js', 'id="worldview"', 'lore-card', '世界观考据'] },
    { file: 'forum/js/forum-cloud.js', includes: ['is_pinned', 'parent_id'] },
    { file: 'docs/CONTENT-PIPELINE.md', includes: ['content:build', '论坛内容'] },
    { file: 'forum/js/forum-auth.js', includes: ['updateNickname', 'signOut', 'applyUser'] },
    { file: 'forum/js/forum-chat.js', includes: ['setChatExpanded', 'touchSelfPresence'] },
    { file: 'forum/forum.css', includes: ['transform: none !important', '--stf-z-chat-expand', 'stf-post-detail', '#worldview:target .reveal'] }
];

/** 期望存在的 migration 前缀（020 有 tables/chat 双文件属历史命名，均计入） */
const MIGRATION_MAX = 28;

let failed = 0;

console.log('=== JS 语法检查 ===');
for (const f of jsFiles) {
    const p = join(root, f);
    if (!existsSync(p)) {
        console.log('MISSING', f);
        failed++;
        continue;
    }
    try {
        execSync(`node --check "${p}"`, { stdio: 'pipe' });
        console.log('OK', f);
    } catch (e) {
        console.log('FAIL', f);
        failed++;
    }
}

console.log('\n=== 关键资源 ===');
for (const f of assets) {
    const ok = existsSync(join(root, f));
    console.log(ok ? 'OK' : 'MISSING', f);
    if (!ok) failed++;
}

console.log('\n=== 符号断言 ===');
for (const check of symbolChecks) {
    const p = join(root, check.file);
    if (!existsSync(p)) {
        console.log('MISSING', check.file);
        failed++;
        continue;
    }
    const content = readFileSync(p, 'utf8');
    const missing = check.includes.filter(s => !content.includes(s));
    if (missing.length) {
        console.log('FAIL', check.file, 'missing:', missing.join(', '));
        failed++;
    } else {
        console.log('OK', check.file);
    }
}

console.log(`\n=== Migration 文件 (001-${String(MIGRATION_MAX).padStart(3, '0')}) ===`);
const migDir = join(root, 'db');
if (existsSync(migDir)) {
    const files = readdirSync(migDir);
    for (let n = 1; n <= MIGRATION_MAX; n++) {
        const prefix = `migration-${String(n).padStart(3, '0')}`;
        const has = files.some(f => f.startsWith(prefix));
        console.log(has ? 'OK' : 'MISSING', `db/${prefix}*.sql`);
        if (!has) failed++;
    }
    /* 020 双文件提示（不计入失败）：chat 文件已废弃，聊天走 023 */
    const m020 = files.filter(f => f.startsWith('migration-020'));
    if (m020.length > 1) {
        console.log('NOTE migration-020 多文件：仅执行 migration-020-forum-tables.sql；聊天走 migration-023（勿跑废弃 forum-chat）');
    }
} else {
    console.log('MISSING db/');
    failed++;
}

console.log(failed ? `\n❌ ${failed} 项失败` : '\n✅ smoke-check 通过');
process.exit(failed ? 1 : 0);
