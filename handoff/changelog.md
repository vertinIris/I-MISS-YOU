# 飞行雪绒 v9.0 变更日志

> **日期**: 2026-07-08  
> **版本**: v7.9.0 → v9.0.0

---

## 新增功能

### 1. 评论删除系统
- 匿名用户删除令牌（UUID v4）：生成 → 存储 → RPC 校验 → 软删除
- 注册用户身份校验删除：`auth.uid() = author_id`
- 版主/管理员操作 RPC：`moderate_comment()`（hide/restore/delete）
- 批量管理 RPC：`batch_moderate_comments()`（管理员专用）
- 软删除机制：`is_hidden = TRUE`，保留评论线程完整性
- 操作日志表：`moderation_logs` 记录所有版主操作

### 2. 认证与角色体系
- 四级角色：匿名(user) → 注册(user) → 版主(moderator) → 管理员(admin)
- 匿名→注册平滑升级：`supabase.auth.updateUser()` 保持 UID 不变
- `profiles` 表新增 `role`/`is_banned`/`banned_until`/`ban_reason` 字段
- RLS 策略禁止用户自行修改角色/封禁状态

### 3. Realtime 全事件同步
- 从仅订阅 INSERT 扩展到 INSERT/UPDATE/DELETE 三事件
- 断连自动降级轮询（15 秒间隔）
- 指数退避重连（1s/2s/4s/8s/16s，最多 5 次）
- 同步状态指示器（🟢实时/🟡轮询/🔴离线/🔄重连）

### 4. 分层限流
- 客户端 UI 冷却（3 秒）+ 重复内容检测（60 秒）
- 服务端 RPC 分角色限流：匿名 60s/5条，注册 30s/10条，版主 10s/20条
- IP 联合限流：50 条/天/IP
- `check_rate_limit()` 返回 JSONB（含 reason + retry_after）

### 5. AO3 风格标签体系
- 五类标签：character / category / rating / warning / freeform
- 多对多关联（`submission_tags` 表）
- 标签使用计数自动触发器
- 按标签筛选投稿 RPC（支持多标签交集）
- 17 个种子标签（角色/类型/分级/警告/自由标签）

### 6. 书签收藏
- 书签表 `bookmarks`（用户↔投稿多对一）
- 收藏夹 `bookmark_collections`（用户自建分类）
- `toggle_bookmark()` RPC（收藏/取消切换）
- 公开/私密书签（RLS 控制）
- 离线书签缓存 `fxre_bookmarks`

### 7. 拖拽上传
- 支持 .txt / .md / .jpg / .png / .gif
- 文本文件直接读取内容（FileReader）
- 图片文件上传到 Supabase Storage
- 上传进度条实时展示
- 与文本编辑区共存互不干扰

### 8. Storage 存储桶
- `works` 桶（public read, authenticated write）
- 文件类型/大小校验 RPC `validate_upload()`
- 作者可删除自己的文件

---

## 数据库变更

### migration-006: 评论删除令牌 + 软删除 + 角色体系
- `comments` 表新增：`delete_token`/`is_hidden`/`hidden_by`/`hidden_reason`/`hidden_at`/`edited_at`
- `submissions` 表新增：`delete_token`/`is_hidden`/`hidden_by`/`hidden_reason`/`hidden_at`
- `profiles` 表新增：`role`/`is_banned`/`banned_until`/`ban_reason`
- 新建 `moderation_logs` 表
- 新建 RPC：`delete_comment_with_token`/`delete_submission_with_token`/`moderate_comment`/`moderate_submission`/`batch_moderate_comments`
- RLS 全面升级：评论/投稿读取区分隐藏状态，profiles 禁止自改角色

### migration-007: 分层限流升级
- `rate_limits` 表新增 `ip_address` 字段
- `check_rate_limit()` 返回 JSONB，按角色区分参数
- `check_daily_quota()` 按角色区分日配额
- 新增 `check_ip_rate_limit()` RPC
- `enforce_insert_limits()` 触发器函数升级

### migration-008: 标签体系 + 收藏功能
- 新建 `tags`/`submission_tags`/`bookmarks`/`bookmark_collections` 四张表
- 标签使用计数触发器（`increment_tag_usage`/`decrement_tag_usage`）
- 新建 RPC：`toggle_bookmark`/`filter_submissions_by_tags`/`add_submission_tags`
- 17 个种子标签数据
- RLS 策略：标签公开读/书签所有者控制

### migration-009: Storage 存储桶
- 创建 `works` public 桶
- Storage RLS：认证用户上传/公开读取/作者删除
- `validate_upload()` 文件校验 RPC

---

## 前端变更

### 新增 JS 模块 (4 个)
- `js/auth-manager.js`: AuthManager 模块 — 会话管理/删除令牌/权限判定/匿名升级
- `js/sync-manager.js`: SyncManager 模块 — Realtime 全事件/轮询降级/重连/状态指示器
- `js/upload-manager.js`: UploadManager 模块 — 拖拽上传/文件校验/进度条/Storage
- `js/rate-limiter-client.js`: ClientRateLimiter 模块 — 客户端限流/冷却/重复检测

### 修改文件 (4 个)
- `js/supabase-adapter.js`: +11 个 RPC 方法封装
- `index.html`: +4 个 script 标签 + 版本号 v9.0
- `css/style.css`: +~300 行新组件样式
- `package.json`: 版本 9.0.0 + 4 个 migration 脚本
