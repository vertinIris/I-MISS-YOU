# 飞行雪绒 · 全流程全模块系统复盘

> 日期：2026-11-18 · 基准版本：v11.7.6（本地与 `origin/main` 同步于 `e8477e1`）
> 范围：项目目标 / 架构 / 功能 / 流程 / 数据与文件 / 技术风险 / 维护性 / 扩展性 / 桌面端可行性
> 方法：全仓只读扫描（构建链、CI、SW、双站 HTML、18.4K 行 JS、26 份 CSS、30 份 migration、22 份 docs）+ 关键结论逐项交叉验证
> 纪律声明：**本次未修改任何项目代码或配置**，仅新增本报告文件。所有判断均附文件/行号证据。

---

## 0. 执行摘要（TL;DR）

**一句话结论**：这是一个**工程质量高于同类个人站、但架构债务已进入复利期**的双站同人项目；当前最该做的不是加功能或换壳，而是**先修三个会静默失效的基建缺陷，再做一次数据层收敛**；桌面端**技术可行但战略不成立**，仅在明确离线/任务栏刚需且 Web 载荷清理完毕后才值得套最小 Tauri 壳。

五个核心判断：

1. **双站分工已冻结且正确**（雪绒=听/感，学院=查/议），但代码层仍是「两套同构实现 + 注释约定勿重构」，分工只落在文案与皮上，未落在数据与服务层。
2. **三个静默失效型基建缺陷**：论坛 SRI 自动回填失效（白屏风险）、部署产物 SW 版本脱缰、主站 Supabase SDK 仅 CDN 无本地兜底。
3. **数据层是最大的完整性隐患**：同一实体 5 处副本、fxre/stf 双前缀、软删与硬删混用、种子版本 v10.1 / 导出元数据 v7.8 漂移、导入函数 `e.author` bug。
4. **新库融入只做了一半**：Fuse/Day.js/confetti 已落地论坛且实现质量不错，主站零覆盖；howler 36KB 全仓零引用=死重量。
5. **桌面端**：现有文档三次给出的结论一致（3.2/10 不推荐 → 场所感先成立 → 可套最小 Tauri）。本报告补充了**代码级阻塞清单**，说明为什么"70% 复用"是乐观估计。

---

## 1. 项目目标与定位复盘

### 1.1 目标一致性评估

| 维度 | 立项目标（docs/TECH-SELECTION-REPORT.md） | 现状（v11.7.6） | 判定 |
|---|---|---|---|
| 非商业同人、零预算 | 硬约束 | 无变现代码， donation 为静码二维码 | ✅ 守住 |
| 单人维护、低维护 | 硬约束 | 30 份 migration + 18 脚本 + 双站 18.4K 行 | ⚠️ 已明显超出「低维护」 |
| 即时更新、无版本碎片 | 硬约束 | push → Pages 自动部署，但 SW 缓存需手动 bump | ⚠️ 部分守住 |
| 全平台可达 | 硬约束 | 主站无搜索、论坛无真实音频，均非阻塞 | ✅ 守住 |
| 内容聚焦 | 爱弥斯×漂泊者（主站） | 主站已收敛；论坛保留全角色档案 | ✅ 符合分工 |
| 场所感 / 反 AI 味 | 2026-11-14 新增 | 档案柜/卷宗/布告栏已落地，但仍是 CSS 皮为主 | 🟡 进行中 |

### 1.2 目标漂移记录（批判性）

- **漂移一：从「一个同人账号体验站」膨胀为「双社区平台」**。主站有投稿+评论+书签+后台审核，论坛有投稿+评论+聊天+档案+世界观+调谐台。两套半成品社区互相稀释——这个问题在 `PRODUCT-SPLIT-2026-11-14.md` 已被指出且文案层纠正，但**功能层未精简**（主站投稿区与论坛发帖仍重叠，`UPGRADE-GAP-2026-11-14.md:38` 自己列为「后续精简空间」）。
- **漂移二：从「零框架 JS」滑向「构建链密集」**。现已引入 terser/csso/eslint/stylelint/prettier/axe/ws + 18 个 scripts + 5 道门禁 + 4 个 workflow。对一个纯静态站这是**正向的工程化**，但维护成本已与"单人低维护"约束冲突。
- **漂移三：内容源从单一变成五处**（见 §5.3），这是最需要收敛的漂移。

### 1.3 已冻结、不可推翻的产品红线

以下为多份文档反复确认的决策，重构建议均以其为前提：

