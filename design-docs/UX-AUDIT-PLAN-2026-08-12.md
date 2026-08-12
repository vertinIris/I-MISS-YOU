# 飞行雪绒 × 星炬学院 · 全站 UX 筛查与修正方案（第二期汇总）

> **交付包**：与 `design-docs/UI-REDESIGN-PLAN-2026-08-12.md` 合并为同一份 UI 改造总览（第一份覆盖主站四块改造，本份覆盖星炬论坛全面筛查 + 主站补充）
> **日期**：2026-08-12 ｜ **状态**：仅规划与审查，**未修改任何生产代码**
> **依据**：星炬论坛 / 主站代码级审查 × qa-review 五道检查 × humanizer-zh 反 AI 味 × design-system-extract 设计系统对比 × GitHub/全网案例与教训 × WCAG 对比度实测

---

## 〇、任务范围与筛查方法

| 维度 | 方法 |
|---|---|
| 审查框架 | qa-review（AI 味 / 可访问性 / 层级节奏 / 交互状态 / 终检汇总） |
| 反 AI 味 | humanizer-zh（维基 AI 写作特征 24 条清单） |
| 设计系统 | design-system-extract（token 提取与组件规范对比） |
| 案例教训 | GitHub（Discourse Air / MDClub / Flarum / wt-history / 上轮 futesat、Snixrs、Bento-Homepage、MoeHome 等）+ 全网暗色模式最佳实践 |
| 对比度 | WCAG 公式脚本实测（非估算） |
| 覆盖文件 | `forum/index.html`、`forum/forum.css`、`forum/forum-theme.css`、`forum/forum-visual.css`、`forum/forum-easter.css`、`css/tokens-stf.css`、`css/stf-weapons.css`、`css/forum-shared.css`、`css/tokens-base.css`、`css/style.css`、`css/donation.css`、`js/main.js`、`js/particles.js`、`forum/js/forum-theme-bootstrap.js` |

---

## 一、先给结论：真正的病根是「表面层级对比」，不是「文字对比度」

对全站关键前景/背景组合做 WCAG 实测后，**文字对比度几乎全部达标**：

| 组合 | 实测对比度 | 判定 |
|---|---|---|
| 论坛正文 `#EEF3FB` / 背景 `#0A101C` | 17.08 : 1 | ✅ |
| 论坛卡片预览 70% 白 / 背景 | 8.72 : 1 | ✅ |
| 论坛 lore 正文 72% 白 / 背景 | 9.18 : 1 | ✅ |
| 论坛 foot-note 50% 白（13px 小字） | 4.94 : 1 | ✅ 临界 |
| 论坛 placeholder 45% 白 | 4.21 : 1 | ⚠️ 全站唯一低于 AA |
| 论坛品牌蓝 `#6d8fd6` / 背景 | 5.93 : 1 | ✅ |
| 主站 ink-2 82% / ink-3 68% | 12.03 / 8.42 : 1 | ✅ |
| 主站玻璃卡上正文 96% | 15.45 : 1 | ✅ |

**因此用户截图反馈「背板没有、界面不明显」的根因是：**

1. **卡片/面板与页面背景的明度差太小**——论坛 surface-1 仅 `4.5%` 白叠层、主站 `4%`，处于全网暗色最佳实践的推荐区间（4–8%）**下限**，观感上"有卡像没卡"；
2. **边框过弱**——`10%` 白边框在 OLED 深底上接近不可见；
3. **阴影在暗底上基本失效**——暗色模式中阴影无法表达高度（全网一致教训），本项目仍大量依赖 box-shadow 而非明度层级。

修正方向 = **用明度层级表达高度**（与第一份规划方案 B 同源），而非调整字号或字色。这也是为什么两站要一起改：病根同一。

---

## 二、星炬论坛 · 问题清单（按 qa-review 五维度）

### 2.1 背板 / 表面层级（P0 · 本次核心）

