# 飞行雪绒 ❄️ Snow

> 「我知道，只要抬头，那颗星总能找到我」

鸣潮角色爱弥斯（Aemeath）的秘密歌手身份「飞行雪绒」的同人社交账号页面。  
非商业同人创作项目，融合角色叙事、音乐合成、社区互动于一体。

**当前版本**: v9.6.0  
**最后更新**: 2026-07-10

---

## 项目概述

飞行雪绒是一个沉浸式同人社交账号体验网站，复刻《鸣潮》角色爱弥斯以「飞行雪绒」为化名在社交平台上分享日常、音乐和心情的体验。项目包含角色资料展示、原创音乐播放器、动态时间线、日志、社区投稿与评论系统，以及多个隐藏彩蛋。

### 核心功能

| 模块 | 功能 | 技术实现 |
|------|------|----------|
| 角色资料 | 主角卡片、SVG头像、地点选择器 | CSS/SVG生成，无外部图片 |
| 音乐播放器 | 5首原创曲目实时合成 | Web Audio API（OscillatorNode + ADSR包络） |
| 动态时间线 | 6条社交动态 + 可展开评论区 | JS动态渲染 + localStorage/Supabase双写 |
| 日志 | 3篇角色日志 + 评论区 | Noto Serif SC排版 |
| 社区投稿 | 5种类型投稿 + 点赞 + 筛选 | 响应式网格 + 云端同步 |
| 评论系统 | 多用户评论 + 删除 + 实时同步 | Supabase PostgreSQL + RLS |
| 彩蛋系统 | 头像气泡、双击脉冲、关键词响应、调频9072 | 多层交互设计 |
| 云端同步 | 评论/投稿跨设备同步 | Supabase Free Tier + 匿名登录 |
| 安全防护 | 速率限制、XSS防护、管理员口令 | 前端RateLimiter + SHA-256 + RLS策略 |

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | HTML5 + CSS3 + 原生 JavaScript | 无框架，零构建步骤 |
| 视觉效果 | Three.js r128 (UMD) | 粒子背景，CDN异步加载 + CSS降级 |
| 音频 | Web Audio API | 实时合成，零版权风险 |
| 后端 | Supabase (PostgreSQL) | 免费Tier，500MB数据库 + 50k MAU |
| 认证 | Supabase Anonymous Auth | 零注册门槛 |
| 安全 | RLS + 前端速率限制 + SHA-256 | 多层防御 |
| 部署 | GitHub Pages | 静态托管，零服务器成本 |
| CDN | jsdelivr | Three.js + Supabase JS SDK |

### 字体

- **正文**: Noto Sans SC → PingFang SC → Microsoft YaHei
- **日志**: Noto Serif SC → Source Han Serif SC → SimSun

---

## 目录结构

```
Snow/
├── README.md                          # 本文件 — 项目总览
├── .gitignore
├── .env.example                       # 配置项参考（实际写入 supabase-adapter.js）
├── package.json
│
├── index.html                         # 主页面（唯一 HTML 入口）
│
├── 打开本地预览.bat                    # Windows 本地预览（8848 端口）
├── run.ps1                            # PowerShell 本地预览
├── 更新GitHubPages.bat                 # Git pull + commit + push
├── 解决合并冲突.bat                    # 合并冲突时保留本地 v7.8
│
├── css/
│   └── style.css
│
├── js/
│   ├── main.js                        # 核心逻辑
│   ├── particles.js                   # Three.js 粒子背景
│   ├── repository.js                  # localStorage ↔ Supabase 抽象层
│   ├── supabase-adapter.js            # Supabase 云端适配器
│   ├── admin-auth.js                  # 管理员认证（SHA-256）
│   └── rate-limiter.js                # 前端速率限制
│
├── db/
│   ├── migration-001-init.sql         # 建表 + RLS + 种子
│   ├── migration-002-rls-hardening.sql
│   ├── migration-003-fixes.sql        # v7.8 触发器 / 点赞 RPC
│   └── migration-004-fix-search-path.sql  # 【必跑】修复 003 search_path bug
│
├── docs/
│   ├── README.md                      # 文档索引（从这里开始）
│   ├── deployment-checklist.md        # 从零部署勾选清单
│   ├── troubleshooting.md             # 运维排错手册
│   ├── fix-journal-v7.8.md            # v7.8 修正日志与纠错思路
│   ├── known-gaps.md                  # 已知疏漏与路线图
│   ├── architecture.md
│   ├── database-design.md
│   ├── api-reference.md
│   ├── design-system.md
│   ├── security.md
│   ├── deployment.md
│   ├── changelog.md
│   ├── phase3-architecture-plan.md
│   └── supabase-setup-guide.md
│
└── scripts/
    ├── serve.sh                       # Linux/macOS 本地预览
    └── README.md                      # 脚本说明
```

