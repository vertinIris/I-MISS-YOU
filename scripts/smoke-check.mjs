#!/usr/bin/env node
/**
 * 飞行雪绒 smoke-check v9.6 — 语法 + 资源 + 关键符号断言
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
    'js/rate-limiter-client.js'
];
const assets = ['index.html', 'reset-password.html', 'assets/favicon.svg', 'assets/og-cover.png'];

const symbolChecks = [
    { file: 'js/admin-panel.js', includes: ['batchModerateComments', 'admin-tab'] },
    { file: 'js/supabase-adapter.js', includes: ['getRecentComments', 'upsertProfile', 'deleteBookmarkCollection'] },
    { file: 'js/auth-manager.js', includes: ['ensureProfile'] },
    { file: 'js/main.js', includes: ['syncAllPostCommentCounts', 'applyRealtimeCommentEvent', "version: 'v9.6'"] },
    { file: 'index.html', includes: ['admin-tab', 'collection-rename-btn', 'v9.6'] }
];

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
        execSync(`node -c "${p}"`, { stdio: 'pipe' });
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

console.log('\n=== Migration 文件 (001-015) ===');
const migDir = join(root, 'db');
if (existsSync(migDir)) {
    const files = readdirSync(migDir);
    for (let n = 1; n <= 15; n++) {
        const prefix = `migration-${String(n).padStart(3, '0')}`;
        const has = files.some(f => f.startsWith(prefix));
        console.log(has ? 'OK' : 'MISSING', `db/${prefix}*.sql`);
        if (!has) failed++;
    }
} else {
    console.log('MISSING db/');
    failed++;
}

console.log(failed ? `\n❌ ${failed} 项失败` : '\n✅ smoke-check 通过');
process.exit(failed ? 1 : 0);
