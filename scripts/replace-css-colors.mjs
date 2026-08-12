import fs from 'fs';
import path from 'path';

const CSS_DIR = path.resolve('c:\\Users\\lenovo\\CURSOR\\Snow\\css');
const TARGET_FILES = ['style.css','forum-shared.css','snow-atmosphere.css','zone-atmosphere.css','archive-subset.css'];

const HEX_MAP = new Map([
  ['#FF6B9D','var(--color-rose)'],['#ff6b9d','var(--color-rose)'],
  ['#A8D8FF','var(--color-blue-light)'],['#a8d8ff','var(--color-blue-light)'],
  ['#6B8AFF','var(--color-blue)'],['#6b8aff','var(--color-blue)'],
  ['#4A6AE0','var(--color-blue-deep)'],['#4a6ae0','var(--color-blue-deep)'],
  ['#FFB6D9','var(--color-pink-warm)'],
  ['#ffffff','var(--color-white)'],['#FFFFFF','var(--color-white)'],
  ['#FFD700','var(--color-gold)'],
  ['#B66BFF','var(--color-purple)'],
  ['#9B6BFF','var(--color-purple-deep)'],
  ['#FFD9A8','var(--color-rose-soft)'],
  ['#F5C0D8','var(--color-pink-soft)'],
  ['#FFF5F8','var(--color-pink-pale)'],
  ['#FFE066','var(--color-gold-soft)'],
  ['#FFF2CC','var(--color-gold-pale)'],
  ['#F0F4FF','var(--color-snow)'],['#f0f4ff','var(--color-snow)'],
  ['#00E5FF','var(--color-cyan)'],
  ['#5B8DEF','var(--color-blue-warm)'],
  ['#E8C56A','var(--char-lucilla)'],
  ['#4EC89A','var(--char-sigrica)'],
  ['#FF6B5B','var(--char-mornye)'],
  ['#B89CD9','var(--char-denia)'],
  ['#B98CFF','var(--char-linne)'],
  ['#0B0B14','var(--neutral-900)'],
  ['#14141F','var(--neutral-800)'],
  ['#1E1E2C','var(--neutral-700)'],
  ['#2A2A3A','var(--neutral-600)'],
  ['#3F3F52','var(--neutral-500)'],
  ['#6B6B82','var(--neutral-400)'],
  ['#9098a8','var(--neutral-300)'],['#9098A8','var(--neutral-300)'],
  ['#C9C9DA','var(--neutral-200)'],
  ['#E0E0ED','var(--neutral-100)'],
  ['#e879a8','var(--color-pink)'],['#E879A8','var(--color-pink)'],
  ['#6d8fd6','var(--color-blue)'],['#6D8FD6','var(--color-blue)'],
  ['#c9a227','var(--color-gold-warm)'],['#C9A227','var(--color-gold-warm)'],
  ['#e4c86a','var(--color-gold-soft)'],['#E4C86A','var(--color-gold-soft)'],
  ['#F4729B','var(--color-rose-soft)'],
  ['#e8ecf4','var(--color-mist)'],['#E8ECF4','var(--color-mist)'],
]);

const SHORT_HEX_MAP = new Map([
  ['#FFF','var(--color-white)'],
  ['#fff','var(--color-white)'],
]);

const RGBA_MAP = new Map([
  ['255,107,157','var(--color-rose)'],
  ['107,138,255','var(--color-blue)'],
  ['168,216,255','var(--color-blue-light)'],
  ['255,255,255','var(--color-white)'],
  ['0,0,0','black'],
  ['255,215,0','var(--color-gold)'],
  ['182,107,255','var(--color-purple)'],
  ['255,182,217','var(--color-pink-warm)'],
  ['240,244,255','var(--color-snow)'],
  ['16,18,34','var(--neutral-900)'],
  ['10,12,24','var(--neutral-900)'],
  ['109,143,214','var(--color-blue)'],
  ['201,162,39','var(--color-gold-warm)'],
  ['228,200,106','var(--color-gold-soft)'],
  ['232,121,168','var(--color-pink)'],
  ['74,106,224','var(--color-blue-deep)'],
  ['232,236,244','var(--color-mist)'],
]);

