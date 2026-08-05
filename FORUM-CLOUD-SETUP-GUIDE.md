# 论坛上云操作手册（方案 2-B · 用户执行部分）

> ⚠️ **过时提示（2026-08）**：本文为历史操作手册。以仓库内 **`db/migration-*.sql` + 当前前端代码** 为准；聊天请执行 `migration-023-forum-chat.sql`，勿再跑废弃的 `migration-020-forum-chat.sql`。现状摘要见 `docs/STATUS.md`。

> 适用：你（站点 Owner）在 Supabase 后台与 GitHub Desktop 中手动完成的步骤。
> 前端代码已由 AI 完成（`forum/` 子目录 + 3 个迁移 SQL），**沙箱无数据库写权、不代 push**。
> 预计手动操作时间：15–25 分钟（含等 GitHub Pages 部署）。

---

## 0. 前置确认

- [ ] 你能登录 Supabase 后台，项目 `lmlyfyjffaaddysiliht`（与飞行雪绒主站同一项目）。
- [ ] 本地 `C:/Users/lenovo/CURSOR/Snow/` 是 GitHub 仓库 `vertiniris/I-MISS-YOU` 的克隆，已装 GitHub Desktop。
- [ ] 你知道自己想用作「论坛管理员」的邮箱（建议直接用主站注册时的同一邮箱，详见 §3-C）。

三个 SQL 文件位置（直接用，无需改动，除 §2 的邮箱占位）：
- `db/migration-020-forum-tables.sql` — 建表
- `db/migration-021-forum-rls.sql` — 行级安全（**需改一处邮箱占位**）
- `db/migration-022-forum-realtime.sql` — 实时推送

---

## 1. 建表（migration-020）

1. 打开 Supabase 后台 → 左侧 **SQL Editor**。
2. 点 **New query**，清空默认内容。
3. 打开本地文件 `C:/Users/lenovo/CURSOR/Snow/db/migration-020-forum-tables.sql`，**全选复制**内容粘贴进编辑器。
4. 点 **Run**（右上角 ▶，或 Ctrl/Cmd+Enter）。
5. 预期结果：底部返回 `Success. No rows returned.`，无报错。
   - 此文件用 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`，**可重复执行**，不会因多次运行出错。
   - 会新建 `forum_submissions`（TEXT 主键 `id`、含 `realm` / `tags` 数组 / `is_hidden` 等）与 `forum_comments`（外键 `submission_id` 级联删除）两张表，并建 5 个索引 + `updated_at` 触发器。

✅ 完成标志：表出现在左侧 **Table Editor → forum_submissions / forum_comments**。

---

## 2. 行级安全 RLS（migration-021）— ⚠️ 必须先改邮箱

> ✅ **已预先填好**：`is_forum_admin()` 的管理员邮箱已改为 `2473609011@qq.com`，你无需再改，直接跑即可。如需换人，把该行邮箱改掉再跑一次。

1. 用编辑器（VS Code / 记事本）打开 `db/migration-021-forum-rls.sql`（邮箱已填 `2473609011@qq.com`）。
2. 确认第 27 行附近为：
   ```sql
   AND u.email = '2473609011@qq.com'   -- ← 管理员邮箱（站点 Owner）
   ```
   - 推荐用你在飞行雪绒主站注册时填的**同一邮箱**（这样主站登录后，论坛里你自动是管理员）。
3. 回到 Supabase **SQL Editor** → **New query** → 粘贴全文 → **Run**。
5. 预期：底部 `Success. No rows returned.`
   - 此文件用 `DROP POLICY IF EXISTS` + `CREATE POLICY`，**可重复执行**。
   - 会启用两张表的 RLS，并创建策略：
     - `public_read`：任何人（含游客）可读 ✅
     - `auth_insert`：已登录（含匿名登录）才能写，且 `author_id` 绑定自己 ✅
     - `owner_update` / `owner_delete`：本人或管理员可改 / 删 ✅

✅ 完成标志：左侧 **Database → Policies** 下能看到 6 条 `forum_*` 策略。

> 改管理员邮箱的其它方式（任选，详见文件末尾注释）：
> - B（推荐已用）：直接改 `is_forum_admin()` 函数里的硬编码邮箱，再于 **Database → Functions** 点击该函数编辑保存。
> - C（与主站打通）：用主站注册邮箱登录，并把该邮箱填进函数，两边皆为管理员。

---

## 3. 实时推送（migration-022）

1. Supabase **SQL Editor** → **New query**。
2. 打开 `db/migration-022-forum-realtime.sql` 全选复制粘贴。
3. **Run**。
4. 预期：`Success.` 无报错。
   - 幂等（已加入发布则跳过），`REPLICA IDENTITY FULL` 两表。
   - 作用：帖子 / 评论写库后，已订阅客户端毫秒级收到变更，实现跨设备真·实时。

✅ 完成标志：无报错即可（后台 **Database → Replication** 中 `supabase_realtime` 发布包含两张表）。

---

## 4. Auth 设置：开匿名登录 + 关邮箱确认 ⚠️ 关键

论坛「匿名身份发帖」（星炬学院学生 / 拉海洛居民等预设身份）依赖 Supabase **匿名登录**产生的用户，这类用户属于 `authenticated` 角色，RLS 才放行写操作。

1. Supabase 后台 → 左侧 **Authentication → Providers**（或 **Sign In / Providers**）。
2. 找到 **Anonymous sign-ins**（匿名登录）：
   - 把开关切到 **Enabled（开启）**。
3. 同一页面（或 **Authentication → Providers → Email**）：
   - 找到 **Email confirmations**（邮箱确认）：
   - 把开关切到 **Disabled（关闭）**。
   - 理由：匿名用户无真实邮箱，若开启确认会卡在「待验证」导致写库失败。
4. 点 **Save**（如有）。

✅ 完成标志：Anonymous sign-ins = Enabled；Email confirmations = Disabled。

> 注意：只关「邮箱确认」不影响主站已有账号；匿名登录是 Supabase 原生能力，免费层可用。

---

## 5. 后台快速核验（可选但推荐）

在 **SQL Editor** 跑一条只读查询确认表与策略生效：
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'forum_%';
```
应返回 `forum_submissions` 与 `forum_comments` 两行。

