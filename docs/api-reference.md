# 数据层 API 参考

> **版本**: v7.7 | **模块**: repository.js + supabase-adapter.js

---

## 1. DataRepository 接口

业务代码（main.js）只调用 `DataRepository`，不直接操作 localStorage 或 Supabase。

### 1.1 Provider 管理

```javascript
// 获取当前数据后端
DataRepository.getProvider()
// → 'localStorage' | 'supabase'

// 切换数据后端
DataRepository.switchProvider('supabase');
DataRepository.switchProvider('localStorage');

// 检查云端是否可用
DataRepository.isCloudAvailable()
// → boolean
```

### 1.2 评论接口

```javascript
// 获取某目标的评论列表（合并本地+云端，去重后按时间排序）
// @param {string} targetId — 如 'post_1', 'diary_1'
// @returns {Promise<Array<Comment>>}
DataRepository.getComments(targetId)

// Comment 结构:
// {
//   id?: number,           // 云端自增ID（本地数据无此字段）
//   target_id: string,
//   author: string,        // 昵称
//   color: string,         // 头像颜色 hex
//   text: string,          // 评论内容（已escapeHTML）
//   author_id?: string,    // 云端用户UUID（本地数据无此字段）
//   created_at: string,    // ISO 8601 时间戳
//   isLocal?: boolean      // 是否仅存在于本地
// }

// 添加评论（双写：localStorage 同步 + Supabase 异步）
// @returns {Promise<boolean>} 云端写入是否成功（本地一定成功）
DataRepository.addComment(targetId, comment)

// 删除评论
// @param {string|number} commentId — 云端ID 或 本地复合key
// @param {string} authorId — 当前用户ID（用于权限校验）
// @param {boolean} isAdmin — 是否管理员模式
// @returns {Promise<boolean>}
DataRepository.deleteComment(commentId, authorId, isAdmin)
```

### 1.3 投稿接口

```javascript
// 获取所有投稿（合并本地+云端，去重后按时间倒序）
// @returns {Promise<Array<Submission>>}
DataRepository.getSubmissions()

// Submission 结构:
// {
//   id?: number,
//   type: '文字' | '故事' | '诗歌' | '插画' | '音乐',
//   title: string,
//   content: string,
//   author: string,
//   color: string,
//   author_id?: string,
//   likes: number,
//   created_at: string,
//   isLocal?: boolean
// }

// 添加投稿（双写）
// @returns {Promise<boolean>}
DataRepository.addSubmission(submission)

// 点赞（仅本地，不同步云端）
DataRepository.likeSubmission(submissionId)
```

### 1.4 事件监听

```javascript
// 监听数据变更（评论/投稿增删时触发）
DataRepository.on('comments:changed', function(targetId) {
    // 重新渲染评论区
    renderComments(targetId);
});

DataRepository.on('submissions:changed', function() {
    // 重新渲染社区区
    renderCommunity();
});

// 移除监听
DataRepository.off('comments:changed', callback);
```

### 1.5 云端初始化

```javascript
// 初始化云端同步（页面加载时自动调用）
// 1. 等待 Supabase SDK 加载
// 2. 匿名登录（12秒超时）
// 3. 同步 pending 队列
// 4. 种子数据首次写入云端
DataRepository.initCloud();
```

---

## 2. SupabaseAdapter 接口

`supabase-adapter.js` 封装 Supabase 客户端，提供底层云端操作。

### 2.1 配置

```javascript
// js/supabase-adapter.js 顶部
var CONFIG = {
    url: 'https://xxxxx.supabase.co',     // Supabase Project URL
    anonKey: 'eyJhbG...',                   // anon public key（可公开）
    enabled: true                           // 功能开关
};
```

### 2.2 认证

```javascript
// 等待 SDK 加载完成（轮询，最多10秒）
SupabaseAdapter.waitForSDK()
// → Promise<void> | reject on timeout

// 确保匿名认证（12秒超时）
SupabaseAdapter.ensureAuthWithTimeout()
// → Promise<{user: User}> | reject on timeout/error

// 获取当前用户
SupabaseAdapter.getCurrentUser()
// → User | null

// 获取认证状态
SupabaseAdapter.isReady()
// → boolean
```

### 2.3 数据操作

```javascript
// 评论
SupabaseAdapter.getComments(targetId)      // → Promise<Array>
SupabaseAdapter.addComment(targetId, data)  // → Promise<boolean>
SupabaseAdapter.deleteComment(commentId)   // → Promise<boolean>

// 投稿
SupabaseAdapter.getSubmissions()            // → Promise<Array>
SupabaseAdapter.addSubmission(data)         // → Promise<boolean>
```

### 2.4 同步队列

