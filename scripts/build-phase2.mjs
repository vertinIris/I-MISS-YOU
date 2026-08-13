/**
 * 飞行雪绒 · Stage II 构建
 * 1) JS 合并：主站 18 文件 → bundle-main.js；论坛 15 文件 → bundle-forum.js（按原顺序，整体 terser）
 * 2) CSS 压缩：主站 8 个 + 论坛 8 个 → 合并压缩为内联用字符串 + 外链 .min.css
 * 3) SRI：sha384 哈希
 * 4) Source Map：bundle JS 生成 .map（不入仓库）
 */
import { minify } from 'terser';
import { minify as cssMinify } from 'csso';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// ============================================================
// 1. 文件清单与顺序（严格按 index.html / forum/index.html 中 <script> 出现顺序）
// ============================================================

// 主站本地 JS（不含 CDN supabase.min.js）· v11.0 追加 signature-utils.js
const MAIN_JS = [
  'js/security-shield.js',
  'js/content-utils.js',
  'js/supabase-adapter.js',
  'js/repository.js',
  'js/admin-auth.js',
  'js/rate-limiter.js',
  'js/auth-manager.js',
  'js/sync-manager.js',
  'js/upload-manager.js',
  'js/rate-limiter-client.js',
  'js/admin-panel.js',
  'js/particles.js',
  'js/secret-portal.js',
  'js/snow-easter.js',
  'js/snow-realm.js',
  'js/modal-a11y.js',
  'js/app-toast.js',
  'js/signature-utils.js',
  'js/main.js',
  'js/donation.js',
  // 'js/sw-register.js', // v11.5: index.html 单独加载，避免 bundle 内重复注册
];

// 论坛本地 JS（不含 CDN supabase.min.js；含跨目录引用的 ../js/*）· v11.0 追加 signature-utils.js
// v10.1: 移除 forum-import-data.js（416KB 种子数据），改为 HTML 中单独 defer 加载，避免拖累 bundle
const FORUM_JS = [
  'forum/js/forum-data.js',
  'js/snow-realm.js',            // ../js/snow-realm.js
  'js/security-shield.js',       // ../js/security-shield.js
  'js/rate-limiter-client.js',   // ../js/rate-limiter-client.js
  'js/modal-a11y.js',            // ../js/modal-a11y.js
  'js/app-toast.js',             // ../js/app-toast.js
  'forum/js/forum-auth.js',
  'forum/js/forum-upload.js',
  'forum/js/forum.js',
  'forum/js/forum-sync.js',
  'forum/js/forum-supabase.js',
  'forum/js/forum-cloud.js',
  'forum/js/forum-chat.js',
  'forum/js/forum-easter.js',
  'js/signature-utils.js',       // ../js/signature-utils.js
  'js/donation.js',              // ../js/donation.js
];

// 主站 CSS（index.html 中 <link> 顺序）· v11.0 追加 snow-signature + snow-weapons · P3-1 追加 fonts
const MAIN_CSS = [
  'css/fonts.css',
  'css/tokens-base.css',
  'css/tokens-snow.css',
  'css/style.css',
  'css/secret-portal.css',
  'css/community-polish.css',
  'css/banding-fix.css',
  'css/donation.css',
  'css/snow-atmosphere.css',
  'css/snow-signature.css',
  'css/snow-weapons.css',
];

// 论坛 CSS（forum/index.html 中 <link> 顺序）· v11.0 追加 stf-signature + stf-weapons · P3-1 追加 fonts
const FORUM_CSS = [
  'css/fonts.css',
  'css/tokens-base.css',
  'css/forum-shared.css',
  'css/tokens-stf.css',
  'css/donation.css',
  'forum/forum.css',
  'forum/forum-easter.css',
  'forum/forum-theme.css',
  'forum/forum-visual.css',
  'css/stf-signature.css',
  'css/stf-weapons.css',
];

// 角色页 CSS（7 个角色页共用）· v11.0 追加 snow-signature · P3-1 追加 fonts
const ARCHIVE_CSS = [
  'css/fonts.css',
  'css/tokens-base.css',
  'css/tokens-snow.css',
  'css/archive-subset.css',
  'css/snow-atmosphere.css',
  'css/zone-atmosphere.css',
  'css/snow-signature.css',
];

