# 系统架构设计

> **版本**: v7.7 | **最后更新**: 2026-07-03

---

## 1. 架构总览

飞行雪绒采用 **纯前端静态站 + BaaS（Backend as a Service）** 架构，无自建服务器。

```
┌──────────────────────────────────────────────────────────┐
│                     用户浏览器                             │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  index.html (唯一入口)                              │  │
│  │                                                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │  │
│  │  │ main.js  │ │particles │ │  supabase-adapter │  │  │
│  │  │ (核心UI) │ │  .js     │ │  .js (云端同步)   │  │  │
│  │  └────┬─────┘ └──────────┘ └────────┬──────────┘  │  │
│  │       │                              │             │  │
│  │  ┌────┴──────────────────────────────┴──────────┐  │  │
│  │  │       DataRepository (抽象层)                 │  │  │
│  │  │  getComments / addComment / deleteComment    │  │  │
│  │  │  getSubmissions / addSubmission              │  │  │
│  │  │  switchProvider('localStorage' | 'supabase') │  │  │
│  │  └────┬─────────────────────────┬───────────────┘  │  │
│  │       │                         │                  │  │
│  │  ┌────┴──────────┐    ┌────────┴──────────────┐    │  │
│  │  │ localStorage  │    │  Supabase JS SDK      │    │  │
│  │  │ (本地优先)     │    │  (异步云端同步)        │    │  │
│  │  └───────────────┘    └───────────┬───────────┘    │  │
│  │                                   │                │  │
│  │  ┌──────────────────────────────┐ │                │  │
│  │  │  admin-auth.js (管理员认证)   │ │                │  │
│  │  │  rate-limiter.js (速率限制)   │ │                │  │
│  │  └──────────────────────────────┘ │                │  │
│  └───────────────────────────────────┼────────────────┘  │
└──────────────────────────────────────┼───────────────────┘
                                       │ HTTPS
                                       ▼
┌──────────────────────────────────────────────────────────┐
│                   Supabase Cloud (Free Tier)              │
│                                                          │
│  ┌────────────────┐  ┌─────────────────────────────────┐ │
│  │  Auth (GoTrue)  │  │  PostgreSQL 15 (PostgREST)     │ │
│  │  - 匿名登录     │  │  - profiles 表                  │ │
│  │  - JWT 令牌     │  │  - comments 表 (RLS)            │ │
│  │  - 自动刷新     │  │  - submissions 表 (RLS)         │ │
│  │                │  │  - rate_limits 表               │ │
│  └────────────────┘  └────────────┬────────────────────┘ │
│                                   │                      │
│  ┌────────────────────────────────┴────────────────────┐ │
│  │  Realtime (WebSocket)                               │ │
│  │  - comments INSERT 事件推送                          │ │
│  │  - submissions INSERT 事件推送                       │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 2. 模块划分

### 2.1 前端模块

| 文件 | 职责 | 大小 | 依赖 |
|------|------|------|------|
| `index.html` | 页面结构 + 内联SVG头像 + 所有section | ~88KB | 无 |
| `css/style.css` | 全部样式、动画系统、响应式、暗色模式 | ~91KB | 无 |
| `js/main.js` | 核心业务逻辑：UI渲染、评论、投稿、音乐、彩蛋 | ~100KB | repository.js, admin-auth.js, rate-limiter.js |
| `js/particles.js` | Three.js粒子背景 + CSS雪花降级 | ~15KB | Three.js (CDN, 异步加载) |
| `js/repository.js` | 数据抽象层，统一localStorage/Supabase接口 | ~21KB | supabase-adapter.js |
| `js/supabase-adapter.js` | Supabase客户端封装、匿名认证、双写策略 | ~22KB | Supabase JS SDK (CDN, async) |
| `js/admin-auth.js` | 管理员口令SHA-256验证、状态持久化 | ~10KB | 无 |
| `js/rate-limiter.js` | 前端速率限制、localStorage持久化 | ~6KB | 无 |

### 2.2 脚本加载顺序

```html
<!-- 1. Supabase SDK — async，不阻塞页面渲染 -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" async></script>

