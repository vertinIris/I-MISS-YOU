# 飞行雪绒 — 项目代码库全面分析报告

> **审计版本**: v7.8.1 | **审计日期**: 2026-07-07 | **审计范围**: 全量代码 + 文档
>
> 本报告基于对全部源文件（~13,891 行）的逐文件审查与文档交叉验证。

---

## 一、项目全景

| 维度 | 数值 |
|------|------|
| 版本 | **v7.8.1**（2026-07-03） |
| 代码总量 | **~13,891 行**（含 HTML/CSS/JS/SQL/Docs） |
| 核心 JS | main.js (2,090) + repository.js (659) + supabase-adapter.js (660) |
| 样式 | style.css (3,902 行) |
| 数据库 | 4 个 migration SQL（共 870 行） |
| 文档 | 15 篇 Markdown（共 3,375 行） |
| 架构 | 纯前端静态站 + Supabase BaaS，零自建服务器 |
| 部署 | GitHub Pages（`vertiniris.github.io/I-MISS-YOU/`） |

---

## 二、模块逐一分析

### 2.1 前端核心模块 — `css/style.css`（3,902 行）

**状态**: ✅ 已完成 | **优先级**: P3（迭代优化）

| 子模块 | 覆盖内容 | 完成度 |
|--------|----------|--------|
| 设计系统 | CSS 变量（颜色/阴影/圆角/间距）、字体栈、暗色模式 Token | 100% |
| 玻璃拟态 | `.glass` / `.glass-card` / `.glass-chip` / `.nav-glass` | 100% |
| 动画系统 | 雪花降落、星河光带、彩虹按钮呼吸灯、粒子脉冲、流星随机化 | 100% |
| 响应式 | ≤768px 移动端、≤480px 小屏，Section 顺序调整 | 90% |
| 音视频 | 播放器暗色唱片 conic-gradient、Canvas 频谱可视化 | 100% |
| 交互态 | hover/active/disabled 四态系统、resonance-ripple 点击涟漪 | 100% |
| 滚动揭示 | `.reveal` + `IntersectionObserver` stagger | 100% |

**技术债务**: 
- 3,902 行单文件 CSS 无模块化拆分，维护成本上升
- 部分 `@keyframes` 未被使用（如 `snowTextFloat`）

---

### 2.2 前端交互引擎 — `js/main.js`（2,090 行）

**状态**: ✅ 已完成 | **优先级**: P1（功能一致性修复）

| 功能模块 | 描述 | 状态 | 已知问题 |
|----------|------|------|----------|
| 主题切换 | dark/light/auto 三态循环 + localStorage 持久化 | ✅ | — |
| 移动端菜单 | 汉堡菜单 + 点击外部关闭 | ✅ | — |
| 滚动揭示 | IntersectionObserver + 交错延迟 | ✅ | — |
| 动态时间线 | 6 条预置动态 + 可展开评论区 | ⚠️ | G-04：评论数静态写死 HTML |
| 日志模块 | 3 篇角色日志 + Noto Serif SC 排版 | ✅ | — |
| 评论系统 | 多用户评论、ORM 10min 自删、事件委托 | ⚠️ | G-05：管理员删评仅本地 |
| 投稿系统 | 5 种类型 + 字数计数器 + 验证 | ✅ | G-10：取消点赞不同步云端 |
| 社区论坛 | 类型筛选、响应式网格、点赞 | ⚠️ | G-11：种子投稿 id 为字符串 |
| 音乐播放器 | Web Audio API 实时合成 5 曲 + Canvas 频谱 | ✅ | — |
| 彩蛋系统 | 头像气泡、双击脉冲、关键词响应、调频 9072 | ✅ | — |
| 按钮共振 | 涟漪粒子 + 四态交互 | ✅ | — |
| 云同步 | Realtime 订阅 + 30s 轮询 + 同步按钮 | ⚠️ | G-07：社区评论可能不在订阅范围内 |
| Phase 4 Stub | ArchiveAPI / SyncAPI / UserAPI | ❌ | G-14~16：三个 Stub 未实现 |
| 分享按钮 | 静态按钮 | ❌ | G-17：无 click 逻辑 |