> **工作区说明**：上级目录 `CURSOR/app/` 为独立 Python 项目，与 Snow 无关。

---

## 快速开始

### 环境要求

- 任意现代浏览器（Chrome 90+ / Firefox 88+ / Safari 14+ / Edge 90+）
- Python 3.x 或 Node.js（仅用于本地开发服务器）
- Git（版本控制）
- Supabase 账号（免费注册，用于云端同步功能）

### 1. 克隆/解压项目

```bash
# 如果从 Git 仓库获取
git clone <your-repo-url>
cd Snow

# 如果是文件夹拷贝，直接进入目录
cd Snow
```

### 2. 本地运行

**方式 A — 直接打开**

直接用浏览器打开 `index.html` 即可。云端同步功能需要互联网连接。

**方式 B — 本地服务器（推荐，Windows 请用此方式）**

```bash
# 最简单：双击 Snow 文件夹内的「打开本地预览.bat」

# 或 PowerShell
cd Snow
.\run.ps1

# 或 Python（默认 8848，避免 8080 冲突）
python -m http.server 8848
# 浏览器访问 http://localhost:8848
```

> **不要直接双击 `index.html`**：用 `file://` 打开时，部分浏览器会限制脚本/CDN/云端同步，页面可能空白或功能失效。必须通过 `http://localhost` 访问。

**线上地址（注意大小写）**

```
https://vertiniris.github.io/I-MISS-YOU/
```

仓库名是 **`I-MISS-YOU`**（大写字母 **I**），不是 `l-MISS-YOU`（小写 L）。后者会 404。

### 3. 配置云端同步（可选但推荐）

参见 [docs/supabase-setup-guide.md](docs/supabase-setup-guide.md) 获取详细步骤。

简要步骤：

