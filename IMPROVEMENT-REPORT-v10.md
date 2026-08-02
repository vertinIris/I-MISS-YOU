# 飞行雪绒同人站 · v10 改进讲解说明（REVIEW-v9.6 收尾）

> 基线文档：`REVIEW-v9.6.md`（20 项发现 R1–R20）+ `FIX-REPORT-v9.6.md`
> 改进原则：效果优先 + 严谨逐项比对（每项对照原始说明条款，未达标项分析根因并给出落地证据）
> 本轮目标：收尾 4 项延后项（R17/R18/R19/R20），并对 16 项已修复项做回归验证

---

## 一、逐项核查结论（对应原始说明条款）

### R17 三级色彩角色 + 表面层级（玻璃拟态去同质化）
- **核查方式**：读取 `css/style.css` 的 `:root` 令牌与组件引用。
- **结论**：✅ 已在 v10 落地，本轮回查确认，**无需新代码改动**。
- **证据**：
  - 令牌定义 L101–106：`--surface-card` / `--surface-inset` / `--surface-accent` 及各自 border 变量。
  - 应用：评论项 `.comment-item` 用 `--surface-inset`（L2599/2601、3666/3668）；社区卡 `.community-card` 用 `--surface-card`（L2616/2617、4017/4018、6185/6186、6211/6212）；选中/交互态用 `--surface-accent`（L883、2895）。
- **依据条款**：REVIEW-v9.6 R17。
- **效果**：内容卡（0.05 透明）与嵌套项/评论（0.03 透明）分层，品牌粉低透明用于交互态，玻璃拟态不再"千面一律"。

### R18 完整字阶 + 行高节奏（★本轮实际改动项）
- **核查方式**：读取 `:root` 与 `.hero-title` / `.section-title` / `.comment-text` 等。
- **结论**：⚠️ 此前仅定义了令牌但未接入 hero/section 实际字号，行高节奏缺失 → **本轮完整落地**。
- **改动（`css/style.css`）**：
  1. `:root` 建立 **6 级字阶令牌**（L126–140）：
     - Hero：`--fs-hero: clamp(2.8rem,8vw,5rem)` / `--fw-hero:900` / `--lh-hero:1.05`
     - Display：`--fs-display: clamp(2.2rem,5vw,3.2rem)` / `--fw-display:900` / `--lh-display:1.12`
     - Title：`--fs-title: clamp(1.4rem,3vw,1.9rem)` / `--fw-title:700` / `--lh-title:1.25`
     - Subtitle：`--fs-subtitle: clamp(1.1rem,2vw,1.35rem)` / `--fw-subtitle:600` / `--lh-subtitle:1.35`
     - Body：`--fs-body:1rem` / `--fw-body:400` / `--lh-body:1.7`
     - Caption：`--fs-caption:0.8125rem` / `--fw-caption:300` / `--lh-caption:1.5`
  2. `.hero-title` 接入系统衬线 Display 语言：字号→`--fs-hero`、字重→`--fw-hero`、字距 `-0.02em`、行高→`--lh-hero`（L1387 起）。
  3. `.hero-tagline` / `.hero-subtitle` 改用 `--fs-subtitle` / `--fs-caption` + 对应字重/行高。
  4. `.section-title` 字号→`--fs-display`、行高→`--lh-display`（L1941 起）；`.section-desc`→`--fs-caption` / `--lh-caption`。
  5. 弹窗/书签/收藏面板标题 `h3` 接入 `--fs-title` / `--lh-title`。
  6. `.comment-text` 行高 `1.5` → `var(--lh-body)`（1.7），改善长评论阅读节奏（L3740）。
- **依据条款**：REVIEW-v9.6 R18（"建立四级以上 type scale，统一字重/字色/字距/行高节奏"）。
- **改动前**：hero 硬编码 `clamp(3rem,10vw,6rem)` 且无衬线/无统一行高；section 与 hero 字号体系割裂；caption/body 行高无令牌，整站行高节奏不统一。
- **改动后**：hero 与 section 统一为衬线 Display 语言，6 级字阶覆盖 Hero→Caption，行高 1.05→1.7 形成递减节奏，长文可读性提升。

### R19 增量 DOM 协调（替代整段 innerHTML 重绘）
- **核查方式**：读取 `js/main.js` 协调函数。
- **结论**：✅ 已在 v10 落地，本轮回查确认。
- **证据**：
  - `reconcileCommentThread(list, comments, opts)` 定义 L1480，调用点 L1573 / 2384 / 3602。
  - `reconcileCommunityGrid(grid, pageItems)` 定义 L3286，调用点 L3187 / 3198。
  - 函数通过 key（评论 id / 投稿 id）增量增删改节点，而非 `list.innerHTML = ...`。
- **依据条款**：REVIEW-v9.6 R19。
- **效果**：评论/社区网格高频刷新（Realtime 推送）时不再整段重绘，避免输入焦点丢失、滚动跳动，降低重排开销。

