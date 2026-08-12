const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;
const FILES = [
  'forum-theme.css',
  'forum-visual.css',
  'forum-easter.css',
];

const HEX_MAP = {
  '#FF6B9D': 'var(--color-rose)',
  '#A8D8FF': 'var(--color-blue-light)',
  '#6B8AFF': 'var(--color-blue)',
  '#4A6AE0': 'var(--color-blue-deep)',
  '#FFB6D9': 'var(--color-pink-warm)',
  '#FFF': 'var(--color-white)',
  '#fff': 'var(--color-white)',
  '#ffffff': 'var(--color-white)',
  'white': 'var(--color-white)',
  '#FFD700': 'var(--color-gold)',
  '#B66BFF': 'var(--color-purple)',
  '#9B6BFF': 'var(--color-purple-deep)',
  '#FFD9A8': 'var(--color-rose-soft)',
  '#F5C0D8': 'var(--color-pink-soft)',
  '#FFF5F8': 'var(--color-pink-pale)',
  '#FFE066': 'var(--color-gold-soft)',
  '#FFF2CC': 'var(--color-gold-pale)',
  '#F0F4FF': 'var(--color-snow)',
  '#f0f4ff': 'var(--color-snow)',
  '#00E5FF': 'var(--color-cyan)',
  '#5B8DEF': 'var(--color-blue-warm)',
  '#E8C56A': 'var(--char-lucilla)',
  '#4EC89A': 'var(--char-sigrica)',
  '#FF6B5B': 'var(--char-mornye)',
  '#B89CD9': 'var(--char-denia)',
  '#B98CFF': 'var(--char-linne)',
  '#0B0B14': 'var(--neutral-900)',
  '#14141F': 'var(--neutral-800)',
  '#1E1E2C': 'var(--neutral-700)',
  '#2A2A3A': 'var(--neutral-600)',
  '#6B6B82': 'var(--neutral-400)',
  '#C9C9DA': 'var(--neutral-200)',
  '#e879a8': 'var(--color-pink)',
  '#6d8fd6': 'var(--color-blue)',
  '#6D8FD6': 'var(--color-blue)',
  '#c9a227': 'var(--color-gold-warm)',
  '#C9A227': 'var(--color-gold-warm)',
  '#e4c86a': 'var(--color-gold-soft)',
  '#E4C86A': 'var(--color-gold-soft)',
};

const RGBA_MAP = {
  '255,107,157': 'var(--color-rose)',
  '255, 107, 157': 'var(--color-rose)',
  '107,138,255': 'var(--color-blue)',
  '107, 138, 255': 'var(--color-blue)',
  '168,216,255': 'var(--color-blue-light)',
  '168, 216, 255': 'var(--color-blue-light)',
  '255,255,255': 'var(--color-white)',
  '255, 255, 255': 'var(--color-white)',
  '0,0,0': 'black',
  '0, 0, 0': 'black',
  '255,215,0': 'var(--color-gold)',
  '255, 215, 0': 'var(--color-gold)',
  '182,107,255': 'var(--color-purple)',
  '182, 107, 255': 'var(--color-purple)',
  '255,182,217': 'var(--color-pink-warm)',
  '255, 182, 217': 'var(--color-pink-warm)',
  '240,244,255': 'var(--color-snow)',
  '240, 244, 255': 'var(--color-snow)',
  '16,18,34': 'var(--neutral-900)',
  '16, 18, 34': 'var(--neutral-900)',
  '10,12,24': 'var(--neutral-900)',
  '10, 12, 24': 'var(--neutral-900)',
  '109,143,214': 'var(--color-blue)',
  '109, 143, 214': 'var(--color-blue)',
  '201,162,39': 'var(--color-gold-warm)',
  '201, 162, 39': 'var(--color-gold-warm)',
  '228,200,106': 'var(--color-gold-soft)',
  '228, 200, 106': 'var(--color-gold-soft)',
};

function findRootBlocks(content) {
  const blocks = [];
  const rootRegex = /:root\s*\{/g;
  let match;
  while ((match = rootRegex.exec(content)) !== null) {
    const start = match.index;
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < content.length && depth > 0) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') depth--;
      i++;
    }
    blocks.push([start, i]);
  }
  return blocks;
}

