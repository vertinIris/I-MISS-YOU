# 飞行雪绒 / 星炬学院 · 执行规划 v8.0

> ⚠️ **过时提示（2026-08）**：本规划含当时实测快照（如 `forum_chat` 404）。以 **`db/migration-*.sql` + 当前代码** 为准；后续迁移（023+）与修复以代码仓库为准。现状摘要见 `docs/STATUS.md`。

> 编制日期：2026-08-04
> 工作目录（唯一权威）：`C:/Users/lenovo/CURSOR/Snow/`
> 仓库：`vertinIris/I-MISS-YOU` · 分支 `main` · 基线 HEAD `43279e3`
> 本规划基于**联网实测**而非文档推断，所有结论均附验证命令。

---

## 0. TL;DR

| 项 | 结论 |
|---|---|
| 主论坛帖子/评论是不是真云端？ | **是**。`forum_submissions` / `forum_comments` 已建表、已 RLS、已进 Realtime 发布，前端订阅代码完整。 |
| 实时聊天是不是真云端？ | **不是**。`forum_chat` 表**不存在**，聊天当前退化为本地单机回声。 |
| 根因 | `db/` 里有**两个 020 编号**文件，按 019→020→021→022 顺序执行时 `020-forum-chat.sql` 被漏跑。 |
| 唯一阻塞项 | 在 Supabase 执行 **`db/migration-023-forum-chat.sql`**（本次已重编号并补齐 Realtime 注册）。 |
| 次要阻塞项 | 573 条二创内容目前**只落在 localStorage**，跨用户不可见；且 500 KB 同步注入存在性能代价。 |

---

## 1. 实测基线（2026-08-04）

### 1.1 云端表状态

同一个 Supabase 项目（`lmlyfyjffaaddysiliht`）内**并存两套表族**，这是理解全局的前提：

| 表 | 归属 | HTTP | 行数 | 说明 |
|---|---|---|---|---|
| `submissions` | 主站（飞行雪绒） | 200 | 18 | migration-019 去 AI 化改写目标 ✅ |
| `comments` | 主站 | 200 | 41 | 同上（12 + 35 行已改写）✅ |
| `forum_submissions` | 论坛（星炬学院） | 200 | 11 | 含 1 条测试脏数据 `stf_test_probe` ⚠️ |
| `forum_comments` | 论坛 | 200 | 0 | 表在、订阅在，暂无数据 |
| `forum_admins` | 论坛 | 400\* | — | 表已存在（021 生效）✅ |
| `forum_chat` | 论坛聊天 | **404** | — | **`PGRST205: Could not find the table`** ❌ |

\* 400 而非 404，表示表存在但无 `id` 列（该表以 `email` 为键），属预期。

**复现命令**

```bash
KEY="<anon key，见 forum/js/forum-supabase.js>"
URL="https://lmlyfyjffaaddysiliht.supabase.co"
for T in submissions comments forum_submissions forum_comments forum_chat; do
  echo -n "$T -> "
  curl -s -I "$URL/rest/v1/$T?select=*" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
       -H "Prefer: count=exact" -H "Range: 0-0" | grep -iE "^HTTP|content-range" | tr '\n' ' '
  echo
done
```

### 1.2 迁移执行台账

| 文件 | 作用 | 状态 |
|---|---|---|
| `migration-019-deaify-live-content.sql` | 主站 `submissions`(12 行) + `comments`(35 行) 去 AI 化改写 | ✅ 已执行 |
| `migration-020-forum-tables.sql` | 建 `forum_submissions` / `forum_comments` + 索引 + 触发器 | ✅ 已执行 |
| `migration-021-forum-rls.sql` | 建 `forum_admins` + `is_forum_admin()` + 全套 RLS 策略 | ✅ 已执行 |
| `migration-022-forum-realtime.sql` | 将上述两表**逐表** ADD 进 `supabase_realtime` + REPLICA IDENTITY FULL | ✅ 已执行 |
| `migration-020-forum-chat.sql` | 建 `forum_chat` | ❌ **编号撞车被漏跑**，本次已标记 DEPRECATED |
| **`migration-023-forum-chat.sql`** | **取代上者**：建表 + RLS + **补齐 Realtime 注册** | ⏳ **待执行（唯一阻塞项）** |