1. 注册 [Supabase](https://supabase.com)（用 GitHub 登录）
2. 创建新项目
3. 在 SQL Editor 中依次执行：
   - `db/migration-001-init.sql`
   - `db/migration-002-rls-hardening.sql`
   - `db/migration-003-fixes.sql`
   - `db/migration-004-fix-search-path.sql` **（必跑，否则评论无法入库）**
4. 在 Authentication → Settings 中启用 Anonymous Sign-ins
5. 在 Authentication → URL Configuration 中设置 Site URL
6. 将 Project URL 和 anon key 填入 `js/supabase-adapter.js` 顶部的 CONFIG

完整勾选清单：[docs/deployment-checklist.md](docs/deployment-checklist.md)  
出问题先看：[docs/troubleshooting.md](docs/troubleshooting.md)

### 4. 部署到 GitHub Pages

```bash
# 创建 GitHub 仓库
# 推送代码
git init
git add -A
git commit -m "Initial commit"
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main

# 在 GitHub 仓库 Settings → Pages → Source 选择 main 分支 → Save
# 等待 1-2 分钟，访问 https://<你的用户名>.github.io/<仓库名>/
```

详细部署指南参见 [docs/deployment.md](docs/deployment.md)。

---

## 环境变量

项目不使用 `.env` 文件（纯前端静态站），Supabase 配置直接写在 `js/supabase-adapter.js` 顶部的 `CONFIG` 对象中。参考 `.env.example` 了解需要哪些配置项。

> **安全说明**: Supabase 的 anon key 是公开的（类似于 Firebase 的 API Key），安全性由数据库层的 RLS（Row Level Security）策略保障，而非密钥保密。详见 [docs/security.md](docs/security.md)。

---

## 关键设计决策

### 为什么不用框架？

项目选择原生 HTML/CSS/JS 而非 React/Vue，原因：
1. **零构建步骤** — 不需要 npm install、webpack、babel，任何设备打开即用
2. **零依赖维护** — 不存在依赖版本冲突、安全漏洞更新
3. **跨平台可移植** — 纯文件，复制到任何静态托管即可运行
4. **学习曲线低** — 后续维护者无需学习框架生态

### 为什么选 Supabase？

详见 [docs/phase3-architecture-plan.md](docs/phase3-architecture-plan.md)。核心原因：
1. **标准 PostgreSQL** — 数据可随时 `pg_dump` 导出，零厂商锁定
2. **免费 Tier 足够** — 500MB 数据库 + 50k MAU，本项目数据量远不达上限
3. **内置认证** — 匿名登录零注册门槛
4. **RLS 行级安全** — 安全规则写在数据库层，无需中间层 API 服务器

### 为什么双写（localStorage + Supabase）？

1. **本地优先** — 评论/投稿先写 localStorage，页面立即响应，无网络延迟
2. **云端异步** — Supabase 就绪后异步同步，不影响用户体验
3. **离线容错** — 云端不可用时数据不丢失，入队等待重试
4. **降级兼容** — 浏览器扩展拦截 CDN 时自动降级为纯本地模式

---

## 浏览器兼容性

| 浏览器 | 状态 | 注意事项 |
|--------|------|----------|
| Chrome 90+ | ✅ 完全支持 | — |
| Firefox 88+ | ✅ 完全支持 | — |
| Safari 14+ | ✅ 完全支持 | — |
| Edge 90+ | ⚠️ 部分支持 | 浏览器扩展可能拦截 jsdelivr CDN，导致降级为本地模式 |
| 夸克浏览器 | ✅ 支持 | 已验证云端同步正常 |
| 移动端 Safari | ✅ 支持 | 触摸事件已适配 |
| 移动端 Chrome | ✅ 支持 | — |

> **降级策略**: Three.js 加载失败时自动切换为纯 CSS 雪花背景；Supabase SDK 加载失败时自动切换为 localStorage 本地模式。所有功能在降级状态下依然可用。

---

## 管理员功能

- **入口**: 页脚 `#sync-status` 区域双击
- **口令**: 见项目维护者私下配置（哈希存储于 `js/admin-auth.js`，非明文）
- **权限**: 可删除任意评论（不受 10 分钟自删时限约束）
- **安全**: 口令哈希存储在 `js/admin-auth.js` 中，纯前端验证

> 如需修改管理员口令，编辑 `js/admin-auth.js` 中的 `ADMIN_PASSWORD_HASH` 常量（使用 SHA-256 哈希值，非明文）。

---

## 注意事项

1. **Supabase Free Tier 休眠**: 项目超过 1 周无 API 请求会被暂停。建议用 [UptimeRobot](https://uptimerobot.com) 设置定时心跳。
2. **CDN 依赖**: Three.js 和 Supabase SDK 通过 jsdelivr CDN 加载。如果目标平台无法访问 jsdelivr，需更换 CDN 或本地化这些库。
3. **跨域限制**: 直接用 `file://` 协议打开时，部分浏览器可能限制 localStorage。建议使用本地服务器。
4. **数据备份**: Supabase 数据可通过 Dashboard → Database → Backup 导出 SQL。
5. **非商业用途**: 本项目为同人创作，仅供学习交流，不得用于商业目的。

---

## 文档导航

| 文档 | 内容 |
|------|------|
| [**文档索引**](docs/README.md) | 所有文档入口与迁移顺序 |
| [**部署清单**](docs/deployment-checklist.md) | 从零到上线勾选步骤 |
| [**排错手册**](docs/troubleshooting.md) | 评论不同步、404、本地预览等 |
| [**修正日志 v7.8**](docs/fix-journal-v7.8.md) | 根因分析与纠错思路 |
| [**疏漏审计清单**](docs/gaps-audit.md) | 完整疏漏编号表（G/D/S/O/E 系列） |
| [**已知疏漏摘要**](docs/known-gaps.md) | Top 10 与路线图 |
| [架构设计](docs/architecture.md) | 系统架构、模块划分、数据流 |
| [数据库设计](docs/database-design.md) | 表结构、索引、RLS策略、ER图 |
| [API参考](docs/api-reference.md) | DataRepository接口、Supabase适配器API |
| [设计系统](docs/design-system.md) | 色彩、字体、动画、组件规范 |
| [安全措施](docs/security.md) | 速率限制、XSS防护、RLS、管理员认证 |
| [部署指南](docs/deployment.md) | GitHub Pages、Supabase配置、域名设置 |
| [变更日志](docs/changelog.md) | v1.0 → v7.8.1 完整版本历史 |
| [Phase 3 架构规划](docs/phase3-architecture-plan.md) | 云端同步方案选型与实施路线 |
| [Supabase 配置指南](docs/supabase-setup-guide.md) | 注册、建表、认证配置步骤 |

---

## 许可

非商业同人创作。角色「爱弥斯」「漂泊者」及相关设定版权归游戏《鸣潮》及其开发商所有。  
代码部分可自由使用、修改、分发。
