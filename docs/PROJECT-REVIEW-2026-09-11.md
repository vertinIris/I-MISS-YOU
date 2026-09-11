# 飞行雪绒 · Snow 项目全面审查汇报

> 审查日期：2026-09-11
> 审查人：Senior Developer（AI 协作）
> 审查范围：整体架构 / 部署链路 / 代码与质量门禁 / 运行态 / 历史正式记录交叉核对
> 方法：源码静态审查 + Git 历史核对 + 线上资产抓取（临时放行 hosts 屏蔽的 github.io）+ 历史文档（需求/选型/决策/诊断/审计）交叉比对
> 依据文档：`TECH-SELECTION-REPORT.md`、`DEPLOYMENT-DECISION-MATRIX.md`、`STATUS.md`、`STATUS-AUDIT-2026-09-08.md`、`QA-RUNTIME-REPORT-2026-09-07.md`、`DIAG-REPORT-2026-09-10.md`、`CI-ROOTCAUSE-2026-09-09.md`、`ZONE-CONFIG-2026-09-11.md`

---

## 〇、审查结论摘要（TL;DR）

| 维度 | 结论 |
|---|---|
| 项目定位 | ✅ 清晰的零预算同人项目，Web 方案选型合理且论证充分 |
| 功能完成度 | ✅ 核心功能（内容/评论/论坛/音乐/账户/后台）已可用，09-07 三个 P0 已修复 |
| 质量门禁 | ✅ CI 三段门禁（smoke+audit / runtime-assert / dist-sync）健全 |
| **部署现状** | ⚠️ **重大偏差**：决策推荐 Cloudflare Pages，实际仅 GitHub Pages 单一部署，大陆访问慢痛点未解 |
| 韧性架构 | ⚠️ 决策中"双部署并行"未实现，单点失效风险 |
| SW 缓存治理 | ⚠️ 历史反复出事（v11.3.1/11.3.2/11.5.x），当前靠 CI 注入缓解但仍靠人工兜底 |
| 工程债 | ⚠️ eslint peer 冲突、179 未用变量、字体 16MB 未子集化、配置冗余 |
| 文档 | ⚠️ STATUS/README 部分滞后于 v11.5.x 实际状态 |

**总体判断**：项目处于"功能可用、质量门禁健全、但部署与韧性偏离既定方案、存在若干长期工程债"的状态。无阻断性故障，但有 1 项需要决策层拍板的部署偏差（影响全部大陆用户的访问体验）和多项错误修正项。

---

## 一、项目概览与现状

### 1.1 项目定位（来自 `TECH-SELECTION-REPORT.md`）

- **性质**：《鸣潮》角色"爱弥斯/飞行雪绒"的同人社交体验站，非官方、非商业。
- **硬约束**：零预算、单人维护（作者 VertinIris）、已有 Supabase 后端（31+ migration）+ 完整原生前端。
- **核心需求**：内容展示(R1)、社区互动(R2)、用户系统(R3)、实时同步(R4)、多媒体(R5)、管理(R6)，以及零预算(R7)/低维护(R8)/即时更新(R9)/跨平台(R10)。
- **技术选型结论（v1.0，2026-08-11）**：维持 **Web Application（HTML/CSS/原生 JS + Supabase）**，附 PWA 渐进增强。**明确不做** 移动原生/混合/桌面/框架迁移。

> 选型论证扎实（成本收益比、转化漏斗、资产复用、行业 95%+ 选 Web），结论至今仍然成立，无偏离。

### 1.2 当前版本与运行态

- **对外版本**：`v11.5.1`（package.json / `window.__FXRE_API.version` / 页脚 / sw.js CACHE_VERSION 基线）。
- **代码规模**（依据记录）：主站 18 个 JS 模块（阶段 II 合并为 1 个 bundle）+ 论坛 15 个模块；CSS 12 个文件压缩为 `main.min.css` 等；31+ SQL migration（至 030，含 web-vitals RUM）。
- **构建产物**：`dist/bundle-main.js`（SRI 保护）、`dist/css/main.min.css`。CI 在 push 时由 `scripts/build-phase2.mjs`（terser + csso + 自动回写 SRI）重建。
- **后端**：Supabase（Auth/DB/Realtime/Storage/RLS），硬删(017)+profiles nickname(027)+论坛置顶(028) 等 Production 已确认执行。
- **线上资产核对（本次抓取）**：`https://vertiniris.github.io/I-MISS-YOU/dist/css/main.min.css` 返回 200，且已包含 09-11 布局修复（`.hero` 的 `padding:80px 24px 120px`、页脚 4 列网格、`document.body.appendChild` 同步挂载）——**修复确已在线生效**。