- 主站 = 深夜电台/第一人称/爱弥斯×漂泊者；论坛 = 学院档案处/第三人称考据讨论。禁止互相镜像。
- 玫白蓝三色（`#F4729B` / `#F0F4FF` / `#6B8AFF`/`#A8D8FF`），金色仅降级令牌，紫色仅达妮娅角色着色。
- **用户浏览器不支持 `color-mix()` / `oklch()`**——凡用这两个函数的声明整条失效。论坛所有可见样式必须纯 hex/rgba（历史事故：hero 因此变灰雾）。
- 页脚 sn-footer 家族签名 + 彩蛋全集 + 音乐/账号/捐赠/投稿/SW/CSP 基建不得删减；论坛 `#stf-hidden-trigger` 绝不能删。
- 双站文案必须岔开（曾因 `.sn-footer__tag` 逐字相同被判为 AI-slop 头号指纹）。
- 用户明确不要毛玻璃（论坛 `.nav-glass` 与跨站浮钮已改实色）。

---

## 2. 现有架构全景

### 2.1 技术栈与拓扑

```
浏览器 ── GitHub Pages（主部署，CI 自动） ── 静态 HTML/CSS/JS
       └─ Cloudflare Pages（备用，_headers 仅此处生效）
                    ↓
        Supabase（单一 project: lmlyfyjffaaddysiliht）
        Auth + Postgres + Realtime + Storage + RLS
```

- 零框架原生 JS + IIFE 模块；主站 20 个 JS 合并为 `bundle-main.js`（237KB），论坛 16 个合并为 `bundle-forum.js`（152KB）。
- CSS 源 26 份共 606KB → 3 份 min.css 共 426KB；`site-v2.css` / `forum-redesign.css` / `refined.css` / `edge-compat.css` 以独立 `<link>` 加载，**不进 bundle、无统一 SRI、不自动补 `-webkit-` 前缀**（靠手写）。
- 依赖极轻：`dependencies` 仅 terser；vendor 14 库共 1.7MB。

### 2.2 构建链与门禁

| 环节 | 脚本 | 作用 | 隐患 |
|---|---|---|---|
| Phase1 | `build-phase1.mjs` | 29 JS 逐文件 terser，写 `dist/js/` `dist/forum/js/` | 产出为**陈旧副本**，页面不加载却随 rsync 部署 |
| Phase2 | `build-phase2.mjs` | JS 合并+terser+SHA384、CSS csso+`hardenCss`、SRI 回填 | **论坛 SRI 回填正则失效**（见 P0-1） |
| 门禁 | `smoke-check.mjs` | 语法/资源/符号/版本号 6 处断言 | 本机 `execSync` 假阳性已加 vm 兜底 |
| 门禁 | `extreme-audit.mjs` | 补断言 `__FXRE_API`/页脚 | — |
| 门禁 | `runtime-assert.mjs` | headless DOM 运行断言 | 依赖 Chrome |
| 门禁 | `css-integrity-check` | 花括号 + `@supports` 前导污染 | 防 CSS 拼接吞规则 |
| 门禁 | `dist-sync` | 重建后 `git diff --exit-code` | 只比 phase2 产物，漏 Phase1 陈旧副本 |

### 2.3 CI/CD（4 个 workflow）

| Workflow | 触发 | 关键内容 |
|---|---|---|
| `static-checks.yml` | push/PR | smoke+audit / runtime-assert / dist-sync；browser-probe 需 `PLAYWRIGHT_PROBE=1` 手动开 |
| `lighthouse.yml` | push/PR | **唯一阻塞项：a11y ≥0.90**；perf/BP/SEO 仅 warn |
| `accessibility.yml` | push/PR | axe-core 扫双站，node 20（其余 22，版本不一致） |
| `pages-deploy.yml` | push main | `sed` 改写 SW CACHE_VERSION 为 commit SHA → rsync → `deploy-pages@v4` |

### 2.4 SW 与版本机制

- `sw.js:13` `CACHE_VERSION='snowfluff-v11.7.6'`；install 预缓存 15 项、activate 清旧 `snowfluff-*`。
- fetch 策略：文档 network-first；`dist/*` 缓存优先 + SRI 校验 + SWR；非 dist 的 .css/.js 命中后 `revalidateRuntimeHard` 硬回源自愈（这是 v11.7.2「改了又出现」事故后的补丁）。
- **部署时 `CACHE_VERSION` 被 CI 改为 `snowfluff-<SHA>`**（`pages-deploy.yml:43`），与源码语义版本脱钩；smoke-check 只测源码故漏过，`sed` 无成功断言。
- 版本写死位置共 7 处：package.json、package-lock.json（**两处**）、main.js `__FXRE_API.version`、双站页脚、sw.js、sw-register.js。**当前全部一致 = 11.7.6。**

