# 飞行雪绒 v9.0 — 任务接续文档（Cursor / AI 编程工具用）

> **项目**: 鸣潮角色爱弥斯同人网站「飞行雪绒」(I-MISS-YOU)
> **架构**: 纯前端静态站 (HTML/CSS/JS) + Supabase BaaS，GitHub Pages 部署 (`main` 分支根目录)
> **当前版本**: v9.0.0
> **生成日期**: 2026-07-08 23:18
> **配套文档**: `docs/comment-system-design-v9.0.md` (7 大模块设计) / `handoff/progress.md` / `handoff/todo.md`

---

## 0. 快速接手须知（必读）

- 这是**纯前端静态站**，没有构建步骤，`npm run serve` 起本地服务即可调试（端口 8848）。
- 所有数据库访问走 Supabase；**migration-006~009 已由用户在 Supabase Dashboard 执行**（2026-07-08 确认）。不要再重复跑这 4 个 SQL。
- 代码契约（谁调谁、传什么）已稳定，新功能必须延续既有模式，不要重写已有模块。
- 全局变量约定：`window.supabaseClient` 由各模块共享；`AuthManager` / `SyncManager` / `UploadManager` / `ClientRateLimiter` / `DataRepository` / `SupabaseAdapter` 均为全局对象。
- 测试前先 `npm run syntax-check` 确认 10 个 JS 文件语法无误。

---

## 1. 已完成任务摘要

### 1.1 基础设施（已落库并推送远程 `19d4aba`）
- [x] 4 个数据库迁移 `db/migration-006~009`（评论审核令牌、分层限流、标签/书签、Storage 桶）
- [x] 4 个新 JS 模块：`js/auth-manager.js`、`js/sync-manager.js`、`js/upload-manager.js`、`js/rate-limiter-client.js`
- [x] `js/supabase-adapter.js` 暴露 `window.supabaseClient` + 11 个 RPC 封装 + `delete_token` 透传
- [x] `js/repository.js` 双后端抽象 + `is_hidden` 过滤 + `extraFields` 透传
- [x] `index.html` CSP 头部 + 认证栏 + 拖拽上传区 + 投稿标签选择器
- [x] `css/style.css` 投稿标签选择器 / 书签按钮 / form-hint 样式（含浅色主题适配）

### 1.2 全面审查补全（10 项遗漏已修复）
- [x] `sync-manager.js` `submissions` → `subscriptions` 变量名 bug
- [x] `window.supabaseClient` 暴露
- [x] 认证状态初始化 `initAuthState()` + `onAuthStateChange` 监听 + `fetchRole()` + `updateAuthUI()`
- [x] 社区投稿卡片书签按钮（本地/云端双写）
- [x] 标签筛选逻辑（实际 `.tag-chip.active` 过滤）
- [x] 社区评论删除/隐藏按钮（`AuthManager` 权限判定 + `data-community-target` 事件委托）
- [x] 投稿标签选择器交互（最多 5 个）+ 提交时附带标签 + 云端 `addSubmissionTags` 同步
- [x] 投稿 `ClientRateLimiter` 集成（`canSubmitWork` + `recordSubmissionSent`）
- [x] 投稿删除令牌（`generateToken` + `extraFields.delete_token` 全链路透传）
- [x] 版本号 `v7.9` → `v9.0`

### 1.3 本轮修复（2026-07-08 续）— P0 实时同步真 bug
- [x] **投稿实时同步回调失效**：`js/main.js:1137` 原调用 `SyncManager.connectSubmissions(function(){ renderCommunity(); })` 传裸函数，但 `js/sync-manager.js:205` 的 `connectSubmissions(handlers)` 契约要求对象 `{ onNewSubmission, onUpdateSubmission }`，导致两个回调被赋 `undefined`、投稿 INSERT/UPDATE 事件静默丢弃。已改为传入正确对象，投稿实时同步恢复。

---