// 全局保留符号（与 Stage I 一致）
const RESERVED_GLOBALS = [
  'AdminAuth','AdminPanel','AuthManager','ClientRateLimiter','DataRepository',
  'SecurityShield','SnowParticles','SupabaseAdapter','SyncManager','UploadManager',
  'ContentUtils','SnowRealm','SnowEaster','SecretPortal','ModalA11y','__FXRE',
  'escapeHtml','formatTime','showSubmitToast','openAdminLoginModal',
  'StarTorchAuth','StarTorchChat','StarTorchCloud','StarTorchData','StarTorchEaster',
  'StarTorchSync','StarTorchUpload','StarTorchSupabase','stfInitAll',
  'renderComments','renderCommunity','handleCommentSubmit','handleDeleteComment',
  'applyRealtimeCommentEvent','ensureProfileExists','reconcileCommentThread',
  'reconcileCommunityGrid','syncAllPostCommentCounts','manualRefreshAll',
  'toggleBookmark','openDonationModal','closeDonationModal','stripeCheckout',
  'FlyingEdelweissDonate','forumSupabase','StarTorchForum',
  '__SNOW_SIG__',
];

const TERSER_OPTS = {
  compress: { defaults: true, passes: 1, unsafe: false, unsafe_comps: false,
              reduce_vars: true, hoist_funs: false, hoist_vars: false,
              dead_code: true, drop_debugger: true, drop_console: false, keep_infinity: true },
  mangle: { toplevel: false, eval: false, reserved: RESERVED_GLOBALS,
            keep_fnames: true, keep_classnames: true },
  format: { comments: false, preserve_annotations: false, semicolons: true, beautify: false },
  sourceMap: { filename: null, url: null },  // 后面按需设置
};

// ============================================================
// 2. 工具函数
// ============================================================
function fmt(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(2) + ' MB';
}

function sriSha384(buf) {
  const hash = crypto.createHash('sha384').update(buf).digest('base64');
  return `sha384-${hash}`;
}

function readConcat(fileList) {
  return fileList.map(rel => {
    const fp = path.join(ROOT, rel);
    if (!fs.existsSync(fp)) throw new Error(`源文件不存在: ${rel}`);
    return fs.readFileSync(fp, 'utf8');
  }).join('\n;\n');  // 分号分隔避免 IIFE 之间 ASI 问题
}

// ============================================================
// 3. JS 合并 + 压缩
// ============================================================
async function buildBundle(fileList, outName) {
  console.log(`\n[BUILD] ── 构建 ${outName} ──`);
  const srcConcat = readConcat(fileList);
  const srcSize = Buffer.byteLength(srcConcat, 'utf8');
  console.log(`[BUILD]   合并源文件 ${fileList.length} 个，总体积 ${fmt(srcSize)}`);

  const opts = JSON.parse(JSON.stringify(TERSER_OPTS));  // 深拷贝
  opts.sourceMap = {
    filename: outName,
    url: outName + '.map',
  };

  const result = await minify(srcConcat, opts);
  if (result.error) throw new Error(`Terser 压缩失败 ${outName}: ${result.error}`);
  if (!result.code) throw new Error(`Terser 产物为空 ${outName}`);

  const outPath = path.join(DIST, outName);
  const mapPath = path.join(DIST, outName + '.map');

  fs.writeFileSync(outPath, result.code, 'utf8');
  if (result.map) {
    // Terser 可能返回字符串或对象；统一为字符串写入
    const mapStr = typeof result.map === 'string' ? result.map : JSON.stringify(result.map);
    fs.writeFileSync(mapPath, mapStr, 'utf8');
  }

  const dstSize = Buffer.byteLength(result.code, 'utf8');
  const ratio = (dstSize / srcSize * 100).toFixed(1);
  const saved = ((1 - dstSize/srcSize) * 100).toFixed(1);
  const sri = sriSha384(Buffer.from(result.code, 'utf8'));

  console.log(`[BUILD]   ✅ ${outName}: ${fmt(srcSize)} → ${fmt(dstSize)} (${ratio}%, 节省 ${saved}%)`);
  console.log(`[BUILD]   ✅ Source Map: ${outName}.map (${result.map ? fmt(Buffer.byteLength(JSON.stringify(result.map))) : 'N/A'})`);
  console.log(`[BUILD]   ✅ SRI: ${sri.substring(0, 30)}...`);

  return { name: outName, srcSize, dstSize, ratio, saved, sri, mapGenerated: !!result.map };
}

