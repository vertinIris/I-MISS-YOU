# 飞行雪绒 UI/UX 前期规划方案

> 范围：捐赠区域重构、主题模式收敛、日记/时间线布局优化  
> 阶段：前期规划（不执行代码修改）→ ✅ 已确认方向，进入原型阶段  
> 日期：2026-08-12  
> 依据：用户截图 × 当前代码审查 × GitHub 优秀案例 × 本地已安装设计 Skill  
> **用户已确认**：调亮 = 方案 B 材质分层；捐赠区 = 桌面侧边固定卡；日记 = 杂志式时间线

---

## 一、用户实际体验审查

### 1.1 截图问题定位

| 截图 | 页面/模块 | 用户感知的问题 | 代码层面根因 |
|---|---|---|---|
| 图 1 | 投稿创作表单（主站） | 表单元素在深色背景上"融进去"，不明显、像卡住 | 表单容器缺少明确的 surface/card 背板；背景动画层与表单玻璃层对比度不足；输入框仅用 `surface-inset` + 细边框，在复杂星空背景上边界模糊 |
| 图 2 | 角色日志 / diary-book（主站） | 日期与正文竖向罗列"难看" | 双页书布局在窄屏下退化为单列长条；日期徽章（`.diary-date`）与长段落垂直堆叠，信息节奏单调；缺少摘要/折叠机制 |

### 1.2 全局体验风险（与两张截图同源）

1. **背景层与内容层对比不足**  
   当前 `sn-paper: oklch(12% 0.02 350)` 接近纯黑，卡片多用 4%–7% 白叠加的玻璃。在星空/粒子动画上，表单、日志卡片缺乏足够 elevation，导致"浮不起来"。

2. **内容密度与阅读节奏问题**  
   日记单篇字数普遍 200–400 字，当前每篇独占一行横向卡片，长文与短标在视觉上等重，没有" peek → 展开 "的渐进披露。

3. **捐赠入口打断性强**  
   当前是右下角 FAB + 全屏 modal。FAB 在移动端与"星炬论坛"入口 FAB 叠加，modal 遮盖当前页面，对只想随手支持的访客不够轻量。

4. **主题模式维护负担**  
   主站与论坛均保留 light 覆盖，捐赠模块单独写 60+ 行 light 覆盖。用户明确只需要当前暗色状态，light 代码成为负债。

---

## 二、GitHub 优秀案例对比思考

### 2.1 案例筛选