### 1.3 部署现状（⚠️ 与决策存在重大偏差）

| 项 | 既定决策（2026-08-11） | 当前实际 |
|---|---|---|
| 主部署平台 | **Cloudflare Pages**（决策矩阵"选项 A 推荐"，解决大陆 800ms+ 痛点） | **GitHub Pages 单一**（`https://vertiniris.github.io/I-MISS-YOU/`，由 `pages-deploy.yml` 启用） |
| 大陆加速 | Cloudflare 优选 IP：50–100ms | 未实现；GitHub Pages 大陆 TTFB 800ms+ |
| 备用/双部署 | "GitHub Pages 永久备用 + CloudBase" | 仅 GitHub Pages 单点 |
| 配置残留 | — | 仓库内仍保留 `wrangler.toml`(Cloudflare)、`pages.config.json`(CloudBase/Tencent) 两份**死配置**；`package.json` homepage 仍写 `https://i-miss-you-bcu.pages.dev/` |

**偏差事实链**：
1. `DEPLOYMENT-DECISION-MATRIX.md` 明确"推荐选项 A（Cloudflare Pages），核心理由是解决大陆访问慢这一核心痛点"。
2. 但 Cloudflare 域名 `i-miss-you.pages.dev` 已被陌生"Silence"项目占用（历史排查记录），无法归属本项目；CloudBase 亦未实际启用。
3. 最终通过 `pages-deploy.yml` 首次运行自动启用 **GitHub Pages** 作为生产环境——即决策中的"选项 B（GitHub Pages，大陆慢、核心痛点未解决）"。
4. 仓库内 `wrangler.toml` / `pages.config.json` / package.json homepage 仍指向已失效的 Cloudflare/CloudBase 域名，**形成误导性的死配置**。

**影响**：作为目标用户主力的中国大陆玩家访问体验未达决策预期，且存在 16MB 字体未子集化（L-02）进一步放大弱网加载成本。

### 1.4 质量门禁现状

`.github/workflows/` 含四套：

| 工作流 | 作用 | 状态 |
|---|---|---|
| `static-checks.yml` | smoke-check+extreme-audit / runtime-assert(无头Chrome真实执行JS后断言DOM) / dist-sync(重建并 `git diff --exit-code` 拦截"改源码忘构建") | ✅ 健全，三层门禁 |
| `pages-deploy.yml` | 重建 dist + 注入 SW 部署号 + 上传 GitHub Pages 产物 | ✅ 自动部署 |
| `accessibility.yml` | axe-core WCAG 2.1 AA，critical/serious 阻断 | ✅ |
| `lighthouse.yml` | a11y≥0.9 阻断，性能/SEO warn | ✅ |

可选 `browser-probe`（Playwright 真实浏览器回归）需仓库变量 `PLAYWRIGHT_PROBE=1` 才启用，目前未开启。

---

## 二、完成进度（对照既定方案）

### 2.1 功能完成度

| 模块 | 状态 | 证据 |
|---|---|---|
| 首屏/导航/动态时间线 | ✅ | 09-07 实测 7 帖正常 |
| 角色日志 | ✅ | 09-07 实测 6 条正常 |
| 评论系统（含 XSS 防护） | ✅ | 09-07 实测 81 条可提交、注入未执行 |
| 音乐播放器 | ✅ | 进度推进、唱片/磁带机联动正常 |
| 社区投稿（听众来信） | ✅ 已修复 | P0-1 于 09-07 修复（卡片渲染 + 防 DOM 泄漏） |
| 管理员后台 | ✅ 已修复 | P0-2 于 09-07 修复（入口常驻 + 登录即开） |
| 账户/投稿升级 | ✅ 已修复 | P0-3 于 09-07 修复 |
| 论坛（列表/分页/聊天/搜索） | ✅ | 09-07 实测 8 条/页、聊天面板可开 |
| 实时同步（SyncManager） | ✅ 已修复定位 | 09-11 `2124b89` 将指示器挂回 `body`，破除 nav 包含块 |
| 界面布局（页脚/hero 旋钮） | ✅ 已修复 | 09-11 `2124b89` + `7517657` |

