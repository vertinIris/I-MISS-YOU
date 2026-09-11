# 飞行雪绒 · SKILL 就绪清单（2026-09-11）

> 任务：读取项目相关文件 → 梳理用途/配置/状态 → 依汇报识别需求 → 本地+GitHub 检索对应 SKILL → 获取并基础准备 → 输出就绪清单。
> 输入主文档：`docs/PROJECT-REVIEW-2026-09-11.md`（全面审查汇报）
> 环境：Windows / 沙箱 Bash（仅 git·node·npm·python + 内建命令可用；`ls`/`head`/`tail` 被安全壳屏蔽）；本机无可用浏览器（审查 P3 已记）；hosts 屏蔽 github。

---

## 一、已读取文件梳理

| # | 文件 | 用途 | 关键配置 | 当前状态 |
|---|------|------|----------|----------|
| 1 | `docs/PROJECT-REVIEW-2026-09-11.md` | 本次任务主输入：架构/部署/质量门禁/运行态/历史文档交叉核对审查 | 结论 TL;DR、偏差 D1–D5、建议 R1–R6、风险 P0–P3 | ✅ 已读；功能达标、门禁健全，但部署偏离决策 |
| 2 | `package.json` | 项目元配置与脚本入口 | `version 11.5.1`；`homepage` 仍指向失效域名 `i-miss-you-bcu.pages.dev`；依赖含可疑 `ters`；devDeps `@eslint/js@^10` 与 `eslint@^9` 主版本冲突 | ⚠️ 生产配置，含 P1-1 死配置 + P2-5 可疑依赖 + P1-4 peer 冲突 |
| 3 | `wrangler.toml` | Cloudflare Pages 部署配置 | `name=i-miss-you`，`pages_build_output_dir="."` | ⚠️ 死配置（Cloudflare 域名被占，未实际启用，P1-1） |
| 4 | `pages.config.json` | CloudBase/腾讯云部署配置 | KV 绑定、`routes` 覆盖 `/*`/`dist/*`/`forum/*` | ⚠️ 死配置（CloudBase 未启用，P1-1） |
| 5 | `_headers` | Cloudflare Pages 安全头+缓存策略 | CSP/HSTS/`X-Frame-Options`、静态资源 `immutable` | ⚠️ 仅 Cloudflare 识别，GitHub Pages 不读取（CSP 由 HTML meta 兜底） |
| 6 | `manifest.webmanifest` | PWA 清单 | `short_name=飞行雪绒`、`theme_color=#E89BB5`、SVG 图标 | ✅ 有效，与 v11.5.x 一致 |
| 7 | `.github/workflows/static-checks.yml` | 质量门禁 | smoke+extreme / runtime-assert(无头Chrome) / dist-sync；可选 `browser-probe`（`PLAYWRIGHT_PROBE=1` 才启用） | ✅ 四层门禁健全；browser-probe 默认关闭（P2-7） |
| 8 | `.github/workflows/pages-deploy.yml` | GitHub Pages 部署 | build → `sed` 注入 SW 部署号 → 上传产物 | ✅ 当前生产部署链路 |
| 9 | `sw.js` | Service Worker | `CACHE_VERSION='snowfluff-v11.5.2-layout-fix'`（占位符，靠 CI `sed` 注入 SHA 版） | ⚠️ 功能正确但治理靠人工、无一致性校验（D3/P1-2） |
| 10 | `docs/DEPLOYMENT-DECISION-MATRIX.md` | 部署决策（2026-08-11） | 选项A Cloudflare（大陆 50–100ms，推荐）/ 选项B GitHub Pages（800ms+） | ⚠️ 决策推荐 A，实际落到 B（偏差 D1） |
| 11 | `docs/TECH-SELECTION-REPORT.md` | 技术选型（Web App 维持） | R1–R10 需求、硬约束（零预算/单人/已有 Supabase + 双部署意图） | ✅ 结论仍成立 |
| 12 | `docs/STATUS.md` | 现状速览（权威源=代码+migration） | v11.5.1、migration 017 硬删/Realtime 等 | ⚠️ 较新，但"GitHub Pages + CloudBase 双部署"约束与现状(仅 GitHub Pages)不符（D2 信息偏差） |
| 13 | `docs/ZONE-CONFIG-2026-09-11.md` | 09-11 布局修正记录 | 页脚/同步指示器/hero 旋钮，提交 `2124b89` | ✅ 已落地在线 |