> **为什么必须补 Realtime 注册**：原 020-forum-chat 注释写着「Realtime 已随 publication 发布所有表，无需额外配置」——这是错的。migration-022 证明本项目采用逐表 `ALTER PUBLICATION ... ADD TABLE`。若只建表不注册，聊天会变成「能存能读、但不会实时推送」，只靠轮询兜底，体验仍不真实。

### 1.3 本地内容资产实测

```
573 条二创        完整 JSON 500 KB   正文占 355 KB (71%)   平均 635 B/条   最长 527 字
类型分布          story 256 / lore 105 / text 92 / art 65 / video 55
作者分布          匿名信号源 370 (65%) / 漂泊者 175 / 飞行雪绒 24 / 西格莉卡 4
```

> **内容侧风险**：作者只有 4 个、且 65% 挂在「匿名信号源」。解析器经核对是**忠实的**（源 md 本身如此），所以这是**内容问题不是代码问题**——一个"论坛"里三分之二的帖子同一个匿名作者，观感不真实。已列入阶段 4。

---

## 2. 目录结构与职责

```
Snow/
├── index.html                 主站入口（飞行雪绒个人站）
├── css/  js/  assets/         主站样式 / 逻辑 / 图片
│   └── js/main.js             主站种子 + UI（v10.1，未提交）
│   └── js/repository.js       主站数据层（未提交）
│
├── forum/                     ★ 论坛主体（星炬学院）
│   ├── index.html             论坛入口，脚本加载顺序在此定义
│   ├── forum.css / -theme / -easter
│   └── js/
│       ├── forum-supabase.js  Supabase 客户端（URL + anon key + CDN 三级回退）
│       ├── forum-cloud.js     云端适配层：pull/push/Realtime 订阅 + 缺表检测
│       ├── forum-data.js      本地数据层：种子播种、localStorage 读写
│       ├── forum-import-data.js  ★生成物★ 573 条二创种子（500 KB，勿手改）
│       ├── forum.js           渲染与交互主控
│       ├── forum-auth.js      双轨身份（邮箱 / 昵称哈希）
│       ├── forum-chat.js      实时聊天（BroadcastChannel + 云端双通道）
│       ├── forum-sync.js      同步状态指示器
│       ├── forum-upload.js    图片上传
│       └── forum-easter.js    彩蛋
│
├── characters/                6 个角色档案子页（aimisi/denia/linne/lucilla/mornye/sigrica）
│
├── db/                        ★ SQL 迁移（唯一事实源，按编号顺序执行）
│   └── migration-001 … 023
│
├── scripts/                   构建与校验工具
│   ├── build-forum-import.cjs ★ md → forum-import-data.js 生成器
│   ├── smoke-check.mjs        冒烟校验
│   └── serve.sh               本地静态服务
│
├── 论坛内容/                   ★ 内容资产库（离线源，已 `.gitignore`，不部署）
│   ├── 二创内容库/            10 个 md，573 条 —— 生成器的输入
│   ├── 事实卷宗/              11 篇 vol-* —— 角色档案/世界观的事实源
│   ├── 角色分层架构/          4 篇 layered —— 档案分层渲染的结构源
│   ├── SUPB改写文本/          41 条 —— 主站内容，对应 migration-019
│   ├── 视觉资产/              10 个 SVG —— 角色卡/关系图/地图
│   ├── 创作指南/              3 篇 —— 收录规范与运营
│   ├── 技术参考/              ⚠️ 旧导出快照，**禁止直接覆盖现有代码**（勿拷入 js/forum）
│   ├── 迁移与报告/            论坛功能缺失汇报.md / 迁移说明.md
│   └── 内容总索引.json/.md    全量索引（含正文），机器可读
│
├── docs/                      文档 + 其他会话产出的 py 脚本
├── design-docs/               设计稿（未跟踪）
└── *.md（根目录）             历史规划与报告
```