// ============================================================
// 4. CSS 压缩
// ============================================================
// ============================================================
// 4.1 CSS 安全加固（v11.4.0）
//   a) 为每条 backdrop-filter 补 -webkit-backdrop-filter（WebKit / Safari / iOS 兼容，
//      避免玻璃拟态在旧引擎上整体失效导致可读性/美观退化）。
//   b) 追加全局 @media (prefers-reduced-motion: reduce) 守卫：关闭装饰性动画并隐藏
//      8 层背景 + 粒子画布，防止眩晕/卡顿，保障「全方面体验」稳定流畅。
// ============================================================
function hardenCss(minified) {
  let css = minified;

  // (a) -webkit-backdrop-filter 镜像（顺序无关、幂等）：
  //     先清掉已有 -webkit- 副本，再为每条 backdrop-filter 追加精确镜像，
  //     保证每条玻璃拟态规则在 WebKit/Safari/iOS 上都有对应前缀。
  css = css.replace(/-webkit-backdrop-filter:\s*[^;}]+;?/g, '');
  css = css.replace(/(backdrop-filter:\s*[^;}]+;)/g, (m) => {
    const webkit = m.replace('backdrop-filter:', '-webkit-backdrop-filter:');
    return `${m}${webkit}`;
  });

  // (b) reduced-motion 守卫（追加在末尾，使用 !important 确保覆盖）
  const reducedMotion = `
@media (prefers-reduced-motion: reduce){
*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
.star-field,.pink-galaxy,.galaxy-river,.ult-energy-core,.hex-shield,.data-rain,.shooting-star-container,.css-snow-container,#particle-canvas{display:none!important}
}`;
  css += reducedMotion;
  return css;
}

function buildCss(fileList, outName) {
  console.log(`\n[BUILD] ── 构建 ${outName} ──`);
  const srcConcat = readConcat(fileList);
  const srcSize = Buffer.byteLength(srcConcat, 'utf8');
  console.log(`[BUILD]   合并源 CSS ${fileList.length} 个，总体积 ${fmt(srcSize)}`);

  const result = cssMinify(srcConcat, { restructure: true, comments: false });
  let minified = result.css;

  // 安全加固：webkit 前缀 + reduced-motion 守卫
  minified = hardenCss(minified);

  const dstSize = Buffer.byteLength(minified, 'utf8');
  const ratio = (dstSize / srcSize * 100).toFixed(1);
  const saved = ((1 - dstSize/srcSize) * 100).toFixed(1);

  // 写入 dist/css/ 供外链用（角色页等）
  const outPath = path.join(DIST, 'css', outName);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, minified, 'utf8');

  console.log(`[BUILD]   ✅ ${outName}: ${fmt(srcSize)} → ${fmt(dstSize)} (${ratio}%, 节省 ${saved}%)`);

  return { name: outName, srcSize, dstSize, ratio, saved, css: minified };
}

// ============================================================
// 5. SRI 自动更新：构建后更新 HTML 中的 integrity 属性
// ============================================================
function updateSriInHtml(htmlPath, bundleName, sri) {
  console.log(`\n[BUILD]   → 更新 ${path.basename(htmlPath)} 中的 ${bundleName} SRI...`);
  let html = fs.readFileSync(htmlPath, 'utf8');

  // 匹配 <script src=".../bundleName" integrity="old-sri" 的模式
  // 支持 index.html (src="dist/bundle-*.js") 和 forum/index.html (src="../dist/bundle-*.js")
  const escapedName = bundleName.replace(/\./g, '\\.');
  const scriptRegex = new RegExp(
    `<script[^>]*src="([^"]*)${escapedName}"[^>]*integrity="[^"]*"[^>]*crossorigin="anonymous"[^>]*>`,
    'g'
  );

  const matches = html.match(scriptRegex);
  if (!matches) {
    console.warn(`[BUILD]   ⚠️ 未在 ${path.basename(htmlPath)} 中找到 ${bundleName} 的 script 标签`);
    return false;
  }

  html = html.replace(scriptRegex, (match) => {
    return match.replace(/integrity="[^"]*"/, `integrity="${sri}"`);
  });

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`[BUILD]   ✅ ${path.basename(htmlPath)} 的 ${bundleName} SRI 已更新 → ${sri.substring(0, 25)}...`);
  return true;
}