---

## 6. GitHub Desktop 提交并推送

> 代码改动已落在本地仓库，需你手动 commit/push，GitHub Pages 会自动重新部署。

1. 打开 **GitHub Desktop**，当前仓库应为 `I-MISS-YOU`，当前分支 `main`。
2. 左侧 **Changes** 应出现本次改动（新增 + 修改，约 10 个文件）：
   - 新增：`db/migration-020/021/022-forum-*.sql`、`forum/js/forum-supabase.js`、`forum/js/forum-cloud.js`
   - 修改：`forum/index.html`、`forum/js/forum-data.js`、`forum/js/forum-auth.js`、`forum/js/forum.js`、`forum/js/forum-sync.js`
3. 在底部 **Summary** 填：`feat(forum): 论坛上云 Supabase（方案2-B）`。
4. 点 **Commit to main**。
5. 点顶部 **Push origin**（或 Fetch/Push 后 Push）。
6. 等待 GitHub Pages 部署：仓库 → **Actions / Pages** 状态变绿，或访问 `https://vertiniris.github.io/I-MISS-YOU/forum/` 刷新确认。

✅ 完成标志：GitHub Pages 部署成功，论坛页可访问。

---

## 7. 上线后验证清单

部署完成后，在浏览器做以下验证（建议用隐身窗口 + 真机/换设备对照）：

- [ ] **跨设备可见**：设备 A 发帖 → 设备 B（或隐身窗口）刷新能看到该帖。
- [ ] **跨页会话**：主站（`../index.html`）登录后，访问论坛 `forum/`，导航栏账号按钮显示已登录（无手动同步）。
- [ ] **同步栏状态**：论坛工具栏下方同步栏显示「云端已连接 · 待上报 N」（N=0 表示无积压，离线发的帖恢复后归零）。
- [ ] **匿名发帖**：未登录时选「星炬学院学生」等身份直接发帖，成功且他人可见。
- [ ] **离线降级**：断网发帖 → 本地立即可见、同步栏 `待上报 1`；恢复网络后自动上报并归零。
- [ ] **控制台无报错**：F12 Console 无红色错误（若有 `RLS` / `policy` 报错，回头查 §2 邮箱与 §4 匿名开关）。

---

## 8. 回滚（如异常）

论坛改动完全独立（`forum/` 子目录 + 3 个新增迁移表），主站零改动。

- **前端回退**：临时从 `forum/index.html` 移除 `forum-supabase.js` / `forum-cloud.js` 两行 `<script>`，论坛自动回落本地 localStorage 模式。
- **数据库**：新增的 `forum_*` 表不影响主站数据；如需彻底撤销，可在 SQL Editor 执行：
  ```sql
  DROP TABLE IF EXISTS public.forum_comments;
  DROP TABLE IF EXISTS public.forum_submissions;
  ```
  （仅在你确认要清空论坛云数据时执行，慎删。）

---

## 9. 常见问题

**Q：运行 SQL 报错 `relation already exists`？**
A：三个文件都做了幂等处理，重复跑不会报错。若报其它错，把错误信息贴回给我。

**Q：发帖时控制台报 `new row violates row-level security policy`？**
A：多半是 §4 匿名登录没开，或 §2 邮箱占位没改（但邮箱只影响管理删除，不影响发帖）。先确认 Anonymous sign-ins = Enabled。

**Q：主站登录后论坛仍显示未登录？**
A：两站必须同属 `vertiniris.github.io` 源（当前部署即如此）。若你改过自定义域名或本地 `localhost` 调试，会话不共享。属正常。

**Q：旧本地帖子没上云？**
A：设计如此 —— 仅官方种子帖子上云，你本机旧帖保留本地不强制迁移（避免匿名数据批量上云）。不影响新发帖跨设备。

---

## 执行顺序速记

```
建表(020) → 改邮箱+跑RLS(021) → 跑Realtime(022) → 开匿名/关邮箱确认 → 核验表
   → GitHub Desktop 提交推送 → 上线验证
```

任何一步卡住，把页面提示 / 报错贴给我即可。