### 2.5 安全基建

- `_headers:7` CSP：`default-src 'self'`，script 白名单 jsdelivr/unpkg/cdnjs，style 含 `unsafe-inline`，connect 限 `*.supabase.co` + wss。
- **CSP 双轨不均**：`_headers` 仅 Cloudflare Pages 生效；主部署 GitHub Pages 靠 HTML meta，防护等级不等价。
- `security-shield.js`：XSS/SQL 正则、危险 URL scheme 拦截、颜色白名单、prototype pollution 防护、频率限制、localStorage 写拦截；DOM 监控自承认可被内联脚本绕过。
- `upload-manager.js`：MIME+扩展名双校验、**图片魔数校验**；但**允许 `.svg` 上传且仅查前缀**（`forum-upload.js:28,177`）→ 存储型 XSS 风险。
- RLS：7 表启用、约 50 policy、45 处 security definer；`rate_limits` 未见 ENABLE，`content_reports` 函数依赖的表无 CREATE TABLE。

---

## 3. 功能结构与业务流程

### 3.1 双站功能地图

| | 飞行雪绒（主站） | 星炬学院（论坛） |
|---|---|---|
| 独有 | 后台审核面板、书签合集、粒子层、**Web Audio 合成播放器**、secret-portal / 37 次走廊彩蛋、评论关键词彩蛋 | 角色档案柜（3D billboard）、世界观卷宗、聊天室、调谐台、昵称身份、JustValidate 表单 |
| 重复 | 音乐播放器同 id DOM、账号浮层、同步指示器、页脚、举报/软删、投稿与评论 | 同左（且播放器为 `src:""` 空壳） |
| 共享模块 | `app-toast` / `modal-a11y` / `signature-utils` / `security-shield` / `rate-limiter-client` / `donation` / `snow-realm`（两 bundle 均含） | 同左 |
| 明确缺口 | **无搜索入口**、时间格式未统一、无 confetti、Supabase SDK 无本地兜底 | 无用户举报入口、无真实音频、无 R2/Storage 图片（base64 存本地） |

### 3.2 核心业务流程（串起来的实际代码）

1. **认证**：两站各自实现（`AuthManager` vs `StarTorchAuth`），共用同一 Supabase project + 同域 GoTrue session 互通；主站靠 `profiles.role`，论坛靠 `forum_admins` / `is_forum_admin()`。论坛昵称→合成邮箱 `stf_<hash>@startorch.example.com`。
2. **投稿**：主站表单 → `UploadManager`（图片传 Supabase Storage `works` 桶）→ `DataRepository.addSubmission` → `submissions` 表 → `renderCommunityGrid`；论坛 → `StarTorchCloud.pushSubmission` → `forum_submissions`，图片压成 base64 dataURL 存 localStorage/TEXT 字段。**全项目无 R2 调用**（旧记录需更正）。
3. **评论**：发表/回复/点赞/删除（令牌或软删）/举报/软删隐藏；主站有 `is_hidden` 过滤，论坛无举报入口。
4. **同步**：主站 `repository.switchProvider` 本地↔云端，失败入 `fxre_pending_sync` 队列补传，Realtime 断线降级 15s 轮询；论坛默认纯本地，20s 轮询，`stf_cloud_queue` 补传；IndexedDB 另存投稿队列 + Background Sync。
5. **搜索**：仅论坛。`forum.js:379 applySearch` 精确子串优先，0 结果才用 Fuse（keys 权重 0.5/0.25/0.15/0.1，`threshold:0.36`，`ignoreLocation:true`），`!window.Fuse` 降级。`migration-029` 的 SQL RPC 前端未用。
6. **时间**：仅论坛 `forum.js:72 fmtStamp` 用 Day.js 统一为 `YYYY-MM-DD HH:mm`（手写回退）；主站仍是「7月5日 15:30」裸标签。
7. **礼花**：仅论坛 `forum.js:85 celebrate` 懒加载 confetti，reduced-motion 拦截，触发于发帖成功两处。
8. **音乐**：主站真实 Web Audio 合成（AudioContext + 频谱 analyser + 曲目「调频9072」）；论坛纯界面模拟（`src:""` + rAF 假进度）。
9. **彩蛋**：9072 键盘/Logo 五连点（双站独立实现）、37 次走廊、空闲口头禅、评论关键词、SnowRealm 双站 BroadcastChannel、论坛调谐台四位拨盘；「雪臂」是 SVG 视觉、「结契人」是设定标签，非独立彩蛋。

### 3.3 新库融入状态（本轮新增要求的落地核对）

