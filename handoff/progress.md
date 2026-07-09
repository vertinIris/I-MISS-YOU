# 飞行雪绒 v9.3 进度报告

> **最后更新**: 2026-07-10  
> **状态**: v9.3 规划项已实现；Supabase 需跑 migration-013；smoke-check 通过

---

## v9.3 新增（2026-07-10）

- [x] 公开收藏夹 + `#collection-{id}` 分享链接
- [x] 投稿插图卡片 + 24h 限时编辑/自删（migration-013）
- [x] `reset-password.html` 忘记密码落地页
- [x] `assets/og-cover.png` + OG meta 更新
- [x] 今日推荐 + 社区分页（12/页）+ 评论加载更多（30/批）
- [x] Realtime 正常时跳过 30s 全量轮询
- [x] `js/content-utils.js` + `scripts/smoke-check.mjs`
- [x] 文档对齐：`known-gaps.md` / `test-checklist-v9.3.md` / README v9.3

### 待用户操作
- [ ] Supabase 执行 `db/migration-013-submission-edit.sql`
- [ ] Redirect URLs 加入 `reset-password.html`
- [ ] （可选）设置 `profiles.role = 'moderator'/'admin'`

---

## 已完成事项

### 基础设施（上一轮完成）
- [x] 4 个数据库迁移文件 (migration-006~009)
- [x] 4 个新 JS 模块 (auth-manager / sync-manager / upload-manager / rate-limiter-client)
- [x] supabase-adapter.js 新增 11 个 RPC 方法封装
- [x] style.css 新增 ~300 行组件样式
- [x] package.json 版本升至 9.0.0

### 代码集成（本轮完成）
- [x] **main.js 集成 AuthManager + SyncManager + ClientRateLimiter**
  - init() 初始化新模块 (AuthManager.init / SyncManager.createSyncIndicator / UploadManager.init)
  - setupCloudRealtime() 用 SyncManager 替代直接 subscribeComments（含降级兼容）
  - _renderCommentsList() 添加 AuthManager 权限判定 + 版主隐藏按钮
  - handleCommentSubmit() 添加客户端限流 + 删除令牌生成 + 云端存储
  - handleDeleteComment() 三路删除：令牌(匿名) → 版主隐藏 → 管理员/本地
  - 新增 _removeCommentFromUI() 辅助函数
  - 新增 .comment-hide-btn 事件委托
  - 同步按钮集成 SyncManager.manualRefresh()
  - 认证升级表单交互（升级/取消/提交）
  - 标签筛选交互
  - 拖拽上传初始化（文本自动填入内容区）

- [x] **repository.js 支持新字段过滤**
  - mergeComments() 添加 is_hidden 过滤
  - mergeSubmissions() 添加 is_hidden 过滤
  - addComment() 透传 extraFields.delete_token

- [x] **supabase-adapter.js addComment 支持 delete_token**
  - 函数签名增加 extraFields 参数
  - insert 数据中包含 delete_token
  - 所有 queuePending 调用同步更新

- [x] **index.html 补充 v9.0 UI 元素**
  - 认证状态栏 + 升级表单（投稿区域上方）
  - 拖拽上传区 + 文件选择 + 进度条（投稿表单内）
  - 标签筛选栏（社区区域，角色/类型/自由标签）

- [x] 全部 10 个 JS 文件语法检查通过

---

## 未完成事项

### 需要手动操作（迁移已确认完成）
- [x] **Supabase 执行 migration-006~009**（用户已于 2026-07-08 在 Dashboard 执行）
- [ ] 设置管理员角色：`UPDATE profiles SET role = 'admin' WHERE id = '你的 auth.uid';`（迁移已含 `role` 字段，管理员仍需手动设；不设置则 admin UI 无法访问）

### 全面审查补全（本轮完成）
- [x] **修复 sync-manager.js submissions 变量 bug** — `submissions['submissions']` → `subscriptions['submissions']`
- [x] **暴露 window.supabaseClient** — supabase-adapter.js init 中添加 `window.supabaseClient = client`
- [x] **认证状态初始化** — 添加 initAuthState() + onAuthStateChange 监听 + fetchRole + updateAuthUI
- [x] **社区投稿卡片书签按钮** — _renderCommunityGrid 添加收藏按钮 + 事件处理 + 本地/云端双写
- [x] **标签筛选逻辑** — _renderCommunityGrid 根据 .tag-chip.active 过滤投稿
- [x] **社区评论删除按钮** — _renderCommunityCommentsList 添加 AuthManager 权限判定 + 删除/隐藏按钮
- [x] **社区评论事件委托扩展** — 删除/隐藏按钮事件支持 data-community-target
- [x] **投稿标签选择器** — index.html 添加选择器 UI + main.js 添加交互 + 提交时附带标签
- [x] **投稿 ClientRateLimiter 集成** — canSubmitWork 检查 + recordSubmissionSent
- [x] **投稿删除令牌生成** — generateToken + extraFields.delete_token 透传
- [x] **repository.js addSubmission 支持 extraFields** — 透传 delete_token
- [x] **supabase-adapter.js addSubmission 支持 extraFields** — insert 数据包含 delete_token
- [x] **CSP 头部** — index.html 添加 Content-Security-Policy meta 标签
- [x] **版本号修正** — __FXRE_API.version 从 v7.9 改为 v9.0
- [x] **CSS 样式补充** — 投稿标签选择器、书签按钮、form-hint 样式
- [x] 全部 7 个 JS 文件语法检查通过

