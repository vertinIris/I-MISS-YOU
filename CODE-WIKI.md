# 飞行雪绒 · Code Wiki

> **版本**: v11.3.2 · **生成日期**: 2026-08-14
> 项目仓库: `vertiniris/I-MISS-YOU` · 权威来源: **当前代码 + SQL migration**

---

## 目录

1. [项目概览](#1-项目概览)
2. [整体架构](#2-整体架构)
3. [目录结构详解](#3-目录结构详解)
4. [前端模块详解](#4-前端模块详解)
5. [论坛模块详解](#5-论坛模块详解)
6. [认证与权限系统](#6-认证与权限系统)
7. [数据库设计](#7-数据库设计)
8. [依赖与第三方库](#8-依赖与第三方库)
9. [构建系统](#9-构建系统)
10. [运行与调试](#10-运行与调试)
11. [部署与 CI](#11-部署与-ci)
12. [设计规范](#12-设计规范)
13. [安全策略](#13-安全策略)
14. [性能优化](#14-性能优化)
15. [常见问题排查](#15-常见问题排查)

---

## 1. 项目概览

### 1.1 项目定位

**飞行雪绒 (Snow / I-MISS-YOU)** 是《鸣潮》角色「爱弥斯 (Aemeath)」的秘密歌手身份「飞行雪绒」的**同人社交账号体验站**，附设独立论坛「**星炬学院**」。属于非商业同人创作项目，涵盖叙事、音乐合成、社区互动与角色档案四大核心体验。

### 1.2 线上地址

| 环境 | 地址 | 说明 |
|------|------|------|
| 主站（Cloudflare Pages） | https://i-miss-you-bcu.pages.dev/ | 大陆访问更稳 |
| 备站（GitHub Pages） | https://vertiniris.github.io/I-MISS-YOU/ | 源站 |
| 论坛入口 | `/forum/index.html` | 独立子站，双品牌视觉 |

### 1.3 技术栈一览

| 层级 | 技术选择 | 说明 |
|------|----------|------|
| **前端** | HTML5 + CSS3 + 原生 JS（零框架） | 无打包工具依赖，以 `defer` 顺序加载；v11 引入 Stage II 合并压缩 |
| **后端/BaaS** | Supabase | PostgreSQL + GoTrue Auth + Realtime + RLS（行级安全） |
| **音频** | Web Audio API | 动态合成与播放 |
| **部署** | Cloudflare Pages（主） + GitHub Pages（备） | 纯静态资源，SW 离线缓存 |
| **构建** | Node.js + Terser（JS） + CSSO（CSS） | `scripts/build-phase2.mjs` 两阶段构建 |
| **代码质量** | ESLint + Prettier + Stylelint | `npm run lint` / `npm run format` |
| **CI/CD** | GitHub Actions | smoke-check + extreme-audit + Lighthouse + a11y |

### 1.4 版本规范

- 对外展示版本：**v11.3.2**（页脚、`window.__FXRE_API.version`）
- `package.json` 版本：`11.3.2`
- Service Worker 缓存版本：`snowfluff-v11.5.0`
- `SEED_VERSION`（数据种子版本）：独立于对外版本，仅用于数据缓存

---

## 2. 整体架构

### 2.1 架构总览

```
┌───────────────────────────────────────────────────────────────┐
│                        浏览器客户端                              │
│  ┌──────────────┐   ┌───────────────┐   ┌──────────────────┐  │
│  │  飞行雪绒主站 │   │ 星炬学院论坛   │   │  7 个角色专区页   │  │
│  │ index.html   │   │ forum/        │   │ characters/*/    │  │
│  └──────┬───────┘   └───────┬───────┘   └────────┬─────────┘  │
│         │                   │                     │            │
│         ▼                   ▼                     ▼            │
│  ┌────────────────────────────────────────────────────────┐   │
│  │            共享运行时层（全局 window 对象挂载）            │   │
│  │  AuthManager · SupabaseAdapter · SecurityShield · ...  │   │
│  └───────────────────────┬────────────────────────────────┘   │
│                          │                                     │
│  ┌───────────────────────▼────────────────────────────────┐   │
│  │                  Service Worker (v11.5)                 │   │
│  │     App Shell 预缓存 · Runtime 缓存 · 离线回退          │   │
│  └───────────────────────┬────────────────────────────────┘   │
└──────────────────────────┼─────────────────────────────────────┘
                           │ HTTPS / WSS
┌──────────────────────────▼─────────────────────────────────────┐
│                      Supabase 云端 (BaaS)                       │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │ Postgres │ │  GoTrue   │ │ Realtime │ │  Storage (S3)   │  │
│  │  RLS 行级│ │  邮箱/匿名 │ │ 推送变更 │ │  用户上传文件   │  │
│  └──────────┘ └───────────┘ └──────────┘ └─────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 双品牌设计原则

本项目采用**双品牌锁定系统**，禁止"同款换色皮"：

| 维度 | 飞行雪绒（主站） | 星炬学院（论坛） |
|------|-----------------|-----------------|
| **Genre** | atmospheric（Midnight-Rose 玫夜） | modern-minimal × academic（学院蓝金） |
| **品牌色** | 雪绒粉 `oklch(72% 0.14 350)` · 玫夜墨纸 | 星炬蓝 `oklch(68% 0.12 255)` · 签发金 |
| **导航形态** | N9 edge-minimal soft（侧chip滚动指示） | N6 masthead（面包屑 + 地址频段切换） |
| **表面材质** | 雾面玻璃（主卡去玻璃化→实色低透） | 冷金属锐角感 |
| **圆角** | 软圆 16–22px | 锐角 6–10px |
| **标题字体** | ZCOOL XiaoWei + Noto Serif SC | Noto Serif SC（权重节奏不同） |
| **等宽字体** | IBM Plex Mono（调频数字） | JetBrains Mono（学号/频段） |
| **动效语言** | 品牌呼吸 · 调频微脉冲 · 滚动淡入 | 灯芯点亮 · 侧栏滑入 · 帖卡边光（克制） |
| **装饰元素** | 允许粉星云/轻雪粒子 | 禁止粉铺底 |

视觉令牌文件：
- 基础令牌：[css/tokens-base.css](file:///C:/Users/lenovo/CURSOR/Snow/css/tokens-base.css)
- 雪绒令牌：[css/tokens-snow.css](file:///C:/Users/lenovo/CURSOR/Snow/css/tokens-snow.css)
- 星炬令牌：[css/tokens-stf.css](file:///C:/Users/lenovo/CURSOR/Snow/css/tokens-stf.css)

设计权威文档：[design.md](file:///C:/Users/lenovo/CURSOR/Snow/design.md)

---

## 3. 目录结构详解

```
Snow/
├── index.html                 # 主站入口（飞行雪绒）
├── reset-password.html        # 独立重置密码页
├── forum/                     # 星炬学院论坛（独立子站）
│   ├── index.html             # 论坛入口
│   ├── js/                    # 论坛专属 JS 模块（15 个）
│   └── *.css                  # 论坛专属样式（forum/ + stf 武器/签名）
├── characters/                # 角色专区档案页（7 个角色，独立 HTML）
│   ├── aimisi/index.html      # 爱弥斯（飞行雪绒本人）
│   ├── denia/index.html       # 达妮娅
│   ├── sigrica/index.html     # 西格莉卡
│   ├── linne/index.html       # 琳奈
│   ├── mornye/index.html      # 莫宁
│   ├── lucilla/index.html     # 洛瑟菈
│   └── drifter/index.html     # 漂泊者
├── css/                       # 主站样式（令牌 + 分区样式 + 武器/签名）
├── js/                        # 主站 JS 模块（27 个，详见 §4）
├── dist/                      # 构建产物（仅 Stage II bundle；Stage I 中间文件已清理）
│   ├── bundle-main.js         # 主站 JS 合并压缩（SRI 保护）
│   ├── bundle-forum.js        # 论坛 JS 合并压缩（SRI 保护）
│   ├── css/
│   │   ├── main.min.css       # 主站 CSS 合并压缩（11 个 → 1 个）
│   │   ├── forum.min.css      # 论坛 CSS 合并压缩
│   │   └── archive.min.css    # 角色页 CSS 合并压缩
│   └── build-report-phase2.json # Phase 2 构建报表（含 SRI / 体积 / 安全分析）
├── vendor/                    # 自托管第三方运行时库（10 个，SRI 保护）
├── db/                        # Supabase SQL 迁移（migration-001 … 030）
├── scripts/                   # 构建 · 自检 · 部署脚本
├── docs/                      # 权威文档索引（STATUS / CONTENT-PIPELINE / WORLDVIEW）
├── assets/                    # 字体 · 图标 · 预览图 · 二维码
├── sw.js                      # Service Worker（v11.5 · App Shell 预缓存）
├── _headers                   # Cloudflare Pages HTTP 头（CSP / HSTS / 缓存）
├── manifest.webmanifest       # PWA 清单
├── robots.txt                 # 搜索引擎爬虫规则
├── wrangler.toml              # Cloudflare Pages / Workers 配置
├── pages.config.json          # Cloudflare Pages 构建配置
├── lighthouserc.json          # Lighthouse CI 配置
├── eslint.config.js           # ESLint 9.x 配置（flat config）
├── .stylelintrc.json          # Stylelint 配置
├── .prettierrc.json           # Prettier 代码格式化配置
├── .github/workflows/         # GitHub Actions CI（3 条流水线）
│   ├── static-checks.yml      # 代码门禁：smoke + extreme-audit
│   ├── lighthouse.yml         # 性能回归防护
│   └── accessibility.yml      # 无障碍 WCAG 2.1 AA 阻断
├── package.json               # 依赖与 npm scripts
└── CODE-WIKI.md               # 本文件
```

---

## 4. 前端模块详解（js/ 目录）

主站共 **27 个 JS 模块**，通过 IIFE + window 全局挂载交互。加载顺序严格按 `scripts/build-phase2.mjs` 中 `MAIN_JS` 数组。

### 4.1 模块职责清单

| 顺序 | 模块文件 | 全局对象 | 核心职责 |
|------|----------|----------|----------|
| 1 | [security-shield.js](file:///C:/Users/lenovo/CURSOR/Snow/js/security-shield.js) | `SecurityShield` | XSS/注入防护：颜色、URL sanitize；CSP 辅助 |
| 2 | [content-utils.js](file:///C:/Users/lenovo/CURSOR/Snow/js/content-utils.js) | `ContentUtils` / 全局 helper | `escapeHtml`、`formatTime` 等纯函数工具 |
| 3 | [supabase-adapter.js](file:///C:/Users/lenovo/CURSOR/Snow/js/supabase-adapter.js) | `SupabaseAdapter` / `window.supabaseClient` | **核心云端适配器**：Supabase SDK 封装、CRUD + RPC 调用、离线队列、Realtime 订阅 |
| 4 | [repository.js](file:///C:/Users/lenovo/CURSOR/Snow/js/repository.js) | `DataRepository` | 双后端抽象（localStorage + Supabase）、云端↔本地合并逻辑 |
| 5 | [admin-auth.js](file:///C:/Users/lenovo/CURSOR/Snow/js/admin-auth.js) | `AdminAuth` | 管理员/版主认证 UI（独立于 AuthManager 的 admin 入口） |
| 6 | [rate-limiter.js](file:///C:/Users/lenovo/CURSOR/Snow/js/rate-limiter.js) | — | 服务端限流规则定义（供 Supabase RPC 对齐） |
| 7 | [auth-manager.js](file:///C:/Users/lenovo/CURSOR/Snow/js/auth-manager.js) | `AuthManager` | **主站认证核心**：会话状态、匿名→注册升级、删除令牌、权限判定 |
| 8 | [sync-manager.js](file:///C:/Users/lenovo/CURSOR/Snow/js/sync-manager.js) | `SyncManager` | Realtime 连接管理、手动刷新、同步指示器 UI |
| 9 | [upload-manager.js](file:///C:/Users/lenovo/CURSOR/Snow/js/upload-manager.js) | `UploadManager` | 拖拽上传 · Supabase Storage · 配额校验 |
| 10 | [rate-limiter-client.js](file:///C:/Users/lenovo/CURSOR/Snow/js/rate-limiter-client.js) | `ClientRateLimiter` | 客户端限流：3s 冷却 · 重复内容检测 · 日配额 |
| 11 | [admin-panel.js](file:///C:/Users/lenovo/CURSOR/Snow/js/admin-panel.js) | `AdminPanel` | 管理后台面板（批量审核 · 隐藏 · 永久删除） |
| 12 | [particles.js](file:///C:/Users/lenovo/CURSOR/Snow/js/particles.js) | `SnowParticles` | Canvas 粒子背景 · 主题适配 · 懒加载 |
| 13 | [secret-portal.js](file:///C:/Users/lenovo/CURSOR/Snow/js/secret-portal.js) | `SecretPortal` | 论坛↔主站秘密传送门彩蛋（打破第四面墙） |
| 14 | [snow-easter.js](file:///C:/Users/lenovo/CURSOR/Snow/js/snow-easter.js) | `SnowEaster` | 主站彩蛋系统（5 连点触发隐藏消息） |
| 15 | [snow-realm.js](file:///C:/Users/lenovo/CURSOR/Snow/js/snow-realm.js) | `SnowRealm` | 「地址频段」切换（星炬学院 / 拉海洛 / 雪原小屋 …） |
| 16 | [modal-a11y.js](file:///C:/Users/lenovo/CURSOR/Snow/js/modal-a11y.js) | `ModalA11y` | 无障碍模态框：焦点陷阱 · ESC 关闭 · 背景滚动锁定 |
| 17 | [app-toast.js](file:///C:/Users/lenovo/CURSOR/Snow/js/app-toast.js) | `window.sanitizeHTML` / `showToast` | Notyf Toast 二次封装 + DOMPurify 桥接 |
| 18 | [signature-utils.js](file:///C:/Users/lenovo/CURSOR/Snow/js/signature-utils.js) | `__SNOW_SIG__` | 签名/水印工具（内容防溯源装饰） |
| 19 | [main.js](file:///C:/Users/lenovo/CURSOR/Snow/js/main.js) | — / 全局 render 函数 | **主站入口**：主题、滚动显示、点赞、评论渲染、社区投稿渲染、初始化串联 |
| 20 | [donation.js](file:///C:/Users/lenovo/CURSOR/Snow/js/donation.js) | `FlyingEdelweissDonate` / `openDonationModal` | 捐赠弹窗：二维码 · Stripe Checkout |
| 21 | [sw-register.js](file:///C:/Users/lenovo/CURSOR/Snow/js/sw-register.js) | — | Service Worker 注册（独立加载，不在 bundle 内） |
| 22 | [markdown-renderer.js](file:///C:/Users/lenovo/CURSOR/Snow/js/markdown-renderer.js) | — | Markdown 渲染：marked + DOMPurify + highlight.js |
| 23 | [web-vitals-collector.js](file:///C:/Users/lenovo/CURSOR/Snow/js/web-vitals-collector.js) | — | Web Vitals RUM：匿名上报 LCP/INP/CLS 到 Supabase |
| 24 | [ui-variants.js](file:///C:/Users/lenovo/CURSOR/Snow/js/ui-variants.js) | — | A/B 变体 · UI 个性化微调 |
| 25 | [supabase-loader.js](file:///C:/Users/lenovo/CURSOR/Snow/js/supabase-loader.js) | — | 主站 Supabase SDK 加载 + CDN 容错链（jsdelivr → unpkg → 本地） |
| 26 | [reset-password.js](file:///C:/Users/lenovo/CURSOR/Snow/js/reset-password.js) | — | 重置密码页独立逻辑 |
| 27 | [signature-utils.js 见上] | — | — |

### 4.2 关键模块深度说明

#### 4.2.1 SupabaseAdapter — 云端核心

文件：[js/supabase-adapter.js](file:///C:/Users/lenovo/CURSOR/Snow/js/supabase-adapter.js)

**配置**（行 15-24）：
- `url`: `https://lmlyfyjffaaddysiliht.supabase.co`
- `anonKey`: Supabase anon public key（可公开；RLS 控制权限）
- `enabled`: `true`（可置 `false` 强制纯本地模式）

**核心 API**：
```javascript
// —— 评论（主站）——
SupabaseAdapter.addComment(targetId, content, authorName, extraFields)
SupabaseAdapter.getComments(targetId, limit, offset)
SupabaseAdapter.deleteCommentWithToken(commentId, deleteToken)  // 匿名删除
SupabaseAdapter.deleteCommentAsAuthor(commentId)               // 注册用户删除
SupabaseAdapter.moderateComment(commentId, action, reason)     // 版主 hide/恢复

// —— 投稿（主站）——
SupabaseAdapter.addSubmission(submission, extraFields)
SupabaseAdapter.getSubmissions(typeFilter, limit, offset)
SupabaseAdapter.deleteSubmissionWithToken(id, token)
SupabaseAdapter.editSubmissionWithToken(id, token, updates)    // 24h 内编辑
SupabaseAdapter.addSubmissionTags(subId, tagsArray)

// —— 实时订阅 ——
SupabaseAdapter.subscribeComments(targetId, handlers)  // { onInsert, onUpdate, onDelete }
SupabaseAdapter.subscribeSubmissions(handlers)

// —— RPC（PostgreSQL 函数）——
SupabaseAdapter.rpcBatchModerateComments(ids, action, reason)
SupabaseAdapter.rpcToggleBookmark(submissionId)
SupabaseAdapter.rpcUnlikeComment(commentId)
```

**离线队列机制**：
- `pendingSync` 数组 + `localStorage['fxre_pending_sync']` 持久化
- 提交时网络失败自动入队，下次初始化自动重试
- 配额失败标记 `_quotaBlocked`，通过 `dropQuotaBlockedFromQueue()` 清理

#### 4.2.2 AuthManager — 认证与权限

文件：[js/auth-manager.js](file:///C:/Users/lenovo/CURSOR/Snow/js/auth-manager.js)

**会话对象结构**：
```javascript
session = {
  uid: null,                    // Supabase auth.users id
  role: 'anonymous',            // anonymous / user / moderator / admin
  isAnonymous: true,            // 是否匿名
  email: null,                  // 注册用户邮箱
  nickname: null,               // 显示昵称
  avatarColor: '#6B8AFF',
  deleteTokens: {}              // { commentId: uuid_token, submissionId: uuid }
}
```

**权限矩阵**（函数级）：

| 函数 | anonymous | user | moderator | admin |
|------|-----------|------|-----------|-------|
| `canDeleteComment(c)` | 令牌匹配 ✅ | 作者 ✅ | ✅ | ✅ |
| `canDeleteSubmission(s)` | 令牌匹配 ✅ | 作者 ✅ | ✅ | ✅ |
| `canEditSubmission(s)` | 令牌匹配 + 24h ✅ | 作者 + 24h ✅ | ✅ | ✅ |
| `canHideComment()` | ❌ | ❌ | ✅ | ✅ |
| `canDeletePermanently()` | ❌ | ❌ | ❌ | ✅ |
| `canBatchModerate()` | ❌ | ❌ | ❌ | ✅ |
| `canCreateBookmark()` | ❌ | ✅ | ✅ | ✅ |
| `canManageTags()` | ❌ | ❌ | ✅ | ✅ |

#### 4.2.3 main.js — 主站交互入口

文件：[js/main.js](file:///C:/Users/lenovo/CURSOR/Snow/js/main.js)（~4500 行 IIFE）

**初始化流程**：
```
initTheme()          → 强制暗色主题（星空氛围；v11 移除 light/auto）
initMobileMenu()     → 移动端汉堡菜单
initScrollReveal()   → IntersectionObserver 滚动淡入（兄弟 stagger 0.1s）
initLikeButtons()    → 博文点赞 + localStorage 持久化
initStatCounters()   → 数字滚动计数动画（easeOutCubic 1.5s）
initEasterEgg()      → 5 连点彩蛋
initNavigation()     → 平滑滚动 + 当前节高亮 + scroll-spy
initComments()       → 渲染评论列表 + Realtime 订阅
initCommunity()      → 渲染投稿网格 + 标签筛选 + 分页
initAudio()          → Web Audio API 初始化（用户手势解锁）
initDonationWidget() → 捐赠侧边卡
initA11y()           → 跳链 + focus-visible + ESC 关闭
```

**渲染核心函数（全局挂载，供其他模块回调）**：
```javascript
renderComments(targetId, comments)         // 增量 DOM 协调：v11 R19 防闪烁
renderCommunity(submissions, filter, sort) // reconcileCommunityGrid 差量更新
handleCommentSubmit(targetId)              // 提交流程：限流 → 令牌 → 入库 → UI
handleDeleteComment(commentId)             // 权限判定 → 令牌/身份/版主分支
applyRealtimeCommentEvent(evt)             // Realtime INSERT/UPDATE/DELETE 分发
reconcileCommentThread(existing, incoming) // 云端↔本地去重合并
ensureProfileExists(user)                  // 新用户首次创建 profile
toggleBookmark(submissionId)               // 书签双写
```

---

## 5. 论坛模块详解（forum/ 目录）

论坛为**独立前端子站**，不依赖主站 `main.js` / `repository.js`。通过共用 Supabase 项目与 `persistSession` 实现跨域（同域）登录互认。

### 5.1 模块清单（forum/js/）

| 顺序 | 模块文件 | 全局对象 | 核心职责 |
|------|----------|----------|----------|
| 1 | [forum-data.js](file:///C:/Users/lenovo/CURSOR/Snow/forum/js/forum-data.js) | `StarTorchData` | 论坛静态种子数据（角色/标签/世界观）+ `ensureCloudSeed` 白名单 |
| 2 | `../js/snow-realm.js` | `SnowRealm` | 地址频段切换（复用主站） |
| 3 | `../js/security-shield.js` | `SecurityShield` | 安全防护（复用主站） |
| 4 | `../js/rate-limiter-client.js` | `ClientRateLimiter` | 客户端限流（复用主站） |
| 5 | `../js/modal-a11y.js` | `ModalA11y` | 无障碍模态（复用主站） |
| 6 | `../js/app-toast.js` | — | Toast 封装（复用主站） |
| 7 | [forum-auth.js](file:///C:/Users/lenovo/CURSOR/Snow/forum/js/forum-auth.js) | `StarTorchAuth` | **论坛认证**：`stf_session` 镜像 · 昵称合成邮箱 · `is_forum_admin()` 权限 |
| 8 | [forum-upload.js](file:///C:/Users/lenovo/CURSOR/Snow/forum/js/forum-upload.js) | `StarTorchUpload` | 论坛帖子封面/附件上传 |
| 9 | [forum.js](file:///C:/Users/lenovo/CURSOR/Snow/forum/js/forum.js) | `StarTorchForum` | **论坛主入口**：帖子列表/详情/评论/标签/搜索 · 楼中楼 · 精华/置顶 |
| 10 | [forum-sync.js](file:///C:/Users/lenovo/CURSOR/Snow/forum/js/forum-sync.js) | `StarTorchSync` | 论坛 Realtime 同步（帖子/评论） |
| 11 | [forum-supabase.js](file:///C:/Users/lenovo/CURSOR/Snow/forum/js/forum-supabase.js) | `StarTorchSupabase` / `forumSupabase` | 论坛云端表操作（forum_submissions / forum_comments） |
| 12 | [forum-cloud.js](file:///C:/Users/lenovo/CURSOR/Snow/forum/js/forum-cloud.js) | `StarTorchCloud` | 论坛搜索 RPC · 管理操作 · 帖子置顶 |
| 13 | [forum-chat.js](file:///C:/Users/lenovo/CURSOR/Snow/forum/js/forum-chat.js) | `StarTorchChat` | 论坛实时聊天（forum_chat 表，Realtime） |
| 14 | [forum-easter.js](file:///C:/Users/lenovo/CURSOR/Snow/forum/js/forum-easter.js) | `StarTorchEaster` | 论坛彩蛋 |
| 15 | `../js/signature-utils.js` | `__SNOW_SIG__` | 签名工具（复用主站） |
| 16 | `../js/donation.js` | — | 捐赠（复用主站） |
| 17 | [forum-import-data.js](file:///C:/Users/lenovo/CURSOR/Snow/forum/js/forum-import-data.js) | — | 573 条二创种子数据（单独加载，不进 bundle） |
| 18 | [form-validator.js](file:///C:/Users/lenovo/CURSOR/Snow/forum/js/form-validator.js) | — | Just-Validate 登录/注册表单校验 |
| 19 | [photoswipe-init.js](file:///C:/Users/lenovo/CURSOR/Snow/forum/js/photoswipe-init.js) | — | PhotoSwipe 灯箱初始化（ESM） |
| 20 | [forum-theme-bootstrap.js](file:///C:/Users/lenovo/CURSOR/Snow/forum/js/forum-theme-bootstrap.js) | — | 主题偏好同步（CSP 提取） |
| 21 | [forum-supabase-loader.js](file:///C:/Users/lenovo/CURSOR/Snow/forum/js/forum-supabase-loader.js) | — | Supabase SDK CDN 容错链（CSP 提取） |

### 5.2 双套 Auth 边界约定（勿大重构）

| | 主站 AuthManager | 论坛 StarTorchAuth |
|---|---|---|
| 会话镜像 localStorage 键 | `fxre_auth_session` | `stf_session` |
| 权威会话存储 | Supabase GoTrue `persistSession`（同项目共享） | 同左 |
| 权限模型 | `profiles.role`（anonymous/user/moderator/admin） | `forum_admins` 表 + RLS `is_forum_admin()` |
| 匿名→注册路径 | 邮箱注册（Supabase 标准） | 昵称 + 合成邮箱路径（`nickname@startorch.local`） |
| 管理员设置 | `UPDATE profiles SET role='admin'` | `INSERT INTO forum_admins(email)` |

**关键**：两站共用同一 Supabase 项目与 GoTrue，同域下 `localStorage` 令牌自动互通，但**UI 镜像键彼此独立**，代码不合并。

---

## 6. 认证与权限系统

### 6.1 角色模型

```
anonymous（匿名信号源）
  ↓ 邮箱注册 / 合成邮箱注册
user（已注册用户）
  ↓ UPDATE profiles SET role = 'moderator'
moderator（版主）
  ↓ UPDATE profiles SET role = 'admin'
admin（管理员）
```

### 6.2 匿名用户删除令牌机制

为解决「未注册用户发评论后无法自删」的业界通病，本项目采用 **UUID v4 一次性删除令牌**：

1. 提交前：`AuthManager.generateToken()` 生成 UUID（优先 `crypto.randomUUID`，否则手写 fallback）
2. 提交时：随 insert 一并写入 `delete_token` 列
3. 令牌存储：`localStorage['fxre_delete_tokens']` 持久化（`{ commentId: token }`）
4. 删除时：比对 `session.deleteTokens[id]` 与数据库中该值，匹配即物理 DELETE（v9 migration-017 后硬删）

### 6.3 RLS（行级安全）原则

所有表均启用 **Row Level Security**，匿名公钥仅能：
- 读：帖子/评论（非隐藏）、公共 profiles 信息
- 写：自己创建的行（通过 `auth.uid() = author_id` 策略）
- 删：仅通过 RPC `delete_*_with_token`（令牌校验）或作者本人
- 版主/管理员操作：仅通过 `moderate_*` RPC（`SECURITY DEFINER` 提权 + `is_moderator()` guard）

---

## 7. 数据库设计

### 7.1 Migration 顺序与核心变更

在 Supabase Dashboard → SQL Editor 中按 `migration-001` → `migration-030` **依次执行**。**不要漏序**。

| 编号 | SQL 文件 | 核心变更 | 关键备注 |
|------|----------|----------|----------|
| 001 | `migration-001-init.sql` | profiles / comments / submissions 建表 + 触发器 | 基础骨架 |
| 002 | `migration-002-rls-hardening.sql` | 全面 RLS 策略 + RPC guard | 安全基础 |
| 003–005 | `migration-003~005` | bugfix · search_path · unlike RPC | 修复类 |
| 006 | `migration-006-comment-moderation.sql` | 版主隐藏 + 删除令牌 + roles | 审核体系 |
| 007 | `migration-007-rate-limit-v2.sql` | 分层限流 RPC（tiers） | 防刷 |
| 008 | `migration-008-tags-bookmarks.sql` | tags / submission_tags / bookmarks / collections | 标签&书签 |
| 009 | `migration-009-storage-bucket.sql` | Storage `uploads` 桶创建 | 上传 |
| 010 | `migration-010-fix-quota-name-type.sql` | 修复 `check_daily_quota` 签名 bug | 必跑 |
| 011 | `migration-011-comment-replies.sql` | comments.parent_id 楼中楼 | 回复 |
| 012 | `migration-012-content-reports.sql` | 用户举报 RPC | 举报 |
| 013 | `migration-013-submission-edit.sql` | 24h 内编辑（令牌/作者） | 编辑 |
| 014 | `migration-014-security-hardening.sql` | 触发器 XSS/注入防护 | 服务端消毒 |
| 015 | `migration-015-submission-delete-author.sql` | 作者可删投稿 | 权限 |
| 016 | `migration-016-replica-identity.sql` | Replica Identity FULL | Realtime 旧值 |
| **017** | **`migration-017-hard-delete-for-realtime.sql`** | **comments/submissions 硬删 + Realtime DELETE** | **Production 已执行** |
| 018 | `migration-018-dedupe-comments.sql` | 历史重复评论清理 | 数据卫生 |
| 019 | `migration-019-deaify-live-content.sql` | 内容去 AI 化重写 | 文案 |
| **020** | **`migration-020-forum-tables.sql`** | **forum_submissions / forum_comments 建表** | **论坛基础（只用此 020）** |
| 021 | `migration-021-forum-rls.sql` | 论坛表 RLS + `is_forum_admin()` | 论坛安全 |
| 022 | `migration-022-forum-realtime.sql` | 论坛 Realtime 发布 | 论坛实时 |
| **023** | **`migration-023-forum-chat.sql`** | **forum_chat 表建表** | **禁止再跑 DEPRECATED 020-chat** |
| 024 | `migration-024-import-seed-1~4.sql` | 分四批导入种子数据 | 按顺序 |
| 025 | `migration-025-cleanup-test-probe.sql` | 清理 `stf_test_probe` 测试数据 | 上线前 |
| 026 | `migration-026-forum-moderation-align.sql` | 论坛版主权限对齐 | 权限 |
| **027** | **`migration-027-profiles-nickname-rls.sql`** | **profiles 本人 INSERT + nickname UPDATE** | **Production 已执行** |
| **028** | **`migration-028-forum-pin-replies.sql`** | **forum_submissions.is_pinned + forum_comments.parent_id** | **Production 已执行** |
| 029 | `migration-029-forum-search-rpc.sql` | 服务端搜索函数（ILIKE 中文友好） | 可选增强 |
| 030 | `migration-030-perf-metrics-rum.sql` | `performance_metrics` 表（Web Vitals） | RUM 监控 |

### 7.2 核心 ER 关系（主站 + 论坛）

```
auth.users (Supabase GoTrue 内置)
    │ 1:1
    ▼
public.profiles (id ← auth.users.id, CASCADE)
    │ nickname / avatar_color / bio / role

    ├─── 1:N → public.comments (author_id)
    │         target_id / author_name / author_color / content / delete_token
    │
    ├─── 1:N → public.submissions (author_id)
    │         type / title / content / tags / delete_token / is_hidden
    │
    ├─── 1:N → public.bookmarks (user_id)
    │         submission_id
    │
    ├─── 1:N → forum.forum_submissions (author_id)
    │         is_pinned / essence / tags / cover_url
    │
    └─── 1:N → forum.forum_comments (author_id)
              parent_id（楼中楼）/ submission_id

forum.forum_submissions 1:N → forum.forum_comments
forum.forum_admins(email)     ← 论坛管理员（独立于 profiles.role）
public.moderation_logs        ← 版主操作审计 + content_snapshot（硬删后可回溯）
public.performance_metrics    ← Web Vitals RUM（anon INSERT 仅）
```

### 7.3 执行指引

`npm run db:migrate-XXX` **仅打印指引**，需**手动**在 Supabase SQL Editor 复制粘贴执行。

---

## 8. 依赖与第三方库

### 8.1 npm 依赖（package.json）

**运行时依赖（仅有两个）**：
| 包 | 版本 | 用途 |
|----|------|------|
| `terser` | ^5.36.0 | JS 压缩（Stage I/II 构建） |
| `ters` | 0.0.1-concept-pre-alpha.4 | 概念版工具（实际未使用） |

**开发依赖**：
| 包 | 版本 | 用途 |
|----|------|------|
| `eslint` | ^9.39.5 | JS 静态分析（flat config） |
| `@eslint/js` | ^10.0.1 | ESLint 官方 JS 规则 |
| `prettier` | ^3.9.6 | 代码格式化 |
| `stylelint` | ^16.26.1 | CSS 检查 |
| `stylelint-config-standard` | ^36.0.1 | stylelint 标准规则集 |
| `csso` | ^5.0.5 | CSS 压缩合并（Stage II） |
| `axe-core` | ^4.13.0 | 无障碍自动化测试引擎（CI 用） |
| `ws` | ^8.21.3 | WebSocket（browser-probe 用） |

### 8.2 自托管第三方运行时库（vendor/）

所有库均自托管（避免 CDN 单点故障），附 **SRI sha384** 完整性校验。清单见 [vendor/manifest.json](file:///C:/Users/lenovo/CURSOR/Snow/vendor/manifest.json) 与 [vendor/README.md](file:///C:/Users/lenovo/CURSOR/Snow/vendor/README.md)。

| 优先级 | 库 | 版本 | 作用 |
|--------|----|------|------|
| P0 必装 | DOMPurify | 3.2.7 | XSS 防护 · UGC 消毒 |
| P0 必装 | Notyf | 3.10.0 | Toast 通知反馈 |
| P1 推荐 | lazysizes | 5.3.2 | 图片懒加载 · LCP 优化 |
| P1 推荐 | marked | 14.1.3 | Markdown 渲染 |
| P1 推荐 | highlight.js | 11.11.2 | 代码语法高亮（配合 marked） |
| P1 推荐 | PhotoSwipe | 5.4.4 | 图片灯箱 · 手势缩放（ESM） |
| P1 推荐 | Just-Validate | 4.3.0 | 表单前端验证 |
| P1 推荐 | Font Awesome | 7.3.1 | 通用图标库（3 字重 + 动画） |
| P1 推荐 | anime.js | 4.5.0 | JS 动画引擎（UMD + ESM） |
| P1 推荐 | Material Design Icons | 7.4.47 | 学院蓝金权威图标 |

### 8.3 Supabase SDK（CDN + 本地三级容错链）

不进 `vendor/`，使用 **CDN 容错链 + 本地备用**（v10.1 CSP 加固后提取为外部 loader）：
1. 主：`cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
2. 备：`unpkg.com/@supabase/supabase-js@2`
3. 最后：本地 `forum/js/supabase.min.js`（未压缩兜底）

---

## 9. 构建系统

### 9.1 两阶段构建

#### Stage I：逐文件 Terser 压缩（不合并）

脚本：[scripts/build-phase1.mjs](file:///C:/Users/lenovo/CURSOR/Snow/scripts/build-phase1.mjs)

- 输入：`js/*.js`（18 个） + `forum/js/*.js`（10 个）
- 输出：`dist/js/*.js` + `dist/forum/js/*.js`（逐文件 minified）
- 用途：**已被 Stage II 替代，目前不再被 HTML 引用**（遗留产物）

#### Stage II：合并压缩 + SRI + CSSO + 安全加固 ⭐（当前实际使用）

脚本：[scripts/build-phase2.mjs](file:///C:/Users/lenovo/CURSOR/Snow/scripts/build-phase2.mjs)

```
输入                                    输出
────────────────────────────────────    ──────────────────────────────
js/* (20个，严格按顺序)            →   dist/bundle-main.js  + SRI sha384
forum/js/* + ../js/* (16个)        →   dist/bundle-forum.js + SRI sha384
css/* (11个主站CSS合并)            →   dist/css/main.min.css  (CSSO + 加固)
css/* + forum/*.css (11个)         →   dist/css/forum.min.css (CSSO + 加固)
css/* (8个角色页共用)              →   dist/css/archive.min.css
```

**Terser 配置原则（保守档，宁慢不炸）**：
- `mangle.toplevel: false`（不碰顶层变量/全局符号）
- `keep_fnames: true` + `keep_classnames: true`（保留 AuthManager 等构造名）
- `RESERVED_GLOBALS`（~50 个全局模块名保留不压缩）
- `drop_console: false`（生产保留 console 排错）

**CSS 安全加固（build-phase2.mjs `hardenCss`）**：
1. 每条 `backdrop-filter:` 自动镜像 `-webkit-backdrop-filter:`（Safari/iOS 兼容）
2. 末尾追加 `@media (prefers-reduced-motion: reduce)` 守卫：关闭装饰性动画 + 隐藏 8 层背景 + 粒子画布

**SRI 自动同步**：构建后自动改写 `index.html` 和 `forum/index.html` 中 `<script integrity="…">`，并自检一致性。

### 9.2 构建执行

```bash
# 全量构建（推荐）
node scripts/build-phase2.mjs

# 报表输出
dist/build-report-phase2.json   # Stage II 报表（含 SRI）
dist/build-report.json          # Stage I 报表（遗留）
```

### 9.3 HTML 资源引用模式（v10.1 后）

```html
<!-- index.html -->
<link rel="stylesheet" href="dist/css/main.min.css">
<link rel="stylesheet" href="css/edge-compat.css">        <!-- Edge/旧Chromium回退 -->
<script defer src="js/markdown-renderer.js"></script>      <!-- 单独加载 -->
<script defer src="js/supabase-loader.js"></script>        <!-- CSP 提取 SDK加载 -->
<script defer src="dist/bundle-main.js" integrity="sha384-..." crossorigin></script>
<script type="module" src="js/web-vitals-collector.js"></script>
<script src="js/ui-variants.js" defer></script>
<script src="js/sw-register.js" defer></script>           <!-- 独立注册，不在bundle -->
```

---

## 10. 运行与调试

### 10.1 本地启动

```bash
# 方法 1：npm（推荐，端口 8848）
npm run serve          # python -m http.server 8848

# 方法 2：Windows PowerShell（自动检测端口 + 自动打开浏览器）
.\run.ps1              # 默认 8848，端口占用自动+1

# 方法 3：双击批处理（最傻瓜）
打开本地预览.bat

# 方法 4：Node.js serve（需要 npx，端口 serve 默认）
npm run serve:node

# 方法 5：Windows 快捷脚本
npm run serve:win      # 等价于 .\run.ps1
```

然后浏览器访问 `http://localhost:8848`。

> ⚠️ **严禁用 `file://` 直接打开**：Supabase 同步 / CSP / Service Worker 会失败。

### 10.2 本地门禁检查（提交前必跑）

```bash
# 冒烟检查（语法 + 引用 + HTML 结构 + 卷路径）
npm run smoke-check         # scripts/smoke-check.mjs

# 极端审计（CSS 大括号平衡 · JS 语法 · 令牌未泄漏 · CSP white · SRI 一致）
npm run extreme-audit       # scripts/extreme-audit.mjs

# Lint
npm run lint                # ESLint（js/ + forum/js/）
npm run lint:css            # Stylelint
npm run lint:bp             # 响应式断点一致性（scripts/lint-breakpoints.mjs）

# 格式化
npm run format              # Prettier 格式化
npm run format:check        # Prettier 检查

# 可选：浏览器探针（需 Playwright + 已启动本地服务器）
node scripts/browser-probe.mjs http://127.0.0.1:8848
```

### 10.3 内容管线

```bash
# 构建论坛二创内容种子（论坛内容库 → forum/js/forum-import-data.js）
npm run content:build       # scripts/build-forum-import.cjs

# 打印管线说明
npm run content:pipeline
```

完整说明见 [docs/CONTENT-PIPELINE.md](file:///C:/Users/lenovo/CURSOR/Snow/docs/CONTENT-PIPELINE.md)。

### 10.4 Supabase 云端连接验证

1. 打开 DevTools Console，输入：
   ```javascript
   SupabaseAdapter.getStatus()  // 应输出 { ready: true, userId: "..." }
   ```
2. Network 面板过滤 `supabase.co`，确认无 401/403
3. 若 CSP 拦截：检查 `_headers` 文件与 HTML `<meta CSP>` 白名单一致性

---

## 11. 部署与 CI

### 11.1 部署目标

| 平台 | 源 | 用途 |
|------|----|------|
| **Cloudflare Pages** | `main` 分支根目录（自动） | 主站：大陆访问更稳，`_headers` 生效 |
| **GitHub Pages** | `main` 分支 `/`（Settings → Pages） | 备站 |

### 11.2 Cloudflare Pages 配置

- 配置文件：[wrangler.toml](file:///C:/Users/lenovo/CURSOR/Snow/wrangler.toml) + [pages.config.json](file:///C:/Users/lenovo/CURSOR/Snow/pages.config.json)
- **关键文件 `_headers`**（根目录）：
  - CSP：`script-src 'self' cdn.jsdelivr.net; …`
  - HSTS：`Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy
  - 静态资源（`assets/`、`dist/`、`vendor/`）：`Cache-Control: public, max-age=31536000, immutable`

### 11.3 GitHub Actions CI（.github/workflows/）

三条独立流水线：

| 工作流 | 触发 | 阻断条件 | 说明 |
|--------|------|----------|------|
| **static-checks.yml** | push / PR | smoke + extreme 任一失败 | 门禁必过；加 `PLAYWRIGHT_PROBE=1` repo variable 启用 browser-probe |
| **lighthouse.yml** | PR | a11y < 0.9（warn 不阻塞） | Lighthouse CI：性能回归防护 |
| **accessibility.yml** | push / PR | a11y critical/serious 问题 | axe-core 扫描：主站 + 论坛 WCAG 2.1 AA |

### 11.4 Service Worker 部署策略

[sw.js](file:///C:/Users/lenovo/CURSOR/Snow/sw.js)（v11.5.0）设计原则：**宁可走网络，也绝不返回空响应导致裸奔**。

- 预缓存清单（`SHELL_ASSETS`）：index.html、forum/index.html、bundle-main/forumm.js、min.css、edge-compat.css、favicon
- **逐资源预缓存，单资源失败容忍**（不用 `cache.addAll` 原子操作）
- 安装后 `skipWaiting` + 激活后 `clients.claim`（强制新版本接管）
- 缓存命中校验 `content-length !== 0`（损坏回退网络）
- 旧 `snowfluff-*` 缓存激活时强制清理
- `navigationPreload` 启用（文档导航加速）

---

## 12. 设计规范

### 12.1 设计令牌体系（三级结构）

```
tokens-base.css       ← 中性色 · 间距 · 圆角 · 阴影 · 字体家族
  ├─ tokens-snow.css  ← 飞行雪绒专属：雪绒粉 · 玫夜墨 · Display字重
  └─ tokens-stf.css   ← 星炬学院专属：星炬蓝 · 签发金 · 字重节奏
```

### 12.2 色彩角色

- **主色**：仅用于 Hero 背景/标题 + 主 CTA
- **辅助色**：纯色（非渐变），用于按钮、标签、徽章
- **表面令牌（v11 R17）**：`--surface-card` / `--surface-inset` / `--surface-accent` + 对应 border
- **渐变收敛原则**：12 处小装饰元素（时间线、头像、进度条等）降级为实色，渐变只留 hero/CTA

### 12.3 响应式断点（8 级）

CSS 断点 lint：`npm run lint:bp`（[scripts/lint-breakpoints.mjs](file:///C:/Users/lenovo/CURSOR/Snow/scripts/lint-breakpoints.mjs)）

| 断点 | 宽度 | 典型设备 |
|------|------|----------|
| xs | < 380px | 超小屏（老 SE） |
| sm | ≥ 380px | 小屏手机 |
| md | ≥ 640px | 大屏手机 |
| lg | ≥ 768px | 平板 |
| xl | ≥ 1024px | 小笔电 |
| 2xl | ≥ 1280px | 桌面 |
| 3xl | ≥ 1536px | 大屏桌面 |
| 4xl | ≥ 1920px | 4K/超宽 |

### 12.4 无障碍（WCAG 2.1 AA 目标）

- **跳链**：`<a class="skip-link" href="#main-content">跳到主要内容</a>`
- **aria-hidden**：所有纯装饰层（star-field / 粒子画布等）标记隐藏
- **aria- 属性**：所有模态、菜单、按钮均标注 `aria-expanded/haspopup/controls/label`
- **焦点陷阱**：ModalA11y 模块处理模态框焦点循环 + ESC 关闭 + 背景滚动锁定
- **prefers-reduced-motion**：`hardenCss` 自动追加守卫，关闭装饰动画 + 隐藏 8 层背景/粒子
- **axe-core CI**：每次 push 扫描，critical/serious 阻断

---

## 13. 安全策略

### 13.1 CSP（内容安全策略，v10.1 加固）

**HTML `<meta>` + Cloudflare `_headers` 双保险**（后者优先级更高）：

```
default-src 'self';
script-src 'self' cdn.jsdelivr.net unpkg.com;
# v10.1: 已移除 'unsafe-inline'（所有内联脚本提取为外部：supabase-loader.js / forum-theme-bootstrap.js 等）
style-src 'self' 'unsafe-inline' cdn.jsdelivr.net;
# style-src 'unsafe-inline' 暂缓移除：28+ 处内联 --x / --tag-rot / --eqh 是设计核心
img-src 'self' data: blob: https://*.supabase.co;
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
font-src 'self' cdn.jsdelivr.net;
base-uri 'self';
form-action 'self';
object-src 'none';
frame-ancestors 'none';
upgrade-insecure-requests;
```

### 13.2 XSS 三道防线

1. **输入层**：前端 `escapeHTML`（所有 UGC 文本渲染走转义）
2. **消毒层**：`window.sanitizeHTML`（DOMPurify）· `SecurityShield.sanitizeColor/isSafeUrl`（颜色/URL 正则）
3. **服务端**：`migration-014` 触发器级 XSS/注入消毒 + CSP 阻断未白名单脚本执行

### 13.3 SRI 子资源完整性

- 所有 vendor JS/CSS：`integrity="sha384-..." crossorigin="anonymous"`（manifest.json 含权威哈希）
- bundle-main.js / bundle-forum.js：构建时自动生成并同步 HTML

### 13.4 限流体系

| 层 | 机制 | 规则 |
|----|------|------|
| 客户端 | `ClientRateLimiter` | 评论 3s 冷却 · 重复内容 hash 检测 · 日配额 |
| 服务端 | `migration-007` RPC `check_daily_quota` | 分层 tiers（anon < registered < mod < admin） |
| HTTP | Cloudflare WAF（可选） | 基础 DDoS / 速率 |

---

## 14. 性能优化

### 14.1 体积优化（v10.1 v11 阶段成果）

| 优化项 | 前 | 后 | 节省 |
|--------|----|----|------|
| 主站 CSS（11 个 → 合并） | ~200KB | 130KB | ↓35% |
| bundle-forum.js（移除 import-data） | 534KB | 146.2KB | **↓72.6%** |
| fonts.css 自托管（移出 Google Fonts 阻塞） | 外链 3 次 RTT | 本地合并进 min.css | FCP 改善 |
| forum-import-data.js 单独 defer | 进 bundle 阻塞 | 416KB 懒加载 | TTI 改善 |

### 14.2 运行时优化

- **字体**：`fonts.css` → 合并进 min.css；Noto/Serif SC → 系统 CJK 回退（PingFang / 微软雅黑 / 宋体）
- **粒子画布懒加载**：`prefers-reduced-motion: reduce` 时隐藏，IntersectionObserver 暂停离屏
- **滚动淡入**：IntersectionObserver（非 scroll 事件），一次 observe 后 unobserve
- **增量 DOM 协调**（R19）：评论/投稿列表不再整列表 `innerHTML` 重绘，长列表防闪烁
- **图片懒加载**：lazysizes `data-src` + `lazyload` 类
- **Service Worker**：App Shell 预缓存 + runtime 缓存；静态资源 `immutable` 长缓存

### 14.3 监控体系

- **Web Vitals RUM**：[js/web-vitals-collector.js](file:///C:/Users/lenovo/CURSOR/Snow/js/web-vitals-collector.js) 匿名上报 LCP / INP / CLS / TTFB / FCP → Supabase `performance_metrics`（RLS：仅 anon INSERT）
- **Lighthouse CI**：PR 性能回归防护
- **build-report-phase2.json**：每次构建后压缩比报表

---

## 15. 常见问题排查

### 15.1 构建后白屏 / bundle 404

```bash
# 重新构建并同步 SRI
node scripts/build-phase2.mjs
```

### 15.2 Supabase 控制台操作（手动执行指引）

```sql
-- 设管理员（主站）
UPDATE profiles SET role = 'admin' WHERE id = 'your_auth_uid';

-- 设论坛管理员（两种方式二选一）
INSERT INTO forum_admins(email) VALUES('your@email.com') ON CONFLICT DO NOTHING;
-- 或
UPDATE profiles SET role = 'admin' WHERE id = 'your_auth_uid';
```

### 15.3 论坛聊天不工作（404 找不到 forum_chat 表）

→ 检查是否漏跑 `migration-023-forum-chat.sql`（**不要**跑废弃的 `DEPRECATED-migration-020-forum-chat.sql`）

### 15.4 Production migration 核查（只读 SQL）

见 [docs/STATUS.md](file:///C:/Users/lenovo/CURSOR/Snow/docs/STATUS.md) 中的"Production 云端核验（收口）"章节（017/027/028 自查 A/B/C 三段 SQL）。

### 15.5 更多文档入口

| 文档 | 路径 |
|------|------|
| 文档索引 | [docs/README.md](file:///C:/Users/lenovo/CURSOR/Snow/docs/README.md) |
| 现状速览（权威） | [docs/STATUS.md](file:///C:/Users/lenovo/CURSOR/Snow/docs/STATUS.md) |
| 世界观设定 | [docs/WORLDVIEW.md](file:///C:/Users/lenovo/CURSOR/Snow/docs/WORLDVIEW.md) |
| 内容管线 | [docs/CONTENT-PIPELINE.md](file:///C:/Users/lenovo/CURSOR/Snow/docs/CONTENT-PIPELINE.md) |
| 部署指南（Cloudflare） | [docs/DEPLOY-GUIDE-CLOUDFLARE.md](file:///C:/Users/lenovo/CURSOR/Snow/docs/DEPLOY-GUIDE-CLOUDFLARE.md) |
| 技术选型报告 | [docs/TECH-SELECTION-REPORT.md](file:///C:/Users/lenovo/CURSOR/Snow/docs/TECH-SELECTION-REPORT.md) |

---

## 附录 A：仓库整理日志 (2026-03-21)

> 整理目标：只保留**正在使用**或**权威参考**的文件；删除重复、过时、冗余、历史遗留的占位/草稿/中间产物。
> 验证方式：`npm run smoke-check` 全绿通过（JS 语法 / 关键资源 / 符号断言 / Migration 001-030）。

### A.1 删除类别与数量

| 类别 | 删除数量 | 说明 |
|------|----------|------|
| 过时计划/方案文档 | 5 份 | EXECUTION-PLAN v8.0、ARCHITECTURE 草稿、MASTERPLAN 旧版本等 |
| 重复 migration 文件 | 1 份 | `DEPRECATED-migration-020-forum-chat.sql`（已由 migration-023 替代） |
| 一次性迁移指引 | 1 份 | `migrate-cloudflare-cors.sql`（内容已并入 DEPLOY-GUIDE-CLOUDFLARE.md §步骤 4） |
| 冗余替换脚本 | 8 份 | `replace-colors.cjs/.mjs` ×2、`replace-css-colors.mjs`、`update-v8.0.py`、`smoke-p0-three.cjs` 等历史操作脚本 |
| Stage I 构建中间产物 | 约 30 个 JS | `dist/js/*.js`、`dist/forum/js/*.js`（HTML 只引用 Stage II 的 bundle-*.js） |
| 过时期刊/预览图 | 10 张 | `preview.png`、`preview-scroll.png`、`preview-v2-*.png`（已由 preview-v3-* 替代） |
| 过时设计稿/原型 | 2 份 | `ui-redesign-plan-2026-08-03.md`、`prototype-snowfluff-redesign.html`（已有 2026-08-12 版替代） |
| AI 工作痕迹/日志 | 2 份 | `.hallmark/log.json`、`.trae/documents/P1-5*.md`（断点计划已落地到 `lint-breakpoints.mjs`） |
| 交付物目录 | 3 份 | `handoff/` 历史交接件（内容已合并入 docs/ 或代码） |
| 空目录 | 5 个 | `handoff/`、`dist/js/`、`dist/forum/`、`.hallmark/`、`.trae/` |

### A.2 保留原则（后续维护建议）

1. **migration-XXX.sql**：编号 001–030 是生产链，**禁止删除**；新增只能追加更高编号。
2. **docs/ 权威文档**：STATUS / CONTENT-PIPELINE / WORLDVIEW / DEPLOY-GUIDE 四件套需始终更新。
3. **scripts/ 工具链**：`build-phase1/2`、`smoke-check`、`extreme-audit`、`lint-breakpoints` 为 CI 依赖，保留。
4. **dist/**：只保留 bundle-*.js + `css/*.min.css` + `build-report-phase2.json`；禁止提交中间态。
5. **design-docs/**：只保留**当前迭代**的 masterplan + 最新 prototype + QA 报告；每完成一次大迭代需清理旧稿。
6. **assets/preview-***：只保留当前官网使用的一套预览图（当前为 v3），新增版本时清理旧版本。

### A.3 目录（整理后）

```
Snow/ (约 300 个文件)
├── 入口 HTML         # index.html / reset-password.html
├── characters/       # 7 个角色档案（已去重）
├── css/              # 21 份样式（令牌 + 分区 + 武器/签名）
├── js/               # 27 份主站模块
├── forum/            # 论坛子站（入口 + 15 js + 4 css）
├── dist/             # Stage II bundle 最终产物（5 文件）
├── vendor/           # 10 个自托管运行时库（DOMPurify/Anime/...）
├── db/               # 30 份 SQL migration（001 … 030）
├── scripts/          # 19 份构建/自检/部署工具
├── docs/             # 13 份权威文档
├── assets/           # 字体 + 图标 + 预览图 v3 + 捐赠二维码
├── design-docs/      # 6 份当前设计迭代资料
├── .github/          # 3 条 CI 流水线
├── sw.js             # Service Worker
├── _headers          # Cloudflare Pages CSP/HSTS
├── CODE-WIKI.md      # 本文件
└── package.json / wrangler.toml / manifest.webmanifest 等配置
```

---

> **Code Wiki v11.3.2** · 最后整理 2026-08-14 · 若代码变更请同步维护本文件