**代码质量**: 
- 整体使用 IIFE 封装，命名空间隔离良好
- `escapeHTML()` 全字符转义使用到位
- 事件委托模式应用于动态内容
- 单文件 2,090 行略显臃肿，建议未来按功能模块拆分

---

### 2.3 数据抽象层 — `js/repository.js`（659 行）

**状态**: ✅ 已完成 | **优先级**: P2（profiles 对接）

| 子模块 | 描述 | 状态 |
|--------|------|------|
| Provider 管理 | `switchProvider('localStorage' | 'supabase')` | ✅ |
| 评论 CRUD | getComments / addComment / deleteComment | ✅ |
| 评论合并去重 | `mergeComments()` — 本地 ∪ 云端，按 id 优先 | ✅ |
| 评论跨设备同步 | `pullCommentsAndPersist()` + `syncLocalOnlyComments()` | ✅ |
| 投稿 CRUD | getSubmissions / addSubmission / mergeSubmissions | ✅ |
| 种子数据管理 | `ensureSeedData()` 版本号控制 | ✅ |
| 云端种子同步 | `seedCloudIfEmpty()` 首次连接推送 | ✅ |
| 归档导入导出 | `exportData()` / `importData()` | ✅ |
| profiles 对接 | 读取 profiles 表获取昵称 | ❌ G-01 |
| 管理员云端删评 | 通过 service_role 绕过 RLS | ❌ G-05 |

**设计亮点**:
- 双写策略：本地立即响应 + 云端异步同步，用户体验不受网络影响
- 离线容错：云端不可用时 queue pending，就绪后批量补传
- 合并算法：以云端 `id` 为优先键，避免同内容重复

---

### 2.4 Supabase 适配器 — `js/supabase-adapter.js`（660 行）

**状态**: ✅ 已完成 | **优先级**: P2（优化待办）

| 子模块 | 描述 | 状态 | 已知问题 |
|--------|------|------|----------|
| 匿名认证 | `signInAnonymously()` + JWT 自动刷新 | ✅ | ⚠️ 12s 超时可能不够 |
| SDK 加载降级 | `waitForSDK()` + `onerror` 降级 | ✅ | — |
| 评论同步 | addComment / getComments / deleteComment | ✅ | — |
| 投稿同步 | addSubmission / getSubmissions / incrementLikes | ⚠️ | 无 decrement RPC |
| 离线队列 | pendingSync 持久化 + 同步按钮 | ✅ | — |
| Realtime 订阅 | `subscribeToComments()` / `subscribeToSubmissions()` | ⚠️ | 仅已 DOM 存在的区域 |
| 类型映射 | `TYPE_TO_DB` / `TYPE_FROM_DB` 中英转换 | ✅ | — |
| 速率/安全 | 输入校验 500 字限制 | ✅ | — |

**风险点**:
- anon key 硬编码在 JS 中（预期行为，安全靠 RLS）
- Supabase Free Tier 1 周无请求会休眠（需 UptimeRobot）
- CDN（jsdelivr）被拦截时降级为纯本地模式

---

### 2.5 粒子背景 — `js/particles.js`（463 行）

**状态**: ✅ 已完成 | **优先级**: P3（CDN 本地化）

| 子模块 | 描述 | 状态 |
|--------|------|------|
| Three.js 粒子 | 星空粒子系统 + 主题色切换 | ✅ |
| CSS 降级 | Three.js CDN 加载失败时启用纯 CSS 雪花 | ✅ |
| 主题联动 | 暗色/亮色模式下粒子颜色自适应 | ✅ |

---

### 2.6 管理员认证 — `js/admin-auth.js`（273 行）

**状态**: ✅ 已完成 | **优先级**: P2（Edge Function 替代）

| 子模块 | 描述 | 状态 | 风险 |
|--------|------|------|------|
| SHA-256 哈希 | 纯 JS 实现，零依赖 | ✅ | — |
| 口令验证 | 失败 3 次冷却 30 秒 | ✅ | 可被暴力尝试 |
| 会话管理 | sessionStorage 令牌 | ✅ | 浏览器关闭即失效 |
| adminToken 暴露 | 控制台 `__FXRE.admin('口令')` | — | 低风险 |