## 2. 剩余任务（按优先级）

| 优先级 | 任务 | 类别 | 紧急度 | 工作量 | 是否核心 |
|--------|------|------|--------|--------|----------|
| 🔴 — | Supabase 设管理员角色 | 手动操作 | 阻塞 admin UI | 2min | 是 |
| 🟠 P1 | **管理后台面板** | 未实现功能 | 高（运营必需） | 1–2 天 | 是 |
| 🟠 P1 | **收藏夹管理 UI** | 未实现功能 | 中 | 0.5–1 天 | 否 |
| 🟠 P1 | **全面测试**（14 项清单） | 未验证 | 高 | 2–3h | 是 |
| 🟡 P2 | 评论/投稿分页 | 性能 | 中 | 0.5–1 天 | 否 |
| 🟡 P2 | 实时事件增量更新 | 性能/体验 | 中 | 0.5 天 | 否 |
| 🟡 P2 | 轮询兜底按需启用 | 性能 | 低 | 1h | 否 |
| 🟢 P3 | 自动化测试框架 | 工程化 | 低 | 2–3 天 | 否 |

> **Token 优先策略**：先完成「设管理员 + 全面测试 + 管理后台面板」（确保核心功能可用、可运营），其余 P2/P3 按需推进。

---

## 3. 关键实现细节 / 现有契约

### 3.1 模块调用契约（新代码必须遵守）
- `SyncManager.connectSubmissions(handlers)` —— **handlers 必须是对象** `{ onNewSubmission(sub), onUpdateSubmission(newData, oldData) }`，不能传裸函数。
- `SyncManager.connectComments(targetId, handlers)` —— handlers 为 `{ onNewComment, onUpdateComment, onDeleteComment }`。
- `AuthManager.canDeleteComment(c)` / `canHideComment()` / `canAccessAdmin()` / `fetchRole()` / `generateToken()` / `storeDeleteToken(id, token)` / `getDeleteToken(id)`。
- `DataRepository.addSubmission(sub, extraFields)` / `addComment(targetId, text, name, extraFields)` —— `extraFields` 用于透传 `delete_token`。
- `SupabaseAdapter.addSubmissionTags(subId, tagsArray)` —— 投稿标签云端同步。
- `SupabaseAdapter.subscribeSubmissions(onInsert)` —— **legacy 裸回调签名**（仅 SyncManager 未加载时降级使用，勿改）。

### 3.2 已建数据库对象（migration 已执行，可直接用）
- 表：`comments`(含 `delete_token`,`is_hidden`)、`submissions`(含 `delete_token`,`is_hidden`)、`profiles`(含 `role`)、`tags`、`submission_tags`、`bookmarks`、`moderation_logs`、`collections`
- RPC：`batch_moderate_comments`、`apply_moderation`、`toggle_bookmark`、`add_submission_tags`、`get_submissions_by_tags`
- Storage bucket：`uploads`（拖拽上传用）

### 3.3 设计文档未实现章节对照
- `docs/comment-system-design-v9.0.md` §10.1 Phase 3：收藏夹管理 UI
- `docs/comment-system-design-v9.0.md` §10.1 Phase 4：管理后台面板（批量管理 + 操作日志 `moderation_logs`）

---

## 4. 供 Cursor 接续执行的具体步骤

### Task A — 设置管理员角色（用户手动，2 分钟）
在 Supabase Dashboard → SQL Editor 执行（替换 uid）：
```sql
UPDATE profiles SET role = 'admin' WHERE id = '你的 auth.uid';
```
> 不设则 `AuthManager.canAccessAdmin()` 返回 false，管理后台面板无法进入。

