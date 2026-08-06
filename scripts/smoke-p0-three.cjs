'use strict';
/**
 * P0 smoke：阶段1色值 / 阶段2 lore 护栏 / 阶段3 CSP·defer·modal
 * 纯静态检查，不启服务。
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
let failed = 0;
function ok(name, cond, detail) {
  if (cond) console.log('  PASS', name, detail || '');
  else { console.log('  FAIL', name, detail || ''); failed++; }
}

console.log('=== 阶段1 令牌 ===');
const style = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
ok('style.css 不覆写 --c-primary', !/:root\s*\{[^}]*--c-primary\s*:/.test(style.slice(0, 2500)));
const snow = fs.readFileSync(path.join(root, 'css/tokens-snow.css'), 'utf8');
ok('tokens-snow 有粉主色', /--c-primary:\s*#e879a8/i.test(snow));
const stf = fs.readFileSync(path.join(root, 'css/tokens-stf.css'), 'utf8');
ok('tokens-stf 学院蓝', /--c-primary:\s*#6d8fd6/i.test(stf) && /--stf-brand:\s*#6d8fd6/i.test(stf));
const forumHtml = fs.readFileSync(path.join(root, 'forum/index.html'), 'utf8');
const styleIdx = forumHtml.indexOf('css/style.css');
const stfIdx = forumHtml.indexOf('css/tokens-stf.css');
ok('forum tokens-stf 在 style.css 后', styleIdx > 0 && stfIdx > styleIdx);
const hexFiles = [
  'forum/forum.css', 'forum/forum-easter.css',
  'forum/js/forum.js', 'forum/js/forum-auth.js', 'forum/js/forum-chat.js', 'forum/js/forum-cloud.js'
];
let leftover = 0;
hexFiles.forEach((f) => {
  const n = (fs.readFileSync(path.join(root, f), 'utf8').match(/#6B8AFF/gi) || []).length;
  leftover += n;
});
ok('论坛关键文件无 #6B8AFF 残留', leftover === 0, 'count=' + leftover);

console.log('=== 阶段2 lore 护栏 ===');
const build = fs.readFileSync(path.join(root, 'scripts/build-forum-import.cjs'), 'utf8');
ok('build 分流 lore', /type:lore|loreOnly/.test(build));
const data = fs.readFileSync(path.join(root, 'forum/js/forum-data.js'), 'utf8');
ok('forum-data 过滤 lore', /isDiscussionSeedType/.test(data) && /type.*lore/.test(data));
const cloud = fs.readFileSync(path.join(root, 'forum/js/forum-cloud.js'), 'utf8');
ok('ensureCloudSeed 白名单', /CLOUD_SEED_TYPE_ALLOW/.test(cloud) && /t === 'lore'/.test(cloud));
ok('attemptSubmission 拦 lore', /拒绝 upsert type:lore/.test(cloud));
const imp = fs.readFileSync(path.join(root, 'forum/js/forum-import-data.js'), 'utf8');
const loreInSeed = (imp.match(/"type":"lore"/g) || []).length;
ok('import-data 无 lore', loreInSeed === 0, 'lore=' + loreInSeed);
ok('excludedLoreCount 标注', /excludedLoreCount:\s*\d+/.test(imp));
const pipe = fs.readFileSync(path.join(root, 'docs/CONTENT-PIPELINE.md'), 'utf8');
ok('CONTENT-PIPELINE 边界', /禁止.*forum_submissions/.test(pipe) && /type:lore/.test(pipe));
const status = fs.readFileSync(path.join(root, 'docs/STATUS.md'), 'utf8');
ok('STATUS 017 自查 SQL', /017 自查/.test(status) && /未由 Agent 核验/.test(status));

console.log('=== 阶段3 CSP / defer / 焦点陷阱 ===');
ok('forum CSP', /Content-Security-Policy/.test(forumHtml) && /cdn\.jsdelivr\.net/.test(forumHtml) && /unpkg\.com/.test(forumHtml));
const deferScripts = (forumHtml.match(/<script defer /g) || []).length;
ok('forum 脚本 defer', deferScripts >= 10, 'defer=' + deferScripts);
ok('forum 加载 modal-a11y', /modal-a11y\.js/.test(forumHtml));
const mainHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok('主站加载 modal-a11y', /modal-a11y\.js/.test(mainHtml));
const a11y = fs.readFileSync(path.join(root, 'js/modal-a11y.js'), 'utf8');
ok('modal-a11y 焦点陷阱', /keydown/.test(a11y) && /Tab/.test(a11y) && /role="dialog"/.test(a11y));

console.log(failed ? '\nRESULT: FAIL (' + failed + ')' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
