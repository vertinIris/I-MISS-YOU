# 论坛数据上云改造计划（方案 2-B · 详细执行方案）

> ⚠️ **过时提示（2026-08）**：规划文档，可能与现状不一致。以 **`db/migration-*.sql` + 当前 `forum/` / `js/` 代码** 为准。现状摘要见 `docs/STATUS.md`。

> 目标：将星炬学院主论坛（`forum/`）从「纯 localStorage 本地存储」升级为「Supabase 云端存储」，
> 与主站（飞行雪绒）**共用同一 Supabase 项目**（`lmlyfyjffaaddysiliht`），实现：
> 1. 账号统一 —— 任一站点注册/登录，两边自动互认（同一 Supabase 会话）。
> 2. 数据跨设备 —— 帖子/评论/点赞在所有设备一致，清缓存不丢。
> 3. 真·实时 —— 用 Supabase Realtime 做多用户实时推送，替代仅同机的 `storage` 事件。
> 4. 可审核 —— 论坛帖子进入与主站一致的 RLS + 管理后台审核体系。
>
> 设计原则（做就做好）：**共享 auth + 独立 forum 数据表**，避免污染主站 `submissions` 表。

---

## 0. 前提核实（Phase 0 · 执行前必做）

已排查确认：

| 项 | 现状 | 来源 |
|---|---|---|
| Supabase 项目 | `lmlyfyjffaaddysiliht`（主站在用） | `js/supabase-adapter.js:20` 的 anonKey |
| anonKey | 已硬编码于 `js/supabase-adapter.js:20`（公开密钥，可复用） | 同上 |
| URL 默认值 | `CONFIG.url` 经 `SupabaseAdapter.configure({url})` 注入（生产可用，需定位注入点） | `js/supabase-adapter.js:151-180` |
| 主站 `submissions` 表 | 字段：`id,type,title,content,author_name,author_color,likes,created_at,author_id,is_hidden`，标签走 `submission_tags` 关联表；**无 `realm` 列，且返回全部帖子** | `js/supabase-adapter.js:496` |
| `profiles` 表 | `id(uuid→auth.users),nickname(varchar50),avatar_color(varchar20),bio,created_at,updated_at` | `db/migration-001-init.sql:19` |
| 论坛本地数据层 | `StarTorchData`：`stf_submissions`/`stf_comments_*`/`stf_seed_*`/`stf_nickname`，`realm='startorch'` | `forum/js/forum-data.js` |
| 论坛认证 | `StarTorchAuth`：本地 SHA-256，`stf_accounts`/`stf_session` | `forum/js/forum-auth.js` |
| **已存在的云端接缝** | `forum/js/forum-sync.js` 已检测 `window.StarTorchCloud` 并委托 `pull/push/getPending` | `forum/js/forum-sync.js` |

**结论**：论坛不接入主站 `submissions` 表（无 realm、会污染主站 feed），而是新建独立的 `forum_submissions` / `forum_comments` 表，复用同一项目的 auth。

---

## 1. 总体架构

```
┌──────────────────────────────────────────────────────────┐
│  Supabase 项目 lmlyfyjffaaddysiliht                         │
│  ├─ auth.users / auth.sessions  ← 共享账号（两站统一）       │
│  ├─ profiles(id,nickname,avatar_color,…) ← 共享身份         │
│  ├─ submissions / comments / submission_tags ← 主站数据     │
│  ├─ forum_submissions / forum_comments      ← 论坛数据(新)  │
│  └─ RLS（匿名读+本人写+管理员审）                            │
└──────────────────────────────────────────────────────────┘
        ▲                               ▲
   飞行雪绒站(主站)                   星炬学院论坛(forum/)
   supabase-adapter + AuthManager     forum-supabase(init)
   DataRepository                     StarTorchCloud(adapter)
                                     StarTorchAuth→Supabase
                                     StarTorchData→云端+本地缓存
```

- **账号打通原理**：Supabase 会话存于同域 `localStorage` 键 `sb-<ref>-auth`。主站与论坛同属 `vertiniris.github.io` 源 → 任一处登录，另一处自动识别。**无需手动"同步账号"**。
- **数据隔离**：论坛帖子在 `forum_submissions`，主站 feed 查询 `submissions`，互不串。

---

## 2. 文件级改动清单

### 新增文件

