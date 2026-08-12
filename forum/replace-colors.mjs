import fs from 'fs';
import path from 'path';

const TARGET_FILE = path.resolve('c:\\Users\\lenovo\\CURSOR\\Snow\\forum\\forum.css');

const hexMap = [
  [/#FF6B9D|#ff6b9d/g, 'var(--color-rose)'],
  [/#A8D8FF|#a8d8ff/g, 'var(--color-blue-light)'],
  [/#6B8AFF|#6b8aff/g, 'var(--color-blue)'],
  [/#4A6AE0|#4a6ae0/g, 'var(--color-blue-deep)'],
  [/#FFB6D9/g, 'var(--color-pink-warm)'],
  [/#FFF(?!F)|#fff(?!f)|#ffffff/gi, 'var(--color-white)'],
  [/#FFD700/g, 'var(--color-gold)'],
  [/#B66BFF/g, 'var(--color-purple)'],
  [/#9B6BFF/g, 'var(--color-purple-deep)'],
  [/#FFD9A8/g, 'var(--color-rose-soft)'],
  [/#F5C0D8/g, 'var(--color-pink-soft)'],
  [/#FFF5F8/g, 'var(--color-pink-pale)'],
  [/#FFE066/g, 'var(--color-gold-soft)'],
  [/#FFF2CC/g, 'var(--color-gold-pale)'],
  [/#F0F4FF|#f0f4ff/g, 'var(--color-snow)'],
  [/#00E5FF/g, 'var(--color-cyan)'],
  [/#5B8DEF/g, 'var(--color-blue-warm)'],
  [/#E8C56A/g, 'var(--char-lucilla)'],
  [/#4EC89A/g, 'var(--char-sigrica)'],
  [/#FF6B5B/g, 'var(--char-mornye)'],
  [/#B89CD9/g, 'var(--char-denia)'],
  [/#B98CFF/g, 'var(--char-linne)'],
  [/#0B0B14/g, 'var(--neutral-900)'],
  [/#14141F/g, 'var(--neutral-800)'],
  [/#1E1E2C/g, 'var(--neutral-700)'],
  [/#2A2A3A/g, 'var(--neutral-600)'],
  [/#3F3F52/g, 'var(--neutral-500)'],
  [/#6B6B82/g, 'var(--neutral-400)'],
  [/#9098a8|#9098A8/g, 'var(--neutral-300)'],
  [/#C9C9DA/g, 'var(--neutral-200)'],
  [/#E0E0ED/g, 'var(--neutral-100)'],
  [/#e879a8|#E879A8/g, 'var(--color-pink)'],
  [/#6d8fd6|#6D8FD6/g, 'var(--color-blue)'],
  [/#c9a227|#C9A227/g, 'var(--color-gold-warm)'],
  [/#e4c86a|#E4C86A/g, 'var(--color-gold-soft)'],
];

const rgbaMap = [
  { match: [255, 107, 157], token: 'var(--color-rose)' },
  { match: [107, 138, 255], token: 'var(--color-blue)' },
  { match: [168, 216, 255], token: 'var(--color-blue-light)' },
  { match: [255, 255, 255], token: 'var(--color-white)' },
  { match: [0, 0, 0], token: 'black' },
  { match: [255, 215, 0], token: 'var(--color-gold)' },
  { match: [182, 107, 255], token: 'var(--color-purple)' },
  { match: [255, 182, 217], token: 'var(--color-pink-warm)' },
  { match: [240, 244, 255], token: 'var(--color-snow)' },
  { match: [16, 18, 34], token: 'var(--neutral-900)' },
  { match: [109, 143, 214], token: 'var(--color-blue)' },
  { match: [201, 162, 39], token: 'var(--color-gold-warm)' },
  { match: [228, 200, 106], token: 'var(--color-gold-soft)' },
  { match: [232, 197, 106], token: 'var(--color-gold-warm)' },
  { match: [255, 107, 157], token: 'var(--color-rose)' },
];

function alphaToPercent(alphaStr) {
  const a = parseFloat(alphaStr);
  return Math.round(a * 100);
}

function replaceRgba(css) {
  return css.replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g, (match, r, g, b, a) => {
    const rgb = [parseInt(r), parseInt(g), parseInt(b)];
    for (const entry of rgbaMap) {
      const [mr, mg, mb] = entry.match;
      if (rgb[0] === mr && rgb[1] === mg && rgb[2] === mb) {
        const pct = alphaToPercent(a);
        return `color-mix(in srgb, ${entry.token} ${pct}%, transparent)`;
      }
    }
    return match;
  });
}

function extractVarFallbacks(css) {
  const fallbacks = new Set();
  const regex = /var\(\s*--[\w-]+\s*,\s*(#[0-9a-fA-F]{3,8}|rgba\([^)]+\))\s*\)/g;
  let m;
  while ((m = regex.exec(css)) !== null) {
    fallbacks.add(m[1]);
  }
  return fallbacks;
}

function protectVarFallbacks(css) {
  const placeholders = [];
  const regex = /(var\(\s*--[\w-]+\s*,\s*)(#[0-9a-fA-F]{3,8}|rgba\([^)]+\))(\s*\))/g;
  let idx = 0;
  const protectedCss = css.replace(regex, (match, prefix, value, suffix) => {
    const key = `__FALLBACK_${idx}__`;
    placeholders.push({ key, value });
    idx++;
    return `${prefix}${key}${suffix}`;
  });
  return { protectedCss, placeholders };
}

function restoreVarFallbacks(css, placeholders) {
  let result = css;
  for (const { key, value } of placeholders) {
    result = result.replace(key, value);
  }
  return result;
}

function protectRootBlocks(css) {
  const placeholders = [];
  const regex = /:root\s*\{[^}]*\}/gs;
  let idx = 0;
  let match;
  let result = css;
  const matches = [];
  while ((match = regex.exec(css)) !== null) {
    matches.push(match);
  }
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const key = `__ROOT_${idx}__`;
    idx++;
    placeholders.push({ key, value: m[0] });
    result = result.substring(0, m.index) + key + result.substring(m.index + m[0].length);
  }
  return { protectedCss: result, placeholders };
}

function restoreRootBlocks(css, placeholders) {
  let result = css;
  for (const { key, value } of placeholders) {
    result = result.replace(key, value);
  }
  return result;
}

function countReplacements(original, modified) {
  let count = 0;
  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  for (let i = 0; i < Math.min(origLines.length, modLines.length); i++) {
    if (origLines[i] !== modLines[i]) count++;
  }
  return count;
}

let css = fs.readFileSync(TARGET_FILE, 'utf-8');
const originalCss = css;

console.log('开始处理:', TARGET_FILE);
console.log('文件大小:', css.length, '字节');

const varFallbacksBefore = extractVarFallbacks(css);
console.log('检测到的 var() fallback 颜色值数量:', varFallbacksBefore.size);

const rootProtect = protectRootBlocks(css);
css = rootProtect.protectedCss;
console.log('保护的 :root 块数量:', rootProtect.placeholders.length);

const varProtect = protectVarFallbacks(css);
css = varProtect.protectedCss;
console.log('保护的 var() fallback 数量:', varProtect.placeholders.length);

for (const [pattern, replacement] of hexMap) {
  css = css.replace(pattern, replacement);
}

css = replaceRgba(css);

css = restoreVarFallbacks(css, varProtect.placeholders);
css = restoreRootBlocks(css, rootProtect.placeholders);

const varFallbacksAfter = extractVarFallbacks(css);
console.log('替换后 var() fallback 颜色值数量:', varFallbacksAfter.size);

if (varFallbacksBefore.size !== varFallbacksAfter.size) {
  console.error('⚠️ 警告: var() fallback 数量不一致，可能有问题!');
} else {
  console.log('✅ var() fallback 保护验证通过');
}

const linesChanged = countReplacements(originalCss, css);
console.log('修改的行数:', linesChanged);

fs.writeFileSync(TARGET_FILE, css, 'utf-8');
console.log('\n✅ 文件已写入:', TARGET_FILE);

console.log('\n=== 替换后快速校验 ===');
const remainingHex = css.match(/(?<!var\([^)]*)(?<!__)\#[0-9a-fA-F]{3,8}(?!\s*[\),])/g) || [];
console.log('剩余硬编码 hex 颜色（不含 var fallback 和根块）:', remainingHex.length);
if (remainingHex.length > 0) {
  const unique = [...new Set(remainingHex)];
  console.log('唯一值:', unique.slice(0, 30).join(', '));
  if (unique.length > 30) console.log('... 还有', unique.length - 30, '个');
}

const remainingRgba = css.match(/(?<!color-mix\()[^:;\s]*rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,/g) || [];
console.log('剩余未替换的带 alpha rgba:', remainingRgba.length);
if (remainingRgba.length > 0) {
  console.log('示例:', remainingRgba.slice(0, 10).join(' | '));
}