> 另已索引但未逐字精读（汇报已交叉引用）：`STATUS-AUDIT-2026-09-08.md`、`CI-ROOTCAUSE-2026-09-09.md`、`DIAG-REPORT-2026-09-10.md`、`QA-RUNTIME-REPORT-2026-09-07.md`、`CLOUDBASE-VS-CLOUDFLARE-ANALYSIS.md`、`CONTENT-PIPELINE.md`、`WORLDVIEW.md` 等。

---

## 二、汇报识别的需求 → 对应 SKILL 映射

| 编号 | 需求（来源） | 类型 | 匹配 SKILL / 工具 |
|------|--------------|------|-------------------|
| N1 | 部署偏差/大陆加速（R1/R2，偏差 D1/D2） | 部署 | `edgeone-pages-deploy`（**优先级：EdgeOne Makers 连接器已连接**）、`github-pages-auto-deploy`（当前生产）、`cloudflare`、`cloudflare-worker-builder`、`netlify-deploy` |
| N2 | 真实浏览器端到端回归（P2-7/R6） | 浏览器自动化 | `agent-browser`（SkillHub 规范命中）、`playwright-cli`、`browser-use`；仓库 `scripts/browser-probe.mjs` 依赖 `playwright` |
| N3 | 中文字体子集化（P2-1/R5） | 性能/工具 | **无对应 SKILL**（市场缺口）→ 改用 `fonttools`(`pyftsubset`)，已安装 |
| N4 | 工程债/lint 对齐（R4，P1-4） | 代码质量 | `eslint` 已为 devDep（无需 skill）；需对齐 `@eslint/js` 版本 |
| N5 | 文档收口（R6/P2-6） | 文档 | `tencent-docx` 等（按需，非阻断） |

---

## 三、本地 + GitHub 检索结果

- **本地检索**：用户级 `~/.workbuddy/skills/` 与插件缓存已内置全部部署/浏览器类 SKILL（见第四节路径）。
- **GitHub / 市场检索**（通过 `find-skills` → SkillHub 语义 API，查询：deploy / browser-e2e / font-subset）：
  - 部署类：未检索到优于本地已装的远程 skill；本地 `edgeone-pages-deploy`/`github-pages-auto-deploy`/`cloudflare` 已覆盖。
  - 浏览器类：最高相关为 `agent-browser`（slug `clawhub_rez0/agent-browser`，installs 36.4K，stars 982）——**已本地安装**，无需获取。
  - 字体子集类：**SkillHub 无任何专用 skill 命中**（返回结果相关性均 ≤0.05 且无关）→ 确认为市场缺口，改用工具 `fonttools`。

---

## 四、基础准备状态