| 文件 | 职责 |
|---|---|
| `forum/js/forum-supabase.js` | 初始化 `window.supabaseClient`（沿用主站 URL+anonKey，加载 Supabase CDN 或复用主站已加载的 `window.supabase`）；导出 `ensureForumClient()`。`forum/index.html` 在 `forum-sync.js` 前加载。 |
| `forum/js/forum-cloud.js` | 实现 `window.StarTorchCloud` 接口：`pull(cb)`（查 `forum_submissions`+`forum_comments`，含本地缓存）、`push(item,cb)`（upsert）、`getPending()`、`getMode()→'cloud'`。**接入即触发同步栏切「云端已连接」**。 |
| `db/migration-020-forum-tables.sql` | 建 `forum_submissions` / `forum_comments` 表（含索引、`updated_at` 触发器、`handle_new_user` 已存在可复用）。 |
| `db/migration-021-forum-rls.sql` | 两表的 RLS：匿名 `SELECT`；匿名/已登录 `INSERT`（author_id 绑定 `auth.uid()`）；本人 `UPDATE/DELETE`；管理员 `UPDATE/DELETE`（复用主站 admin 判定）；`forum_comments` 同理。 |
| `db/migration-022-forum-realtime.sql` | 为两表开启 Realtime（`alter publication supabase_realtime add table …`，或 `replica identity full`，参照 `migration-016/017`）。 |

### 修改文件

| 文件 | 改动 |
|---|---|
| `forum/js/forum-auth.js` | 重写：`register/login/logout/currentUser/onChange/bumpPostCount` 改为调用 `supabaseClient.auth.signUp/signInWithPassword/signInAnonymously` + `profiles` upsert（nickname/avatar_color）。**保持原公开 API 不变**，使 `forum.js` 的 UI 绑定零改动。匿名预设身份（星炬学院学生等）经 `signInAnonymously()` 取得稳定 uid 后绑定显示名/色。 |
| `forum/js/forum-data.js` | `StarTorchData` 改为云端优先 + 本地缓存兜底：`getSubmissions/saveSubmissions/getComments/saveComments` 走 `StarTorchCloud`；`ensureSeedData` 改为幂等把官方种子（stf_1..stf_12）写入 `forum_submissions`（按 id upsert + 墓碑表防复活）；离线时读本地缓存、写操作入队。 |
| `forum/js/forum.js` | `buildSubmission` 的 `author` 改为 Supabase uid；`persistNewSubmission` 写入走云端（乐观更新+本地缓存）；`refreshCommunity` 已存在，供 `StarTorchCloud.pull` 回调重渲染。其余 UI 逻辑基本不变。 |
| `forum/index.html` | 在 `forum-sync.js` 前引入 Supabase CDN + `forum-supabase.js` + `forum-cloud.js`；同步栏文案自动随模式切换（无需改 HTML）。 |
| `forum/js/forum-sync.js` | 现有 `window.StarTorchCloud` 委托逻辑**已就绪**，仅需确保 `forum-cloud.js` 在其 `init()` 前挂载 `window.StarTorchCloud`。可选增强：用 Realtime 订阅替代 `storage` 事件的"实时监测"主路径，`storage` 事件降级为兜底。 |

> 注：主站（`index.html` / `js/auth-manager.js` / `js/supabase-adapter.js` / `js/repository.js`）**零改动** —— 账号打通靠共享 Supabase 会话自动完成，数据表各自独立。

---

## 3. 数据库表设计（forum 专属）

### `forum_submissions`（对照现有本地 `buildSubmission` 字段）

```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()   -- 或保留客户端 'stf_'+时间戳做幂等
author_id     UUID REFERENCES auth.users(id)
author_name   VARCHAR(60) NOT NULL
author_color  VARCHAR(20) NOT NULL DEFAULT '#6B8AFF'
type          VARCHAR(20) NOT NULL          -- text/story/poem/art/music
title         VARCHAR(300) NOT NULL
content       TEXT NOT NULL
image         TEXT DEFAULT ''               -- 压缩封面 dataURL 或 ''
tags          TEXT[] DEFAULT '{}'           -- 简化：用数组，避免 submission_tags 关联复杂度
identity      VARCHAR(30) DEFAULT NULL      -- 匿名预设身份 id（学生/居民…）
realm         VARCHAR(20) NOT NULL DEFAULT 'startorch'  -- 语义保留，便于未来
likes         INT NOT NULL DEFAULT 0
is_hidden     BOOLEAN NOT NULL DEFAULT FALSE
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### `forum_comments`

```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
submission_id UUID NOT NULL REFERENCES forum_submissions(id) ON DELETE CASCADE
author_id     UUID REFERENCES auth.users(id)
author_name   VARCHAR(60) NOT NULL
author_color  VARCHAR(20) NOT NULL DEFAULT '#6B8AFF'
content       TEXT NOT NULL
is_hidden     BOOLEAN NOT NULL DEFAULT FALSE
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

> 标签用 `TEXT[]` 而非关联表：论坛标签是简单字符串集合，数组查询（`tags && ARRAY['爱弥斯']`）足够，省去 `submission_tags`/`tags` 两套表与 join，简化 `StarTorchCloud.pull`。

