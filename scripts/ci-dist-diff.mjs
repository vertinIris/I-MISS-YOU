/**
 * CI 诊断：逐文件比对 已提交版本(git show HEAD:) 与 工作区当前版本 的字节差异。
 * 仅关注 dist 构建产物（排除 *.map 与 build-report），以及被构建脚本回写 SRI 的
 * index.html / forum/index.html。
 * 输出每个差异文件的：首次差异偏移、上下文字节（hex + ascii），便于定位跨环境非确定性来源。
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function gitShow(file) {
  try {
    return execSync(`git show HEAD:${file}`, { encoding: 'buffer', cwd: ROOT });
  } catch {
    return null; // 文件在 HEAD 中不存在
  }
}

function trackedFiles() {
  const out = execSync('git ls-files', { encoding: 'utf8', cwd: ROOT });
  return out.split('\n').filter(Boolean);
}

// 关注的文件集合：dist 下非 .map 非 report，以及两个被 SRI 回写的 html
const candidates = trackedFiles().filter((f) => {
  if (f === 'dist/build-report-phase2.json') return false;
  if (f.endsWith('.map')) return false;
  if (f.startsWith('dist/')) return true;
  if (f === 'index.html' || f === 'forum/index.html') return true;
  return false;
});

function hex(ctx, around = 24) {
  const start = Math.max(0, ctx.off - around);
  const end = Math.min(ctx.a.length, ctx.off + around);
  const sliceA = ctx.a.subarray(start, end);
  const sliceB = ctx.b.subarray(start, end);
  const toHex = (buf) => Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join(' ');
  const toAscii = (buf) => Array.from(buf).map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
  return `  HEAD : ${toHex(sliceA)}\n        ${toAscii(sliceA)}\n  WORK : ${toHex(sliceB)}\n        ${toAscii(sliceB)}`;
}

let diffCount = 0;
const lines = [];
lines.push(`DIFF DIAGNOSTIC @ ${execSync('git rev-parse --short HEAD', { encoding: 'utf8', cwd: ROOT }).trim()}`);
lines.push(`node ${process.version}  platform ${process.platform}`);
lines.push(`candidates: ${candidates.length}`);
lines.push('='.repeat(60));

for (const f of candidates) {
  const head = gitShow(f);
  let work;
  try {
    work = fs.readFileSync(path.join(ROOT, f));
  } catch {
    work = null;
  }
  if (head === null && work === null) continue;
  if (head === null) { lines.push(`+ NEW  ${f} (${work.length} bytes)`); diffCount++; continue; }
  if (work === null) { lines.push(`- GONE ${f}`); diffCount++; continue; }
  if (head.equals(work)) {
    lines.push(`  OK   ${f} (${head.length} bytes)`);
    continue;
  }
  diffCount++;
  // 找首个差异偏移
  const minLen = Math.min(head.length, work.length);
  let off = -1;
  for (let i = 0; i < minLen; i++) { if (head[i] !== work[i]) { off = i; break; } }
  if (off === -1) off = minLen; // 长度不同
  lines.push(`~ DIFF ${f}  HEAD=${head.length} WORK=${work.length} firstDiff@${off}`);
  lines.push(hex({ a: head, b: work, off }));
  lines.push('-'.repeat(60));
}

lines.push(`SUMMARY: ${diffCount} file(s) differ`);
console.log(lines.join('\n'));
process.exit(diffCount > 0 ? 2 : 0);