### 2.1 关键约束

- **`forum/js/forum-import-data.js` 是生成物**，任何修改必须改 `scripts/build-forum-import.cjs` 后重新生成，否则下次构建被覆盖。
- **`论坛内容/技术参考/` 是旧快照**（`index.html` / `main.js` / `repository.js` / `supabase-adapter.js`）。直接覆盖会**回退到 v7.8.1 之前的 UI**，抹掉导航改版、捐赠、管理员按钮等。仅作对照阅读用。
- **`db/` 是数据库唯一事实源**，禁止在 Dashboard 里手改结构而不落 SQL 文件。

---

## 3. 依赖关系

```
论坛内容/二创内容库/*.md
        │  (scripts/build-forum-import.cjs)
        ▼
forum/js/forum-import-data.js ──▶ forum-data.js(ensureSeedData) ──▶ localStorage ──▶ forum.js 渲染
        │
        └─(阶段2)─▶ db/migration-024-import-seed.sql ──▶ forum_submissions ──▶ forum-cloud.pull ──▶ 全用户可见

db/021 (is_forum_admin) ──必需前置──▶ db/023 (forum_chat RLS)
db/023 ──▶ forum_chat 表 + Realtime ──▶ forum-cloud.pullChat/pushChat ──▶ forum-chat.js 真实时

论坛内容/事实卷宗/*.md ──(阶段3)──▶ 角色档案动态渲染
论坛内容/视觉资产/*.svg ──(阶段4)──▶ 角色卡 / 关系图
```

**硬依赖**：`021 → 023`（缺 `is_forum_admin()` 则 023 报错）。
**软依赖**：阶段 2 的云端导入完成后，阶段 1 的性能治理方案才能选「云端分页」而非「本地分片」。

---

## 4. 执行顺序

### 阶段 0 — 解除聊天阻塞【P0，5 分钟】

| 项 | 内容 |
|---|---|
| **输入** | `db/migration-023-forum-chat.sql`（已就位） |
| **操作** | Supabase Dashboard → SQL Editor → 新建查询 → 粘贴全文 → **以项目 owner / service_role 执行** |
| **输出** | `forum_chat` 表 + 2 索引 + 4 条 RLS 策略 + 进入 `supabase_realtime` 发布 |
| **验收 A** | 文件末尾 6.1/6.2/6.3 三段自检查询：应分别返回 8 行 / 4 行 / 1 行 |
| **验收 B** | `curl` 探针从 404 变 200：<br>`curl -s -o /dev/null -w "%{http_code}\n" "$URL/rest/v1/forum_chat?select=*&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"` |
| **验收 C** | 浏览器开**两个论坛标签页**，A 发消息 → B **无需刷新**即出现；同步点由琥珀色转绿 |
| **回滚** | `DROP TABLE public.forum_chat CASCADE;`（聊天自动退回本地模式，不影响其他功能） |
| **风险** | 低。若报 `function is_forum_admin() does not exist`，说明 021 未真正生效，先补跑 021。 |

> 前端代码**已经写好**（`forum-cloud.js` 的 `pullChat/pushChat/onChatRealtime` + `forum-chat.js` 的缺表优雅降级）。表一建好，聊天自动从"本地回声"升级为"真·实时"，**无需改一行前端代码**。

---

### 阶段 1 — 云端脏数据清理【P0，2 分钟】

| 项 | 内容 |
|---|---|
| **输入** | `forum_submissions` 中的 `stf_test_probe` |
| **操作** | SQL Editor 执行 `DELETE FROM public.forum_submissions WHERE id = 'stf_test_probe';` |
| **输出** | 论坛帖子由 11 条降为 10 条，与本地官方种子一致 |
| **验收** | `curl ... forum_submissions?id=eq.stf_test_probe` 返回 `[]` |
| **回滚** | 无需回滚（测试数据） |

---

### 阶段 2 — 573 条内容上云【P0，30–60 分钟】