### R20 硬删除以支持 Realtime DELETE 广播
- **核查方式**：读取 `js/supabase-adapter.js`、`js/repository.js`、`db/migration-017-hard-delete-for-realtime.sql`。
- **结论**：🟡 前端与 SQL 均已就绪，但 **`migration-017` 尚未在 Supabase 执行** —— 这是 R20 唯一真正缺口，需用户手动操作。
- **证据**：
  - 前端：`SupabaseAdapter.deleteComment` 用 `.from('comments').delete()` 物理删除（L441）；`deleteCommentWithToken` RPC 封装（L802–809）；`repository.js` 调用物理删除；`main.js` `handleDeleteComment` 走 `deleteCommentWithToken`。
  - SQL：`db/migration-017-hard-delete-for-realtime.sql` 已写好：软删 `is_hidden` → 物理 DELETE；`delete_comment_with_token` / `delete_submission_with_token` 重写为物理删；`moderation_logs` 新增 `content_snapshot` 在硬删前快照内容（L25、146、202）；含防误删说明（L134、190）。
  - 现状：该 SQL 文件存在于工作树但**未在 Supabase Dashboard 执行** → Realtime 的 DELETE 事件尚不会正确广播（软删行仍在表内，仅 UPDATE 才触发）。
- **依据条款**：REVIEW-v9.6 R20（"REPLICA IDENTITY 未设置 / 软删导致 Realtime DELETE 不广播"）。
- **需用户操作**：在 Supabase Dashboard → SQL Editor 执行 `db/migration-017-hard-delete-for-realtime.sql`（幂等，可重复执行）。执行后 R20 完整生效。

### 16 项已修复项回归验证（R1–R16）
- R1：`sync-manager.js` `lastSyncByTarget` 按 target 分别记录（不再跨评论区共享）✅
- R2：`supabase-adapter.js` `getSubmissions` 已 JOIN `submission_tags` 返回 tags ✅
- R3：`sync-manager.js` submissions 频道 `attemptReconnect('submissions')` 指数退避重连 + 订阅 DELETE ✅
- R4：`sync-manager.js` `onBulkComments` 批量合并 ✅
- R8：`main.js` 封禁检查 `isBanned` 命中即拦截 ✅
- （R5/R6/R7/R9–R16 在 FIX-REPORT 已记录；本次抽样复核 `main.js` / `repository.js` / `supabase-adapter.js` 等 10 个 JS 文件 `node --check` 全部通过，无语法回退）
- **依据条款**：FIX-REPORT-v9.6 已修复清单

---

## 二、改动前后效果对比（聚焦本轮实际改动 R18）

| 维度 | 改动前 | 改动后 |
|---|---|---|
| Hero 标题 | 硬编码 `clamp(3rem,10vw,6rem)`，无衬线、无统一行高 | 系统衬线 `--fs-hero`（最大 5rem），字重 900，行高 1.05，字距 -0.02em |
| Hero/Section 关系 | 两套割裂的字号体系 | 统一 Display 语言（hero=Hero 级 / section=Display 级） |
| 字阶层级 | 仅 4 档且 caption/body 行高无令牌 | 6 档（Hero/Display/Title/Subtitle/Body/Caption）全覆盖 |
| 行高节奏 | 散落硬编码（1.5 等） | 1.05→1.12→1.25→1.35→1.7→1.5 递减节奏令牌化 |
| 长评论阅读 | line-height 1.5 | 1.7，段落更舒展 |
| 玻璃拟态 | （R17 已分层，本轮回查确认）卡片/嵌套/交互三档表面 | 同左，无需改 |

---

## 三、最终版本整体效果评估

- **视觉一致性**：R17（表面分层）+ R18（字阶系统）双管齐下，整站"玻璃拟态去同质化 + 排版节奏统一"目标达成，hero 与 section 形成清晰主次层级。
- **性能与实时性**：R19 增量协调确保高频推送不抖动；R20 前端已物理删除，待 SQL 执行后即完整支持跨设备 DELETE 同步。
- **安全性**：R20 SQL 含 `content_snapshot` 快照 + 防误删说明，硬删前保留审计痕迹，未削弱 moderation 能力。
- **回归安全**：10 个 JS 文件 `node --check` 通过；`style.css` 括号配平（940=940）；新增令牌均被引用，无孤立变量。

**综合**：本轮在"效果优先"前提下，把真正有收益且未完成的 R18 完整落地，并严格验收了 R17/R19/R20 前端，未做无收益的大改，避免了回归风险。最终版本在排版严谨度与一致性上明显优于改进前。

---

## 四、尚存可优化空间与后续建议

1. **【必须】R20 SQL 执行**：请在 Supabase Dashboard 执行 `db/migration-017-hard-delete-for-realtime.sql`，否则跨设备删除同步不完整。这是当前唯一阻塞项。
2. **字阶下钻**：当前 6 档已覆盖主层级，但按钮/标签/徽章等微排版仍可接入 `--fs-caption` 体系，进一步消灭散落硬编码字号。
3. **表面层级扩展**：R17 三档表面已就位，后续新增"悬浮卡/置顶卡"可复用 `--surface-accent` 派生变量，避免新建颜色。
4. **R19 协调 key 稳定化**：确认评论/投稿节点 key 在编辑场景下稳定（目前用 id），避免编辑时整节点重建。
5. **可观测性**：建议前端接入删除操作的乐观更新回滚日志（R20 物理删失败时能提示用户），目前依赖 `console.error`。
6. **提交与部署**：本轮改动尚未提交 git（按约定不推送）。建议用户在 GitHub Desktop 提交并推送，触发 GitHub Pages 重新部署；R20 SQL 执行后建议做一次删除联调验证。

---

*生成时间：2026-07-02 · 基线 REVIEW-v9.6 + FIX-REPORT-v9.6 · 落地项 R18，验收项 R17/R19/R20-frontend，待执行项 R20-SQL*