| SKILL / 工具 | 存放位置 | 可加载 | 运行前置（待用户/环境） |
|--------------|----------|--------|--------------------------|
| `edgeone-pages-deploy` | `C:\Users\lenovo\.workbuddy\skills\edgeone-pages-deploy\SKILL.md` | ✅ 已读验证 | `edgeone` CLI ≥1.2.30 + `PAGES_SOURCE=skills` + 登录（浏览器/Token）。CLI 安装与登录需用户交互+网络（沙箱/本机浏览器缺失，待用户执行） |
| `github-pages-auto-deploy` | `C:\Users\lenovo\.workbuddy\skills\github-pages-auto-deploy\SKILL.md` | ✅ 已读验证 | 已由 `pages-deploy.yml` 生产使用，无需额外准备 |
| `cloudflare` | `C:\Users\lenovo\.workbuddy\skills\cloudflare\SKILL.md` | ✅ 已读验证 | 参考库（Pages 部分）；实际域名被占，仅作选项 α 参考 |
| `cloudflare-worker-builder` | `~/.workbuddy/skills/cloudflare-worker-builder/SKILL.md` | ✅ 已注册 | 同上 |
| `netlify-deploy` | `~/.workbuddy/skills/netlify-deploy/SKILL.md` | ✅ 已注册 | 备选部署平台 |
| `agent-browser` | `C:\Users\lenovo\.workbuddy\plugins\cache\codebuddy-plugins-official\agent-browser\1.3.0\SKILL.md` | ✅ 已读验证 | `agent-browser` CLI + Chromium(~500MB)；本机无浏览器二进制（P3），待环境准备 |
| `playwright-cli` | `~/.workbuddy/plugins/cache/.../playwright-cli/0.1.0/SKILL.md` | ✅ 已注册 | `playwright` + Chromium |
| `browser-use` | `~/.workbuddy/plugins/cache/.../browser-use/SKILL.md` | ✅ 已注册 | 同上 |
| `find-skills` | `~/.workbuddy/plugins/cache/.../find-skills/1.0.0/SKILL.md` | ✅ 已注册 | 检索用，已验证可用 |
| **`fonttools` 工具** | `C:\Users\lenovo\.workbuddy\binaries\python\envs\default\` (venv) | ✅ **已安装 4.65.0** | 可直接 `pyftsubset` 做字体子集化（P2-1）；**本次实际完成的基础准备** |

> 连接器状态（会话级）：EdgeOne Makers ✅ 已连接（部署最高优先级）｜GitHub ✅ 已连接｜agent-mail / qq-mail ✅ 已连接。

---

## 五、就绪清单（执行下一步任务前）

**✅ 已读取文件（13 个）**：见第一节明细（审查汇报 + 4 个部署/CI 配置 + SW/PWA + 4 份决策/状态文档）。

**✅ 已就绪、可随时调用的 SKILL（本地已装 + 已验证可加载）**：
1. `edgeone-pages-deploy` — 修复部署偏差 R1 的首选（EdgeOne Makers 已连接）
2. `github-pages-auto-deploy` — 当前生产链路，无需改动
3. `cloudflare` / `cloudflare-worker-builder` — 选项 α 参考
4. `netlify-deploy` — 备选
5. `agent-browser` / `playwright-cli` / `browser-use` — 真实浏览器端到端回归（P2-7/R6）
6. `find-skills` — 后续再次检索用

**✅ 已完成的工具准备**：`fonttools 4.65.0`（托管 Python venv），可直接做中文字体子集化（P2-1）。

**⏳ 待用户/环境执行的运行前置（非阻塞，按需）**：
- **部署决策拍板（R1）**：选 Cloudflare(α) / CloudBase(β) / 接受 GitHub Pages 单点并清死配置(γ)；随后 `edgeone` CLI 安装+登录（或 `cloudflare` wrangler 登录）。
- **清理死配置（P1-1）**：删除/激活 `wrangler.toml`、`pages.config.json`，修正 `package.json` homepage。
- **浏览器二进制**：本地跑 `agent-browser`/`npm run browser-probe` 需先下载 Chromium（沙箱/本机缺失，约 500MB；或 CI 已支持 `PLAYWRIGHT_PROBE=1` 自动装）。
- **工程债（R4）**：对齐 `@eslint/js` 到 ^9 以消除 `--legacy-peer-deps`；移除可疑 `ters` 依赖。

> 说明：本沙箱 Bash 屏蔽 `ls`/`head`/`tail` 且本机无浏览器，故"依赖安装/路径配置"类准备以"验证 SKILL 可加载 + 安装 fonttools + 记录运行前置"为准；需联网下载浏览器二进制或交互登录的步骤，将在实际执行对应任务时由用户在可用环境中完成。
