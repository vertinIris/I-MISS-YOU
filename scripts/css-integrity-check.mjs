/**
 * CSS 完整性检查（smoke 门禁）
 * ------------------------------------------------------------
 * 背景（2026-10-23 事故）：css/style.css 的 @supports 块漏写收尾 `}`，
 * csso 容错解析 + hardenCss 的 backdrop-filter 前缀镜像又把
 * `-webkit-backdrop-filter:blur(1px))` 注进了 @supports 前导，
 * 最终 min.css 花括号失衡 —— 浏览器丢弃了断点之后的全部规则，
 * 主站悬浮簇（同步指示器 / 论坛入口 / 咖啡按钮）集体失去 fixed 定位。
 * 此类回归此前无任何门禁可拦，故立此检查：
 *
 *   1) 源码层：仓库自有 CSS（css/ forum/*.css redesign/*.css）花括号平衡
 *   2) 产物层：dist/css/*.min.css 花括号平衡
 *   3) 产物层：每个 @supports 前导括号配平、且不含分号（hardenCss 污染特征）
 *
 * 退出码非 0 = 门禁失败。本地等价：node scripts/css-integrity-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.css')) yield p;
  }
}

/** 注释/字符串感知的花括号净深度（0 = 平衡） */
export function braceDepth(css) {
  let depth = 0, inComment = false, inStr = null;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i], nx = css[i + 1];
    if (inComment) { if (ch === '*' && nx === '/') { inComment = false; i++; } continue; }
    if (inStr) { if (ch === '\\') { i++; continue; } if (ch === inStr) inStr = null; continue; }
    if (ch === '/' && nx === '*') { inComment = true; i++; continue; }
    if (ch === '"' || ch === "'") { inStr = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
  }
  return depth;
}

/** 提取所有 @supports 前导（到第一个 '{' 为止），供污染特征检查 */
export function supportsPreludes(css) {
  const out = [];
  const re = /@supports\s+([^{}]*?)\s*\{/g;
  let m;
  while ((m = re.exec(css))) out.push(m[1]);
  return out;
}

const failures = [];
const checkedSrc = [], checkedDist = [];

// 1) 源码平衡
const srcRoots = [path.join(ROOT, 'css'), path.join(ROOT, 'redesign'), path.join(ROOT, 'forum')];
for (const r of srcRoots) {
  if (!fs.existsSync(r)) continue;
  for (const f of walk(r)) {
    const rel = path.relative(ROOT, f);
    if (rel.startsWith('css' + path.sep + 'vendor')) continue;
    const css = fs.readFileSync(f, 'utf8');
    checkedSrc.push(rel);
    const d = braceDepth(css);
    if (d !== 0) failures.push(`[源码失衡] ${rel} 花括号净深度=${d}（漏写 } 的典型症状）`);
  }
}

// 2) / 3) 产物平衡 + @supports 前导检查
const distCssDir = path.join(ROOT, 'dist', 'css');
if (fs.existsSync(distCssDir)) {
  for (const f of walk(distCssDir)) {
    const rel = path.relative(ROOT, f);
    const css = fs.readFileSync(f, 'utf8');
    checkedDist.push(rel);
    const d = braceDepth(css);
    if (d !== 0) failures.push(`[产物失衡] ${rel} 花括号净深度=${d}（浏览器会丢弃断点后的全部规则）`);
    for (const pre of supportsPreludes(css)) {
      const opens = (pre.match(/\(/g) || []).length;
      const closes = (pre.match(/\)/g) || []).length;
      if (opens !== closes) failures.push(`[前导括号失衡] ${rel} @supports (${pre.slice(0, 60)}…) ${opens}/${closes}`);
      if (pre.includes(';')) failures.push(`[前导被污染] ${rel} @supports 前导含分号（前缀镜像注入特征）: ${pre.slice(0, 80)}`);
    }
  }
}

console.log(`[CSS 检查] 源码 ${checkedSrc.length} 个，产物 ${checkedDist.length} 个`);
if (failures.length) {
  console.error('[CSS 检查] ❌ 失败：');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('[CSS 检查] ✅ 通过');