### 2.2 质量/安全/性能演进

- **安全加固（v10.1）**：移除 `script-src 'unsafe-inline'`、内联脚本外提、CSP/HSTS/`_headers`、XSS 服务端 trigger。
- **a11y/监控**：axe-core CI、web-vitals RUM（migration-030）。
- **性能**：bundle 146KB（论坛）、主站 3 请求、Lighthouse a11y≥0.9。
- **SRI 自动化**：`build-phase2.mjs` 自动回写 integrity，消除"手动 SRI 维护炸弹"（commit `b0ad948`）。

### 2.3 近期修复里程碑（2026-09-07 → 09-11）

| 日期 | 提交 | 内容 |
|---|---|---|
| 09-07 | `f6b8cae` | 修 3 个 P0（投稿渲染/DOM 泄漏、后台不可达、账户升级）+ 5 处 404 + SW 版本统一 → v11.5.1 |
| 09-08 | `349f974` | 现状复核 + CI 加固（版本一致性断言、本地引用扫描） |
| 09-09 | `e69b139` | CI 根因修复（ERESOLVE → `--legacy-peer-deps` + 门禁收窄） |
| 09-10 | `ed6c405` | 启用 GitHub Pages 自动部署工作流 |
| 09-10 | `78a3af0` | 界面错位布局修复（根布局上下文 + 导航预留） |
| 09-11 | `641a6d6` | S-01/S-02/S-03/M-01/M-03/M-05/L-01/L-04 全量落地（reveal 兜底、SW network-first、init 容错、断言增强） |
| 09-11 | `2124b89` | 分区布局：同步指示器归位、hero 旋钮间距、页脚隔离 |
| 09-11 | `7517657` | SW 缓存版本升 `v11.5.2-layout-fix` 强制失效旧缓存 |

---

## 三、已识别风险与问题（按优先级）

### P0 — 阻断/决策级

| 编号 | 问题 | 影响 | 证据 |
|---|---|---|---|
| **P0-D1** | **部署平台偏离决策且大陆访问慢未解决** | 大陆目标用户体验降级，与选型"核心痛点"直接冲突 | 见 §1.3 |

### P1 — 高优先级（应近期处理）

| 编号 | 问题 | 影响 | 证据/来源 |
|---|---|---|---|
| P1-1 | **部署配置冗余/死配置**（`wrangler.toml`、`pages.config.json`、package.json homepage 指向失效域名） | 误导维护者，部署意图不清 | 本次核查 |
| P1-2 | **SW 缓存版本仍靠人工 + CI 注入双轨**，committed `sw.js` 的 CACHE_VERSION 为占位符，无一致性校验；历史 v11.3.1/11.3.2/11.5.x 反复出 SW 事故 | 每次改样式都需手动 bump 才能清缓存，否则用户长期看到旧版 | STATUS-AUDIT P2-5；git 历史；DIAG S-02 |
| P1-3 | **179 个 `no-unused-vars` 警告** | 掩盖真实问题，lint 信号噪声大 | STATUS-AUDIT P1-3；eslint 仍 `--legacy-peer-deps` |
| P1-4 | **eslint@^9 与 @eslint/js@^10 peer 冲突**，裸 `npm install` 必 ERESOLVE，全 CI/本地依赖 `--legacy-peer-deps` | 构建脆弱，新人/新环境易踩坑 | CI-ROOTCAUSE；package.json |
| P1-5 | **`dist` 与源码仍可能失步**（虽有 dist-sync 门禁拦截，但属"事后失败"而非"事前防呆"） | 改源码忘构建会被 CI 退回，但浪费一轮 CI | STATUS-AUDIT P1-2 |

### P2 — 中优先级（规划项）