function buildProtectedRanges(css) {
  const ranges = [];
  const n = css.length;
  let i = 0;

  while (i < n) {
    if (css[i] === '/' && css[i+1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const e = end === -1 ? n : end + 2;
      ranges.push([i, e]);
      i = e;
      continue;
    }

    if (css.startsWith(':root', i) || css[i] === '[' && /^\[data-theme[^\]]*\]/.test(css.substring(i))) {
      const m = css.startsWith(':root', i)
        ? null
        : css.substring(i).match(/^\[data-theme[^\]]*\]/);
      const hdrLen = m ? m[0].length : 5;
      let bi = i + hdrLen;
      while (bi < n && css[bi] !== '{') bi++;
      if (bi >= n) { i++; continue; }
      let depth = 0, k = bi;
      while (k < n) {
        if (css[k] === '{') depth++;
        else if (css[k] === '}') { depth--; if (depth === 0) break; }
        k++;
      }
      ranges.push([i, k + 1]);
      i = k + 1;
      continue;
    }

    if (css.startsWith('var(', i)) {
      let paren = 1, vi = i + 4, comma = -1;
      while (vi < n && paren > 0) {
        const c = css[vi];
        if (c === '(') paren++;
        else if (c === ')') { paren--; if (paren === 0) break; }
        else if (c === ',' && paren === 1 && comma === -1) comma = vi;
        vi++;
      }
      if (comma !== -1) {
        ranges.push([comma + 1, vi]);
      }
      i = vi + 1;
      continue;
    }

    i++;
  }

  ranges.sort((a, b) => a[0] - b[0]);
  return ranges;
}

function isProtected(pos, ranges) {
  let lo = 0, hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [s, e] = ranges[mid];
    if (pos < s) hi = mid - 1;
    else if (pos >= e) lo = mid + 1;
    else return true;
  }
  return false;
}

