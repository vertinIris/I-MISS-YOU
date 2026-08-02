# 推送后查漏补缺分析（v10.1 基线）

> 文档版本：v1.0 · 2026-08-03
> 基线：`6e38308`（删除重复评论）已推送，`main` 与 `origin/main` 同步
> 方法：先实测、后建议。所有结论来自对仓库 / 代码 / 架构的核对，避免凭印象。

---

## 0. 现状确认（实测）

| 项 | 结论 |
|---|---|
| 推送状态 | `git status` 显示 `main...origin/main` 无 ahead/behind；`git log origin/main..HEAD` 为空 → **已全部推送**，你说的"已完成所有推送操作"属实 |
| 路线图 P0 阶段 | `5149ad1` 已落地：P0-1 字阶下钻 / P0-2 模态可访问性 / P0-3 脚本 defer |
| 本轮新增 | `repository.js` 评论去重（`commentSig`/`mergeComments`/`dedupeLocalComments`）+ `db/migration-018`；`main.js`/`repository.js` 同步管线 `.id` 空值守卫 |
| 匿名登录 | 已在 Supabase Dashboard 开启（截图确认） |
| 普通用户注册 | **已存在**（`auth-manager.js signUp` / `signInWithPassword`，账号面板有"注册"tab） |
| 管理员入口 | **共享口令**（`admin-auth.js`，SHA-256 校验 `flyingedelweiss2026`，sessionStorage 存令牌）+ 页脚双击触发 |

---

## 1. 两点前提澄清（重要，避免做错方向）

### 1.1 「评论后自动触发推送」——这是个架构误解，需求不成立

- 评论数据存在 **Supabase PostgreSQL + localStorage**，**从不进入 git 仓库**。
- 发表评论 = 写 Supabase，跨设备通过 **Realtime 秒级同步**，根本不需要、也不应该 push 到 GitHub。
- 你用 GitHub Desktop 做的"推送"，只针对**代码改动**（HTML/CSS/JS）。而且 GitHub Pages 在 push 到 `main` 时**已经自动部署**——代码推送本身就已经触发了部署。
- **结论**：「评论后自动推送」不可做也不必做；真正值得优化的是「代码推送的自动化护栏」（见 §4.2）。

### 1.2 「移动端管理员注册」——也需澄清

- **普通用户注册已存在**（邮箱+密码），无需新建。
- **管理员当前是「共享口令」而非「注册账号」**：任何知道口令的人双击页脚输入即可成为管理员。这是同人项目的合理设计（没有多租户管理员需求，也不需要每人一个账号）。
- 如果你要的是「多个具名管理员 + 角色分配」：需要注册账号 → 后端 RPC 给账号写 `user_metadata.role=admin/moderator`（**普通用户不能自改 role，否则越权**）→ RLS/策略按 role 放行。这是中等后端工作量，且会与现有「共享口令删除」路径并存造成权限来源混乱，当前不推荐。
- **真正的移动端痛点**是：管理员入口 = 页脚「双击」（`main.js:3704` dblclick）+ `prompt()` 输口令。双击在触屏 unreliable，`prompt()` 在 iOS 上很别扭。**这一条值得立刻修**（见 §4.1）——它解决的是「移动端管理员能顺畅进入」，而不是「注册」。

---

## 2. 未完成功能排查（按优先级）

引用 `OPTIMIZATION-ROADMAP-v10.md` 并核对代码后的真实进度：

| 项 | 优先级 | 状态 | 说明 |
|---|---|---|---|
| P0-1 字阶下钻到控件层 | P0 | ✅ 已完成 | `5149ad1` |
| P0-2 模态 role/aria-modal/焦点陷阱 | P0 | ✅ 已完成 | `5149ad1` |
| P0-3 脚本 defer | P0 | ✅ 已完成 | `5149ad1` |
| **JS 压缩 + 关键 CSS 内联** | P1 | ⬜ 待做 | `main.js` 233KB/4564 行未压缩；需引入 terser + GitHub Actions 部署 |
| **CI 自动语法/冒烟卡点** | P1 | ⬜ 待做 | 防回归；当前靠人工 `node --check` |
| **og:image 转 WebP** | P1 | ⬜ 待做 | 当前 `assets/og-cover.png` = 2.0 MB，社交预览慢 |
| 权限体系统一 | P1 | ⚠️ 半完成 | `auth-manager` 有 admin/moderator role 概念，但删除权限实际走 `AdminAuth` 共享口令；若做具名管理员需先统一权限来源 |
| PWA / Service Worker | P2 | ⬜ 暂缓 | 强依赖 Realtime，离线价值有限 |
| 数据冲突合并（CRDT 级） | P2 | ⬜ 暂缓 | 多设备同改同条概率低 |
| 大陆访问镜像 | P2 | ⬜ 待你确认 | 需备案或用 cloudstudio；涉及账号决策 |