| 库 | 星数 | 状态 | 证据 / 判断 |
|---|---|---|---|
| Fuse.js 6.6.2 | 20.5K | ✅ 已接入论坛 | `forum.js:363-385`，精确优先+兜底，零回归设计正确；锁 6.6.2 因 7.x 无 UMD |
| Day.js 1.11.23 | 48.7K | ✅ 已接入论坛 | `forum.js:72-79`；手写回退保证库挂不掉 |
| canvas-confetti 1.9.4 | 12.8K | ✅ 已接入论坛 | `forum.js:85-97`，按需注入，不挡彩蛋入口 |
| howler.js 2.2.4 | 25.4K | ❌ 死重量 | 全仓零引用，**36KB 从不加载**（不加载就不产生流量），保留为将来音轨预埋 |

**融入缺口**：三库只覆盖论坛，主站搜索/时间/反馈三处仍空。建议按「论坛验证有效 → 移植主站」推进，但主站无搜索入口属产品决策（电台人设是否需要搜索），应先拍板再接。

### 3.4 已装 4 个审美 Skill（本轮新增资产）

`taste-skill` / `impeccable`（升级至官方 4.9.2）/ `diagram-design` / `hallmark` 已装为用户级 skill。`design.md §0` 已把反 AI 味要求固化为 Agent 入口必读。

**批判性提醒**：这些 Skill 和 `redesign/refined.css` 都大量使用 `oklch()` 定义令牌，而**用户浏览器不支持该函数**——设计文档与运行时之间存在未标注的兼容断层。Skill 产出若直接落 CSS，必须人工降级为 hex/rgba。

---

## 4. 数据与文件关系

### 4.1 数据后端

- `DataRepository`（`js/repository.js:18,41,89`）默认 localStorage，`initCloud()` 成功切 Supabase，15s 超时回退，云端失败双写+队列补传。
- Supabase URL 与 anon key **硬编码于两处**（`supabase-adapter.js:17` / `forum-supabase.js:18`），无环境注入、无 project 隔离。
- 12 张业务表（profiles / comments / submissions / rate_limits / moderation_logs / tags 系列 4 张 / forum_submissions / forum_comments / forum_admins / forum_chat / performance_metrics）；RPC 覆盖 search / likes / moderation / delete-with-token / rate-limit / report。

### 4.2 本地存储与版本闸门

- 主站 `fxre_*` 14 类 key，论坛 `stf_*` 9 类；两套 seeds / comments / submissions 语义重复。
- 版本闸门：`SEED_VERSION='v10.1'`（`main.js:2194`）与 `repository.js:925 exportData` 元数据写死 `v7.8` 与仓库 v11.7.6 **三者漂移**。
- `exportData/importData` 已实现但无 UI 入口，且导入去重按 `e.author` 取值而对象是 `name`（`repository.js:944`）→ **导入功能实际有 bug**。

### 4.3 内容数据链路与五处副本

```
论坛内容/二创内容库/*.md (10 份)
   → build-forum-import.cjs → forum-import-data.js (416KB, 6 行)
   → forum-data.js 合并 → stf_submissions
   → migration-024-*.sql (imp_ 前缀，声称 573 条) → 云端
```

同一帖子（如「第三个符文」「来自黑海岸的信号」）同时出现在：① `index.html` timeline 内联 HTML ② `main.js SEED_SUBMISSIONS` ③ `forum-data.js SEED_SUBMISSIONS` ④ `forum-import-data.js` ⑤ `migration-024`。主站 timeline/diary 甚至不是 JS 数组而是 HTML `<article>`。

**这是当前最大的维护陷阱**：改一条内容要同步五处，且无自动化校验；`forum-import-data.js`（8 月生成）与 `forum-data.js`（11 月）版本已脱节。

### 4.4 文件依赖地图

| 目录 | 体量 | 定性 |
|---|---|---|
| assets | 15 文件 ~10MB | 必需（二维码/og 图占绝大部分） |
| 论坛内容 | 50 文件 ~2.9MB | 源稿，不入 git |
| dist | 37 文件 ~2.3MB | 产物；含 Phase1 陈旧副本 |
| vendor | 30 文件 ~1.7MB | 必需（supabase.min.js 211KB） |
| forum | 21 文件 ~1.15MB | 必需（import-data 408KB） |
| db / js / css | 632KB / 506KB / 421KB | 必需 |
| docs | 26 文件 217KB | 文档 |
| **opc-doc** | 17 文件 211KB | **与站点无关**（Python 生成创业分析报告 docx） |
| **presentations** | 空目录 | 孤儿 |
| 稿件 | 2 文件 14KB | **私人目录，git 未跟踪，禁止纳入提交** |