<!-- 2. 本地模块 — 按依赖顺序加载 -->
<script src="js/supabase-adapter.js"></script>   <!-- 依赖 Supabase SDK -->
<script src="js/repository.js"></script>          <!-- 依赖 supabase-adapter -->
<script src="js/admin-auth.js"></script>           <!-- 独立模块 -->
<script src="js/rate-limiter.js"></script>         <!-- 独立模块 -->
<script src="js/particles.js"></script>            <!-- 独立模块，异步加载 Three.js -->
<script src="js/main.js"></script>                 <!-- 主入口，依赖以上所有 -->
```

### 2.3 后端模块（Supabase）

| 组件 | 用途 |
|------|------|
| PostgreSQL | 数据持久化（profiles, comments, submissions, rate_limits） |
| GoTrue (Auth) | 匿名认证，JWT令牌管理 |
| PostgREST | 自动生成REST API，前端通过SDK访问 |
| Realtime | WebSocket实时推送（comments/submissions INSERT事件） |
| RLS (Row Level Security) | 数据库层权限控制 |

---

## 3. 数据流设计

### 3.1 评论发表流程（双写策略）

```
用户输入评论
    │
    ▼
┌─────────────────┐
│  main.js        │  1. 前端速率限制检查 (RateLimiter.checkComment)
│  handleComment  │  2. 输入校验 (昵称≤20字, 内容2-500字)
│  Submit()       │  3. escapeHTML() XSS防护
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  DataRepository │  4. 调用 addComment(targetId, comment)
│  .addComment()  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────────┐
│ 本地   │ │ Supabase     │
│ 写入   │ │ Adapter      │
│ localStorage │  5. ensureAuthWithTimeout (12秒超时)
│ (同步) │ │  6. INSERT到comments表
│        │ │  7. RLS策略校验
└────────┘ └──────┬───────┘
    │              │
    │         成功? │ 失败?
    │         ┌────┴────┐
    │         ▼         ▼
    │     ┌───────┐ ┌──────────┐
    │     │ 刷新   │ │ 入队     │
    │     │ 评论   │ │ pendingSync│
    │     │ 列表   │ │ (持久化到  │
    │     └───────┘ │ localStorage)│
    │               └──────────┘
    ▼
页面立即显示新评论（乐观更新）
```

### 3.2 数据读取流程（合并去重）

```
页面加载 / 刷新评论区
    │
    ▼
┌─────────────────────┐
│ DataRepository      │
│ .getComments(id)    │
└────────┬────────────┘
         │
    ┌────┴────────────┐
    │                 │
    ▼                 ▼
┌─────────┐    ┌──────────────┐
│ 本地    │    │ Supabase     │
│ localStorage │  SELECT *    │
│ 读取    │    │  WHERE       │
│ (同步)  │    │  target_id   │
└────┬────┘    └──────┬───────┘
     │                │
     └───────┬────────┘
             ▼
     ┌───────────────┐
     │ 合并去重       │  按 author_name + content + created_at 去重
     │ 本地 ∪ 云端    │  云端数据保留 id 和 author_id 字段
     └───────┬───────┘
             ▼
     ┌───────────────┐
     │ 按时间排序     │  created_at ASC
     │ 渲染评论列表   │
     └───────────────┘
```

### 3.3 同步状态机

```
                    ┌──────────────┐
                    │  页面加载     │
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │ 等待SDK加载   │  waitForSDK() 轮询
                    │ (最多10秒)    │
                    └──────┬───────┘
                      成功? │ 失败?
                    ┌──────┴──────┐
                    ▼             ▼
             ┌────────────┐ ┌──────────┐
             │ 匿名认证    │ │ 本地模式  │  显示 "☁ 本地模式"
             │ (12秒超时)  │ │ (降级)   │
             └──────┬─────┘ └──────────┘
               成功? │
              ┌──────┴──────┐
              ▼             ▼
       ┌────────────┐ ┌──────────┐
       │ 云端在线    │ │ 本地模式  │  显示 "☁ 本地模式"
       │ 同步pending │ │          │
       │ 队列        │ └──────────┘
       └──────┬─────┘
              ▼
       ┌────────────┐
       │ ✅ 云端在线 │  显示用户ID + pending数
       │ 定时刷新    │  每5秒更新状态
       │ (5秒间隔)   │
       └────────────┘