| 编号 | 问题 | 来源 |
|---|---|---|
| P2-1 | 字体 ~16MB 全量无子集（noto-serif 8MB / noto-sans 5.5MB / zcool 2.5MB） | DIAG L-02 |
| P2-2 | 低性能模式开关（8 层 fixed 背景 + canvas 粒子同屏，低功耗设备 GPU 压力） | DIAG L-03 |
| P2-3 | 账号面板 input 未包 `<form>` + autocomplete（4× 控制台告警） | DIAG L-05 |
| P2-4 | main.js(4700+行)/style.css(6600+行) 单文件，按域拆分 | DIAG L-06 |
| P2-5 | `package.json` 含可疑依赖 `"ters": "^0.0.0-concept-pre-alpha.4"`（疑似误加/废弃包） | 本次核查 |
| P2-6 | 文档陈旧：STATUS/README/CODE-WIKI 未覆盖 v11.5.x 社区渲染重构、后台入口、部署变更为 GitHub Pages | STATUS-AUDIT P2-6 |
| P2-7 | 可选 `browser-probe` 未启用（`PLAYWRIGHT_PROBE` 未设），真实浏览器端到端回归缺位 | static-checks.yml 注释 |

### P3 — 资源/环境约束（客观限制，需纳入决策）

- **本机无可用浏览器**（无 Chromium / Playwright / puppeteer），本地只能依赖 CI 的 `runtime-assert`(无头 Chrome) 做运行时验证，无法在本地做像素级/交互级回归截图。
- **本机 hosts 屏蔽 github**（约 27 行），审查/抓取线上需临时注释并事后恢复，推送需 D 盘 Git + wincred + 关闭 SSL 吊销检查，流程脆弱。
- **单人维护 + 无 Codex 双轮评审**：靠 smoke+extreme+落盘评审文档替代（STATUS 已记录替代闭环）。
- **零预算**：所有方案须 ¥0。

---

## 四、与既定方案的偏差（重点）

### 偏差 D1 — 部署平台（决策 → 实际）⚠️ 最重要

- **决策**（DEPLOYMENT-DECISION-MATRIX，2026-08-11）：选项 A Cloudflare Pages 为推荐项，明确"解决核心痛点（大陆访问慢）"。
- **实际**：Cloudflare 域名被占、CloudBase 未启用，生产落到 GitHub Pages（决策中的选项 B，自评"大陆速度无改善，核心痛点未解决"）。
- **性质**：**方案级偏离**，且偏离到了决策文档 itself 否定的选项。
- **建议**：见第五节 R1。

### 偏差 D2 — "双部署并行"韧性未实现

- **决策**（TECH-SELECTION 风险策略 1）：GitHub Pages + CloudBase 双部署并行，任一故障另一可用。
- **实际**：仅 GitHub Pages 单点。CloudBase/Cloudflare 均未激活。
- **性质**：韧性目标未达成，单点失效风险（GitHub Pages  outage → 全站不可达）。
- **建议**：R2。

### 偏差 D3 — SW 缓存版本治理

- **决策隐含**：历史 v11.3.x 已多次栽在 SW（git 历史 `e42b6e7`/`b6f0f01`/`d4d709b` 均为 SW 修复），决策风险 W4 列明"SW 缓存过期"。
- **实际缓解**：`pages-deploy.yml` 在部署时 `sed` 注入 `snowfluff-${GITHUB_SHA:0:8}` 强制每次部署 SW 更新——**该缓解实际生效于部署产物**（artifact 含注入后版本）。但 committed `sw.js` 的 CACHE_VERSION 仍为手工占位符 `snowfluff-v11.5.2-layout-fix`，且无任何门禁校验 sw.js 版本与构建一致性。
- **性质**：功能正确但治理不透明、靠人工，与 STATUS-AUDIT P2-5 预警一致。
- **建议**：R3（将 SW 版本纳入 CI 一致性断言，消除"手工 bump"依赖）。

### 偏差 D4 — "无打包管道"文档与事实不符

- **STATUS.md** 仍写"静态站无打包管道；暂缓 terser/minify"。
- **实际**：`scripts/build-phase2.mjs` 已实现 terser+csso+SRI 自动回写，CI 全程使用。
- **性质**：文档滞后（信息偏差，非功能问题）。
- **建议**：R6。

