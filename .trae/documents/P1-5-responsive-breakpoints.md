# P1-5 响应式断点重算 · 实施计划

## Context（背景与目标）

**为什么做**：masterplan v11.0 §4.2 P1-5 要求建立 8 断点体系（320/360/480/768/1024/1280/1440/1920）+ clamp() 替换固定 px + pointer:coarse/hover:none 移动端适配。

**现状盘点**（已调研）：

* @media 共 47 处，其中非标准断点 13 处（520×5 / 540 / 720×5 / 860 / 899 / 980 / 1100）

* `pointer:coarse` / `hover:none` / `hover:hover` 使用 **0 处** ← 硬缺口

* viewport meta：11 个 HTML 全部正确 ✅

* tap-target 44px 仅 1 处偶然实现

* clamp() 已用约 30 处（tokens-base.css 字号 token 为模板），仍有大量硬编码 px

* tokens-base.css 无任何断点 token

**目标**：建立可校验的断点契约 + 补齐移动端触屏适配 + 关键元素 clamp 化（按呈现效果最佳判断范围，非全量）。

**约束**：保持现有视觉不回归；保持 `max-width` 反向断点策略（全项目已统一，迁移到 mobile-first 成本不可接受）。

***

## 实施分四阶段

### 阶段 1 · 断点契约 + 全局移动端适配（核心基建）