**安全评价**: 
- 前端认证无法防篡改（本地 JS 可被绕过），但项目数据（评论/投稿）本身为公开 UGC，管理员权限仅用于删除不当内容，总体风险可接受
- 口令哈希硬编码，修改需重新生成 SHA-256

---

### 2.7 速率限制 — `js/rate-limiter.js`（194 行）

**状态**: ✅ 已完成 | **优先级**: P3

| 子模块 | 描述 | 状态 |
|--------|------|------|
| 评论限制 | 3 次/60 秒/目标 | ✅ |
| 投稿限制 | 2 次/300 秒/全局 | ✅ |
| 持久化 | localStorage + 内存回退 | ✅ |
| 服务端兜底 | `check_rate_limit()` DB 函数 | 🔧 依赖 migration-004 |

**安全评价**: 前端的速率限制可被清 localStorage 绕过，DB 层函数（`check_rate_limit()` + `check_daily_quota()`）是真正的防线，但需要 migration-004 生效。

---

### 2.8 数据库迁移

**状态**: ⚠️ 部分运维待办 | **优先级**: P0

| 迁移 | 文件名 | 行数 | 内容 | 状态 |
|------|--------|------|------|------|
| 001 | `migration-001-init.sql` | 217 | 建表（profiles/comments/submissions/rate_limits）+ RLS + 种子 | ✅ 已执行 |
| 002 | `migration-002-rls-hardening.sql` | 361 | RLS 强化 + 速率限制函数 + 敏感词触发器 + 每日配额 | ✅ 已执行 |
| 003 | `migration-003-fixes.sql` | 102 | INSERT 触发器 + increment RPC + 10min 删评 RLS | ✅ 已执行 |
| 004 | `migration-004-fix-search-path.sql` | 190 | **修复 003 的 `search_path=''` 致命 bug** | 🔧 **未执行（P0 阻塞）** |

**关键风险**:
- **migration-004 未执行**：所有评论 INSERT 全部失败（因为 `search_path=''` 导致 `rate_limits` 等表找不到）
- `cleanup_rate_limits` 无 cron 调度，表会持续增长
- Realtime publication 需确认所有表已加入

---

### 2.9 页面结构 — `index.html`（1,345 行）

**状态**: ✅ 已完成 | **优先级**: P3

| Section | 内容 | 行数估算 |
|---------|------|----------|
| Hero | 地点选择器、角色信息、行动按钮 | ~160 |
| Profile | 角色卡片、SVG 头像、统计数据 | ~180 |
| Music | 音乐播放器、5 曲切换、频谱 | ~130 |
| Timeline | 6 条社交动态 + 评论区嵌入 | ~200 |
| Diary | 3 篇日志 + 评论区嵌入 | ~200 |
| Easter Egg | 彩蛋触发按钮 + 结果展示 | ~60 |
| Submit | 投稿表单（5 类型）| ~80 |
| Community | 社区论坛投稿网格 | ~60 |
| Footer | 同步状态、版本号、管理员入口 | ~40 |
| Nav + 背景层 | 导航栏 + 星空/星河/能量核心/六边形/数据雨/雪花/流星 | ~235 |

**问题**:
- 动态评论数为 HTML 中静态值（如 `28`），发评后不更新（G-04）
- 无 `<link rel="icon">` 和 Open Graph meta 标签（E-06）

---

### 2.10 文档体系（15 篇 Markdown，3,375 行）

**状态**: ✅ 较完善 | **优先级**: P3（对齐更新）