| 区块 | 现状 | 问题 | 建议方向 |
|---|---|---|---|
| **Hero 区**（brand/title/sub/actions） | 72vh，文字直接落在多层渐变+星点+噪点背景上，**无任何背板** | 观感最差的区域：大字号文字浮在星空中 | 内容区加轻量径向光晕背板/玻璃面板；或压缩 hero 到 48–56vh |
| **帖流卡片** `.stf-card` | `surface-1` = 4.5% 白 + 左侧 3px 角色色线 | 背板接近下限，卡片边界靠一根色线撑 | surface-1 → 8–9% 白，边框 10% → 16% |
| **侧栏/搜索/排序/置顶**（aside-card / stf-sort / stf-search / stf-pinned） | 4–8% 白 | 低于最佳区间 | 统一提到 8–9% |
| **世界观卡** `.lore-card` | 4% 白 + 8% 边框 | 同下限问题 | → 8% |
| **入口墙** `.stf-indexcard` | surface-2 = 8%（全站最好） | desc 用 `neutral-300 #9098a8` 偏灰 | desc → neutral-200，背板保持 8–10% |
| **发帖触发/聊天气泡**（composer-trigger / chat-bubble） | 6% 白 | 略低 | → 8% |
| **页脚声明** `.forum-foot-note` | 无背板，13px 50% 白直接落底 | 小字+无板+临界对比 | 加内衬条或提亮到 60% |
| **弹层** `.stf-modal-panel.glass` / `.stf-post-detail-panel` | 与卡片同档或更低 | 弹层应比卡片**再亮一档**（Material 明度层级） | 弹层加 0.14 白叠层 |

### 2.2 布局 / 信息架构（P1）

- **时间线形态残留**：`stf-weapons.css` 定义了 `.stf-timeline__rail / .stf-timeline__item / sig-timeline-node` 完整时间线样式，但 `forum-theme.css` 又把 `.stf-timeline::before` 和 `.stf-node` 设为 `display:none`（主帖流退化为纯列表）；而**置顶帖（362 行）与空态（457 行）仍挂着 `sig-timeline-node`**——半启用状态，自相矛盾。→ 二选一：恢复 rail 形态（与主站杂志式时间线统一，推荐），或彻底清理残留。
- **无 `<main>` landmark**：论坛 index.html 全程 section/div；`characters/*/index.html` 有 `<main class="zone-modules">`（✅），主站 index.html 也没有。
- **三处浮层竞争**：左下返回按钮 + 右下捐赠 FAB + 调频胶囊，各自独立浮层，视觉上"东西多但都躲着"。
- **hero 72vh 空耗首屏**：除文字外无内容，移动端占满一屏以上。

### 2.3 交互状态（P1 / P2）

- ✅ **正面**：`forum-theme.css` 954–972 行有统一焦点环（filter/sort/tab/tag/page/card/chat/dial/hero/entry/btn 全覆盖）；reduced-motion 覆盖优秀；按钮 hover/active 差异普遍存在。
- ❌ `donate-fab` 默认 `opacity: 0.72`——刻意"低调"导致可用性受损，且与主站 FAB 行为不一致。
- ❌ `.stf-indexcard`（整卡是 `<a>`）与 `.stf-search-clear` 无 `:focus-visible` 样式。
- ❌ 触控目标偏小：`.stf-page-btn` 36px、tag-chip、`.stf-dial-step` 均 < 44px（移动端）。
- ❌ `.lore-card` 有 hover 位移但非交互元素（无 cursor 变化、无 aria 标注）——语义暧昧，需确认是否可点。

### 2.4 可访问性（P1）

- ❌ **skip link 缺失**：`.nav-skip-link` 样式已在 `tokens-base.css:254` 预留，但主站/论坛 HTML 均未使用。
- ❌ **placeholder 45% 白** 是唯一对比度短板（4.21 < 4.5）。
- ✅ 表单 label 关联完善（`form-label` + `for`/`id`）；聊天区 `role="log"` + `aria-live="polite"`；对话框 `role="dialog"` + `aria-modal`；焦点环对比度达标。