孤儿/可疑：`forum/js/forum-supabase.js` 未被 bundle 清单或 HTML 引用（但 adapter 可能被 loader 间接用到，删前需核实）；`dist/*.map`、`CODE-WIKI.md`(49KB)、多份历史项目汇报为归档。

---

## 5. 技术风险清单（分级）

### P0 — 会静默造成线上故障

| ID | 风险 | 证据 | 后果 | 建议 |
|---|---|---|---|---|
| P0-1 | **论坛 SRI 自动回填失效** | `build-phase2.mjs:279` 正则要求 `bundle-forum.js"` 紧跟引号，但 `forum/index.html:1363` src 带 `?v=11.7.6-place`；实测匹配数 main=1 / forum=0；`:368` 校验被 `if(forumUpdated)` 跳过 | 下次改论坛 JS 重建后 integrity 不更新 → **浏览器拒绝执行 → 论坛白屏，CI 全程无感**。`4b1ffd7` 的手工回填正是此缺陷的事故记录 | 正则放宽为 `[^"]*bundle-forum\.js[^"]*`，并改为「匹配数为 0 即构建失败」；把 `?v=` 串纳入 smoke-check |
| P0-2 | **部署 SW 版本脱缰** | `pages-deploy.yml:43` sed 改 CACHE_VERSION 为 SHA，脱离 `snowfluff-vX` 语义；无成功断言 | 缓存失效口径在源码与产物间分裂；正则一变静默失效，回到「改了没生效」老坑 | 改用源码版本号注入；sed 后加 `grep -q` 断言失败即退出 |
| P0-3 | **主站 Supabase SDK 仅 CDN** | `js/supabase-loader.js:7` 只从 jsdelivr 加载，无 fallback（`vendor/supabase.min.js` 存在但主站不用；论坛有四级降级链） | CDN 故障/离线 → 主站云端功能全瘫，无本地兜底 | 移植论坛的 `jsdelivr → unpkg → 本地 supabase.min.js → 纯本地` 降级链 |

### P1 — 数据完整性与安全

| ID | 风险 | 证据 | 建议 |
|---|---|---|---|
| P1-1 | 同实体 5 处内容副本、无校验 | §4.3 | 选定单一源（建议 md 源），其余改为构建生成；加 checksum 门禁 |
| P1-2 | 版本标识三处漂移（v10.1/v7.8/v11.7.6） | §4.2 | 统一从 package.json 读取，禁止硬编码 |
| P1-3 | `importData` 去重字段 bug | `repository.js:944` `e.author` vs 对象 `name` | 修正字段并提供 UI 入口与备份提醒 |
| P1-4 | SVG 上传仅查前缀 | `forum-upload.js:28,177` | 服务端/客户端统一禁 SVG 或完整解析后白名单化 |
| P1-5 | `content_reports` 函数依赖表缺失、`rate_limits` RLS 未见 | migration 012 / 002 | 补建表与 RLS，加迁移完整性测试 |
| P1-6 | 软删/硬删语义混用 | 006 软删 → 017 物理删 → 020 论坛保留 is_hidden | 统一删除语义并文档化，避免 Realtime 广播与历史记录冲突 |
| P1-7 | 时间戳双格式靠 `isSeedLabel` 猜测 | `repository.js:160,643` | 全链路 ISO + 展示层 Day.js 格式化 |

### P2 — 维护性与架构

| ID | 风险 | 建议 |
|---|---|---|
| P2-1 | 双套 Auth/sync/upload/彩蛋，靠注释「勿大重构」维系 | 抽公共内核，站点层只留配置（见 §9 阶段 2） |
| P2-2 | 论坛播放器 `src:""` 空壳 + 同 id DOM | 按分工要么删、要么接真实音频；空壳是 AI-slop 指纹 |
| P2-3 | 主站无搜索、时间未统一、无 confetti | 先拍板产品口径再决定是否移植，不为「对称」而对称 |
| P2-4 | CSS 覆盖层不进 bundle、无统一 SRI、缺自动 `-webkit-` | 纳入构建链或至少加独立校验门禁 |
| P2-5 | CSP 双轨不均（Pages meta vs CF _headers） | 统一为 HTML meta 权威 + CF 同步，或反之；明确单一事实源 |
| P2-6 | howler 36KB 死重量 + 4 个未引用 CSS 变体 | 清理或显式标注预埋 |
| P2-7 | Phase1 陈旧副本随部署、accessibility node 版本不一致 | 停止部署 dist/js 副本；统一 node 20/22 |

---

## 6. 维护性与扩展性评估

