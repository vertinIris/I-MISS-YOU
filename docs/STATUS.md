# 现状速览（STATUS）

> 权威来源：**当前代码** + `db/migration-*.sql`。历史规划（`FORUM-CLOUD-*`、`EXECUTION-PLAN-v8.0.md` 等）仅作背景，顶部已标过时提示。

## 对外版本

- 产品展示版：**v10.0**（主站页脚、论坛页脚、`window.__FXRE_API.version`）
- `package.json`：`10.0.0`
- 种子缓存键（`SEED_VERSION`）是数据修订号，可与对外版本不同，勿混用

## Migration 要点

- `020`：仅 `migration-020-forum-tables.sql`（论坛帖/评）
- 聊天：`migration-023-forum-chat.sql`（**禁止**再跑废弃的 `DEPRECATED-migration-020-forum-chat.sql`）
- `028`：`migration-028-forum-pin-replies.sql` — `is_pinned` + `forum_comments.parent_id`（一层楼中楼）
- 本地脚本：`npm run db:migrate-020` / `db:migrate-023` / `db:migrate-028` 仅打印指引
- 内容管线：`docs/CONTENT-PIPELINE.md` · `npm run content:build`

## 双套 Auth（文档级约定）

| | 主站 | 论坛 |
|---|---|---|
| 模块 | `js/auth-manager.js` | `forum/js/forum-auth.js` |
| UI 镜像 | `fxre_auth_session` | `stf_session` |
| 权威会话 | 同项目 Supabase GoTrue（同域 `persistSession` 共享） | 同左 |
| 管理员 | `profiles.role` | `forum_admins` / RLS `is_forum_admin()` |

同域（如 GitHub Pages `/` 与 `/forum/`）下邮箱登录可互认；昵称合成邮箱路径仅论坛。合并两套 UI **非当前目标**。

## 本地门禁

```bash
node scripts/smoke-check.mjs
node scripts/extreme-audit.mjs
# 可选（需 Playwright + 静态服）:
# node scripts/browser-probe.mjs http://127.0.0.1:8848
```

CI：`.github/workflows/static-checks.yml`（默认 smoke + extreme；browser-probe 需 `PLAYWRIGHT_PROBE=1`）。