这是**《论坛功能缺失汇报》里的 P0 缺口**，也是"内容有、论坛无"的根源。

**决策点：本地种子 vs 云端导入**

| 方案 | 优点 | 缺点 | 建议 |
|---|---|---|---|
| A. 维持 localStorage 种子（现状） | 零成本、离线可用 | **跨用户不可见**；每人一份副本；评论/点赞无法共享；首访写入 500 KB 造成卡顿 | ❌ |
| B. 生成 SQL 灌入 `forum_submissions` | 全用户同一份内容；评论可挂真实 ID；可服务端分页/检索 | 需分批执行 SQL | ✅ **推荐** |

**方案 B 执行步骤**

1. 扩展 `scripts/build-forum-import.cjs`，新增 `--sql` 输出模式，生成
   `db/migration-024-import-seed-{1..4}.sql`，**每份约 150 行 INSERT**（单份 ≈ 150 KB，SQL Editor 可稳定处理）。
2. 采用 `INSERT ... ON CONFLICT (id) DO NOTHING`，保证**幂等**、可重复执行。
3. 所有导入行统一 `realm='startorch'`、`author_id = NULL`、`id` 前缀 `imp_`，与官方 `stf_*` 种子**天然隔离**。
4. 依次执行 4 份 SQL。
5. 前端改造：`forum-data.js` 检测到云端已有 `imp_*` 数据时**跳过本地播种**，避免重复。

| 项 | 内容 |
|---|---|
| **输入** | `forum/js/forum-import-data.js`（573 条） |
| **输出** | `db/migration-024-import-seed-*.sql` + 云端 `forum_submissions` 增至 583 行 |
| **验收** | `Content-Range` 显示 `*/583`；论坛社区页在**无痕窗口**（空 localStorage）下仍能看到二创内容 |
| **回滚** | `DELETE FROM public.forum_submissions WHERE id LIKE 'imp_%';` |
| **风险** | 中。执行前先备份：Dashboard → Database → Backups，或 `SELECT * FROM forum_submissions` 导出 CSV。 |

---

### 阶段 3 — 前端性能治理【P1，1–2 小时】

**问题量化**：`forum-import-data.js` 500 KB 同步加载 + `ensureSeedData()` 一次性 `JSON.stringify` 583 条写入 localStorage（≈515 KB），首访主线程阻塞可达 100–200 ms，直接拖累 INP 与 LCP。

**治理方案**（阶段 2 完成后择一）

| 方案 | 做法 | 首屏体积 |
|---|---|---|
| B1（配套阶段 2） | 云端成为事实源；本地只保留**轻量索引**（标题/作者/标签/摘要，约 225 KB → gzip ≈ 65 KB），正文按需从云端拉 | ↓ 55% |
| B2（更激进） | 索引改为 `fetch('data/forum-index.json')` 异步加载 + 首屏只渲染 20 条、滚动分页 | ↓ 90% |

**配套措施**

- 社区列表接入**虚拟滚动**或分页（583 条同时挂 DOM 是明确的性能反模式）。
- `ensureSeedData()` 的 localStorage 写入改为 `requestIdleCallback` 分片，避免长任务。
- 生成物加 `defer`，并从「同步 `<script>`」改为按需 `import()`。

| **验收** | Lighthouse Performance ≥ 90；社区页首屏 JS ≤ 150 KB（gzip）；无 >50 ms 长任务 |
|---|---|

---

### 阶段 4 — 内容质量与档案动态化【P2，半天】

1. **作者多样化**：370 条「匿名信号源」按创作指南拆分为多个署名（诺娃/埃拉拉/塞莱斯特/学院路人等），使论坛观感真实。改**源 md**，再跑生成器，不要改生成物。
2. **角色档案读事实层**：`characters/*/index.html` 与 `论坛内容/事实卷宗/vol-*.md`、`角色分层架构/*.md` 对齐，把静态卡片改为数据驱动渲染。
3. **子页一致性校验**：6 个角色子页 vs 事实卷宗逐项核对（汇报第 8 项缺口）。