| 仓库/站点 | 相关亮点 | 可借鉴点 | 本项目适配性 |
|---|---|---|---|
| [futesat/futesat.github.io](https://github.com/futesat/futesat.github.io) | 深黑底 + 霓虹强调 + 玻璃卡片 + 自定义光标光晕 | 卡片 elevation 用半透明叠加而非纯黑；hover 状态清晰 | 高：可借鉴其卡片分层，但避免霓虹紫（与品牌冲突） |
| [Snixrs/snixrs.github.io](https://github.com/Snixrs/snixrs.github.io) | 紫渐变暗色 + glassmorphism + 粒子背景 | 粒子背景与内容分离；section 卡片有明确边框 | 中：粒子层处理可参考，紫色需收敛 |
| [Ero-Cat/Bento-Homepage](https://github.com/Ero-Cat/Bento-Homepage) | Liquid-glass + Bento 网格 + 明暗自动跟随 | Bento 卡片网格对日记/日志重排有参考价值 | 高：日记可改为 Bento 式卡片墙 |
| [moewah/MoeHome](https://github.com/moewah/MoeHome) | 赞助模块：2–3 个支付方式、二维码 + 外链、图标悬停反色 | **捐赠区最佳参考**：侧边/底部赞助卡片，轻量不弹窗 | 高：可直接作为"星炬论坛式"捐赠卡片范本 |
| [SKOHscripts/donate.github.io](https://github.com/SKOHscripts/donate.github.io) | 比特币捐赠页：二维码居中、语言切换、复制 URI | 二维码展示清晰；复制按钮体验好 | 中：可作为二维码展示细节参考 |
| [Yajon/donate-page](https://github.com/Yajon/donate-page) | 翻转卡片式/嵌入 iframe 捐赠按钮 | 形式新颖但打断感仍强 | 低：本项目用户要的是"旁边"而非弹窗 |
| uiCookies CSS Timelines | 10 种时间线模板：中心轴、交替卡片、横向里程碑、活动流 | **日记布局最佳参考**：用时间轴/卡片替代垂直列表 | 高：可引入"左日期 + 右内容卡片"或"交替时间轴" |

### 2.2 关键设计结论

- **捐赠不应是 FAB/Modal，应是 page 内的一个 widget/card**。moewah/MoeHome 的赞助卡片与星炬论坛的 `.stf-discuss-aside` 侧栏卡片思路一致：放在内容旁、默认可见、点击展开二维码。
- **暗色界面要"亮"，靠 elevation 而不是开灯**。Material/Linear 的做法是：背景从 #0A0A12 提到 #121212–#161616，卡片再用 #1E1E2E 级 surface，文本用 87%–95% 白。
- **长文本列表需要"呼吸"**。uiCookies 的时间线模板显示：把日期独立为视觉锚点（圆点/徽章），内容用卡片承载，交替或错落排布，能打破垂直堆叠的单调感。

---

## 三、本地已安装 Skill 应用策略

| Skill | 用途 | 本次规划中的应用 |
|---|---|---|
| `design-system-extract` | 从截图/代码提取 Token 与组件规范 | 已用于提取当前 tokens-snow.css / tokens-stf.css 的配色、字体、间距，作为改动基准 |
| `frontend-aesthetic-direction` | 输出 3–4 个美学方向 | 用于生成"调亮暗色"的多个可行方向（见下文方案 A/B/C） |
| `wireframe` | 低保真布局探索 | 用于产出日记布局 3 个变体 + 捐赠区 2 个变体 |
| `make-prototype` | 高保真 HTML 原型 | 后续用户选定方向后，按此规划生成可点击原型 |

> 本次不调用 `make-prototype`，因为用户要求"不执行"，且需要等方向确认。

---

## 四、具体改动方案

### 4.1 捐赠区域：从 FAB/Modal 改为"星炬论坛式"侧栏卡片

#### 当前状态
- 文件：`css/donation.css`、`js/donation.js`、`index.html` 底部
- 实现：`.donate-fab` 固定右下角 → 点击打开 `.donate-modal` 全屏遮罩 → 展示二维码

#### 目标设计（✅ 已确认：桌面侧边固定卡）

在主站右侧以**常驻悬浮卡片**承载赞助支持（替换现有 FAB+Modal 位置）：

1. **桌面端（≥1024px）**：右侧固定悬浮卡（`position: fixed; right: 24px; bottom: 96px`），卡片内嵌"星炬论坛式"捐赠内容：标题 + 支付方式分段切换 + 二维码 + 最小化按钮
2. **移动端（<1024px）**：收起为右侧圆形入口按钮，点击展开底部抽屉（bottom sheet）而非全屏 modal
3. **论坛沿用**：论坛侧栏 `.stf-discuss-aside` 已有同构风格，主站卡片用粉蓝配色、论坛用蓝金，禁止"同款换色皮"

> 设计动机：访客"随手支持"不应被全屏打断；侧边卡常驻可见但可一键收起，兼顾曝光与打扰程度。与 FAB 相比：不遮页面主内容、信息一屏看全。

#### 组件结构（规划）

```html
<!-- 桌面侧边固定卡（替换 .donate-fab + .donate-modal） -->
<div class="support-dock" aria-label="赞助支持">
  <button class="support-dock-toggle is-open" aria-expanded="true" aria-controls="support-card">
    <span class="support-dock-icon" aria-hidden="true">☕</span>
    <span class="support-dock-label">支持站点</span>
  </button>
  <section class="support-card glass" id="support-card">
    <header class="support-card-header">
      <div>
        <h2 class="support-title">请制作人喝杯咖啡</h2>
        <p class="support-desc">每一份支持都会变成星空下更稳定的信号。</p>
      </div>
      <button class="support-minimize" aria-label="收起">—</button>
    </header>
    <div class="support-methods" role="tablist">
      <button class="support-method is-active" data-method="wechat">微信</button>
      <button class="support-method" data-method="alipay">支付宝</button>
    </div>
    <div class="support-qr">
      <img src="assets/qrcode-wechat.png" alt="微信支付二维码" data-method="wechat" class="is-active">
      <img src="assets/qrcode-alipay.jpg" alt="支付宝二维码" data-method="alipay">
    </div>
    <p class="support-note">选择方式后扫码即可。你的陪伴，是这里继续发光的理由。</p>
  </section>
</div>

<!-- 移动端：入口按钮 + 底部抽屉（同 DOM，CSS 控制形态） -->
```

#### 视觉规范
- 卡片宽度：约 280px，`position: fixed; right: 24px; bottom: 96px; z-index: 50`
- 卡片背景：`var(--surface-card)`（方案 B 提亮后）
- 边框：`var(--surface-card-border)` 提升为 10% 白
- 图标区：圆形渐变徽章，粉→蓝
- 支付方式切换：胶囊分段器（segmented control）
- 二维码容器：白色内衬 + 圆角 + 内阴影，保证扫码识别（白色底是扫码硬要求）
- 收起态：仅剩圆形 ☕ 按钮，带未读感的呼吸光圈提醒存在感

#### 交互
- 默认展开卡片，二维码默认显示微信（第一支付方式）
- 切换支付方式时二维码 cross-fade
- 卡片头部的"收起"按钮 → 最小化为圆形 ☕ 按钮（`aria-expanded` 联动）
- 移动端收起 → 显示为底部导航条右侧的圆形入口，点击弹出 bottom sheet
- 保留"最小化"而非"关闭"，让反感赞助的用户可收起、不打扰

#### 影响文件
- `css/donation.css`：重写为 dock/card 样式
- `js/donation.js`：移除 modal 逻辑，改为 tab 切换 + 收起/展开状态
- `index.html`：移除 FAB/modal DOM，插入 support-dock
- `forum/index.html` 与 `forum/forum-theme.css`：论坛已有 aside，可复用结构；删除 `.donate-fab` 相关覆盖

---

### 4.2 主题模式：删除日光模式，保留并调亮当前暗色

#### 当前状态
- `css/style.css` 含 `[data-theme="light"]` 覆盖（约 30+ 处）
- `css/donation.css` 含 60+ 行 light 覆盖
- `forum/js/forum-theme-bootstrap.js` 支持 dark/light/auto 三种
- `index.html` 默认 `data-theme="dark"`

#### 目标
- 删除所有 light 主题代码
- 论坛主题 bootstrap 只保留 dark（可保留 auto 检测，但 eff 固定 dark）
- 提升 dark 界面整体亮度与可读性

#### 调亮策略（✅ 已确认：方案 B 材质分层）

**方案 B：Material 式分层（已选定）**
- 背景用 `#121212` 等价 `oklch(21% 0 0)` 替代当前 `#0A0A12`，抬升全局亮度基线
- 卡片 surface 用 `#1E1E2E`（带粉/蓝 tint，蓝向 `oklch(24% 0.012 285)`）
- 最高 elevation（弹层/抽屉）用 `#252536`（`oklch(28% 0.014 285)`）
- 玻璃层与卡片背板 alpha 提到 8%–9% 白，边框 14% 白
- 文本分层：主 96% 白、secondary 88%、辅助 74%
- 强调色（粉/蓝）饱和度降低 15%–20%，大面积填充不刺眼，焦点色保持

**（备选记录，未采用）**
- ~~方案 A：保守提亮~~ —— 只动 token 亮度，改动最小，但用户选 B
- ~~方案 C：OLED 暖灰~~ —— 偏离粉蓝冷调，未选

#### 实施要点
- 删除 `css/style.css` 中所有 `[data-theme="light"]` 规则
- 删除 `css/donation.css` 中 light 覆盖
- 删除/简化 `forum/js/forum-theme-bootstrap.js` 的 auto/light 分支
- 统一使用 CSS 变量，不硬编码 #000
- 所有文本在最终背景上验证 WCAG AA（正文 ≥ 4.5:1）

---

### 4.3 日记/时间线布局：从垂直列表改为杂志式时间线

#### 当前状态
- 容器 `.diary-book` 为双页书布局（左页 + 右页）
- 单篇 `.diary-entry` 为横向 flex：日期徽章左 + 内容右
- 移动端：双页退化为单列，日期与内容仍横向，但在窄屏下挤压

#### 问题根因
- 日期徽章 `.diary-date` 在窄屏下仍占固定 60px + padding，导致正文可用宽度不足
- 多篇日记连续堆叠，缺少视觉锚点和阅读停顿
- 标题与日期分属左右，视线来回跳动

#### 目标设计（✅ 已确认：杂志式时间线）

**"星历卡片" 时间线 —— 杂志式（已选定）**

**桌面端（≥1024px）**
- 单列时间轴 + 日期/标题同行 + 正文折叠预览，右侧 tag 行
- 长文卡片可跨列，形成杂志节奏（`grid-template-columns: repeat(6, 1fr)`，卡片按内容权重跨 4–6 列）

**平板端（768px–1024px）**
- 左对齐时间轴：竖线 + 圆点在左，卡片在右

**移动端（<768px）**
- 卡片垂直堆叠，但内部改为：**日期徽章与标题同行**（例如 "25 六月 · 渐湖"），正文显示前 3 行 + "展开" 按钮
- 不采用当前"日期独占一行、正文另起一列"的窄屏布局

#### 组件结构（规划）

```html
<div class="diary-timeline">
  <article class="diary-card">
    <header class="diary-card-header">
      <time class="diary-card-date" datetime="2026-06-25">
        <span class="diary-card-day">25</span>
        <span class="diary-card-month">六月</span>
      </time>
      <h3 class="diary-card-title">渐湖</h3>
    </header>
    <div class="diary-card-body">
      <p>今天在数据系统里翻了拉海洛的旧地图……</p>
      <!-- 移动端默认折叠，展开后显示全文 -->
    </div>
    <footer class="diary-card-footer">
      <span class="diary-card-tag">#机兵形态</span>
      <span class="diary-card-tag">#飞行</span>
      <span class="diary-card-tag">#爱弥斯</span>
    </footer>
  </article>
</div>
```

#### 视觉规范
- 卡片背景：`var(--surface-card)`（提亮后）
- 日期徽章：圆形或圆角矩形，粉蓝渐变背景
- 时间轴线：1px，`var(--glass-border)`，hover 时高亮
- 标题：与日期同行，字号 `var(--fs-title)`
- 正文：最多 4 行省略，展开按钮用 text-link 样式

#### 响应式策略
- 用 CSS Grid 实现 Bento/交替布局
- `clamp()` 控制卡片宽度
- 移动端 `grid-template-columns: 1fr`

#### 影响文件
- `css/style.css`：重写 `.diary-book`、`.diary-entry`、`.diary-date` 等
- `index.html`：调整日记 HTML 结构
- `js/main.js`：新增"展开/收起"交互
- `css/archive-subset.css` 中的 `.archive-timeline` 可同步统一风格

---

## 五、设计 Token 调整草案

### 5.1 主站暗色提亮（✅ 方案 B 材质分层数值）

| Token | 当前值 | 建议值 | 说明 |
|---|---|---|---|
| `--sn-paper` | `oklch(12% 0.02 350)` ≈ #0A0A12 | `#121212` ≈ `oklch(21% 0 0)` | 全局亮度基线抬升（背景） |
| `--sn-paper-2` | `oklch(16% 0.025 350)` | `#1E1E2E` ≈ `oklch(24% 0.012 285)` | surface 卡片层（带蓝 tint） |
| `--sn-paper-3` | `oklch(20% 0.03 348)` | `#252536` ≈ `oklch(28% 0.014 285)` | 最高 elevation（抽屉/弹层） |
| `--glass-bg` | `oklch(96% 0.01 350 / 0.04)` | `oklch(96% 0.01 350 / 0.08)` | 玻璃提亮 |
| `--glass-border` | `oklch(96% 0.01 350 / 0.10)` | `oklch(96% 0.01 350 / 0.14)` | 边框可见 |
| `--surface-card` | `oklch(96% 0.01 350 / 0.045)` | `oklch(96% 0.01 350 / 0.09)` | 卡片背板（在 1E1E2E 底上再叠白） |
| `--sn-ink-2` | `oklch(82% 0.02 350)` | `oklch(88% 0.018 350)` | 正文 secondary 提亮 |
| `--sn-ink-3` | `oklch(68% 0.025 350)` | `oklch(74% 0.022 350)` | 辅助信息提亮 |
| `--sn-ink-4` | —（新增） | `oklch(60% 0.02 350)` | 占位/禁用文本层级 |

> 分层关系（Material 式）：背景 `#121212` ＜ 卡片 `#1E1E2E` ＜ 弹层 `#252536`，配合 8%–9% 白玻璃叠加与 14% 白边框，形成明确的 elevation 层级。

### 5.2 强调色降饱和

当前粉 `#F4729B` / 蓝 `#6B8AFF` 在暗底上可能过艳。建议：
- 主粉：保持色相，但降低 5%–10% 饱和度用于大面积填充
- 蓝：用于焦点、链接，保持现有值即可
- 金色：按用户要求继续降级，仅用于 focus-ring 或极少 icon

---

## 六、实施优先级与工作量

| 优先级 | 任务 | 预计文件 | 依赖 |
|---|---|---|---|
| P0 | 删除 light 主题代码，统一 dark 提亮 Token | `css/style.css`, `css/donation.css`, `forum/js/forum-theme-bootstrap.js`, 各 HTML `data-theme` | 无 |
| P1 | 捐赠区重构为侧栏/section 卡片 | `css/donation.css`, `js/donation.js`, `index.html`, `forum/forum-theme.css` | P0（Token 提亮后卡片才明显） |
| P2 | 日记布局改为杂志式时间线 | `css/style.css`, `index.html`, `js/main.js` | P0 |
| P3 | 投稿表单增加明确背板 | `css/style.css` 投稿相关样式 | P0 |
| P4 | 角色档案 `.archive-timeline` 同步新时间线风格 | `css/archive-subset.css`, `characters/*/index.html` | P2 完成后 |
| P5 | 回归测试：Lighthouse / axe-core / 移动端截图 | CI 工作流 | 全部完成后 |

---

## 七、风险与注意事项

1. **CSP 与外链**：捐赠卡片若引入外部图标/图片，需确保在现有 CSP 白名单内。
2. **Service Worker 缓存**：样式大改后，需确认 `sw.js` 的 `CACHE_VERSION` 提升，避免用户看到旧样式。
3. **论坛与主站风格区分**：捐赠卡片在主站用粉蓝，在论坛用蓝金，禁止"同款换色皮"。
4. **减少动画偏好**：所有新 hover/展开动效必须包裹 `@media (prefers-reduced-motion: reduce)`。
5. **不恢复 light 主题**：删除代码前确认没有用户/设备依赖 light；当前 `forum-theme-bootstrap.js` 的 auto 模式可能让少数设备变 light，删除是用户明确需求。

---

## 八、决策记录与下一步

### ✅ 用户已确认（2026-08-12）
1. **调亮方案**：方案 B 材质分层（背景 #121212 / 卡片 #1E1E2E / 弹层 #252536）
2. **捐赠区位置**：桌面侧边固定卡（替换 FAB+Modal，移动端退化为底部抽屉）
3. **日记布局**：杂志式时间线（日期+标题同行、正文折叠、tag 行）

### 下一步
1. ~~用户确认方向~~（已完成）
2. 进入 `make-prototype` 阶段：按本文档 Token 与结构生成**高保真 HTML 原型**（独立预览文件，不改生产代码），供用户预览三个模块效果
3. 原型确认后，按「六、实施优先级」P0→P5 落地到项目代码，并自行 commit + push
