# 现状速览（STATUS）

> 权威来源：**当前代码** + `db/migration-*.sql`。历史规划（`FORUM-CLOUD-*`、`EXECUTION-PLAN-v8.0.md` 等）仅作背景，顶部已标过时提示。

## 对外版本

- 产品展示版：**v10.0**（主站页脚、论坛页脚、`window.__FXRE_API.version`）
- `package.json`：`10.0.0`
- 种子缓存键（`SEED_VERSION`）是数据修订号，可与对外版本不同，勿混用

## Migration 要点

- `020`：仅 `migration-020-forum-tables.sql`（论坛帖/评）
- 聊天：`migration-023-forum-chat.sql`（**禁止**再跑废弃的 `DEPRECATED-migration-020-forum-chat.sql`）
- `027`：`migration-027-profiles-nickname-rls.sql` — profiles 本人 INSERT + 显示名 UPDATE（可写 `nickname`）
- `028`：`migration-028-forum-pin-replies.sql` — `is_pinned` + `forum_comments.parent_id`（一层楼中楼）
- 本地脚本：`npm run db:migrate-020` / `db:migrate-023` / `db:migrate-028` 仅打印指引
- 内容管线：`docs/CONTENT-PIPELINE.md` · `npm run content:build`

### Production 云端核验（收口）

**用户已确认**：Production 已执行 **027**（profiles nickname RLS）与 **028**（`is_pinned` + `parent_id`）。  
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

同域（如 GitHub Pages `/` 与 `/forum/`）下邮箱登录可互认；昵称合成邮箱路径仅论坛。合并两套 UI **非当前目标**。

## 本地门禁与评审闭环

```bash
node scripts/smoke-check.mjs
node scripts/extreme-audit.mjs
# 可选（需 Playwright + 静态服）:
# node scripts/browser-probe.mjs http://127.0.0.1:8848
```

CI：`.github/workflows/static-checks.yml`（默认 smoke + extreme；browser-probe 需仓库 Actions variable `PLAYWRIGHT_PROBE=1`）。

### Codex 不可用（替代闭环）

本环境 **无 Codex / code-review MCP**。强制 Codex 双轮评审 **不适用**。  
等价收口：**`smoke-check` + `extreme-audit` + 落盘评审文档**（如 `docs/CHARACTERS-EXPAND-REVIEW.md`、`docs/WORLDVIEW-REVIEW.md`）→ 通过后即可合入 / PUSH。恢复 Codex 后可再叠加外部复核，不阻塞当前交付。