---

### 阶段 5 — 视觉资产与板块收敛【P3，半天】

1. 接入 `论坛内容/视觉资产/` 的 10 个 SVG（角色卡、关系图、罗伊冰原地图、论坛封面）。SVG 走 `<img>` 或内联，注意 `gradient id` 冲突需加前缀。
2. 落地「47 细板块 → 5 分区」映射，收敛到讨论 / 角色档案 / 世界观 / 投稿四域边界。
3. 明确 SUPB 改写文本（主站 `submissions`）与论坛（`forum_submissions`）的同步策略——当前两套表**无通路**，需决定是单向展示还是不打通。

---

### 贯穿事项 — Git 提交纪律

当前工作区**混有多个会话的改动**，必须分批提交，禁止 `git add -A`：

| 批次 | 文件 | 提交信息建议 |
|---|---|---|
| ① 本次论坛改造 | `forum/js/forum-chat.js` `forum-cloud.js` `forum-data.js` `forum/index.html` `forum/forum.css` `forum/js/forum-import-data.js` `scripts/build-forum-import.cjs` | `feat(forum): 聊天真实感重构 + 573条二创导入管线` |
| ② 数据库迁移 | `db/migration-023-forum-chat.sql` `db/migration-020-forum-chat.sql`(标记废弃) | `fix(db): 修复020编号撞车，聊天表重编号为023并补Realtime注册` |
| ③ 规划文档 | `EXECUTION-PLAN-v8.0.md` | `docs: 执行规划 v8.0` |
| ④ 其他会话 | `js/main.js` `js/repository.js` | 单独提交，**需你确认** |
| ⑤ 暂不提交 | `css/community-polish.css`（含 `.nav-link-forum` 孤儿样式，与"移除顶栏论坛按钮"冲突） | — |
| ⑥ 不入 git | `论坛内容/`（离线资产，已加入 `.gitignore`；构建见 `scripts/README.md`） | — |

---

## 5. 风险登记

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | 023 执行时 `is_forum_admin()` 缺失 | SQL 报错，表未建 | 先跑 021；023 已在注释标注前置依赖 |
| R2 | 阶段 2 导入后云端出现重复条目 | 社区列表重复 | `ON CONFLICT DO NOTHING` + `imp_` 前缀隔离 + 前端跳过本地播种 |
| R3 | 误用 `论坛内容/技术参考/` 覆盖现有代码 | **UI 大幅回退** | 已在 §2.1 / `scripts/README.md` 明令禁止；该目录随 `论坛内容/` 已 gitignore，仅作对照；勿拷入 `js/`、`forum/` |
| R4 | 583 条全量渲染导致页面卡顿 | 移动端明显掉帧 | 阶段 3 虚拟滚动 / 分页 |
| R5 | anon key 已出现在多份文档中 | 低（仅读权限 + RLS 保护） | 保持 RLS 严格；勿泄露 service_role key |
| R6 | `git add -A` 误提交其他会话半成品 | 污染 main | 按 §贯穿事项 分批提交 |

---

## 6. 待你决策

1. **阶段 2 走方案 B（上云）还是维持 A（本地）？** —— 我推荐 B，否则 573 条内容对访客等于不存在。
2. **`js/main.js` + `js/repository.js` 是否单独提交？** —— 属其他会话产出，我不擅自动。
3. **`论坛内容/` 是否入 git？** —— 我建议加入 `.gitignore`，作为离线资产库维护。
4. **阶段 4 的作者多样化是否要做？** —— 涉及改 573 条源 md 的作者字段，工作量中等但对真实感提升显著。

---

## 7. 最短见效路径

如果只想用**最小动作**换**最大可见改善**：

```
阶段 0（跑 023，5 分钟）→ 聊天立刻变真·实时
      ↓
阶段 1（删测试脏数据，2 分钟）
      ↓
阶段 2（573 条上云，30 分钟）→ 论坛内容对所有访客可见
```

这三步做完，《论坛功能缺失汇报》里的 P0 缺口即全部关闭。
