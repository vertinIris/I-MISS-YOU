# 现状速览（STATUS）

> 权威来源：**当前代码** + `db/migration-*.sql`。历史规划（`FORUM-CLOUD-*`、`EXECUTION-PLAN-v8.0.md` 等）仅作背景，顶部已标过时提示。

## 对外版本

- 产品展示版：**v10.0**（主站页脚、论坛页脚、`window.__FXRE_API.version`）
- `package.json`：`10.0.0`
- 种子缓存键（`SEED_VERSION`）是数据修订号，可与对外版本不同，勿混用

## Migration 要点

- `020`：仅 `migration-020-forum-tables.sql`（论坛帖/评）
- 聊天：`migration-023-forum-chat.sql`（**禁止**再跑废弃的 `DEPRECATED-migration-020-forum-chat.sql`）
- `017`：`migration-017-hard-delete-for-realtime.sql` — 主站 comments/submissions 硬删 + Realtime DELETE
- `027`：`migration-027-profiles-nickname-rls.sql` — profiles 本人 INSERT + 显示名 UPDATE（可写 `nickname`）
- `028`：`migration-028-forum-pin-replies.sql` — `is_pinned` + `forum_comments.parent_id`（一层楼中楼）
- 本地脚本：`npm run db:migrate-020` / `db:migrate-023` / `db:migrate-028` 仅打印指引
- 内容管线：`docs/CONTENT-PIPELINE.md` · `npm run content:build`
- **lore 护栏**：`type:lore` 档案向内容由构建分流 + `ensureCloudSeed` 白名单双拦，不进 `forum_submissions`

### migration-017（硬删 / Realtime DELETE）— Production 已确认

含义：主站 `comments` / `submissions` 的 hide/自删从「`is_hidden` 软删」改为**物理 `DELETE`**，以便 Realtime 能投递 DELETE 事件；审计靠 `moderation_logs.content_snapshot`。  
代码侧已按硬删路径标注（见 `js/supabase-adapter.js` deleteComment 注释）。

**用户已确认**：Production 已执行（硬删 Realtime 版，仓库全文）。Agent 无法登录 Supabase，不以 Dashboard 再核验；**勿反复催用户重跑**。以下 SQL 仅供日后自查（只读）：

```sql
-- 017 自查 A：函数体是否含物理 DELETE（期望 delete_comment_with_token / delete_submission_with_token 定义里出现 DELETE FROM）
SELECT p.proname, pg_get_functiondef(p.oid) AS def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'delete_comment_with_token',
    'delete_submission_with_token',
    'moderate_comment',
    'moderate_submission'
  );

-- 017 自查 B：moderation_logs 是否有 content_snapshot
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'moderation_logs'
  AND column_name = 'content_snapshot';

-- 017 自查 C（抽测，可选）：对测试行执行作者删/版主 hide 后，行应不存在（物理删除），且不应仅剩 is_hidden=true
-- SELECT id, is_hidden FROM public.comments WHERE id = <test_id>;  -- 期望 0 行
-- SELECT id, is_hidden FROM public.submissions WHERE id = <test_id>;
```

### Production 云端核验（收口）

**用户已确认**：Production 已执行 **017**（硬删 Realtime）、**027**（profiles nickname RLS）与 **028**（`is_pinned` + `parent_id`）。  
Agent **无法登录 Supabase**，不以 Dashboard 再核验；**勿反复催用户重跑**。以下 SQL 仅供日后自查（只读）：

```sql
-- 027：期望存在 profiles_owner_insert / profiles_owner_update_v3
SELECT polname FROM pg_policy
WHERE polrelid = 'public.profiles'::regclass
  AND polname IN ('profiles_owner_insert', 'profiles_owner_update_v3');

-- 028：期望列存在
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'forum_submissions' AND column_name = 'is_pinned')
    OR (table_name = 'forum_comments' AND column_name = 'parent_id')
  );
```

## 双套 Auth（文档级约定）