### 偏差 D5 — 文档版本标注滞后

- README/STATUS 索引未及时反映 v11.5.x 的社区渲染重构、后台入口改造、部署平台变更（GitHub Pages）。
- **性质**：可维护性风险（新维护者误判现状）。
- **建议**：R6。

---

## 五、后续改进建议（按优先级）

### R1（决策级，需用户拍板）— 解决部署偏差 D1
- **选项 α**：重新夺取 Cloudflare 部署（换项目名避开被占的 `i-miss-you.pages.dev`，如 `snowfluff.pages.dev`），落实决策矩阵推荐，根治大陆慢。
- **选项 β**：若 Cloudflare 不可行，启用 **CloudBase（腾讯云）** 大陆加速（仓库已有 `pages.config.json` 雏形），并把 GitHub Pages 保留为备用 → 同时满足 D1+D2。
- **选项 γ**：接受 GitHub Pages 单点，但**清理所有失效域名/死配置**（P1-1），并在文档中明确"已知大陆慢为权衡结果"。
- 无论选哪项，先删 `wrangler.toml` / `pages.config.json`（或激活其一），并修正 `package.json` homepage，消除误导。

### R2 — 落实韧性双部署（D2）
- 选定主平台后，将另一平台配置为"永久备用"并写进 `DEPLOYMENT-DECISION-MATRIX` 的执行记录，避免再次漂移。

### R3 — SW 版本治理自动化（D3 / P1-2）
- 在 `static-checks.yml` 增加一步：比对 `sw.js` 注入逻辑与 `package.json` 版本，或固化"CI 注入 SHA 版"为唯一真相源，并在文档声明 committed CACHE_VERSION 仅占位。
- 长期：评估 SW 版本与构建哈希绑定，彻底去掉人工 bump。

### R4 — 工程债清理（P1-3 / P1-4 / P2-5）
- 对齐 eslint 工具链（`@eslint/js` 降到 ^9 或整体升 eslint 10），消除 `--legacy-peer-deps` 依赖（CI-ROOTCAUSE 遗留项）。
- 分批清理 179 `no-unused-vars`，或对历史文件加分层 `eslint-disable`。
- 移除 `package.json` 中可疑的 `"ters"` 依赖。

### R5 — 性能与可访问性打磨（P2-1~P2-4）
- 字体子集化（fonttools 压至 <1MB/款，直接利好大陆弱网）。
- 加 `prefers-reduced-motion` / `hardwareConcurrency≤4` 低性能模式。
- 账号面板包 `<form>` + autocomplete。
- （可选，风险高）main.js/style.css 按域拆分。

### R6 — 文档与门禁收口（D4 / D5 / P2-6 / P2-7）
- 更新 STATUS/README/CODE-WIKI 覆盖 v11.5.x + 部署变更为 GitHub Pages。
- 修正 STATUS "无打包管道"描述为"已有 build-phase2.mjs 管道"。
- 建议设 `PLAYWRIGHT_PROBE=1` 启用真实浏览器端到端回归，补齐"改了样式但视觉错位"类缺陷的自动化拦截（历史 P0/S-01 均靠人工截图发现）。

---

## 六、结论

飞行雪绒项目**功能层已达标、质量门禁健全、近期故障已全部修复并验证在线生效**，是一个健康运行中的同人站点。但其**部署与韧性未按既定决策落地**（D1/D2），导致面向主力大陆用户的访问体验未达选型预期；同时累积了若干**可管理的工程债**（SW 治理、eslint、字体、死配置、文档滞后）。

**最需要用户决策的动作是 R1（部署平台）**：是补做 Cloudflare/CloudBase 大陆加速，还是正式接受 GitHub Pages 单点并清理死配置。其余 R2–R6 均为可在正常迭代中消化的技术改进，无阻断性风险。

> 附：本审查所有"现状"结论均来自本次源码/Git/线上抓取实证；"偏差"结论均来自历史正式文档（`TECH-SELECTION-REPORT.md`、`DEPLOYMENT-DECISION-MATRIX.md`、`STATUS*.md`、`DIAG-REPORT-*.md` 等）与现状的交叉比对，非推测。