function findVarFallbacks(content) {
  const fallbacks = [];
  const varRegex = /var\(\s*--[\w-]+\s*,/g;
  let match;
  while ((match = varRegex.exec(content)) !== null) {
    const commaPos = match.index + match[0].length - 1;
    let depth = 1;
    let i = commaPos + 1;
    while (i < content.length && depth > 0) {
      if (content[i] === '(') depth++;
      else if (content[i] === ')') depth--;
      i++;
    }
    fallbacks.push([commaPos + 1, i - 1]);
  }
  return fallbacks;
}

function findVarOrColorMixRanges(content) {
  const ranges = [];
  const regex = /(?:var|color-mix)\s*\(/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < content.length && depth > 0) {
      if (content[i] === '(') depth++;
      else if (content[i] === ')') depth--;
      i++;
    }
    ranges.push([match.index, i]);
  }
  return ranges;
}

function isProtected(pos, protectedRanges) {
  for (const [start, end] of protectedRanges) {
    if (pos >= start && pos < end) return true;
  }
  return false;
}

function collectReplacements(content, protectedRanges) {
  const replacements = [];

  const hashHexEntries = Object.entries(HEX_MAP).filter(([k]) => k.startsWith('#'));
  hashHexEntries.sort((a, b) => b[0].length - a[0].length);
  const hashHexPattern = hashHexEntries.map(([k]) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const hashHexRegex = new RegExp(`(${hashHexPattern})(?![0-9a-fA-F])`, 'g');

  let match;
  while ((match = hashHexRegex.exec(content)) !== null) {
    if (!isProtected(match.index, protectedRanges)) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        replaceWith: HEX_MAP[match[0]],
        type: 'hex'
      });
    }
  }

  const namedColorRegex = /(?<![-\w])(white)(?![-\w])/g;
  while ((match = namedColorRegex.exec(content)) !== null) {
    if (!isProtected(match.index, protectedRanges)) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        replaceWith: HEX_MAP[match[0]],
        type: 'hex'
      });
    }
  }

  const rgbaRegex = /rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([\d.]+)\s*\)/g;
  while ((match = rgbaRegex.exec(content)) !== null) {
    if (!isProtected(match.index, protectedRanges)) {
      const r = match[1], g = match[2], b = match[3], alpha = match[4];
      const key1 = `${r},${g},${b}`;
      const key2 = `${r}, ${g}, ${b}`;
      const token = RGBA_MAP[key1] || RGBA_MAP[key2];
      if (token) {
        const alphaNum = parseFloat(alpha);
        const Y = Math.round(alphaNum * 10000) / 100;
        const percentStr = Number.isInteger(Y) ? `${Y}%` : `${Y}%`;
        replacements.push({
          start: match.index,
          end: match.index + match[0].length,
          replaceWith: `color-mix(in srgb, ${token} ${percentStr}, transparent)`,
          type: 'rgba'
        });
      }
    }
  }

  replacements.sort((a, b) => b.start - a.start);
  return replacements;
}

function applyReplacements(content, replacements) {
  let result = content;
  let hexCount = 0;
  let rgbaCount = 0;
  for (const r of replacements) {
    result = result.slice(0, r.start) + r.replaceWith + result.slice(r.end);
    if (r.type === 'hex') hexCount++;
    else rgbaCount++;
  }
  return { result, hexCount, rgbaCount };
}