```

---

## 4. 关键架构模式

### 4.1 Repository 抽象层

```
业务代码 (main.js)
      │
      ▼
DataRepository (repository.js)
  ├── provider = 'localStorage' | 'supabase'
  ├── getComments(targetId)
  ├── addComment(targetId, comment)
  ├── deleteComment(commentId)
  ├── getSubmissions()
  ├── addSubmission(submission)
  └── switchProvider(newProvider)
      │
      ├── localStorage 适配器 (内置)
      │   ├── key: fxre_comments_<targetId>
      │   ├── key: fxre_submissions
      │   └── key: fxre_data_provider
      │
      └── Supabase 适配器 (supabase-adapter.js)
          ├── client: SupabaseClient
          ├── ensureAuthWithTimeout()
          ├── addComment() → INSERT
          ├── getComments() → SELECT
          ├── deleteComment() → DELETE
          ├── addSubmission() → INSERT
          ├── getSubmissions() → SELECT
          └── syncPendingQueue() → 批量重试
```

**切换后端只需一行**：
```javascript
DataRepository.switchProvider('supabase');  // 启用云端
DataRepository.switchProvider('localStorage');  // 降级到本地
```

### 4.2 乐观更新（Optimistic Update）

评论/投稿提交后立即本地渲染，不等云端响应：

```javascript
// 1. 立即写入 localStorage（同步操作）
localComments.push(newComment);
saveToLocalStorage(targetId, localComments);

// 2. 立即渲染到页面
renderComments(targetId);

// 3. 异步同步到云端（不阻塞UI）
try {
    await cloud_addComment(targetId, newComment);
} catch(e) {
    // 失败也不影响已显示的内容，入队重试
    pendingSync.push({ action: 'addComment', targetId, comment: newComment });
}
```

### 4.3 离线队列持久化（v7.7新增）

```javascript
// pendingSync 队列持久化到 localStorage
var PENDING_KEY = 'fxre_pending_sync';

function savePendingQueue() {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(pendingSync)); } catch(e){}
}

function loadPendingQueue() {
    try {
        var saved = localStorage.getItem(PENDING_KEY);
        if (saved) pendingSync = JSON.parse(saved) || [];
    } catch(e) { pendingSync = []; }
}
```

### 4.4 降级策略

| 降级场景 | 触发条件 | 降级行为 |
|----------|----------|----------|
| Three.js 加载失败 | CDN不可达 / 浏览器扩展拦截 | 切换为纯CSS雪花背景 |
| Supabase SDK 加载失败 | CDN不可达 / 浏览器扩展拦截 | 切换为localStorage本地模式 |
| 匿名认证超时 | 12秒内未完成认证 | 切换为本地模式，显示"☁ 本地模式" |
| 云端写入失败 | 网络错误 / RLS拒绝 | 数据入pendingSync队列，下次重试 |
| localStorage 不可用 | 隐私模式 / 空间不足 | 内存回退存储（RateLimiter） |

---

## 5. 性能特征

| 指标 | 目标 | 实际 |
|------|------|------|
| 首次内容绘制 (FCP) | < 1.5s | ~0.8s（静态HTML） |
| 可交互时间 (TTI) | < 2s | ~1.5s（JS加载+初始化） |
| 评论列表渲染 | < 100ms | ~30ms（9条预置评论） |
| 本地写入延迟 | < 10ms | ~2ms（localStorage同步） |
| 云端同步延迟 | < 500ms | ~200-800ms（取决于网络） |
| Three.js 粒子帧率 | 60fps | 55-60fps（桌面端） |

---

## 6. 升级路径

```
Phase 3A (当前)           Phase 3B               Phase 3C
Supabase Free Tier   →   Supabase Pro       →   自托管 Docker
¥0/月                    $25/月                  ¥100-300/月
500MB PostgreSQL         8GB PostgreSQL          无限制
50k MAU                  100k MAU                无限制
可能被休眠(1周)           无休眠                   完全控制

迁移方式: pg_dump → .sql → pg_restore (零损失)
前端改动: 仅改 supabase-adapter.js 中 CONFIG.url 和 CONFIG.anonKey 两行
```