function replaceColors(css) {
  const prot = buildProtectedRanges(css);
  const n = css.length;
  let out = '';
  let i = 0;

  while (i < n) {
    if (isProtected(i, prot)) {
      out += css[i];
      i++;
      continue;
    }

    if (css[i] === 'r' && css.startsWith('rgba(', i)) {
      const m = css.substring(i).match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
      if (m) {
        const key = `${parseInt(m[1])},${parseInt(m[2])},${parseInt(m[3])}`;
        if (RGBA_MAP.has(key)) {
          const pct = Math.round(parseFloat(m[4]) * 100);
          out += `color-mix(in srgb, ${RGBA_MAP.get(key)} ${pct}%, transparent)`;
          i += m[0].length;
          continue;
        }
      }
    }

    if (css[i] === '#') {
      let hexLen = 0;
      for (let k = 1; k <= 7 && i + k < n; k++) {
        const ch = css[i + k];
        if (/[0-9a-fA-F]/.test(ch)) hexLen = k;
        else break;
      }
      if (hexLen === 3 || hexLen === 6) {
        const hex = css.substring(i, i + hexLen + 1);
        const before = i > 0 ? css[i - 1] : '';
        const after = i + hexLen + 1 < n ? css[i + hexLen + 1] : '';
        const badBefore = /[0-9a-fA-F#]/.test(before);
        const badAfter = /[0-9a-fA-F]/.test(after);
        if (!badBefore && !badAfter) {
          if (HEX_MAP.has(hex)) {
            out += HEX_MAP.get(hex);
            i += hexLen + 1;
            continue;
          }
          if (SHORT_HEX_MAP.has(hex)) {
            out += SHORT_HEX_MAP.get(hex);
            i += hexLen + 1;
            continue;
          }
        }
      }
    }

    out += css[i];
    i++;
  }
  return out;
}

function verifyNoMappedColorsRemain(css) {
  const prot = buildProtectedRanges(css);
  const issues = [];
  const n = css.length;
  let i = 0;
  while (i < n) {
    if (isProtected(i, prot)) { i++; continue; }

    if (css[i] === 'r' && css.startsWith('rgba(', i)) {
      const m = css.substring(i).match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
      if (m) {
        const key = `${parseInt(m[1])},${parseInt(m[2])},${parseInt(m[3])}`;
        if (RGBA_MAP.has(key)) {
          let line = 1, col = 1;
          for (let k = 0; k < i; k++) if (css[k] === '\n') { line++; col = 1; } else col++;
          issues.push({ type: 'rgba', match: m[0], line });
        }
      }
    }

    if (css[i] === '#') {
      let hexLen = 0;
      for (let k = 1; k <= 7 && i + k < n; k++) {
        if (/[0-9a-fA-F]/.test(css[i + k])) hexLen = k; else break;
      }
      if (hexLen === 3 || hexLen === 6) {
        const hex = css.substring(i, i + hexLen + 1);
        const before = i > 0 ? css[i - 1] : '';
        const after = i + hexLen + 1 < n ? css[i + hexLen + 1] : '';
        if (!/[0-9a-fA-F#]/.test(before) && !/[0-9a-fA-F]/.test(after)) {
          if (HEX_MAP.has(hex) || SHORT_HEX_MAP.has(hex)) {
            let line = 1;
            for (let k = 0; k < i; k++) if (css[k] === '\n') line++;
            issues.push({ type: 'hex', match: hex, line });
          }
        }
      }
    }
    i++;
  }
  return issues;
}

function countDiffLines(a, b) {
  const al = a.split('\n'), bl = b.split('\n');
  let c = 0;
  for (let i = 0; i < Math.min(al.length, bl.length); i++) if (al[i] !== bl[i]) c++;
  return c;
}

const totalReport = [];

console.log('🚀 CSS 颜色替换（区间保护版）');
for (const fn of TARGET_FILES) {
  const fp = path.join(CSS_DIR, fn);
  console.log('\n' + '═'.repeat(60));
  console.log('📄', fn);

  const rawBuf = fs.readFileSync(fp);
  const hasBOM = rawBuf.slice(0,3).equals(Buffer.from([0xEF,0xBB,0xBF]));
  let css = rawBuf.toString('utf-8');
  if (hasBOM && css.charCodeAt(0) === 0xFEFF) css = css.slice(1);
  const original = css;

  const beforeProt = buildProtectedRanges(css);
  console.log('   保护区间数:', beforeProt.length);

  const result = replaceColors(css);
  const finalOut = hasBOM ? '\uFEFF' + result : result;
  fs.writeFileSync(fp, finalOut, 'utf-8');

  const lines = countDiffLines(original, result);
  console.log('   修改行数:', lines);

  const issues = verifyNoMappedColorsRemain(fs.readFileSync(fp, 'utf-8').replace(/^\uFEFF/, ''));
  if (issues.length === 0) console.log('   ✅ 无残留映射表内颜色');
  else {
    console.log('   ⚠️ 残留:', issues.length);
    issues.slice(0, 10).forEach(it => console.log(`      行${it.line} [${it.type}] ${it.match}`));
  }

  totalReport.push({ fn, lines, issues: issues.length });
}

console.log('\n' + '═'.repeat(60));
console.log('📊 结果汇总');
for (const r of totalReport) {
  const ok = r.issues === 0 ? '✅' : '⚠️';
  console.log(`${ok} ${r.fn}: ${r.lines} 行修改, 残留 ${r.issues}`);
}
console.log(totalReport.every(r => r.issues === 0) ? '\n🎉 全部文件处理完成并验证通过!' : '\n⚠️ 存在残留需人工检查');
