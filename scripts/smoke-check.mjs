#!/usr/bin/env node
/**
 * 飞行雪绒 smoke-check — 语法检查 + 关键文件存在性
 * 用法: node scripts/smoke-check.mjs
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsFiles = [
    'js/main.js', 'js/repository.js', 'js/supabase-adapter.js', 'js/auth-manager.js',
    'js/sync-manager.js', 'js/admin-panel.js', 'js/content-utils.js', 'js/upload-manager.js'
];
const assets = ['index.html', 'reset-password.html', 'assets/favicon.svg', 'assets/og-cover.png'];

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

console.log(failed ? `\n❌ ${failed} 项失败` : '\n✅ smoke-check 通过');
process.exit(failed ? 1 : 0);