function processFile(filename) {
  const filePath = path.join(BASE_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');

  const rootBlocks = findRootBlocks(content);
  const varFallbacks = findVarFallbacks(content);
  const protectedRanges = [...rootBlocks, ...varFallbacks];

  const replacements = collectReplacements(content, protectedRanges);
  const { result, hexCount, rgbaCount } = applyReplacements(content, replacements);

  fs.writeFileSync(filePath, result, 'utf-8');

  return { filename, hexCount, rgbaCount, total: hexCount + rgbaCount };
}

function verifyFile(filename) {
  const filePath = path.join(BASE_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');

  const rootBlocks = findRootBlocks(content);
  const varFallbacks = findVarFallbacks(content);
  const varOrColorMixRanges = findVarOrColorMixRanges(content);
  const protectedRanges = [...rootBlocks, ...varFallbacks, ...varOrColorMixRanges];

  let remainingHex = [];
  let remainingRgba = [];

  const hashHexEntries = Object.entries(HEX_MAP).filter(([k]) => k.startsWith('#'));
  hashHexEntries.sort((a, b) => b[0].length - a[0].length);
  const hashHexPattern = hashHexEntries.map(([k]) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const hashHexRegex = new RegExp(`(${hashHexPattern})(?![0-9a-fA-F])`, 'g');

  let match;
  while ((match = hashHexRegex.exec(content)) !== null) {
    if (!isProtected(match.index, protectedRanges)) {
      const lineNum = content.slice(0, match.index).split('\n').length;
      remainingHex.push({ value: match[0], line: lineNum, pos: match.index });
    }
  }

  const namedColorRegex = /(?<![-\w])(white)(?![-\w])/g;
  while ((match = namedColorRegex.exec(content)) !== null) {
    if (!isProtected(match.index, protectedRanges)) {
      const lineNum = content.slice(0, match.index).split('\n').length;
      remainingHex.push({ value: match[0], line: lineNum, pos: match.index });
    }
  }

  const rgbaRegex = /rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([\d.]+)\s*\)/g;
  while ((match = rgbaRegex.exec(content)) !== null) {
    if (!isProtected(match.index, protectedRanges)) {
      const lineNum = content.slice(0, match.index).split('\n').length;
      const key1 = `${match[1]},${match[2]},${match[3]}`;
      const key2 = `${match[1]}, ${match[2]}, ${match[3]}`;
      if (RGBA_MAP[key1] || RGBA_MAP[key2]) {
        remainingRgba.push({ value: match[0], line: lineNum, pos: match.index });
      }
    }
  }

  return { filename, remainingHex, remainingRgba };
}

console.log('========== 开始批量替换 ==========\n');

const results = FILES.map(file => {
  const result = processFile(file);
  console.log(`✅ ${result.filename}`);
  console.log(`   hex:  ${result.hexCount} 处`);
  console.log(`   rgba: ${result.rgbaCount} 处`);
  console.log(`   合计: ${result.total} 处\n`);
  return result;
});

console.log('========== 替换统计 ==========');
const totalHex = results.reduce((s, r) => s + r.hexCount, 0);
const totalRgba = results.reduce((s, r) => s + r.rgbaCount, 0);
console.log(`hex 总计: ${totalHex} 处`);
console.log(`rgba 总计: ${totalRgba} 处`);
console.log(` grand total: ${totalHex + totalRgba} 处\n`);

console.log('========== 验证未替换残留 ==========\n');

const verifyResults = FILES.map(file => {
  const result = verifyFile(file);
  console.log(`🔍 ${result.filename}`);
  if (result.remainingHex.length === 0 && result.remainingRgba.length === 0) {
    console.log('   ✅ 全部替换完成，无残留\n');
  } else {
    if (result.remainingHex.length > 0) {
      console.log(`   ⚠️  残留 hex: ${result.remainingHex.length} 处`);
      result.remainingHex.slice(0, 10).forEach(r => {
        console.log(`      第 ${r.line} 行: ${r.value}`);
      });
      if (result.remainingHex.length > 10) {
        console.log(`      ... 还有 ${result.remainingHex.length - 10} 处`);
      }
    }
    if (result.remainingRgba.length > 0) {
      console.log(`   ⚠️  残留 rgba: ${result.remainingRgba.length} 处`);
      result.remainingRgba.slice(0, 10).forEach(r => {
        console.log(`      第 ${r.line} 行: ${r.value}`);
      });
      if (result.remainingRgba.length > 10) {
        console.log(`      ... 还有 ${result.remainingRgba.length - 10} 处`);
      }
    }
    console.log('');
  }
  return result;
});

const allRemainingHex = verifyResults.reduce((s, r) => s + r.remainingHex.length, 0);
const allRemainingRgba = verifyResults.reduce((s, r) => s + r.remainingRgba.length, 0);

console.log('========== 最终验证结果 ==========');
if (allRemainingHex === 0 && allRemainingRgba === 0) {
  console.log('🎉 全部目标颜色已成功替换！无映射表内残留。');
} else {
  console.log(`⚠️  残留 hex: ${allRemainingHex} 处, 残留 rgba: ${allRemainingRgba} 处`);
}