| 维度 | 评分 | 说明 |
|---|---|---|
| 模块边界 | 5/10 | 双站同构实现 + 注释约定，改一处要记得改两处 |
| 构建可重复性 | 7/10 | 门禁齐全但 SRI 回填有洞、dist 副本陈旧 |
| 数据可迁移性 | **3/10** | 五处内容副本、双前缀、导入 bug、无可靠备份入口 |
| 文档完备度 | 8/10 | 22 份 docs + CODE-WIKI + design.md，但结论散落、版本口径滞后 |
| 单人可持续 | 5/10 | 工程化质量高，但债务复利已开始吃掉迭代速度 |
| 新功能扩展成本 | 6/10 | 加展示型功能快；加跨站一致功能（如搜索）需双实现 |

**总评**：工程质量在个人同人站里属于上游（门禁、SRI、RLS、RUM 一应俱全），问题不在"写得差"而在"**历史补丁层层叠加、缺乏收敛**"。下一阶段收益最高的不是新功能，而是**收敛和去重**。

---

## 7. 桌面端独立程序可行性评估【重点】

### 7.1 已有决策台账（三次结论一致）

| 时间 | 文档 | 结论 |
|---|---|---|
| 2026-08-11 | `TECH-SELECTION-REPORT.md` | 桌面 **3.2/10 ❌不推荐**；15-20 人天；仅桌面用户、无 SEO/分享、需自建更新分发 |
| 2026-11-14 | `PRODUCT-SPLIT-2026-11-14.md` | 独立壳**不能自动变精致**；Tauri = 同 WebView + 可安装窗口；「Web 场所感先成立 → 再套最小 Tauri」 |
| 2026-11-14 | `DESIGN-STANDARDS-2026-11-14.md` | Tauri 包 1-10MB / Electron 80-200MB；**Windows 空闲内存 WebView2 ≈ Chromium（~140MB）**；真瓶颈是大种子 DOM、多 bundle、陈旧 SW、无限动画 |

### 7.2 桌面化真实收益 vs 代价

| 收益 | 实际价值 | 代价 / 反驳 |
|---|---|---|
| 任务栏 / 可安装 | 中 | PWA manifest 已有，浏览器"安装到桌面"即可获得，零成本 |
| 离线访问 | 中 | **主站 SDK 仅 CDN（P0-3）**，离线直接不可用；真要离线得先修云端降级链 |
| 少浏览器 chrome | 低 | Tauri 仍用 WebView2（同 Chromium 内核），内存不省 |
| 本地文件访问 | 低 | 本项目图片走 Supabase Storage，无本地文件场景；导出/备份是更真实的需求 |
| 系统通知 | 低 | 社区站点非刚需，Web Push 未实现是因为用户不在线价值低 |
| 更精致 / 更 3D | **零** | 同一套 HTML/CSS/JS，壳不改变渲染；3D 效果来自档案柜设计而非壳 |
| 分发与更新 | **负收益** | 需自建 updater + 签名（Windows 证书 ¥200+/年）；失去 URL 分享与 SEO，同人站传播漏斗被砍 |

### 7.3 代码级阻塞清单（本报告新增，已有文档未覆盖）

即便决定做 Tauri，以下不能靠"套壳"自动解决，必须逐项改造：

1. **CDN 硬依赖**：主站 Supabase SDK 仅 jsdelivr（`supabase-loader.js:7`）、Three.js 三 CDN fallback（`particles.js:344-346`）、字体 CDN。Tauri 的 CSP 是 `tauri.conf.json` 独立配置，与现有 HTML meta / `_headers` **三套并存**，需重新对齐白名单。
2. **SW 与 Tauri 资源协议冲突**：Tauri 用 `tauri://localhost` 自定义协议并提供原生资源缓存，现有 SW 的 `dist/*` SRI 校验、`cache:'reload'` 硬回源自愈、CI 注入 SHA 版本这套机制在桌面构建里要重写或整体禁用——否则 double cache + 版本口径分裂。
3. **跨窗口/跨站同步**：SnowRealm 用 `BroadcastChannel` 在主站与论坛间同步（`snow-realm.js`），前提是同源两个标签页。Tauri 多窗口是否同源、`window.location` 路由变化、外链跳浏览器都需重测。
4. **认证域与 OAuth**：GoTrue 的 persistSession 依赖同域 cookie/localStorage；桌面壳的 origin 与线上不同，现有 session 互通与匿名升级流程要重验。
5. **CSP 三轨**：HTML meta / CF `_headers` / Tauri config，任一处漏配即功能静默失效。
6. **更新分发**：Tauri updater 需签名密钥 + 托管 endpoints + 版本 JSON；个人项目要多维护一条发布流水线，与"push 即生效"的现有优势直接冲突。
7. **体积与构建矩阵**：Tauri 需 Rust 工具链 + WebView2 打包 + 三平台构建；本机已确认 Node 无法 spawn 子进程（历史限制），本地构建可能直接受阻，需 CI 代做。
8. **70% 复用是乐观值**：前端 DOM/CSS 可复用，但 SDK 加载、SW、CSP、认证域、构建分发五处必须重写，实际新增工作量接近文档估算上限（15-20 人天）。

