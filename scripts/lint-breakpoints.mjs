// lint-breakpoints.mjs · 断点契约校验
//
// 扫描 css/、forum/、characters/**/*.css 中所有 @media 查询，
// 提取尺寸断点数值，与契约 8 断点对比，报告非标准断点。
//
// 契约（与 css/tokens-base.css 顶部一致）：
//   320 / 360 / 480 / 768 / 1024 / 1280 / 1440 / 1920
//
// 允许通过的非尺寸 media feature：
//   prefers-reduced-motion / hover / pointer / min-resolution /
//   prefers-color-scheme / orientation / aspect-ratio
//
// 用法：node scripts/lint-breakpoints.mjs
// 退出码：0 通过 / 1 发现非标准断点

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const STANDARD_BREAKPOINTS = new Set([320, 360, 480, 768, 1024, 1280, 1440, 1920]);

// 兼容断点：项目中已广泛使用但不在 8 断点契约内的值。
// 暂时允许通过，但鼓励迁移到最近的标准断点（640→768）。
// 后续 P2 阶段可移除此集合，强制迁移。
const LEGACY_BREAKPOINTS = new Set([640]);

// 允许通过的非尺寸 media feature（不校验数值）
const NON_SIZE_FEATURES = [
  'prefers-reduced-motion',
  'prefers-color-scheme',
  'prefers-contrast',
  'hover',
  'pointer',
  'any-hover',
  'any-pointer',
  'min-resolution',
  'max-resolution',
  'orientation',
  'aspect-ratio',
  'min-aspect-ratio',
  'max-aspect-ratio',
  'display-mode',
  'forced-colors',
  'inverted-colors',
];

/**
 * 收集指定目录下所有 .css 文件路径
 */
function collectCssFiles(dir, acc = []) {
  const entries = readdirSync(dir);
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      // 跳过 node_modules / dist / .git
      if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
      collectCssFiles(full, acc);
    } else if (extname(name) === '.css') {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * 提取一个文件中所有 @media 查询的尺寸断点
 * 返回 [{ line, raw, breakpoints: [{ op, value }] }]
 */
function extractMediaQueries(content) {
  const results = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 匹配 @media 开头（允许前导空格）
    const m = line.match(/^\s*@media\s+(.+?)\s*\{\s*$/);
    if (!m) continue;
    const queryBody = m[1];

    // 跳过纯非尺寸 media query
    const lowerBody = queryBody.toLowerCase();
    const isAllNonSize = NON_SIZE_FEATURES.some((f) => lowerBody.includes(f)) &&
      !lowerBody.match(/(min|max)-width/) &&
      !lowerBody.match(/(min|max)-height/);
    if (isAllNonSize) continue;

    // 提取所有 (min-width: Npx) / (max-width: Npx) 等
    const bpRegex = /\((min|max)-(width|height)\s*:\s*(\d+(?:\.\d+)?)px\s*\)/g;
    const breakpoints = [];
    let bm;
    while ((bm = bpRegex.exec(queryBody)) !== null) {
      breakpoints.push({ op: bm[1], axis: bm[2], value: parseFloat(bm[3]) });
    }

    if (breakpoints.length === 0) continue;
    results.push({ line: i + 1, raw: line.trim(), breakpoints });
  }
  return results;
}

function main() {
  const targets = [
    join(ROOT, 'css'),
    join(ROOT, 'forum'),
    join(ROOT, 'characters'),
  ];

  const files = [];
  for (const t of targets) {
    try {
      const st = statSync(t);
      if (st.isDirectory()) collectCssFiles(t, files);
    } catch {
      // 目录不存在，跳过
    }
  }

  let totalViolations = 0;
  let totalLegacy = 0;
  const fileViolations = [];
  const legacyNotes = [];

  for (const f of files) {
    const content = readFileSync(f, 'utf8');
    const queries = extractMediaQueries(content);
    const relPath = relative(ROOT, f).replace(/\\/g, '/');
    for (const q of queries) {
      for (const bp of q.breakpoints) {
        if (!STANDARD_BREAKPOINTS.has(bp.value)) {
          if (LEGACY_BREAKPOINTS.has(bp.value)) {
            // 兼容断点：记录但不计入违规
            legacyNotes.push({
              file: relPath,
              line: q.line,
              value: bp.value,
              op: bp.op,
              axis: bp.axis,
              raw: q.raw,
            });
            totalLegacy++;
          } else {
            fileViolations.push({
              file: relPath,
              line: q.line,
              value: bp.value,
              op: bp.op,
              axis: bp.axis,
              raw: q.raw,
            });
            totalViolations++;
          }
        }
      }
    }
  }

  if (totalViolations === 0) {
    console.log(`✅ lint:bp 通过 · ${files.length} 个 CSS 文件，所有 @media 断点符合 8 断点契约`);
    console.log('   契约：320 / 360 / 480 / 768 / 1024 / 1280 / 1440 / 1920');
    if (totalLegacy > 0) {
      console.log(`   ℹ️  另有 ${totalLegacy} 处兼容断点（640px）暂留，P2 阶段迁移`);
    }
    process.exit(0);
  }

  console.error(`❌ lint:bp 失败 · 发现 ${totalViolations} 处非标准断点`);
  console.error('   契约允许值：320 / 360 / 480 / 768 / 1024 / 1280 / 1440 / 1920\n');
  for (const v of fileViolations) {
    console.error(`  ${v.file}:${v.line}  (${v.op}-${v.axis}: ${v.value}px)`);
    console.error(`    ${v.raw}`);
  }
  console.error('\n请将上述断点对齐到最近的标准断点。');
  process.exit(1);
}

main();
