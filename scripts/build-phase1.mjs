/**
 * 飞行雪绒 · Stage I JS 压缩脚本
 * 策略：逐文件 terser 压缩 → dist/；不合并、不开 mangle-toplevel、保留全局符号
 */
import { minify } from 'terser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ============================================================
// 1. 要压缩的本地 JS 文件（排除 CDN 外链；排除 supabase.min.js，已 min）
//    顺序不重要（Stage I 不合并）；但路径要准确
// ============================================================
const FILES = [
  // --- 主站 js/ ---
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
  'js/main.js',
  'js/donation.js',
  // --- 论坛 forum/js/ ---
  'forum/js/forum-import-data.js',
  'forum/js/forum-data.js',
  'forum/js/forum-auth.js',
  'forum/js/forum-upload.js',
  'forum/js/forum.js',
  'forum/js/forum-sync.js',
  'forum/js/forum-supabase.js',
  'forum/js/forum-cloud.js',
  'forum/js/forum-chat.js',
  'forum/js/forum-easter.js',
];

// ============================================================
// 2. 全局保留符号（跨脚本通过 window.XXX 互相调用）
//    逐文件 grep window.XXX = 得出
// ============================================================
const RESERVED_GLOBALS = [
  // 模块级 window 暴露
  'AdminAuth',
  'AdminPanel',
  'AuthManager',
  'ClientRateLimiter',
  'DataRepository',
  'SecurityShield',
  'SnowParticles',
  'SupabaseAdapter',
  'SyncManager',
  'UploadManager',
  'ContentUtils',
  'DonationWidget',
  'SnowRealm',
  'SnowEaster',
  'SecretPortal',
  'ModalA11y',
  '__FXRE',
  'escapeHtml',
  'formatTime',
  'showSubmitToast',
  'openAdminLoginModal',
  // forum 模块全局
  'StarTorchAuth',
  'StarTorchChat',
  'StarTorchCloud',
  'StarTorchData',
  'StarTorchEaster',
  'StarTorchSync',
  'StarTorchUpload',
  'StarTorchSupabase',
  'stfInitAll',
  // 跨模块符号（main.js 与别模块交互的全局 helper，在 <script> 顶层 var/function）
  'renderComments',
  'renderCommunity',
  'handleCommentSubmit',
  'handleDeleteComment',
  'applyRealtimeCommentEvent',
  'ensureProfileExists',
  'reconcileCommentThread',
  'reconcileCommunityGrid',
  'syncAllPostCommentCounts',
  'manualRefreshAll',
  'toggleBookmark',
  'openDonationModal',
  'closeDonationModal',
  'stripeCheckout',
];

// Terser 配置：保守档，绝不误优化语义
const TERSER_OPTS = {
  compress: {
    defaults: true,           // 默认压缩项
    passes: 1,                // 单次 pass（稳妥）
    unsafe: false,            // 关闭激进
    unsafe_comps: false,
    reduce_vars: true,
    hoist_funs: false,
    hoist_vars: false,
    dead_code: true,
    drop_debugger: true,
    drop_console: false,      // 保留 console（生产也用于排错）
    keep_infinity: true,
  },
  mangle: {
    toplevel: false,          // 关键：不碰顶层变量/全局
    eval: false,
    reserved: RESERVED_GLOBALS,
    keep_fnames: true,        // 保留函数名（利于堆栈 + AuthManager/AdminPanel 等构造名相等场景）
    keep_classnames: true,
  },
  format: {
    comments: false,          // 移除注释（生产减小；但保留 @license/@preserve 若存在）
    preserve_annotations: false,
    semicolons: true,
    beautify: false,
  },
  sourceMap: false,           // Stage I 不加 map（避免 git 历史膨胀）
};

// ============================================================
// 3. 执行压缩
// ============================================================
const DIST_ROOT      = path.join(ROOT, 'dist');
const DIST_JS        = path.join(DIST_ROOT, 'js');
const DIST_FORUM_JS  = path.join(DIST_ROOT, 'forum', 'js');

for (const d of [DIST_ROOT, DIST_JS, DIST_FORUM_JS]) {
  fs.mkdirSync(d, { recursive: true });
}

let totalSrc = 0;
let totalDst = 0;
const reportRows = [];

for (const rel of FILES) {
  const src = path.join(ROOT, rel);
  const dst = path.join(DIST_ROOT, rel);
  const outDir = path.dirname(dst);
  fs.mkdirSync(outDir, { recursive: true });

  if (!fs.existsSync(src)) {
    console.error(`[BUILD] ❌ 源文件不存在: ${rel}`);
    process.exit(1);
  }

  const srcCode = fs.readFileSync(src, 'utf8');
  const srcSize = Buffer.byteLength(srcCode, 'utf8');
  totalSrc += srcSize;

  const result = await minify(srcCode, TERSER_OPTS);
  if (result.error) {
    console.error(`[BUILD] ❌ 压缩失败 ${rel}:`, result.error);
    process.exit(1);
  }
  if (!result || typeof result.code !== 'string') {
    console.error(`[BUILD] ❌ 压缩产物为空 ${rel}`);
    process.exit(1);
  }

  fs.writeFileSync(dst, result.code, 'utf8');
  const dstSize = Buffer.byteLength(result.code, 'utf8');
  totalDst += dstSize;

  const ratio = (dstSize / srcSize * 100).toFixed(1);
  const saved = ((1 - dstSize/srcSize) * 100).toFixed(1);
  reportRows.push({ rel, srcSize, dstSize, ratio, saved });
  console.log(`[BUILD]   ✅ ${rel.padEnd(34)}  ${fmt(srcSize)} → ${fmt(dstSize)}  (${ratio}%, 节省 ${saved}%)`);
}

// ============================================================
// 4. 汇总报表
// ============================================================
console.log('');
console.log('='.repeat(80));
console.log(`[BUILD] 总源文件体积 : ${fmt(totalSrc)}  (${reportRows.length} 个文件)`);
console.log(`[BUILD] 总压缩后体积 : ${fmt(totalDst)}`);
const overallRatio = (totalDst / totalSrc * 100).toFixed(1);
const overallSaved = ((1 - totalDst/totalSrc) * 100).toFixed(1);
console.log(`[BUILD] 总体压缩比   : ${overallRatio}%  (节省 ${overallSaved}%，约 ${fmt(totalSrc-totalDst)})`);
console.log('='.repeat(80));

// 写一份 JSON 报表给后续自检用
fs.writeFileSync(
  path.join(DIST_ROOT, 'build-report.json'),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    stage: 'phase-1',
    terserOpts: TERSER_OPTS,
    reserved: RESERVED_GLOBALS,
    totalFiles: reportRows.length,
    totalSrcBytes: totalSrc,
    totalDstBytes: totalDst,
    overallRatio: Number(overallRatio),
    overallSavedPercent: Number(overallSaved),
    files: reportRows,
  }, null, 2)
);
console.log(`[BUILD]   报表写入 dist/build-report.json`);

function fmt(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(2) + ' MB';
}