### 7.4 三条路径对比与建议

| 路径 | 成本 | 获得 | 失去 | 判定 |
|---|---|---|---|---|
| A. 现状 Web + 现有 SW/PWA | 0 | 全部现有能力、即时更新、URL 分享 | 无真正离线、无任务栏图标 | ✅ **继续** |
| B. 最小 Tauri 壳（打包现有产物） | 15-20 人天 + 签名 | 任务栏、安装包、可离线（需先修 P0-3） | 分享/SEO、即时更新、多一套构建与 CSP | ⏸ **条件性：仅在明确桌面刚需且 P0/P1 清理后** |
| C. Electron | 更高（80-200MB 包） | 同 B + Node 全权 | 内存更大、无新增场景 | ❌ **不选** |

**最终判定**：桌面端**技术可行、战略不成立**。推荐路径是 **A 继续 + 条件性保留 B**：先完成 §9 阶段 0/1（修 P0、收敛数据），再评估是否存在"用户明确要求离线/任务栏"的真实需求；若有，按 B 的最小壳路径落，且**不把它当作提升精致度或 3D 的手段**——这与 11-14 已冻结的结论完全一致，本报告只是补齐了代码级证据。

---

## 8. 新旧要求统一台账

| 类别 | 要求 | 来源 | 当前状态 |
|---|---|---|---|
| 产品 | 双站听/感 vs 查/议，禁止镜像 | PRODUCT-SPLIT-11-14 | ✅ 文案/视觉已落；功能层未精简 |
| 产品 | 场所隐喻（展柜/卷宗/布告栏），拒绝同款圆角卡 | PRODUCT-SPLIT / UPGRADE-GAP | ✅ 已落 CSS 结构，材质仍薄 |
| 视觉 | 玫白蓝三色、禁紫蓝渐变、禁毛玻璃 | 长期约束 | ✅ 基本守住 |
| 兼容 | 禁 `color-mix()` / `oklch()` 用于可见样式 | 用户浏览器实测 | ⚠️ design.md/新 Skill 仍有 oklch 令牌，需人工降级 |
| 红线 | sn-footer + 彩蛋全集 + `#stf-hidden-trigger` 不得删 | design.md §0 | ✅ 保持 |
| 部署 | 改 HTML/覆盖层 CSS 必 bump SW 版本 | v11.7.2 事故 | ⚠️ 依赖人工；CI 又改为 SHA，口径分裂 |
| 部署 | 禁止跑 `更新GitHubPages.bat`（`git add -A` 会提交「稿件/」+ 写死旧 message） | 10-21 记录 | ✅ 已遵守；git 现全同步 |
| 工程 | 版本 7 处一致、smoke-check 断言 | smoke-check | ✅ 当前 11.7.6 全一致 |
| 新增 | 4 个高星库下载 + SRI + manifest | 10-21 扫描 | ✅ 完成 |
| 新增 | Fuse/Day.js/confetti 融入论坛 | 11-14 提交 d5b0a21 | ✅ 完成且质量良好 |
| 新增 | howler 暂不接入（音乐为合成、无音轨） | 融入方案 | ✅ 正确决策，保留预埋 |
| 新增 | 4 个审美 Skill 安装（taste-skill / impeccable 升级 / diagram-design / hallmark） | 11-18 安装 | ✅ 完成；impeccable 列表缓存待重启会话刷新 |
| 新增 | 桌面端独立程序评估 | 本次要求 | ✅ 本报告 §7：技术可行、战略不成立、条件性保留 |
| 待拍板 | 主站是否加搜索 / 时间是否统一 / 是否移植 confetti | 融入方案遗留 | ⏸ 产品口径未定，不擅自接 |
| 待拍板 | 主站投稿区与论坛发帖是否二选一 | UPGRADE-GAP:38 | ⏸ 分工已定，功能未精简 |

---

## 9. 问题清单（按处置优先级）

