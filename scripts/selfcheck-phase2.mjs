/**
 * 飞行雪绒 · Stage II 自检
 * 1) bundle 语法 + SRI 哈希重新计算与 HTML 中的 integrity 比对
 * 2) CSS 产物存在性与体积合理性
 * 3) Source Map 存在性
 * 4) HTML 引用完整性：主站/论坛无残留旧 css/ 引用，引用 bundle + min.css
 * 5) 关键全局符号在 bundle 中留存
 * 6) CSP 仍允许 bundle（'self' + 'unsafe-inline' 不变）
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist', 'build-report-phase2.json'), 'utf8'));

let pass = 0, fail = 0;
function check(cond, label, detail = '') {
  console.log(`  ${cond ? '✅' : '❌'} ${label}${detail && !cond ? '    ' + detail : ''}`);
  cond ? pass++ : fail++;
}

function sriSha384(buf) {
  return `sha384-${crypto.createHash('sha384').update(buf).digest('base64')}`;
}

// ============================================================
// 1. Bundle 语法 + SRI 验证
// ============================================================
console.log('\n─── 1. Bundle 语法 + SRI 完整性 ───');
for (const [key, name] of [['main', 'bundle-main.js'], ['forum', 'bundle-forum.js']]) {
  const fp = path.join(ROOT, 'dist', name);
  const exists = fs.existsSync(fp);
  check(exists, `${name} 存在`);

  if (!exists) continue;

  // 语法
  try {
    execFileSync(process.execPath, ['--check', fp], { stdio: 'pipe' });
    check(true, `${name} node --check 语法通过`);
  } catch (e) {
    check(false, `${name} 语法不通过`, (e.stderr || '').toString().slice(0, 200));
  }

  // SRI 比对
  const code = fs.readFileSync(fp);
  const computed = sriSha384(code);
  const expected = REPORT.bundles[key].sri;
  check(computed === expected, `${name} SRI 哈希一致`,
    `期望 ${expected.substring(0, 25)}... / 实际 ${computed.substring(0, 25)}...`);

  // 体积合理性（与报表偏差 < 0.5%）
  const sz = code.length;
  const expectedSz = REPORT.bundles[key].dstSize;
  const delta = Math.abs(sz - expectedSz) / expectedSz * 100;
  check(delta < 0.5, `${name} 体积偏差 < 0.5% (报表 ${expectedSz} / 磁盘 ${sz} / ${delta.toFixed(2)}%)`);
}

// ============================================================
// 2. CSS 产物存在性 + 体积
// ============================================================
console.log('\n─── 2. CSS 压缩产物 ───');
for (const [key, name] of [['main', 'main.min.css'], ['forum', 'forum.min.css'], ['archive', 'archive.min.css']]) {
  const fp = path.join(ROOT, 'dist', 'css', name);
  const exists = fs.existsSync(fp);
  check(exists, `${name} 存在`);
  if (!exists) continue;

  const sz = fs.statSync(fp).size;
  const expectedSz = REPORT.css[key].dstSize;
  const delta = Math.abs(sz - expectedSz) / expectedSz * 100;
  check(delta < 0.5, `${name} 体积偏差 < 0.5% (报表 ${expectedSz} / 磁盘 ${sz} / ${delta.toFixed(2)}%)`);

  // 压缩比合理（应 < 75%）
  const ratio = sz / REPORT.css[key].srcSize * 100;
  check(ratio < 75, `${name} 压缩比 < 75% (实际 ${ratio.toFixed(1)}%)`);
}

// ============================================================
// 3. Source Map 存在性
// ============================================================
console.log('\n─── 3. Source Map ───');
for (const name of ['bundle-main.js.map', 'bundle-forum.js.map']) {
  const fp = path.join(ROOT, 'dist', name);
  const exists = fs.existsSync(fp);
  check(exists, `${name} 存在`);
  if (exists) {
    try {
      const map = JSON.parse(fs.readFileSync(fp, 'utf8'));
      check(!!map.sources && map.sources.length > 0, `${name} 包含 sources (${map.sources.length} 个)`);
    } catch (e) {
      check(false, `${name} JSON 解析失败`, e.message.slice(0, 100));
    }
  }
}

// ============================================================
// 4. HTML 引用完整性
// ============================================================
console.log('\n─── 4. HTML 引用完整性 ───');

// 主站 index.html
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
check(indexHtml.includes('src="dist/bundle-main.js"'), 'index.html 引用 dist/bundle-main.js');
check(indexHtml.includes('integrity="sha384-OK0OpwzNgko0vHGh0YxO3/yDKKUlnKU3vug/llgU1RKwnS75QOs4znG7MdjeV1vS"'), 'index.html SRI integrity 正确');
check(indexHtml.includes('crossorigin="anonymous"'), 'index.html crossorigin="anonymous"');
check(indexHtml.includes('href="dist/css/main.min.css"'), 'index.html 引用 dist/css/main.min.css');
check(!indexHtml.includes('href="css/') && !indexHtml.includes('src="js/'), 'index.html 无残留 css/ 或 js/ 引用');
// 不应有多于 1 个本地 <script src>（CDN除外）
const indexLocalScripts = indexHtml.match(/src="(dist|js)\//g) || [];
check(indexLocalScripts.length === 1, `index.html 本地脚本引用数 = 1 (实际 ${indexLocalScripts.length})`);

// 论坛 forum/index.html
const forumHtml = fs.readFileSync(path.join(ROOT, 'forum', 'index.html'), 'utf8');
check(forumHtml.includes('src="../dist/bundle-forum.js"'), 'forum/index.html 引用 ../dist/bundle-forum.js');
check(forumHtml.includes('integrity="sha384-/0e/uyPD7XtCgzjeMIRkidPyRspi5/V6wspkw/zmctnSe2q8yc52S+Hl/XWVipHA"'), 'forum/index.html SRI integrity 正确');
check(forumHtml.includes('crossorigin="anonymous"'), 'forum/index.html crossorigin="anonymous"');
check(forumHtml.includes('href="../dist/css/forum.min.css"'), 'forum/index.html 引用 ../dist/css/forum.min.css');
check(!forumHtml.match(/href="\.\.\/css\//), 'forum/index.html 无残留 ../css/ 引用');
check(!forumHtml.match(/src="\.\.\/js\//) && !forumHtml.match(/src="js\/forum/), 'forum/index.html 无残留 ../js/ 或 js/forum/ 引用');
// 本地脚本引用数 = 1（bundle-forum.js）
const forumLocalScripts = forumHtml.match(/src="\.\.\/dist\/|src="dist\//g) || [];
check(forumLocalScripts.length === 1, `forum/index.html 本地脚本引用数 = 1 (实际 ${forumLocalScripts.length})`);

// 角色页
const charDirs = ['aimisi', 'denia', 'drifter', 'linne', 'lucilla', 'mornye', 'sigrica'];
for (const dir of charDirs) {
  const fp = path.join(ROOT, 'characters', dir, 'index.html');
  const html = fs.readFileSync(fp, 'utf8');
  check(html.includes('href="../../dist/css/archive.min.css"'), `characters/${dir} 引用 archive.min.css`);
  check(!html.match(/href="\.\.\/\.\.\/css\//), `characters/${dir} 无残留 ../../css/ 引用`);
}

// reset-password.html
const resetHtml = fs.readFileSync(path.join(ROOT, 'reset-password.html'), 'utf8');
check(resetHtml.includes('href="dist/css/main.min.css"'), 'reset-password.html 引用 dist/css/main.min.css');
check(resetHtml.includes('src="dist/js/supabase-adapter.js"'), 'reset-password.html 引用 dist/js/supabase-adapter.js');

// ============================================================
// 5. 关键全局符号在 bundle 中留存
// ============================================================
console.log('\n─── 5. Bundle 关键全局符号 ───');
const bundleMain = fs.readFileSync(path.join(ROOT, 'dist', 'bundle-main.js'), 'utf8');
const bundleForum = fs.readFileSync(path.join(ROOT, 'dist', 'bundle-forum.js'), 'utf8');

const MAIN_SYMBOLS = [
  'AdminAuth', 'AdminPanel', 'AuthManager', 'SupabaseAdapter', 'SyncManager',
  'UploadManager', 'ClientRateLimiter', 'DataRepository', 'SecurityShield',
  'SnowParticles', 'SnowRealm', 'SnowEaster', 'ContentUtils',
  'FlyingEdelweissDonate', '__FXRE', 'formatTime', 'escapeHtml',
  'MutationObserver',  // secret-portal + modal-a11y 的特征词
];

const FORUM_SYMBOLS = [
  'StarTorchAuth', 'StarTorchCloud', 'StarTorchData', 'StarTorchSync',
  'StarTorchUpload', 'forumSupabase', 'StarTorchForum',
  'BroadcastChannel', 'renderMessages', 'DOMContentLoaded',
];

for (const sym of MAIN_SYMBOLS) {
  check(bundleMain.includes(sym), `bundle-main.js 含 "${sym}"`);
}
for (const sym of FORUM_SYMBOLS) {
  check(bundleForum.includes(sym), `bundle-forum.js 含 "${sym}"`);
}

// ============================================================
// 6. CSP 一致性（'self' 允许同源 bundle；'unsafe-inline' 允许内联 style）
// ============================================================
console.log('\n─── 6. CSP 一致性 ───');
check(indexHtml.includes("script-src 'self' 'unsafe-inline'"), 'index.html CSP script-src 仍含 self + unsafe-inline');
check(indexHtml.includes("style-src 'self' 'unsafe-inline'"), 'index.html CSP style-src 仍含 self + unsafe-inline');
check(forumHtml.includes("script-src 'self' 'unsafe-inline'"), 'forum/index.html CSP script-src 仍含 self + unsafe-inline');
check(forumHtml.includes("style-src 'self' 'unsafe-inline'"), 'forum/index.html CSP style-src 仍含 self + unsafe-inline');

// ============================================================
// 7. 残留错误标记
// ============================================================
console.log('\n─── 7. 残留错误标记扫描 ───');
const forbidden = ['Terser', 'Unexpected token', 'SyntaxError', '/*@cc_on'];
let allClean = true;
for (const name of ['bundle-main.js', 'bundle-forum.js']) {
  const code = fs.readFileSync(path.join(ROOT, 'dist', name), 'utf8');
  for (const bad of forbidden) {
    if (code.includes(bad)) {
      check(false, `${name} 含残留标记 "${bad}"`);
      allClean = false;
    }
  }
}
if (allClean) check(true, 'Bundle 不含残留错误标记（2 文件 × 4 标记）');

// ============================================================
// 汇总
// ============================================================
console.log('\n' + '='.repeat(72));
console.log(`[SELFCHECK-II] 总计检查项: ${pass + fail}`);
console.log(`[SELFCHECK-II]   ✅ 通过: ${pass}`);
console.log(`[SELFCHECK-II]   ❌ 失败: ${fail}`);
console.log('='.repeat(72));

if (fail > 0) process.exit(1);
console.log('\n[SELFCHECK-II] 🎉 Stage II 全部通过，可放心提交。');