| 文档 | 行数 | 状态 | 备注 |
|------|------|------|------|
| `gaps-audit.md` | 221 | ✅ | 最全面的疏漏编号清单 |
| `known-gaps.md` | 64 | ✅ | 摘要 + Top 10 |
| `changelog.md` | 272 | ✅ | v1.0 → v7.8.1 完整历史 |
| `fix-journal-v7.8.md` | 114 | ✅ | v7.8 修正根因分析 |
| `architecture.md` | 335 | ⚠️ | 标 v7.7，需更新至 v7.8 |
| `database-design.md` | 332 | ⚠️ | 标 v7.7，未含 migration-003/004 |
| `security.md` | 345 | ⚠️ | RLS 策略名与迁移不一致 + 口令明文示例 |
| `deployment.md` | 314 | ✅ | GitHub Pages 完整流程 |
| `deployment-checklist.md` | 85 | ✅ | 勾选清单 |
| `troubleshooting.md` | 147 | ✅ | 排错手册 |
| `supabase-setup-guide.md` | 110 | ✅ | — |
| `design-system.md` | 368 | ✅ | — |
| `api-reference.md` | 321 | ✅ | — |
| `phase3-architecture-plan.md` | 361 | ✅ | 方案选型与实施路线 |
| `docs/README.md` | 46 | ✅ | 文档索引 |

---

## 三、整体完成度评估

| 模块 | 完成度 | 状态 |
|------|--------|------|
| 角色资料展示 | 100% | ✅ |
| 音乐播放器 | 100% | ✅ |
| 动态时间线 | 90% | ⚠️ 评论数静态 |
| 日志系统 | 100% | ✅ |
| 彩蛋系统 | 100% | ✅ |
| 视觉特效 | 100% | ✅ |
| 主题系统 | 100% | ✅ |
| 评论系统（本地） | 95% | ⚠️ 跨设备同步依赖 004 |
| 评论系统（云端） | 60% | ❌ migration-004 未执行 → 评论无法入库 |
| 社区投稿 | 85% | ⚠️ 点赞/取消不完全同步 |
| 管理员系统 | 70% | ⚠️ 删评仅本地 |
| 用户身份系统 | 30% | ❌ profiles 表未接前端 |
| 数据归档 | 50% | ⚠️ 导出可用，导入/清理为 Stub |
| 运维体系 | 70% | ⚠️ 缺 004 执行、缺 UptimeRobot、缺自动化测试 |
| 文档体系 | 85% | ⚠️ architecture/database-design/security 需对齐 v7.8 |

**整体完成度**: **约 82%**（功能可用但因迁移未执行导致核心交互断裂）

---

## 四、已知问题 TOP 10（按严重度排序）

| # | ID | 问题 | 严重度 | 影响范围 |
|---|-----|------|--------|----------|
| 1 | D-01 | **migration-004 未在 Supabase 执行** | 🔴 P0 阻塞 | 所有评论 INSERT 全部失败，云端互动功能基��废弃 |
| 2 | O-01 | Supabase Free Tier 1 周休眠 | 🟠 P1 | 长期无访问后评论/投稿功能静默失效 |
| 3 | G-04 | 动态区评论数写死在 HTML 中 | 🟠 P1 | 发评后 UI 不反映真实数据 |
| 4 | G-05 | 管理员删他人评论仅本地移除 | 🟠 P1 | 恶意内容无法从云端清除 |
| 5 | G-09 | 动态时间线点赞为纯前端装饰 | 🟠 P1 | 刷新恢复，用户困惑 |
| 6 | G-10 | 社区取消点赞不同步云端 | 🟡 P2 | likes 只增不减 |
| 7 | G-01 | profiles 表未接前端 | 🟡 P2 | 昵称每次手填，跨设备无身份连续性 |
| 8 | G-14~16 | Phase 4 三个 Stub 未实现 | 🟢 P3 | clearArchive / pull / logout 不可用 |
| 9 | E-04 | 无自动化测试 | 🟢 P3 | 回归完全依赖手工验证 |
| 10 | E-06 | 无 favicon / OG 标签 | 🟢 P3 | 社交分享预览体验差 |

---

## 五、架构优势与亮点

1. **零构建步骤** — 纯 HTML/CSS/JS，无 npm/webpack/babel，任何设备即开即用
2. **双写 + 降级** — localStorage 优先响应 + Supabase 异步同步，离线/在线无缝切换
3. **DataRepository 抽象层** — 切换后端只需一行 `switchProvider`，解耦良好
4. **多层次安全** — 前端 RateLimiter + DB 触发器 + RLS + XSS 防护
5. **Web Audio API 实时合成** — 5 首原创曲目，零版权风险
6. **种子版本控制** — `SEED_VERSION` 机制确保种子数据只写一次，可版本迭代
7. **文档齐全** — 15 篇文档覆盖架构、数据库、API、安全、部署、排错、变更历史
8. **疏漏审计体系** — G/D/S/O/E 系列编号，可追溯、可验证、可闭环