| | 主站 | 论坛 |
|---|---|---|
| 模块 | `js/auth-manager.js` | `forum/js/forum-auth.js` |
| UI 镜像 | `fxre_auth_session` | `stf_session` |
| 权威会话 | 同项目 Supabase GoTrue（同域 `persistSession` 共享） | 同左 |
| 管理员 | `profiles.role` | `forum_admins` / RLS `is_forum_admin()` |

同域（如 GitHub Pages `/` 与 `/forum/`）下邮箱登录可互认；昵称合成邮箱路径仅论坛。合并两套 UI **非当前目标**（通行证 / 频道账号边界保留，不合并代码）。

## 构建债（暂缓）

静态站无打包管道；`js/main.js` 等以源文件 + `defer` 直出。**暂缓 terser / minify**，避免半吊子构建破坏全局与加载顺序；若日后加 `npm run minify`，须保 defer 与全局符号不变。

## 本地门禁与评审闭环

```bash
node scripts/smoke-check.mjs
node scripts/extreme-audit.mjs
# 可选（需 Playwright + 静态服）:
# node scripts/browser-probe.mjs http://127.0.0.1:8848
```

CI：`.github/workflows/static-checks.yml`（默认 smoke + extreme；browser-probe 需仓库 Actions variable `PLAYWRIGHT_PROBE=1`）。  
Lighthouse CI：`.github/workflows/lighthouse.yml`（a11y ≥ 0.9 阻断，性能/SEO warn 不阻塞）。

### v10.1 安全加固 + 性能优化（2026-08-12）

- **CSP 加固**：移除 `script-src 'unsafe-inline'`，内联脚本提取为外部文件（`js/supabase-loader.js`、`forum/js/forum-theme-bootstrap.js`、`forum/js/forum-supabase-loader.js`）；添加 `frame-ancestors 'none'`
- **`_headers` 文件**：Cloudflare Pages 根目录新增，含 CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy + 静态资源 immutable 缓存
- **Lighthouse CI**：新增 `.github/workflows/lighthouse.yml` + `lighthouserc.json`，PR 性能回归防护
- **migration-029**：论坛服务端搜索 RPC（`search_forum_submissions` + `search_forum_comments`），ILIKE 中文友好，客户端搜索仍保留
- **bundle-forum.js 瘦身**：`forum-import-data.js`（416KB）从 bundle 拆出单独 defer 加载，bundle 534KB → 146.2KB（↓72.6%）
- **main.js 模块化**：评估后暂缓（4564 行 IIFE 共享闭包变量，拆分风险高，需后续单独处理）

### v10.1 库接入 + 监控 + a11y（2026-08-12 第二批）

- **axe-core a11y CI**：新增 `.github/workflows/accessibility.yml`，扫描主站 + 论坛 WCAG 2.1 AA，critical/serious 阻断
- **web-vitals RUM**：新增 `migration-030` + `js/web-vitals-collector.js`，匿名采集 LCP/INP/CLS/TTFB/FCP 写入 Supabase，RLS 仅 anon INSERT
- **Markdown 渲染**：新增 `js/markdown-renderer.js`（marked + DOMPurify + highlight.js），论坛帖子详情 + 评论接入 `renderMarkdown`，非 MD 文本降级纯文本
- **PhotoSwipe 灯箱**：新增 `forum/js/photoswipe-init.js`（ESM），论坛帖子详情大图手势缩放浏览
- **Just-Validate 表单验证**：新增 `forum/js/form-validator.js`，注册/登录表单前端校验（邮箱格式/显示名长度/口令一致性），捕获阶段拦截 submit
- **style-src 'unsafe-inline'**：评估后暂缓（28+ 处内联样式含 CSS 自定义属性 `--x/--tag-rot/--eqh` 是设计核心，移除风险高 ROI 低，业界普遍保留）

### Codex 不可用（替代闭环）

本环境 **无 Codex / code-review MCP**。强制 Codex 双轮评审 **不适用**。  
等价收口：**`smoke-check` + `extreme-audit` + 落盘评审文档**（如 `docs/CHARACTERS-EXPAND-REVIEW.md`、`docs/WORLDVIEW-REVIEW.md`）→ 通过后即可合入 / PUSH。恢复 Codex 后可再叠加外部复核，不阻塞当前交付。
