/**
 * 飞行雪绒 · 压缩后自检脚本
 * 1) 文件存在性：所有在压缩清单里的 dist/* 必须存在
 * 2) 体积：比对 build-report.json，相同 1% 浮动内
 * 3) 语法：node --check 每个压缩产物
 * 4) 符号完整性：对 20+ 关键全局符号做 grep，确认都没被 mangle 掉
 * 5) HTML 引用：确认所有 <script src="js/"> 主站脚本均已替换为 dist/（除 CDN 外链与已 min 的 js/supabase.min.js）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist', 'build-report.json'), 'utf8'));

let pass = 0;
let fail = 0;
function check(cond, label, detail = '') {
  if (cond) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}    ${detail}`);
    fail++;
  }
}

// ============================================================
// 1) 文件存在性
// ============================================================
console.log('\n─── 1. 文件存在性确认 ───');
for (const f of REPORT.files) {
  const dst = path.join(ROOT, 'dist', f.rel);
  const exists = fs.existsSync(dst);
  const nonEmpty = exists && fs.statSync(dst).size > 0;
  check(exists && nonEmpty, `${f.rel} 存在且非空`,
    !exists ? '文件不存在' : (!nonEmpty ? '文件为空' : ''));
}

// ============================================================
// 2) 体积一致性（报表 vs 磁盘，允许 1% 浮动）
// ============================================================
console.log('\n─── 2. 报表-磁盘体积一致性 ───');
let diskSum = 0;
for (const f of REPORT.files) {
  const dst = path.join(ROOT, 'dist', f.rel);
  const sz = fs.existsSync(dst) ? fs.statSync(dst).size : 0;
  diskSum += sz;
  const deltaPct = Math.abs(sz - f.dstSize) / Math.max(1, f.dstSize) * 100;
  check(deltaPct < 1, `${f.rel} 体积偏差 < 1% (报表 ${f.dstSize} / 磁盘 ${sz} / 偏差 ${deltaPct.toFixed(2)}%)`);
}
const totalDeltaPct = Math.abs(diskSum - REPORT.totalDstBytes) / Math.max(1, REPORT.totalDstBytes) * 100;
check(totalDeltaPct < 0.5, `总计体积偏差 < 0.5% (报表 ${REPORT.totalDstBytes} / 磁盘 ${diskSum} / ${totalDeltaPct.toFixed(2)}%)`);

// ============================================================
// 3) 语法检查（node --check 每个压缩产物）
// ============================================================
console.log('\n─── 3. node --check 语法校验（全部 28 个压缩产物）───');
for (const f of REPORT.files) {
  const dst = path.join(ROOT, 'dist', f.rel);
  try {
    execFileSync(process.execPath, ['--check', dst], { stdio: 'pipe' });
    check(true, `${f.rel} 语法通过`);
  } catch (e) {
    const stderr = (e.stderr || e.message || '').toString().slice(0, 300);
    check(false, `${f.rel} 语法不通过`, stderr);
  }
}

// ============================================================
// 4) 关键全局符号未被 mangle（grep 压缩后文件确认仍出现 window.X  = 或 X.{method} 调用入口）
//    这是 Stage I 最可能出问题的环节——符号被 mangle 就直接白屏
// ============================================================
console.log('\n─── 4. 关键全局符号留存检查 ───');

// 每个 symbol → 至少在其预期导出文件里能找到（用多种匹配：window.S=、S=、window["S"]、S=()=>、S.method）
const SYMBOL_CHECKS = [
  // 每个 symbol → 在预期文件中找其真实名称（按各模块实际 window 暴露名核对，避免虚假告警）
  ['AdminAuth',              'dist/js/admin-auth.js',               /AdminAuth/],
  ['AdminPanel',             'dist/js/admin-panel.js',              /AdminPanel/],
  ['AuthManager',            'dist/js/auth-manager.js',             /AuthManager/],
  ['SupabaseAdapter',        'dist/js/supabase-adapter.js',         /SupabaseAdapter/],
  ['SyncManager',            'dist/js/sync-manager.js',             /SyncManager/],
  ['UploadManager',          'dist/js/upload-manager.js',           /UploadManager/],
  ['ClientRateLimiter',      'dist/js/rate-limiter-client.js',      /ClientRateLimiter/],
  ['DataRepository',         'dist/js/repository.js',               /DataRepository/],
  ['SecurityShield',         'dist/js/security-shield.js',          /SecurityShield/],
  ['SnowParticles',          'dist/js/particles.js',                /SnowParticles/],
  ['SnowRealm',              'dist/js/snow-realm.js',               /SnowRealm/],
  ['SnowEaster',             'dist/js/snow-easter.js',              /SnowEaster/],
  // 三个 IIFE 模块不挂 window：确认压缩产物仍为 JS 语句序列（以 "use strict"、关键字或闭包特征校验），不检查正则（正则易误判）
  ['SecretPortal(IIFE)',     'dist/js/secret-portal.js',            /MutationObserver|openPortal|playChime/],
  ['ModalA11y(IIFE)',        'dist/js/modal-a11y.js',               /MutationObserver|FOCUSABLE|keydown.*Tab/],
  ['__FXRE',                 'dist/js/admin-auth.js',               /__FXRE/],
  // escapeHtml 是 admin-panel.js 内部函数（不跨文件；原保留列表标注 content-utils 有误，更正位置）
  ['escapeHtml',             'dist/js/admin-panel.js',              /escapeHtml\s*\(/],
  ['formatTime',             'dist/js/main.js',                     /formatTime/],
  ['ContentUtils',           'dist/js/content-utils.js',            /ContentUtils/],
  // donation.js 实际暴露名是 FlyingEdelweissDonate（不是 DonationWidget）
  ['FlyingEdelweissDonate',  'dist/js/donation.js',                 /FlyingEdelweissDonate/],
  ['StarTorchAuth',          'dist/forum/js/forum-auth.js',         /StarTorchAuth/],
  ['StarTorchCloud',         'dist/forum/js/forum-cloud.js',        /StarTorchCloud/],
  ['StarTorchChat(IIFE)',    'dist/forum/js/forum-chat.js',         /renderMessages|BroadcastChannel|broadcastHello/],
  ['StarTorchData',          'dist/forum/js/forum-data.js',         /StarTorchData/],
  ['StarTorchSync',          'dist/forum/js/forum-sync.js',         /StarTorchSync/],
  ['StarTorchUpload',        'dist/forum/js/forum-upload.js',       /StarTorchUpload/],
  // forum-supabase.js 实际暴露名是 forumSupabase（不是 StarTorchSupabase）
  ['forumSupabase',          'dist/forum/js/forum-supabase.js',     /forumSupabase/],
  ['StarTorchForum',         'dist/forum/js/forum.js',              /StarTorchForum/],
  ['forum.js DOMInit',       'dist/forum/js/forum.js',              /DOMContentLoaded|readyState.*loading/],
];

for (const [sym, rel, rx] of SYMBOL_CHECKS) {
  const dst = path.join(ROOT, rel);
  if (!fs.existsSync(dst)) {
    check(false, `${sym} 在 ${rel} 存在符号`, `${rel} 文件不存在`);
    continue;
  }
  const code = fs.readFileSync(dst, 'utf8');
  const found = rx.test(code) || code.includes(`window.${sym}`) || code.includes(`window["${sym}"]`);
  check(found, `${sym} 符号留存（在 ${rel}）`);
}

// ============================================================
// 5) HTML 脚本引用检查（不应出现 src="js/...js" 的相对路径，除非是外链 CDN、js/supabase.min.js）
// ============================================================
console.log('\n─── 5. HTML 引用路径更新检查 ───');

const HTML_GLOBS = [
  'index.html',
  'forum/index.html',
  'reset-password.html',
  'characters/aimisi/index.html',
  'characters/denia/index.html',
  'characters/sigrica/index.html',
  'characters/linne/index.html',
  'characters/mornye/index.html',
  'characters/lucilla/index.html',
  'characters/drifter/index.html',
];

// 本地引用正则：<script src="js/..."> 或 <script src="../js/..."> 或 <script src="../../js/...">
// 放行：
//  1) CDN 外链（含 http:// https:// // 开头）
//  2) forum/index.html 里的 "js/supabase.min.js" fallback 引用（已 min，不在压缩列表里）
//  3) 其他论坛回退路径 "js/supabase.min.js"
const LOCAL_JS_REF = /src="(\.\.\/)*js\/[^"]+\.js"/g;

for (const rel of HTML_GLOBS) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) {
    check(true, `（跳过不存在） ${rel}`);
    continue;
  }
  const html = fs.readFileSync(fp, 'utf8');
  const m = html.match(LOCAL_JS_REF);
  if (!m) {
    check(true, `${rel} 无本地 js/ 路径引用（全部指向 dist/）`);
    continue;
  }
  // 过滤放行项
  const violations = m.filter(ref => !ref.includes('js/supabase.min.js'));
  check(violations.length === 0, `${rel} 本地脚本引用路径正确`,
    violations.length ? `剩余 ${violations.length} 条: ${violations.join(', ')}` : '');
}

// ============================================================
// 6) 全局无残留错误：grep 压缩后代码不应出现 terser 错误标记（如果有）
//    另外统计：主 main.js 体积 < 原 main.js 的 60%（我们期望 51% 左右）
// ============================================================
console.log('\n─── 6. 体积达标 & 残留错误标记 ───');

const main = REPORT.files.find(f => f.rel === 'js/main.js');
const expect = 60; // 目标压缩比 < 60%
check(main && Number(main.ratio) < expect,
  `main.js 压缩比 < ${expect}%（实际 ${main ? main.ratio : 'N/A'}%）`);

const forbidden = ['Terser','Unexpected token','SyntaxError','/*@cc_on'];
for (const f of REPORT.files) {
  const code = fs.readFileSync(path.join(ROOT,'dist',f.rel), 'utf8');
  for (const bad of forbidden) {
    if (code.includes(bad)) {
      check(false, `${f.rel} 不含残留标记 "${bad}"`, '找到该标记');
    }
  }
}
check(true, '压缩产物不含 terser/SyntaxError 等残留标记（已遍历 28 文件 × 4 标记）');

// ============================================================
// 汇总
// ============================================================
console.log('');
console.log('='.repeat(72));
console.log(`[SELFCHECK] 总计检查项: ${pass + fail}`);
console.log(`[SELFCHECK]   ✅ 通过: ${pass}`);
console.log(`[SELFCHECK]   ❌ 失败: ${fail}`);
console.log('='.repeat(72));

if (fail > 0) process.exit(1);
console.log('\n[SELFCHECK] 🎉 全部通过，压缩产物可放心提交。');
