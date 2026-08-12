import fs from 'fs';
import path from 'path';

const CSS_DIR = path.resolve('c:\\Users\\lenovo\\CURSOR\\Snow\\css');

const TARGET_FILES = [
  'style.css',
  'forum-shared.css',
  'snow-atmosphere.css',
  'zone-atmosphere.css',
  'archive-subset.css',
];

const HEX_PATTERNS = [
  { re: /#FF6B9D|#ff6b9d/g, name: 'color-rose' },
  { re: /#A8D8FF|#a8d8ff/g, name: 'color-blue-light' },
  { re: /#6B8AFF|#6b8aff/g, name: 'color-blue' },
  { re: /#4A6AE0|#4a6ae0/g, name: 'color-blue-deep' },
  { re: /#FFB6D9/g, name: 'color-pink-warm' },
  { re: /#FFF(?!F)|#fff(?!f)(?![a-zA-Z0-9])|#ffffff|#FFFFFF(?!F)/g, name: 'color-white' },
  { re: /#FFD700/g, name: 'color-gold' },
  { re: /#B66BFF/g, name: 'color-purple' },
  { re: /#9B6BFF/g, name: 'color-purple-deep' },
  { re: /#FFD9A8/g, name: 'color-rose-soft' },
  { re: /#F5C0D8/g, name: 'color-pink-soft' },
  { re: /#FFF5F8/g, name: 'color-pink-pale' },
  { re: /#FFE066/g, name: 'color-gold-soft' },
  { re: /#FFF2CC/g, name: 'color-gold-pale' },
  { re: /#F0F4FF|#f0f4ff/g, name: 'color-snow' },
  { re: /#00E5FF/g, name: 'color-cyan' },
  { re: /#5B8DEF/g, name: 'color-blue-warm' },
  { re: /#E8C56A/g, name: 'char-lucilla' },
  { re: /#4EC89A/g, name: 'char-sigrica' },
  { re: /#FF6B5B/g, name: 'char-mornye' },
  { re: /#B89CD9/g, name: 'char-denia' },
  { re: /#B98CFF/g, name: 'char-linne' },
  { re: /#0B0B14/g, name: 'neutral-900' },
  { re: /#14141F/g, name: 'neutral-800' },
  { re: /#1E1E2C/g, name: 'neutral-700' },
  { re: /#2A2A3A/g, name: 'neutral-600' },
  { re: /#3F3F52/g, name: 'neutral-500' },
  { re: /#6B6B82/g, name: 'neutral-400' },
  { re: /#9098a8|#9098A8/g, name: 'neutral-300' },
  { re: /#C9C9DA/g, name: 'neutral-200' },
  { re: /#E0E0ED/g, name: 'neutral-100' },
  { re: /#e879a8|#E879A8/g, name: 'color-pink' },
  { re: /#6d8fd6|#6D8FD6/g, name: 'color-blue (6d8fd6)' },
  { re: /#c9a227|#C9A227/g, name: 'color-gold-warm' },
  { re: /#e4c86a|#E4C86A/g, name: 'color-gold-soft' },
  { re: /#F4729B/g, name: 'color-rose-soft (F4729B)' },
  { re: /#e8ecf4|#E8ECF4/g, name: 'color-mist' },
];

const RGBA_PATTERNS = [
  { rgb: [255, 107, 157], name: 'color-rose' },
  { rgb: [107, 138, 255], name: 'color-blue' },
  { rgb: [168, 216, 255], name: 'color-blue-light' },
  { rgb: [255, 255, 255], name: 'color-white' },
  { rgb: [0, 0, 0], name: 'black' },
  { rgb: [255, 215, 0], name: 'color-gold' },
  { rgb: [182, 107, 255], name: 'color-purple' },
  { rgb: [255, 182, 217], name: 'color-pink-warm' },
  { rgb: [240, 244, 255], name: 'color-snow' },
  { rgb: [16, 18, 34], name: 'neutral-900 (16,18,34)' },
  { rgb: [10, 12, 24], name: 'neutral-900 (10,12,24)' },
  { rgb: [109, 143, 214], name: 'color-blue (109,143,214)' },
  { rgb: [201, 162, 39], name: 'color-gold-warm' },
  { rgb: [228, 200, 106], name: 'color-gold-soft' },
  { rgb: [232, 121, 168], name: 'color-pink' },
  { rgb: [74, 106, 224], name: 'color-blue-deep' },
  { rgb: [232, 236, 244], name: 'color-mist' },
];

function findMatchesWithContext(content, regex, contextLines = 1) {
  const results = [];
  const lines = content.split('\n');
  let m;
  const globalRe = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  while ((m = globalRe.exec(content)) !== null) {
    let lineIdx = 0;
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length + 1 > m.index) {
        lineIdx = i;
        break;
      }
      charCount += lines[i].length + 1;
    }
    const start = Math.max(0, lineIdx - contextLines);
    const end = Math.min(lines.length, lineIdx + contextLines + 1);
    results.push({
      match: m[0],
      line: lineIdx + 1,
      col: m.index - charCount + 1,
      context: lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n'),
    });
  }
  return results;
}

function isInComment(line, matchIndexInLine, fullContent, charPos) {
  let commentDepth = 0;
  for (let i = 0; i < charPos; i++) {
    if (fullContent[i] === '/' && fullContent[i + 1] === '*') commentDepth++;
    if (fullContent[i] === '*' && fullContent[i - 1] === '/') commentDepth = Math.max(0, commentDepth - 1);
  }
  return commentDepth > 0;
}

function analyzeFile(filename) {
  const filePath = path.join(CSS_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  console.log('\n' + '='.repeat(70));
  console.log(`🔍 分析文件: ${filename}  (${content.length.toLocaleString()} 字节)`);
  console.log('='.repeat(70));

  let hexTotal = 0;
  let hexInRootOrTheme = 0;
  let hexInVarFallback = 0;
  let hexInComment = 0;
  let hexUnprotected = 0;
  const hexByType = {};

  let rgbaTotal = 0;
  let rgbaInRootOrTheme = 0;
  let rgbaInVarFallback = 0;
  let rgbaInComment = 0;
  let rgbaUnprotected = 0;
  const rgbaByType = {};

  for (const { re, name } of HEX_PATTERNS) {
    const matches = findMatchesWithContext(content, re, 0);
    if (matches.length === 0) continue;
    hexByType[name] = { total: 0, root: 0, fallback: 0, comment: 0, unprotected: 0 };

    for (const m of matches) {
      hexTotal++;
      hexByType[name].total++;

      const lines = content.split('\n');
      const line = lines[m.line - 1] || '';

      let inVar = false;
      if (line.includes('var(')) {
        const beforeMatch = line.substring(0, m.col - 1);
        const varIdx = beforeMatch.lastIndexOf('var(');
        if (varIdx !== -1) {
          const afterVar = line.substring(varIdx);
          if (afterVar.includes(',')) {
            inVar = true;
          }
        }
      }

      let inRoot = false;
      let inDataTheme = false;
      {
        let braceCount = 0;
        let blockStart = -1;
        for (let i = 0; i < matches.length; i++) {}
        let scanPos = 0;
        const charPos = (() => {
          let pos = 0;
          for (let i = 0; i < m.line - 1; i++) pos += lines[i].length + 1;
          return pos + m.col - 1;
        })();
        const beforeContent = content.substring(0, charPos);
        const rootIdx = beforeContent.lastIndexOf(':root');
        const themeIdx = beforeContent.lastIndexOf('[data-theme');

        function braceBalanceUpTo(idx) {
          let depth = 0;
          for (let i = 0; i < idx; i++) {
            if (content[i] === '{') depth++;
            else if (content[i] === '}') depth--;
          }
          return depth;
        }

        if (rootIdx !== -1) {
          const braceAfterRoot = content.indexOf('{', rootIdx);
          if (braceAfterRoot !== -1 && braceAfterRoot < charPos) {
            const depthAtRootOpen = braceBalanceUpTo(braceAfterRoot);
            const depthAtMatch = braceBalanceUpTo(charPos);
            if (depthAtMatch > depthAtRootOpen) inRoot = true;
          }
        }
        if (themeIdx !== -1) {
          const braceAfterTheme = content.indexOf('{', themeIdx);
          if (braceAfterTheme !== -1 && braceAfterTheme < charPos) {
            const depthAtThemeOpen = braceBalanceUpTo(braceAfterTheme);
            const depthAtMatch = braceBalanceUpTo(charPos);
            if (depthAtMatch > depthAtThemeOpen) inDataTheme = true;
          }
        }
      }

      const isInCom = isInComment(line, m.col, content, (() => {
        let pos = 0;
        for (let i = 0; i < m.line - 1; i++) pos += lines[i].length + 1;
        return pos + m.col - 1;
      })());

      if (isInCom) { hexInComment++; hexByType[name].comment++; continue; }
      if (inRoot || inDataTheme) { hexInRootOrTheme++; hexByType[name].root++; continue; }
      if (inVar) { hexInVarFallback++; hexByType[name].fallback++; continue; }
      hexUnprotected++;
      hexByType[name].unprotected++;

      if (hexUnprotected <= 10) {
        console.log(`  ⚠️ HEX 未替换: ${m.match}  行 ${m.line}:${m.col}  → ${name}`);
        console.log(`     ${line.trim()}`);
      }
    }
  }

  for (const { rgb, name } of RGBA_PATTERNS) {
    const [R, G, B] = rgb;
    const re = new RegExp(`rgba\\(\\s*${R}\\s*,\\s*${G}\\s*,\\s*${B}\\s*,\\s*[\\d.]+\\s*\\)`, 'g');
    const matches = findMatchesWithContext(content, re, 0);
    if (matches.length === 0) continue;
    rgbaByType[name] = { total: 0, root: 0, fallback: 0, comment: 0, unprotected: 0 };

    for (const m of matches) {
      rgbaTotal++;
      rgbaByType[name].total++;

      const lines = content.split('\n');
      const line = lines[m.line - 1] || '';

      let inVar = false;
      if (line.includes('var(')) {
        const beforeMatch = line.substring(0, m.col - 1);
        const varIdx = beforeMatch.lastIndexOf('var(');
        if (varIdx !== -1) {
          const afterVar = line.substring(varIdx);
          if (afterVar.includes(',')) inVar = true;
        }
      }

      let inRoot = false;
      let inDataTheme = false;
      {
        const linesArr = content.split('\n');
        const charPos = (() => {
          let pos = 0;
          for (let i = 0; i < m.line - 1; i++) pos += linesArr[i].length + 1;
          return pos + m.col - 1;
        })();
        const beforeContent = content.substring(0, charPos);
        const rootIdx = beforeContent.lastIndexOf(':root');
        const themeIdx = beforeContent.lastIndexOf('[data-theme');

        function braceBalanceUpTo(idx) {
          let depth = 0;
          for (let i = 0; i < idx; i++) {
            if (content[i] === '{') depth++;
            else if (content[i] === '}') depth--;
          }
          return depth;
        }

        if (rootIdx !== -1) {
          const braceAfterRoot = content.indexOf('{', rootIdx);
          if (braceAfterRoot !== -1 && braceAfterRoot < charPos) {
            const depthAtRootOpen = braceBalanceUpTo(braceAfterRoot);
            const depthAtMatch = braceBalanceUpTo(charPos);
            if (depthAtMatch > depthAtRootOpen) inRoot = true;
          }
        }
        if (themeIdx !== -1) {
          const braceAfterTheme = content.indexOf('{', themeIdx);
          if (braceAfterTheme !== -1 && braceAfterTheme < charPos) {
            const depthAtThemeOpen = braceBalanceUpTo(braceAfterTheme);
            const depthAtMatch = braceBalanceUpTo(charPos);
            if (depthAtMatch > depthAtThemeOpen) inDataTheme = true;
          }
        }
      }

      const isInCom = isInComment(line, m.col, content, (() => {
        let pos = 0;
        for (let i = 0; i < m.line - 1; i++) pos += lines[i].length + 1;
        return pos + m.col - 1;
      })());

      if (isInCom) { rgbaInComment++; rgbaByType[name].comment++; continue; }
      if (inRoot || inDataTheme) { rgbaInRootOrTheme++; rgbaByType[name].root++; continue; }
      if (inVar) { rgbaInVarFallback++; rgbaByType[name].fallback++; continue; }
      rgbaUnprotected++;
      rgbaByType[name].unprotected++;

      if (rgbaUnprotected <= 10) {
        console.log(`  ⚠️ RGBA 未替换: ${m.match}  行 ${m.line}:${m.col}  → ${name}`);
        console.log(`     ${line.trim()}`);
      }
    }
  }

  console.log(`\n📊 HEX 颜色统计:`);
  console.log(`  总匹配数:         ${hexTotal}`);
  console.log(`  在注释中:         ${hexInComment}  (不替换 ✓)`);
  console.log(`  在:root/[data-theme]: ${hexInRootOrTheme}  (不替换 ✓)`);
  console.log(`  在var() fallback: ${hexInVarFallback}  (不替换 ✓)`);
  console.log(`  未保护需替换:     ${hexUnprotected}`);

  console.log(`\n📊 RGBA 颜色统计:`);
  console.log(`  总匹配数:         ${rgbaTotal}`);
  console.log(`  在注释中:         ${rgbaInComment}  (不替换 ✓)`);
  console.log(`  在:root/[data-theme]: ${rgbaInRootOrTheme}  (不替换 ✓)`);
  console.log(`  在var() fallback: ${rgbaInVarFallback}  (不替换 ✓)`);
  console.log(`  未保护需替换:     ${rgbaUnprotected}`);

  return { filename, hexTotal, hexUnprotected, rgbaTotal, rgbaUnprotected };
}

console.log('🔬 CSS 颜色映射表全面审计');
const summary = [];
for (const file of TARGET_FILES) {
  summary.push(analyzeFile(file));
}

console.log('\n' + '='.repeat(70));
console.log('📋 最终审计汇总');
console.log('='.repeat(70));
for (const s of summary) {
  const status = (s.hexUnprotected === 0 && s.rgbaUnprotected === 0) ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${s.filename}`);
  console.log(`   HEX: 总数 ${s.hexTotal}，未保护 ${s.hexUnprotected}`);
  console.log(`   RGBA: 总数 ${s.rgbaTotal}，未保护 ${s.rgbaUnprotected}`);
}