**结论**：代码层已闭环（v10 + 去重修复），剩余主要是「性能压缩 / 自动化护栏 / 社交图瘦身」三类工程化收尾，**没有功能性缺失**。

---

## 3. 性能优化诊断（具体瓶颈 + 方向）

| 瓶颈 | 证据 | 优化方向 | 预期收益 |
|---|---|---|---|
| 主 JS 未压缩 | `main.js` 233KB/4564 行，无 `dist/`/构建 | P1-1 terser 压缩 13 个 JS → `dist/` | 体积 ↓40–60%（≈90–140KB），Lighthouse 性能分 +5~10 |
| og:image 过重 | `assets/og-cover.png` = 2.0 MB | P1-3 转 WebP（质量 80%，目标 <300KB） | 社交分享卡片加载更快 |
| 关键 CSS 未内联 | 单 CSS 6280 行，无内联 | P1-1 首屏必需 CSS 内联进 `<head>`，其余异步 | 减少一次 CSS 往返，TTI 下降 |
| 脚本请求数 | 13 个独立 `<script>` | 压缩后合并/合并请求 | 请求数下降 |
| Realtime 轮询兜底 | `sync-manager.js` 15s 轮询（断线时全量拉取） | 指数退避；仅可见区轮询 | 大评论量下降低周期主线程占用 |
| Three.js 粒子 | `particles.js:74` 已节流 24/42 + CSS 降级 | 维持现状（已达标） | — |
| reduced-motion | 已全局处理 | 维持 | — |

**优先级建议**：P1-1 压缩 > P1-3 og:image > P1-1 关键 CSS 内联 > Realtime 退避优化。

---

## 4. 两个真正可落地的改进（推荐立即做，均为低风险纯前端/配置）

### 4.1 移动端管理员访问修复（不是"注册"，是"可用"）

- **问题**：页脚 `dblclick` 触发 + `prompt()` 输口令，触屏双击不可靠、iOS 原生 prompt 别扭。
- **方案**：
  1. footer 新增 **长按 800ms** 触发（复用头像长按逻辑 `main.js:886` 的 `pressTimer` 模式），桌面保留 dblclick 兼容。
  2. 用**页面内登录 modal** 替代 `prompt()`（走 P0-2 已封装的 `initModalA11y`：role/aria-modal/焦点陷阱）。
  3. 校验仍走 `AdminAuth.verify()`（SHA-256），不改安全模型。
- **工作量**：低（1 个长按事件 + 1 个 modal + 复用 helper）。
- **效果**：移动端管理员可顺畅进入，且不再弹原生 prompt，更体面。

### 4.2 代码推送自动化护栏（这才是「推送效率」的真义）

- **问题**：代码改动 push 后，需手动在浏览器抽查是否回归；语法错只能靠人工 `node --check`。
- **方案**：新增 `.github/workflows/deploy.yml`，push 到 `main` 时自动：
  1. `npm run syntax-check`（`node -c` 全部 JS）—— 卡语法错误
  2. `npm run smoke-check`（无头冒烟，对「云端未就绪」做容错）—— 卡明显回归
  3. GitHub Pages 自动部署（仓库 Pages 源=`main` 已内置，无需额外 action）
- **效果**：你点一下 push，CI 自动卡语法 + 自动部署，省去手动抽查与「忘了验证」的焦虑。
- **注意**：最终的「在 GitHub Desktop 点 push」这步无法由我代劳（git 凭据在你本地）；CI 接管的是 push 之后的事。
- **工作量**：低（1 个 yaml）。

---

## 5. 建议的下一步

1. **我可以马上做 §4.1（移动端管理员 modal + 长按触发）和 §4.2（CI workflow）**——都是纯前端/配置改动，不涉及 Supabase 凭据，零可见副作用。
2. 做完后你 commit + push，GitHub Pages 自动部署 + 自动语法卡点。
3. **「具名管理员 + 角色分配」**和**「大陆镜像」**属于更大的架构/账号决策，需要你确认方向后再动，不在本轮范围内。

> 备注：本轮仅产出分析文档，未修改源文件、未推送。