### 2.5 反 AI 味筛查（humanizer-zh + qa-review 第 1 项）

- ❌ **☕ emoji 当图标**：`donate-emoji`（forum index.html 1216 行）——qa-review 第 7 项「emoji 当 icon」命中，主站同款。→ 换 SVG（主站原型已换）。
- ❌ **渐变复用超限**：`btn-primary` / `.stf-fab` / `.stf-composer-avatar` / `.stf-sort-btn.active` / `.stf-pinned-badge` / `.donate-btn-primary` / `.stf-chat-send` 等 **6+ 处**共用同一条 blue→gold 渐变——违反项目 v10 禁令「所有表面统一套同一条渐变」。→ 渐变仅保留主按钮与 FAB，其余降为纯色 tint。
- ⚠️ **文案人工确认清单**（humanizer-zh 标记，非自动判定）：
  - hero sub「研讨厅已开门。共鸣者注疏与训练笔记，在讨论区公开沉淀。」——总体合格，属同人叙事语态；
  - 捐赠 subtitle「每一份支持，都会变成星空下更稳定的信号。」——「更稳定的信号」是频率主题的合理延伸，可用；
  - 捐赠 note「你的陪伴，是这里继续发光的理由。」——「继续发光的理由」略有 AI 抒情腔，建议改「你的陪伴，让这个角落一直亮着。」（待你确认）。
- ✅ **正面**：入口墙 2-1-1 非对称（HTML 注释明确"替代 AI 标配 3 列 feature grid"）；lore 卡以角色色 `--char` 区隔；无紫蓝渐变、无 lorem、无 stock 占位。

### 2.6 性能 / 维护性（P2 / P3）

- **样式层叠过深**：`forum.css` + `forum-theme.css` + `forum-easter.css` + `forum-visual.css` + 主站侧 `forum-shared.css` + `stf-signature.css` + `stf-weapons.css` + `tokens-stf.css` = **8 个样式文件**，且 `forum-visual.css` 整层以 `!important` 兜底（含 z-index 冗余声明）——维护与回归成本高。
- hero 渐变标题 `stf-title-drift` 16s 无限动画（已有 reduced-motion 兜底，但默认态耗电）。
- `body` 多层 `radial-gradient` + `background-attachment: fixed`——移动端滚动掉帧风险。

---

## 三、飞行雪绒主站 · 补充筛查（第一份规划未覆盖项）

### 3.1 删除 light 主题的完整影响面（P0 实施项 · 第一份规划只给了 token，这里补全清单）

**CSS 规则分布（约 77 处）：**

| 文件 | `data-theme="light"` / `"auto"` 规则数 |
|---|---|
| `css/style.css` | 47 处 |
| `css/donation.css` | 17 处 |
| `css/forum-shared.css` | 13 处 |
| `css/banding-fix.css` / `community-polish.css` 等 | 需实施时再 grep 兜底确认 |

**JS 依赖（必须同步改，否则删除后报错/残留逻辑）：**

| 文件 | 位置 | 内容 |
|---|---|---|
| `js/main.js` | 32–43 行 | `themes` 三态数组、`getEffectiveTheme`（auto→matchMedia）、`applyTheme`、`initTheme`、auto 媒体监听 |
| `js/main.js` | 4651 行 | `theme-toggle` 绑定逻辑 |
| `js/particles.js` | 200 / 331 行 | 两处 `theme === 'light'` 分支（粒子换色） |
| `forum/js/forum-theme-bootstrap.js` | 7–11 行 | 读 `snowfluff-theme`，`auto`/`light` 分支需降级为 dark |
| `forum/js/*`（如 forum.js 内） | 待实施时 grep `data-theme` 兜底 | — |