// ============================================================
// 6. 执行
// ============================================================
(async () => {
  fs.mkdirSync(path.join(DIST, 'css'), { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    stage: 'phase-2',
    bundles: {},
    css: {},
  };

  // JS bundles
  report.bundles.main = await buildBundle(MAIN_JS, 'bundle-main.js');
  report.bundles.forum = await buildBundle(FORUM_JS, 'bundle-forum.js');

  // CSS bundles
  report.css.main = buildCss(MAIN_CSS, 'main.min.css');
  report.css.forum = buildCss(FORUM_CSS, 'forum.min.css');
  report.css.archive = buildCss(ARCHIVE_CSS, 'archive.min.css');

  // 汇总
  console.log('\n' + '='.repeat(72));
  console.log('[BUILD] Stage II 汇总');
  console.log('='.repeat(72));
  console.log(`  bundle-main.js  : ${fmt(report.bundles.main.dstSize)}  (SRI: ${report.bundles.main.sri.substring(0,20)}...)`);
  console.log(`  bundle-forum.js : ${fmt(report.bundles.forum.dstSize)}  (SRI: ${report.bundles.forum.sri.substring(0,20)}...)`);
  console.log(`  main.min.css    : ${fmt(report.css.main.dstSize)}`);
  console.log(`  forum.min.css   : ${fmt(report.css.forum.dstSize)}`);
  console.log(`  archive.min.css : ${fmt(report.css.archive.dstSize)}`);
  console.log('='.repeat(72));

  fs.writeFileSync(
    path.join(DIST, 'build-report-phase2.json'),
    JSON.stringify(report, null, 2)
  );
  console.log('[BUILD] 报表写入 dist/build-report-phase2.json');

  // 自动更新 HTML 中的 SRI integrity 属性（防止未来重建后白屏）
  console.log('\n' + '='.repeat(72));
  console.log('[BUILD] SRI 自动更新 → HTML');
  console.log('='.repeat(72));

  const indexHtml = path.join(ROOT, 'index.html');
  const forumHtml = path.join(ROOT, 'forum', 'index.html');

  const mainUpdated = updateSriInHtml(indexHtml, 'bundle-main.js', report.bundles.main.sri);
  const forumUpdated = updateSriInHtml(forumHtml, 'bundle-forum.js', report.bundles.forum.sri);

  // 自检：确认 HTML 中的 SRI 与构建产物一致
  console.log('\n[BUILD] 验证 HTML SRI 与构建产物一致性...');
  const verifyHtml = (htmlPath, bundleName, expectedSri) => {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const esc = bundleName.replace(/\./g, '\\.');
    // HTML 中属性顺序：src="bundleName" 在前，integrity="..." 在后
    const regex = new RegExp(`src="[^"]*${esc}"[^>]*integrity="([^"]*)"`);
    const match = html.match(regex);
    if (match && match[1] === expectedSri) {
      console.log(`[BUILD]   ✅ ${path.basename(htmlPath)}: ${bundleName} SRI 一致`);
    } else {
      console.error(`[BUILD]   ❌ ${path.basename(htmlPath)}: ${bundleName} SRI 不匹配！`);
      console.error(`       期望: ${expectedSri}`);
      console.error(`       实际: ${match ? match[1] : '未找到'}`);
      process.exit(1);
    }
  };

  if (mainUpdated) verifyHtml(indexHtml, 'bundle-main.js', report.bundles.main.sri);
  if (forumUpdated) verifyHtml(forumHtml, 'bundle-forum.js', report.bundles.forum.sri);

  console.log('\n[BUILD] ✅ Stage II 构建完成，HTML SRI 已同步。');
})();