| # | 问题 | 优先级 | 类型 |
|---|---|---|---|
| 1 | 论坛 SRI 回填失效 → 白屏风险 | **P0** | 静默故障 |
| 2 | 部署 SW 版本脱缰 + sed 无断言 | **P0** | 静默故障 |
| 3 | 主站 Supabase SDK 无本地兜底 | **P0** | 可用性 |
| 4 | 内容五处副本、无单一事实源 | P1 | 数据完整性 |
| 5 | 版本标识三处漂移 + importData bug | P1 | 数据完整性 |
| 6 | SVG 上传 XSS / 缺表 / 缺 RLS | P1 | 安全 |
| 7 | 软硬删混用 + 时间戳双格式 | P1 | 数据一致性 |
| 8 | 双套 Auth/sync/upload 未收敛 | P2 | 维护性 |
| 9 | 论坛空壳播放器 + 主站无搜索 | P2 | 产品一致性 |
| 10 | CSS 覆盖层脱管 + CSP 三轨 + Phase1 陈旧副本 | P2 | 工程卫生 |
| 11 | howler 死重量 + opc-doc/presentations 归档混入 | P2 | 清理 |
| 12 | Skill 的 oklch 令牌与用户浏览器不兼容 | P2 | 设计-运行时断层 |

---

## 10. 重构建议（分阶段，可独立验收）

### 阶段 0：止血（P0，建议立刻做，1 天内）

1. 修 `build-phase2.mjs` 的 SRI 正则，匹配数 0 即 `process.exit(1)`；把 `?v=` 串纳入校验。
2. `pages-deploy.yml`：CACHE_VERSION 改由版本文件注入，sed 后加 `grep -q` 断言。
3. 主站 `supabase-loader.js` 移植论坛四级降级链；把 HTML 里 `?v=11.7.6-place` 改为真实版本变量。
4. 补一次「改论坛 JS → build → 校验两边 integrity 自动更新」的回归验证。

### 阶段 1：数据收敛（P1，2-3 天，收益最大）

5. 确立 `论坛内容/*.md` 为内容单一源，`index.html`/SEED/`forum-import-data.js`/migration-024 全部改为构建生成；加内容 checksum 门禁。
6. 统一版本源为 `package.json`，删除 SEED_VERSION / exportData 元数据里的硬编码。
7. 修 `importData` 的 `e.author` bug；补一个显式「导出备份」入口（用户数据可带走）。
8. 补 `content_reports` 建表 + `rate_limits` RLS；禁 SVG 上传或做完整白名单。
9. 统一删除语义与时间戳格式（全链路 ISO，展示层 Day.js）。

### 阶段 2：结构收敛（P2，可选，需单独排期）

10. 抽 `auth-core` / `sync-core` / `upload-core` 公共内核，站点层只保留配置与文案；**必须保留双站文案岔开**。
11. 论坛空壳播放器：按分工决定删或接真实音频（if 接，howler 此时才启用）。
12. CSS 覆盖层纳入构建校验；统一 CSP 为单一事实源；停止部署 Phase1 陈旧副本。

### 阶段 3：桌面壳（条件性，不在当前路线）

13. 前置条件：阶段 0/1 完成 + 用户明确提出离线/任务栏刚需。
14. 按 §7.3 清单逐项改造，走最小 Tauri，不追求 Electron；不把壳当精致度或 3D 方案。
15. 若仅为"桌面有图标"：优先 PWA 安装，成本 0。

### 明确不做

- 不为对称性给主站硬加搜索/礼花（先拍板产品口径）。
- 不在当前阶段做 Electron / 框架迁移 / 全站 WebGL。
- 不动「稿件/」私人目录；不跑 `更新GitHubPages.bat`。

---

## 11. 结论

项目当前处于**「工程基建成熟、产品分工清晰、但数据层与构建链存在静默债务」**的状态。v11.7.6 的双站场所感落地是正确方向，新库的融入质量也经得起代码核对；真正威胁可持续性的是 P0 级的三处静默失效与 P1 级的数据多源漂移——它们不报错、不阻塞迭代，但会在某次普通重建后突然变成白屏或数据错乱。

**桌面端独立程序**：已有三次决策一致指向"先 Web 后壳"，本报告补充的代码级证据进一步说明，套壳至少要重写 SDK 加载、SW、CSP、认证域、分发五处，且失去 URL 分享这一同人站的生命线。**建议维持 Web 路线，把桌面化作为满足条件后的可选项而非当前目标**。

最高性价比的下一步：**修 P0 三处 → 收敛内容单一源 → 再谈功能扩展或桌面壳**。

---

*本报告基于 v11.7.6 磁盘实际状态生成，未修改任何项目代码或配置。证据均可按文中文件名/行号复核。*