**旧用户兼容策略（建议）：**
- 读取 `localStorage.snowfluff-theme` 时，`'light'` / `'auto'` 一律降级为 `'dark'`（写回 localStorage 亦可）；
- 删除 `data-theme-pref` 属性逻辑；
- `theme-toggle` 按钮处置待定（见 §七）。

### 3.2 主站其余未覆盖项

- 无 `<main>` / skip link（与论坛同病，一并补）。
- 玻璃卡 `4%` 白与背景明度差偏小——正文对比度实测 15:1 没问题，但**卡片边缘感知弱**，与方案 B 的 surface 提升同步解决。
- 角色页 `characters/*/index.html` 有 `<main>`（✅）；`.archive-timeline` 时间线模块待与杂志式时间线统一（第一份规划已列）。

---

## 四、GitHub / 全网教训对照表

| # | 来源 | 教训 | 本项目现状 | 差距 → 修正 |
|---|---|---|---|---|
| 1 | madegooddesigns.com《Dark Mode Design》 | 暗色模式用**明度层级**表达高度，阴影在暗底失效；卡片比背景浅 5–12% | 两站卡片 4–8%，大量依赖 box-shadow | 提亮背板 + 边框，方案 B |
| 2 | mittaltechnologies / flowtrix / 58ui 等 | 暗色主题是**独立视觉系统**，不是白改黑 | 本项目 light 主题正是"反转式"维护负担 | 删 light，dark 单模式做完整 |
| 3 | Material Design 文本惯例 | 正文 87% 白 / 次要 60% / 禁用 38% | 主站 96/82/68，论坛 100/65/45 | 基本符合；placeholder 45%→52% |
| 4 | 全网一致 | 纯黑底禁止（halation 光晕） | 两站均用 `#0A0A12` / `#0A101C` | ✅ 已符合 |
| 5 | 全网一致 | 高饱和强调色在暗底需降饱和 | 主站粉 0.14→0.11（已做）；论坛蓝 0.12 合理，gold 仅小面积 | ✅ 基本符合 |
| 6 | 全网一致 | 表单输入边框在暗底要可见 | `stf-search` 边框 10% 白偏弱；`form-input` 待实施时核查 | 边框 → 14–16% |
| 7 | WCAG 2.1 | 状态不只靠颜色 | sync-dot（色+点）、chat-tick（色+图标） | ✅ 已符合 |
| 8 | GitHub `discourse/discourse-air` | 现代论坛双色主题 + 分组卡片化 | 论坛帖流为左色线列表 | 参考其分组/卡片层级 |
| 9 | GitHub `MDClub` | Material 论坛、自动暗色 | 本项目反向（单 dark） | 印证：单模式必须自洽 |
| 10 | GitHub `Flarum` | 极简扁平、列表密度克制 | 帖流信息密度可再收 | 实施期参考 |
| 11 | GitHub `OHUHO/wt-history` | 暗色 + 彩色时间线条 | 论坛时间线 rail 被隐藏 | 恢复 rail 与杂志式时间线统一 |
| 12 | 上轮已收录 | futesat / Snixrs / Bento-Homepage / MoeHome / Yajon-donate / uiCookies-timeline | — | 详见第一份规划 §三 |

---

## 五、修正方案（按优先级 · 不实施）

> 以下均为**建议值**，落地前以 `make-prototype` 验证观感。

### P0-1 · 论坛背板与表面层级（对应 §2.1）

改 `css/tokens-stf.css` / `forum/forum-theme.css` 的 surface 系列：

| Token | 现值 | 建议值 | 说明 |
|---|---|---|---|
| `--stf-surface-1` | 4.5% 白 | **8.5% 白** | 帖流/侧栏/世界观卡背板 |
| `--stf-surface-2` | 8% 白 | **12% 白** | 悬停/展开/入口墙 |
| `--stf-edge` | 14% 蓝 | **22% 蓝** | 边框可见度 |
| `--stf-edge-strong` | 28–30% | **38%** | 强边框/焦点 |
| `--glass-border`（论坛） | 10% 白 | **16% 白** | 玻璃层边框 |
| 弹层（modal/post-detail） | 与卡同档 | **+0.14 白叠层** | 弹层高于卡片一档 |
| `.forum-foot-note` | 无板 50% 白 | 内衬条 + 60% 白 | 或并入 footer 卡 |
| Hero 区 | 无背板 72vh | 内容加轻量径向光晕面板 + 高度压到 48–56vh | 或二选一（见 §七） |