**文件 1**：[css/tokens-base.css](file:///c:/Users/lenovo/CURSOR/Snow/css/tokens-base.css)

在文件顶部（`:root` 之前）插入断点契约注释块：

```css
/* ============================================================
   Breakpoint Contract（断点契约）
   8 断点 · 所有 @media 必须使用以下值之一，由 scripts/lint-breakpoints.mjs 校验
     --bp-4xs: 320px   极小手机（iPhone SE 1st）
     --bp-3xs: 360px   小手机（Android 主流）
     --bp-2xs: 480px   大手机 / 小平板竖
     --bp-xs:  768px   平板竖（iPad）
     --bp-sm:  1024px  平板横 / 小笔记本
     --bp-md:  1280px  桌面标准
     --bp-lg:  1440px  桌面大屏
     --bp-xl:  1920px  全高清+
   策略：保持现有 max-width 反向断点；新写 @media 优先 min-width（mobile-first）
   注意：CSS @media 不支持 var()，--bp-* token 仅供 JS 读取与文档化
   ============================================================ */
```

在 `:root` 内（紧接 `--content-max` 之后）追加断点 token：

```css
/* —— Breakpoint tokens（documentation + JS-readable；@media 不支持 var()）—— */
--bp-4xs: 320px;
--bp-3xs: 360px;
--bp-2xs: 480px;
--bp-xs:  768px;
--bp-sm:  1024px;
--bp-md:  1280px;
--bp-lg:  1440px;
--bp-xl:  1920px;
--hover-enabled: 1; /* 在 (hover:none) 下置 0，供 JS 检测 */
```

在文件末尾追加全局触屏适配块：

```css
/* ============================================================
   Pointer / Hover Adaptation（移动端触屏全局降级）
   ============================================================ */
@media (hover: none) and (pointer: coarse) {
  :root {
    --hover-enabled: 0;
  }
  /* 强制可点击元素满足 44×44px tap-target（WCAG 2.5.5） */
  button:not([data-keep-size]),
  a:not([data-keep-size]):not(.nav-skip-link),
  input[type="checkbox"],
  input[type="radio"],
  input[type="submit"],
  input[type="button"],
  select,
  textarea,
  [role="button"]:not([data-keep-size]),
  [role="tab"]:not([data-keep-size]) {
    min-height: 44px;
    min-width: 44px;
  }
  /* 禁用纯 hover 装饰动效（保留功能态） */
  .hover-only-fx,
  [data-hover-fx="decorative"] {
    transition: none !important;
    animation: none !important;
  }
  /* 移除移动端 tap 高亮灰块 */
  html {
    -webkit-tap-highlight-color: transparent;
  }
}

@media (hover: hover) {
  /* hover 容器：未来 hover-only 效果在此白名单内激活 */
}
```

**文件 2**：[scripts/lint-breakpoints.mjs](file:///c:/Users/lenovo/CURSOR/Snow/scripts/lint-breakpoints.mjs)（**新建**）

Node 脚本，扫描 `css/`、`forum/`、`characters/**/*.css` 中所有 `@media` 查询，提取断点数值，与契约 8 断点（320/360/480/768/1024/1280/1440/1920）对比，报告非标准断点。允许 `prefers-reduced-motion` / `hover` / `pointer` / `min-resolution` 等非尺寸 media query 通过。

**文件 3**：[package.json](file:///c:/Users/lenovo/CURSOR/Snow/package.json)

在 `scripts` 中追加：

```json
"lint:bp": "node scripts/lint-breakpoints.mjs"
```

可选：把 `lint:bp` 加入已有的 `lint:all` 聚合脚本（若存在）。

***

### 阶段 2 · 非标准断点对齐（13 处）

按下表映射。每处需 Read 上下文后确认迁移方向（保守：仅改 @media 行的数值，不动规则体）。

| 现值     | 出现位置（文件:行）                                                                                        | 映射到                | 理由                             |
| ------ | ------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------ |
| 520px  | css/style.css:4448 / css/donation.css:305 / forum/forum.css:1308,2432,2542                        | **480px**          | 520 与 480 仅差 40px，统一到 --bp-2xs |
| 540px  | css/secret-portal.css:213                                                                         | **480px**          | 同上                             |
| 720px  | css/style.css:6020 / css/forum-shared.css:1784 / css/archive-subset.css:383 / forum/forum.css:511 | **768px**          | 720 与 768 仅差 48px，统一到 --bp-xs  |
| 860px  | forum/forum.css:741                                                                               | **768px 或 1024px** | 视规则体内容决定（布局质变点）                |
| 899px  | forum/forum.css:643                                                                               | **1024px**         | 接近 1024                        |
| 980px  | forum/forum.css:3186                                                                              | **1024px**         | 接近 1024                        |
| 1100px | forum/forum.css:517                                                                               | **1024px**         | 1100 接近 1024                   |

**注意**：`forum/forum.css:511` 是 `@media (min-width: 720px)`（少数 min-width 用法），迁移为 `(min-width: 768px)`；同样 `forum/forum.css:517` 是 `(min-width: 1100px)` → `(min-width: 1024px)`。

验收：`npm run lint:bp` 输出 0 非标准断点。

***

### 阶段 3 · 关键元素 clamp 化（按呈现效果最佳判断）

**不追求全量替换**。仅对以下高 ROI 元素做 clamp 化，确保跨断点过渡平滑：

**A. 字号**（参考 [css/tokens-base.css:130](file:///c:/Users/lenovo/CURSOR/Snow/css/tokens-base.css#L130) 已有的 `--fs-hero: clamp(2.8rem, 8vw, 5rem)` 模板）

* 主站 hero 标题、section 标题、profile-card 标题

* 论坛 hero 标题、卡片标题

* 角色页 hero 标题（[css/zone-atmosphere.css:87](file:///c:/Users/lenovo/CURSOR/Snow/css/zone-atmosphere.css#L87) 已用 clamp，可作参考）

* 估算 \~15-20 处

**B. 容器宽度**

* `.container` / `.hero` / `.profile-card` / `.forum-container` 等主容器的 `max-width` / `width`

* 估算 \~8-12 处

**C. 关键间距**

* section padding（hero / footer / 主要 section）

* card grid 的 gap

* 估算 \~10-15 处

**做法**：每个候选点 Read 上下文，确认 clamp 公式合理（最小值、首选值 vw、最大值），Edit 替换。不批量正则替换（避免破坏特殊场景）。

**范围控制**：预计 \~35-50 处。若某处 clamp 后视觉异常，立即回退为原 px。

***

### 阶段 4 · 验证三件套 + 浏览器实测

**自动校验**（必须全过）：

```bash
npm run lint           # ESLint 0 errors
npm run lint:css       # stylelint 0 errors
npm run lint:bp        # 断点契约 0 errors（新增）
node scripts/build-phase2.mjs  # bundle SRI 同步
node scripts/smoke-check.mjs    # 结构完整性
```

**浏览器实测**（由用户执行或 browser\_use 代理）：

* Chrome DevTools 切换 8 尺寸：320 / 360 / 480 / 768 / 1024 / 1280 / 1440 / 1920

* 检查无横向滚动条

* 移动端（360 / 414）下点击导航、按钮、tab，确认 tap-target ≥ 44px

* 触屏模拟（DevTools → Sensors → Touch）下 hover 效果不残留

* 主站 + 论坛 + 1 个角色页全测

***

## 文件改动清单

| 文件                             | 类型     | 改动                                                     |
| ------------------------------ | ------ | ------------------------------------------------------ |
| `css/tokens-base.css`          | 修改     | 顶部断点契约注释 + :root --bp-\* token + 末尾 pointer:coarse 全局块 |
| `scripts/lint-breakpoints.mjs` | **新建** | 断点校验脚本                                                 |
| `package.json`                 | 修改     | scripts 加 lint:bp                                      |
| `css/style.css`                | 修改     | 非标准断点对齐（720→768 等）+ 关键 clamp 化                         |
| `css/donation.css`             | 修改     | 520→480                                                |
| `css/secret-portal.css`        | 修改     | 540→480                                                |
| `css/forum-shared.css`         | 修改     | 720→768                                                |
| `css/archive-subset.css`       | 修改     | 720→768                                                |
| `forum/forum.css`              | 修改     | 5 处非标准断点对齐 + 关键 clamp 化                                |
| `forum/forum-visual.css`       | 修改     | 关键 clamp 化（hero 字号等）                                   |
| 其他 css                         | 按需     | clamp 化候选点                                             |

预计总改动 \~12 个文件，新增 1 个脚本文件。

***

## 风险与回退

| 风险                        | 缓解                                                                     |
| ------------------------- | ---------------------------------------------------------------------- |
| 非标准断点迁移造成视觉回归             | 仅改 @media 数值，不动规则体；每处 Read 上下文；720→768 / 520→480 差异 ≤48px，视觉影响微小       |
| 全局 tap-target 44px 让小按钮变大 | 用 `:not([data-keep-size])` 逃生口；视觉异常处加 `data-keep-size`                 |
| clamp 公式在中间尺寸产生意外值        | 每处 Edit 后单独测；异常立即回退为原 px                                               |
| pointer:coarse 误伤桌面触摸屏笔记本 | `(hover: none) and (pointer: coarse)` 双重限定，桌面触摸屏通常 hover:hover 仍为 true |

**回退策略**：所有改动以 commit 粒度分阶段提交，任一阶段验证失败可单独 revert。

***

## 验收标准

1. `npm run lint:bp` 输出 0 非标准断点
2. `npm run lint` / `lint:css` / `smoke-check` 全过
3. Chrome DevTools 8 尺寸全通过，无横向滚动
4. 移动端（≤480px）tap-target ≥ 44px，hover 效果不残留
5. 主站 + 论坛 + 角色页视觉无回归（关键 hero / 容器 / 间距）