---

## 六、技术债务与潜在风险

| 类别 | 描述 | 缓解措施 |
|------|------|----------|
| 运维风险 | migration-004 未执行，评论功能断裂 | **立即执行** |
| 可用性风险 | Supabase Free 休眠 | 设置 UptimeRobot 5 分钟心跳 |
| CDN 风险 | jsdelivr / Google Fonts 可被拦截（Edge 扩展） | 本地化 vendor 或换 CDN |
| 安全风险 | 管理员口令存储在前端 | 远期迁移至 Supabase Edge Function |
| 代码债务 | main.js 2,090 行 / style.css 3,902 行单文件 | 未来按功能模块拆分 |
| 兼容性风险 | `file://` 协议下 localStorage 受限 | 文档已明确要求使用本地服务器 |
| 数据膨胀 | `rate_limits` 表无自动清理 | 设置 pg_cron 定时任务 |

---

## 七、待完成 / 规划中任务

### P0 — 阻塞项（立即处理）

| 任务 | 操作 |
|------|------|
| 🔧 执行 migration-004 | Supabase SQL Editor 运行 `db/migration-004-fix-search-path.sql` |
| 🔧 验证评论可入库 | 线上发评 → Supabase comments 表有记录 → 另一设备可见 |

### P1 — 体验一致性（下一迭代）

| 任务 | 涉及文件 | 预计工作量 |
|------|----------|------------|
| 动态评论数动态更新 | `main.js` / `index.html` | 小 |
| 点赞行为一致性（unlike 同步云端） | `main.js` + 新增 Decrement RPC | 中 |
| 明确时间线点赞策略（装饰 or 云端） | `index.html` + `main.js` | 小 |
| 本地-only 评论补传提示 | `main.js` + `repository.js` | 小 |

### P2 — 身份与治理

| 任务 | 涉及文件 | 预计工作量 |
|------|----------|------------|
| profiles 表对接前端 | `repository.js` + `main.js` + 前端表单 | 中 |
| 管理员删评 Supabase Edge Function | 新建 Edge Function + `admin-auth.js` | 大 |
| 投稿自删功能 | `main.js` + `repository.js` + RLS | 中 |

### P3 — 工程与文档

| 任务 | 涉及文件 |
|------|----------|
| 更新 `architecture.md` → v7.8 | docs |
| 更新 `database-design.md` 含 migration-003/004 | docs |
| 添加 favicon + OG 标签 | `index.html` |
| 关键路径 smoke test | 新建测试 |
| 配置 UptimeRobot 心跳 | 运维 |
| CSS 模块化拆分 | `style.css` |
| main.js 功能模块拆分 | `js/main.js` |
| Three.js / Google Fonts 本地化 | `js/particles.js` / `index.html` |

---

## 八、总结

飞行雪绒 v7.8.1 是一个架构设计精良、文档完备、代码质量扎实的静态站点项目。核心展示功能（角色、音乐、视觉特效、彩蛋）均 100% 完成，创意性和交互水准在同人项目中相当出色。

**当前最大的问题**是 migration-004 未在 Supabase 执行导致云端评论功能断裂——这是 P0 阻塞项，需要在 Supabase SQL Editor 中运行一次即可解决。其次，评论数静态、点赞不一致等 P1 体验问题虽不影响核心使用，但会降低用户真实互动感。

项目整体完成度约 **82%**，P0 问题修复后可提升至 **90%+**。长期来看，profiles 身份系统、管理员 Edge Function、自动化测试等 P2/P3 任务是实现「真正可运营」的关键路径。

---

*本报告基于 2026-07-07 全量代码审计生成，随代码变更同步更新。关键 ID（如 G-04、D-01）与 [gaps-audit.md](./gaps-audit.md) 编号体系保持一致。*