---

## 4. 分阶段执行步骤

- **Phase 0 · 核实注入点**：定位主站 `CONFIG.url` 的实际注入位置（`SupabaseAdapter.configure` 调用方 / `index.html` 内联），提取 `{url, anonKey}` 供论坛复用；在 Supabase SQL Editor 确认 `profiles`/`auth` 结构与此计划一致。**产出**：一份准确的连接配置与表结构确认单。
- **Phase 1 · 建表 + RLS + Realtime**：执行 `migration-020/021/022`（幂等，可重复跑）；在 SQL Editor 验证匿名能 `SELECT`、登录后能 `INSERT` 自己的行。
- **Phase 2 · 客户端接入**：`forum-supabase.js`（init client）+ `forum-cloud.js`（`StarTorchCloud` 实现）+ `forum/index.html` 引入。此时同步栏应从「本地模式」切「云端已连接」。
- **Phase 3 · 数据层云化**：`forum-data.js` 改为云端优先 + 本地缓存兜底；`ensureSeedData` 幂等播种官方种子到 `forum_submissions`。
- **Phase 4 · 认证云化**：`forum-auth.js` 改调 Supabase auth；匿名预设身份走 `signInAnonymously`。验证主站登录后论坛自动识别（跨页会话）。
- **Phase 5 · 实时 + 收尾**：`forum-sync.js` 接入 Realtime 订阅作为"实时监测"主路径；`forum.js` 发帖走云端乐观更新；`node --check` 全过；本地缓存离线降级验证。

---

## 5. 关键设计决策与风险

| 决策 | 选择 | 理由 |
|---|---|---|
| 论坛数据表 | 独立 `forum_*` 表（非主站 `submissions`） | 主站表无 `realm` 且返回全量，硬塞会污染主站 feed 与审核 |
| 账号打通 | 共享 Supabase `auth.users`+`profiles` | 会话存同域 localStorage，两站自动互认，零手动同步 |
| 标签存储 | `TEXT[]` 数组 | 论坛标签简单，避免关联表/join 复杂度 |
| 离线策略 | 本地缓存 + 写队列 | 保留论坛"离线可用"体验，网络恢复后自动上报 |
| 现有本地帖子 | 官方种子上云；用户旧本地帖保留本地（或一键迁移） | 避免匿名数据批量灌云造成重复/隐私问题 |

**风险与缓解**：
- R3 `profiles` 字段差异 → Phase 0 核实，论坛仅用 `nickname/avatar_color`。
- R4 写冲突/配额 → `StarTorchCloud.push` 失败入队，复用主站 `queuePending` 思路。
- R5 匿名发帖审核 → `forum_submissions.is_hidden` + 与主站同套 RLS/admin 通道。
- R6 迁移期双写 → 过渡期 `StarTorchData` 同时维护本地缓存与云端，云端为权威；不破坏现有离线用户。

---

## 6. 验证与回滚

- **功能验证**：`node --check` 全过（forum-supabase/cloud/auth/data/js）；GitHub Pages 部署后：
  1. 论坛发帖 → 刷新/换设备可见（跨设备）。
  2. 主站登录 → 论坛自动显示已登录（跨页会话）。
  3. 同步栏显示「云端已连接 · 待上报 N」。
  4. 断网发帖 → 本地缓存可见、恢复后自动上报。
- **回滚**：论坛改动独立（`forum/` 子目录 + 3 个新迁移），主站零改动；若上云异常，可临时移除 `forum-cloud.js` 引入回退本地模式，迁移为新增表不影响主站数据。

---

## 7. 改动量与工期估算

- **新增文件**：5 个（2 JS + 3 SQL）。
- **修改文件**：5 个（均在 `forum/`，主站 0 改动）。
- **代码量**：约 400–600 行新增/改写（含 SQL）。
- **工期**：Phase 0–5 连续约 **1.5–2 天**（含 Supabase SQL Editor 执行与跨设备实测）。

---

## 8. 待您确认

1. **是否接受"独立 forum 表"而非复用主站表**（本计划默认独立，最干净，推荐）？
2. **现有用户本地帖子**：默认"官方种子上云、旧本地帖保留本地"，是否还需要"一键迁移我的本地帖子到云端"按钮？（建议先不做，减少匿名数据上云）
3. 计划批准后，我按 Phase 0→5 顺序执行；Phase 1 的 SQL 需您在 **Supabase SQL Editor** 以服务角色执行（沙箱无数据库写权限，历来由您操作），其余前端代码由我完成并交您 GitHub Desktop 推送。

> 本文件为**方案文档，未改动任何源码/数据库**。确认后进入执行。