### Task B — 管理后台面板 [P1，核心]
**目标**：版主/管理员批量管理评论、查看操作日志。
**起点**：新建 `admin.html` + `js/admin.js`（或作为 `index.html` 的隐藏路由 `#admin`）。
**步骤**：
1. 入口守卫：`if (!AuthManager.canAccessAdmin()) { 重定向/隐藏面板; return; }`
2. 拉取待审列表：调用 `SupabaseAdapter` 封装的 `from('comments').select('*').eq('is_hidden', false)`（或新增 `get_pending_comments` RPC）。
3. 批量操作：勾选多条 → 调 `batch_moderate_comments(ids, action, reason)`（action ∈ hide/restore/delete）。
4. 操作日志：从 `moderation_logs` 表读取展示（谁、何时、对哪条、做什么）。
5. 样式复用 `css/style.css` 既有 token（深色为主，含浅色适配）。
**验收**：版主可批量隐藏/恢复；管理员可永久删除；日志可查。

### Task C — 收藏夹管理 UI [P1]
**起点**：`bookmarks` / `collections` 表 + `toggle_bookmark` RPC 已就绪，社区卡片书签按钮已可用。
**步骤**：新建「我的收藏」页面/弹层，列出 `bookmarks`；支持创建 `collections`、将书签移入/移出收藏夹、公开收藏夹分享链接。
**验收**：用户能分类管理收藏、看到公开收藏夹。

### Task D — 全面测试（14 项，见 `handoff/todo.md` 末尾清单）
逐项手测，全部勾选。重点验证本轮 P0 修复：**开两个浏览器/隐身窗口，A 窗口发投稿 → B 窗口社区列表应实时出现新帖**（此前因回调失效不会刷新）。
测试前先用 `npm run serve` 起本地服务（端口 8848），或部署后访问 `https://vertiniris.github.io/I-MISS-YOU/` 按 `Ctrl+F5` 强刷。

### Task E — 分页 [P2]
`renderComments(targetId)` / `renderCommunity()` 改为带 `limit/offset` 的懒加载或「加载更多」按钮；云端查询用 Supabase `.range()`。

### Task F — 实时增量更新 [P2]
将 `onNewComment` / `onUpdateComment` / `onNewSubmission` 的全量 `renderXxx()` 改为：按 id 查找现有 DOM 节点，存在则 `textContent`/属性原地更新，不存在则 `insertBefore` 单条插入，减少闪烁。

### Task G — 轮询兜底按需启用 [P2]
`window.__fxreCommentPoll` 的 `setInterval(30s)` 改为：仅在 `SyncManager` 状态为 `offline`/`reconnecting` 时启动，状态恢复为 `realtime` 时 `clearInterval`。

### Task H — 自动化测试框架 [P3]
引入 Vitest（逻辑层：AuthManager 令牌、ClientRateLimiter 限流）+ Playwright（流程层：把 todo.md 14 项自动化）。在 `package.json` 加 `test` / `test:e2e` 脚本。

---

## 5. 提交与部署约定
- 提交信息模板：`feat/fix: v9.0 <模块> — <一句话>`。
- 推送即部署：`git push origin main` → GitHub Pages 1–2 分钟生效。
- **不要用 `更新GitHubPages.bat` 提交**——其 `git diff --cached --quiet` 判断有 bug，会误判「无新改动」跳过 commit（已踩坑一次）。直接 `git add -A && git commit -m "..." && git push origin main`。
- 每次 JS 改动后跑 `npm run syntax-check`。

---

## 6. 已知陷阱（避免重复踩坑）
1. `SyncManager.connectSubmissions` 必须传**对象**，不是函数（本轮 P0 bug 根因）。
2. `window.supabaseClient` 由各模块共享，新模块若要用 Supabase 必须读它，不能自己再 `createClient`。
3. 所有新功能集成代码用 `typeof X !== 'undefined'` 守卫，避免模块未加载时整页报错。
4. 社区评论删除事件用 `data-community-target`，博文评论用 `.comment-area` 的 `data-target-id`，事件委托里要分流。
5. 投稿标签筛选是 AND 语义（`activeTags.every(...)`），不是 OR。