### 本轮修复（2026-07-08 续）— P0 实时同步真 bug
- [x] **修复投稿实时同步回调失效** — `js/main.js:1137` 原调用 `SyncManager.connectSubmissions(function(){ renderCommunity(); })` 传了裸函数，但 `sync-manager.js:205` 的 `connectSubmissions(handlers)` 契约要求对象 `{ onNewSubmission, onUpdateSubmission }`，导致两个回调被赋为 `undefined`、投稿 INSERT/UPDATE 事件静默丢弃。已改为传入正确对象，投稿实时同步恢复。已通过 `node --check`。

### 剩余功能模块（未实现）
- [ ] **管理后台面板** [P1] — `batch_moderate_comments` / `apply_moderation` RPC 已建，但无 UI。需版主/管理员批量管理评论 + 查看 `moderation_logs`
- [ ] **收藏夹管理 UI** [P1] — `bookmarks` 表 + `toggle_bookmark` RPC + 书签按钮已可用，但无收藏夹管理界面（创建/整理/公开）
- [ ] **评论/投稿分页** [P2] — `renderComments`/`renderCommunity` 全量渲染，数据量大时卡顿
- [ ] **实时事件增量更新** [P2] — 当前全量重渲染，可改为单条增量插入/更新
- [ ] **轮询兜底按需启用** [P2] — `setInterval(30s)` 在 Realtime 正常时也常驻，应仅离线/重连时启用
- [ ] **自动化测试框架** [P3] — 仅有 `syntax-check`，无单测/E2E（todo.md 14 项仍靠手点）

### 测试清单（仍未验证）
- [ ] 匿名用户发评论 → 生成令牌 → 删除评论（令牌校验）
- [ ] 注册用户发评论 → 身份删除
- [ ] 版主隐藏/恢复评论
- [ ] 管理员永久删除评论
- [ ] Realtime 新评论实时显示
- [ ] Realtime 评论隐藏实时移除
- [ ] 断网后轮询降级 → 恢复后停止轮询
- [ ] 客户端限流（3秒冷却 + 重复检测）
- [ ] 投稿拖拽上传 .txt → 内容自动填入
- [ ] 投稿拖拽上传 .jpg → Storage URL 返回
- [ ] 标签筛选投稿
- [ ] 书签收藏/取消
- [ ] 匿名→注册升级（UID 不变）
- [ ] 深色/浅色主题新组件样式正确

---

## 变更文件列表

### 本轮修改的文件 (4 个)
| 文件 | 变更内容 |
|------|----------|
| `js/main.js` | +AuthManager/SyncManager/ClientRateLimiter/UploadManager 集成，+令牌删除，+版主隐藏，+拖拽上传初始化，+认证表单，+标签筛选 |
| `js/repository.js` | +is_hidden 过滤 (mergeComments/mergeSubmissions)，+extraFields 透传 (addComment) |
| `js/supabase-adapter.js` | +delete_token 支持 (addComment 函数签名+insert数据+queuePending) |
| `index.html` | +认证状态栏，+拖拽上传区，+标签筛选栏 |

### 上一轮创建的文件 (12 个)
- `db/migration-006-comment-moderation.sql`
- `db/migration-007-rate-limit-v2.sql`
- `db/migration-008-tags-bookmarks.sql`
- `db/migration-009-storage-bucket.sql`
- `js/auth-manager.js`
- `js/sync-manager.js`
- `js/upload-manager.js`
- `js/rate-limiter-client.js`
- `handoff/progress.md`
- `handoff/changelog.md`
- `handoff/todo.md`
- `docs/comment-system-design-v9.0.md`

---

## 关键设计决策

1. **软删除** (is_hidden) 而非物理删除，保留评论线程完整性
2. **删除令牌** = UUID v4，存 localStorage，匿名用户可删自己的评论
3. **匿名→注册升级** 保持 UID 不变（Supabase 原生能力）
4. **SyncManager 降级兼容** — 如果 SyncManager 未加载，回退到旧 subscribeComments
5. **三层删除路径** — 令牌(匿名) → 版主隐藏 → 管理员/本地
6. **extraFields 透传** — main.js → DataRepository → SupabaseAdapter 全链路传递 delete_token