### P0-2 · 主站删 light + 提亮（实施清单见 §3.1 + 第一份规划 §4.2-B）

执行顺序建议：先改 CSS（删 77 处规则，留 `:root` 一套值）→ 再改 JS（main.js / particles.js / forum-theme-bootstrap.js）→ 最后处理旧 localStorage 兼容。

### P1 · 结构 / 可访问性（两站一起做）

1. 主站与论坛补 `<main>` + skip link（复用预留的 `.nav-skip-link` 样式）。
2. `placeholder` 45% → 52%。
3. `donate-fab` opacity 0.72 → 0.9；三处浮层收敛为两层（返回 + 捐赠，调频并入导航或捐赠层）。
4. 补 `.stf-indexcard`、`.stf-search-clear` 的 `:focus-visible`（套用统一焦点环）。
5. 触控目标：`.stf-page-btn` 36→44px、tag-chip / dial-step 补 padding。
6. `.lore-card` 确认交互语义：可点则补 `cursor/aria`，不可点则移除 hover 位移。
7. 论坛时间线 rail：恢复（推荐，与杂志式时间线统一）或彻底清理残留。

### P2 · 反 AI 味与视觉统一

1. 论坛/主站捐赠 ☕ emoji → SVG（主站原型已有现成）。
2. blue→gold 渐变收敛：仅保留 `btn-primary` 与 `.stf-fab`，其余（composer-avatar / sort-btn.active / pinned-badge / chat-send / donate-btn）降为纯色 tint。
3. 文案清单人工确认（§2.5 三条）。

### P3 · 性能 / 维护

1. 收敛 `forum-visual.css` 的 `!important`（目标：z-index 与 token 兜底只留一份）。
2. hero 渐变文字动画降频（16s→静态渐变 or 8s）或仅 decorative。
3. `background-attachment: fixed` 在移动端禁用（`@media (max-width: 768px) { background-attachment: scroll }`）。

---

## 六、与第一份规划汇总 · 全局实施顺序

两份文档合并后的**统一优先级**（实施阶段按此排序）：

| 序 | 项 | 来源 |
|---|---|---|
| 1 | 主站删 light 主题 + 方案 B 提亮 | 第一份规划 P0 + 本份 §3.1 |
| 2 | 论坛背板与表面层级提亮 | 本份 §五 P0-1 |
| 3 | 主站表单背板 + 日记杂志式时间线 | 第一份规划 P0/P1 |
| 4 | 捐赠区：主站侧边卡 / 论坛同步 | 第一份规划 + 本份 §2.5 |
| 5 | 可访问性补全（main/skip/focus/触控/placeholder） | 本份 §五 P1 |
| 6 | 反 AI 味：emoji→SVG、渐变收敛、文案 | 本份 §五 P2 |
| 7 | 性能与样式层收敛 | 本份 §五 P3 |

---

## 七、待确认事项（确认后进入 make-prototype → 落地）

1. **论坛 hero**：加背板 + 压缩高度（推荐）？还是只加背板？还是只压缩高度？
2. **论坛时间线**：恢复 rail 形态与主站杂志式时间线统一（推荐）？还是彻底清理残留？
3. **渐变收敛**：blue→gold 渐变仅保留主按钮与 FAB（推荐）？
4. **文案**：捐赠 note 改为「你的陪伴，让这个角落一直亮着。」（推荐）？其余两条保留？
5. **theme-toggle**：删 light 后按钮移除？还是保留为装饰（仅显示"电台"意象）？