```javascript
// 获取 pending 队列长度
SupabaseAdapter.getPendingCount()
// → number

// 手动同步 pending 队列（v7.7新增，绑定到页脚🔄按钮）
SupabaseAdapter.syncPendingQueue()
// → Promise<{success: number, failed: number}>

// pending 队列结构:
// [
//   { action: 'addComment', targetId: 'post_1', comment: {...} },
//   { action: 'addSubmission', submission: {...} }
// ]
```

### 2.5 状态查询

```javascript
// 获取完整状态信息（用于页脚显示）
SupabaseAdapter.getStatus()
// → {
//   provider: 'supabase' | 'localStorage',
//   ready: boolean,
//   user: string | null,      // 用户UUID
//   pending: number,           // pending队列长度
//   timestamp: string          // 最后更新时间
// }
```

---

## 3. AdminAuth 接口

`admin-auth.js` 提供管理员认证功能。

```javascript
// 登录（弹出输入框，SHA-256验证）
AdminAuth.login(function(success) {
    if (success) {
        // 管理员模式已开启
    }
});

// 登出
AdminAuth.logout();

// 检查是否管理员
AdminAuth.isAdmin()
// → boolean

// 检查是否有删除权限
AdminAuth.canDelete(comment)
// → boolean (isAdmin || 是自己的评论且10分钟内)

// 获取管理员显示名
AdminAuth.getDisplayName()
// → '管理员' | null
```

### 管理员口令

- **明文口令**: `flyingedelweiss2026`
- **SHA-256 哈希**: 存储在 `admin-auth.js` 的 `ADMIN_PASSWORD_HASH` 常量中
- **验证流程**: 用户输入 → SHA-256 → 与存储哈希比对 → 持久化到 localStorage
- **持久化**: `localStorage.setItem('fxre_admin_logged_in', 'true')`

---

## 4. RateLimiter 接口

`rate-limiter.js` 提供前端速率限制。

```javascript
// 检查是否可以发表评论
RateLimiter.checkComment()
// → { allowed: boolean, reason?: string, retryAfter?: number }

// 检查是否可以投稿
RateLimiter.checkSubmission()
// → { allowed: boolean, reason?: string, retryAfter?: number }

// 记录一次评论操作
RateLimiter.recordComment();

// 记录一次投稿操作
RateLimiter.recordSubmission();

// 获取当前状态
RateLimiter.getStatus()
// → {
//   comment: { count: number, windowStart: number, limit: 3, windowMs: 60000 },
//   submission: { count: number, windowStart: number, limit: 2, windowMs: 300000 }
// }
```

### 限制规则

| 操作 | 前端限制 | 后端限制 (migration-002) | 每日配额 |
|------|----------|--------------------------|----------|
| 发表评论 | 3次/60秒 | 5次/60秒 | 50条/天 |
| 发表投稿 | 2次/300秒 | 3次/300秒 | 10篇/天 |

> 前端限制比后端更严格，作为第一道防线减少无效请求。后端限制是最终保障，防止绕过前端检查。

---

## 5. 全局 API 预留（Phase 4）

```javascript
// main.js 末尾暴露的接口 stub，供未来扩展
window.__FXRE_API = {
    // ArchiveAPI — 数据导出
    archive: {
        exportJSON: function() { /* TODO */ },
        exportSQL: function() { /* TODO */ }
    },

    // SyncAPI — 高级同步
    sync: {
        forceSync: function() { return SupabaseAdapter.syncPendingQueue(); },
        getStatus: function() { return SupabaseAdapter.getStatus(); }
    },

    // UserAPI — 用户系统（Phase 4）
    user: {
        getCurrent: function() { return SupabaseAdapter.getCurrentUser(); },
        login: function() { /* TODO: 邮箱密码登录 */ },
        logout: function() { /* TODO */ }
    },

    // 版本信息
    version: '7.7',
    seedVersion: 'v7.6'
};
```

---

## 6. localStorage Key 一览

| Key | 用途 | 格式 |
|-----|------|------|
| `fxre_data_provider` | 当前数据后端 | `'localStorage'` \| `'supabase'` |
| `fxre_comments_<targetId>` | 本地评论列表 | JSON Array |
| `fxre_submissions` | 本地投稿列表 | JSON Array |
| `fxre_pending_sync` | 离线同步队列 | JSON Array |
| `fxre_seed_version` | 种子数据版本 | `'v7.6'` |
| `fxre_admin_logged_in` | 管理员状态 | `'true'` \| `'false'` |
| `fxre_theme` | 主题模式 | `'dark'` \| `'light'` \| `'auto'` |
| `fxre_location` | 当前地点选择 | `'星炬学院'` 等 |
| `fxre_rate_comment` | 评论速率记录 | JSON |
| `fxre_rate_submission` | 投稿速率记录 | JSON |
