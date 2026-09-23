# 设计文档 — 飞行雪绒 × 星炬学院（反 AI 味编辑式重构）

> 本文件为飞行雪绒站点的**完整设计规格**，含全部功能点（功能点清单 + 可落地设计方案）。
> 设计语言：**反 AI 味编辑式（editorial）× 夜色纸感（midnight-paper）**。
> 架构定位：**飞行雪绒 = 频道**（叙事聚焦 爱弥斯 × 漂泊者）并置于 **星炬学院 = 主站 / 论坛**。
> 资料优先级：鸣潮官方 ＞ 同人共识补白 ＞ 项目原创（硬规则见 `docs/WORLDVIEW.md`，机读源 `docs/worldview-glossary.json`）。

---

## 0. 文档范围与状态

- **当前重构进度**：`redesign/` 已落地「编辑式落地页」（视觉与微交互），但仅为展示层，缺失绝大多数功能挂载点。
- **本文件目标**：逐项核对功能点 → 标记覆盖状态 → 对缺失项给出可落地方案 → 作为后续「提升为线上主站」的单一事实来源。
- **不可覆盖项（红线）**：§5 列出的页脚与全部彩蛋，任何重构不得遗漏或覆盖。

---

## 1. 设计原则（反 AI 味）

援引 `pbakaus/impeccable`、`kdcokenny/opencode-workspace` frontend-philosophy（5 支柱）、lobehub `frontend-design-philosophy` 反模式提示词。

1. **排版为王**：衬线 Display（Fraunces + Noto Serif SC）建立层级；无衬线（Noto Sans SC）做正文；左对齐、模块化字阶、`clamp()` 流体尺寸。
2. **留白即设计**：大间距建立呼吸；正文限宽 ~68ch；杜绝信息拥挤与「卡片套卡片」。
3. **克制色彩**：单一雪绒玫瑰主色 + 一抹冷调冰蓝点缀，中性墨/纸层次；无霓虹、无渐变文字、无发光。
4. **有意的微交互**：滚动渐显（IntersectionObserver 错峰）、磁性按钮、下划线绘出；一次一处高光；严格尊重 `prefers-reduced-motion`。
5. **质感细节**：纸面颗粒（SVG 噪声 ~3%）、发丝分隔线、精绘雪绒 SVG 标记（非大 Logo）、液态玻璃仅用于必要表面。

**明确反参照（AI Slop，禁止）**：霓虹辉光、动态渐变按钮、星云/粒子/流星/雪花背景、渐变文字、超大旋转 Logo、三栏图标卡片、居中堆砌英雄区、Inter/Roboto 默认字、玻璃拟态滥用、回弹缓动、常驻无限动画。

---

## 2. 设计令牌（Tokens）

### 2.1 飞行雪绒（活动主系统，来自 `redesign/refined.css`）

| 用途 | 令牌 | 值 |
|---|---|---|
| 纸面 | `--paper` | `oklch(15% 0.018 350)` 玫夜墨 |
| 纸面 2/3 | `--paper-2/3` | `oklch(19%…)` / `oklch(24%…)` |
| 墨色 | `--ink / --ink-2 / --ink-3` | `oklch(95%)` / `oklch(80%)` / `oklch(64%)` |
| 发丝线 | `--rule / --rule-strong` | 玫瑰透明 0.16 / 0.30 |
| 主色 | `--rose / --rose-strong / --rose-soft` | `oklch(72% 0.13 350)` 雪绒粉 |
| 点缀 | `--ice / --ice-dim` | `oklch(82% 0.05 230)` 冰蓝（仅点缀，非品牌） |
| 玻璃 | `--surface / --surface-line / --blur` | 低透白 + `blur(14px) saturate(115%)` |
| 圆角 | `--r-sm/md/lg/pill` | 8 / 14 / 22 / 999px |
| 缓动 | `--ease-out` | `cubic-bezier(0.16,1,0.3,1)` |
| 字阶 | `--fs-mega…--fs-micro` | mega `clamp(3.2,9vw,7)rem` 起 |
| 字体 | 显示 Fraunces+Noto Serif SC；正文 Noto Sans SC；等宽 IBM Plex Mono | — |
| 版心 | `--measure:68ch` `--gutter` `--section-y:clamp(5rem,12vw,10rem)` | — |

### 2.2 星炬学院（论坛主站，来自旧 `design.md`）

| 用途 | 令牌 | 值 |
|---|---|---|
| 纸面 | `--paper` | `oklch(14% 0.03 250)` 学院深蓝 |
| 品牌 | `--brand` | `oklch(68% 0.12 255)` 星炬蓝 |
| 金 | `--gold` | `oklch(78% 0.12 85)` 仅签发/精华/通行证 |
| 字体 | 显示/正文 Noto Serif SC / Noto Sans SC；等宽 JetBrains Mono | — |
| 圆角 | 锐角 6–10px | — |
| 动效 | 灯芯点亮 · 侧栏滑入 · 帖卡边光（克制） | — |

> 两站气质必须一眼区分；禁止同款换色皮。星炬学院允许蓝金星炬，禁止粉铺底。

---

## 3. 功能点需求清单（逐项核对）

状态图例：✅ 已涵盖 ｜ 🟡 部分/需修正 ｜ ❌ 缺失

| 编号 | 功能点 | 优先级 | 当前 redesign 状态 | 说明 |
|---|---|---|---|---|
| F1 | 玻璃导航 + 下滚隐藏 | 高 | ✅ | `nav.hidden` 已落实 |
| F2 | 滚动进度 / 章节标签 | 中 | ❌ | 旧版 `sn-scroll-fill`/`sn-scroll-label`；redesign 未含 |
| F3 | Supabase 账号面板（注册/登录/管理员） | 高 | ❌ | 旧版 `account-panel`；redesign 无 |
| F4 | 位置选择器（在线·星炬学院） | 低 | ❌ | 因星炬学院已定为主站，可合并入导航副标或省略 |
| F5 | 移动端菜单 | 高 | ❌ | redesign 仅隐藏次级链接，需补汉堡菜单 |
| F6 | 编辑式 Hero | 高 | ✅ | 左对齐衬线大标题 |
| F7 | 关于 / 来历 | 高 | ✅ | `#story` |
| F8 | 角色专区 | 高 | 🟡 | 含达妮娅/西格莉卡，**须按文案决策收敛为爱弥斯×漂泊者** |
| F9 | 音乐播放器（Web Audio 合成 + 可视化 + 列表） | 高 | ❌ | redesign 仅有文字特性，无播放器 |
| F10 | 同人作品（fanwork） | 中 | ❌ | 缺 |
| F11 | 时间线 / 动态（post-1..7） | 中 | ❌ | 缺 |
| F12 | 雪绒日志（diary） | 中 | ❌ | 缺 |
| F13 | 投稿表单（含 auth 状态栏） | 高 | ❌ | 缺 |
| F14 | 调频 9072（FREQ 90.72 MHz） | 高（彩蛋） | ❌ | 音乐曲 + 页脚邮戳，均缺 |
| F15 | 雪臂彩蛋（尝试连接信号） | 高（彩蛋） | ❌ | `egg-trigger` 缺 |
| F16 | 秘密传送门（secret-portal） | 中（彩蛋） | ❌ | 缺 |
| F17 | 频谱签名页脚 | 高（彩蛋） | ❌ | redesign 为纯文字页脚 |
| F18 | 五连点彩蛋 | 中（彩蛋） | ❌ | 缺 |
| F19 | SnowRealm 五地址 | 低（设定） | ❌ | 文案层 |
| F20 | 电子幽灵 / 电子海 | 低（设定） | ❌ | 文案层 |
| F21 | 雪原小屋 | 低（设定） | ❌ | 文案层 |
| F22 | 结契人（标注非官方） | 低（设定） | ❌ | 文案层，须标注 |
| F23 | 捐赠悬浮按钮 + 弹窗（微信/支付宝二维码） | 中 | ❌ | 缺 |
| F24 | 夜电台页脚（EQ 频谱 / FREQ 90.72 / ON AIR / 版权） | 高 | 🟡 | redesign 为极简页脚，**须恢复夜电台处理（§5 红线）** |
| F25 | 论坛左固定筛选栏 sticky | 高 | ✅ | `css/forum-redesign.css` 已完成 |
| F26 | 论坛夜电台尾页 | 高 | ✅ | 已完成 |
| F27 | 论坛音乐播放器 | 高 | ✅ | `forum/js/forum-music.js` 已完成 |
| F28 | 论坛捐赠按钮 | 中 | ✅ | 保留 |
| F29 | 论坛 9072 隐藏触发 | 中 | ✅ | `stf-hidden-trigger` 保留 |
| F30 | Service Worker + CSP | 高（基建） | ❌ | redesign 未含，上线必须加回 |
| F31 | web-vitals RUM | 中（基建） | ❌ | 缺 |
| F32 | 管理后台 | 中 | ❌ | 后续阶段 |
| F33 | SRI / vendor（dompurify, marked, notyf） | 高（安全） | ❌ | 上线必须加回 |

**覆盖统计**：✅ 9（含论坛 5）｜🟡 3 ｜❌ 21。

---

## 4. 缺失功能点 · 可落地设计方案

> 所有方案沿用 `redesign/refined.css` 令牌；挂载点 ID 与旧版 `dist/bundle-main.js` / `js/*.js` 保持一致，确保「换新皮、保功能」。

### 4.1 账号系统（F3 · Supabase Auth）
- **结构**：导航右侧加 `account-panel`（默认 `hidden`），含注册/登录两个 tab + 管理员登录入口。
- **挂载点**（沿用旧版）：`#nav-account-btn`、`#account-panel`、`#account-register-email/-password/-password2`、`#account-register-submit`、`#account-login-email/-password`、`#account-login-submit`、`#account-forgot-btn`、`#account-panel-user`、`#account-signout-btn`、`#admin-panel-open-btn`。
- **脚本**：`js/supabase-loader.js` + `dist/bundle-main.js`（含 `auth-manager.js`）。
- **样式**：面板用 `--surface` 玻璃，发丝边框，按钮复用 `.btn-primary`/`.btn-ghost`；错误提示 `--rose` 文字。

### 4.2 滚动进度 / 章节标签（F2）
- 导航底缘加 `1px` 高 `sn-scroll-fill`，宽度随页面滚动百分比；左侧 `sn-scroll-label` 显示当前章节（`§ 00 · HERO` 风格）。
- 仅 `transform: scaleX()` 动画；`prefers-reduced-motion` 下保留静态满格。

### 4.3 移动端菜单（F5）
- `<=560px` 时次级链接收进 `menu-btn` 展开层；复用汉堡 → 全屏遮罩列表交互。

### 4.4 角色专区修正（F8 · 结合文案决策）
- **删除**达妮娅、西格莉卡卡片；仅保留 **爱弥斯** 与 **漂泊者**。
- 结构沿用 `.zones/.zone`，`zone-tag` 改为 `Aemeath` / `Drifter`；描述按 `docs/WORLDVIEW.md` 收敛（爱弥斯=秘密歌手；漂泊者=渐湖小屋冬日的频道叙事伙伴）。
- 链接：`characters/aimisi/`、`characters/drifter/`（达妮娅/西格莉卡档案归入星炬学院主站角色档案）。

### 4.5 音乐播放器（F9 · 夜电台）
- **结构**（沿用旧版 ID）：`.music-module` → `.music-player`（`#music-visualizer`/`#viz-canvas`、`#music-disc`、`#prev-track`/`#play-btn`/`#next-track`、`#progress-bar`/`#progress-fill`、`#current-time`/`#total-time`）+ `.music-playlist`（`#playlist`，`data-track` 曲目项）+ `.music-disclaimer`。
- **脚本**：`#play-btn` 等绑定 `dist/bundle-main.js` 内音乐逻辑（Web Audio 合成，无音频文件时按真实时间推进可视化）。
- **曲目**：保留《星炬学院的深夜》《信号中的回响》《渐湖的冰面》《双形态协奏曲》+ **《调频9072》**（彩蛋曲，见 F14）。
- **样式**：`.music-module` 用 `--surface` 玻璃；唱片/磁带旋转用 `--rose` 描边；进度条 `--rose` 填充；`prefers-reduced-motion` 关旋转/可视化动画。

### 4.6 同人作品 / 时间线 / 雪绒日志（F10–F12）
- **时间线**：`.timeline` 纵向时间轴，`post-card`（沿用 `#post-1..n`、`data-post-id`），发丝分隔 + `.reveal` 渐显；内容由 `repository.js` 拉取。
- **日志**：`.section-diary`，卡片式日志条目（`#diary` 下 `.diary-card` + `#diary-tag`）。
- **同人作品**：`.fanwork` 错落网格（非三栏图标卡），单卡限宽、发丝边。
- 三模块均接 `reveal` 错峰渐显，限宽 `--measure`。

### 4.7 投稿表单（F13）
- 结构：`#submit` 区 → `#auth-status`（`#auth-status-text`/`#auth-upgrade-toggle`）+ `#submit-form`（`#submit-nickname`/`#submit-type`/`#submit-title`/`#submit-content`）。
- 提交走 `auth-manager` + `repository`；未登录提示「打开账号」。
- 样式：表单字段 `.form-input` 用纸面 2 + 发丝边，聚焦 `--rose` 边框。

### 4.8 彩蛋体系（F14–F22 · §5 红线，必须保留）

| 彩蛋 | 落地方案 |
|---|---|
| **F14 调频 9072** | 音乐列表含《调频9072》曲；页脚邮戳 `SENT · 9072`（F24 内）；`FREQ · 90.72 MHz` 常驻夜电台页脚 |
| **F15 雪臂彩蛋** | `#easter-egg` 区保留 `#egg-card`/`#egg-trigger`/`#egg-result`；点击「尝试连接信号」触发 JS 叙事反馈；雪花 SVG 改为精绘单色（去 `snowGlow` 霓虹，用 `--ice` 描边） |
| **F16 秘密传送门** | `#secret-portal-root` + `js/secret-portal.js`；特定交互序列开启隐藏页 |
| **F17 频谱签名页脚** | 页脚含静态 EQ 频谱条（`--rose` 填充，`--eqh` 高度）、`FREQ 90.72 MHz`、`ON AIR`、签名行；本项即 F24 主体 |
| **F18 五连点彩蛋** | 页脚或导航隐藏的 5 个圆点，特定点击序列触发 |
| **F19 SnowRealm 五地址** | 设定层，于「关于/世界观」文案列出（非 UI 组件） |
| **F20 电子幽灵/电子海** | 设定层，文案体现；可于音乐《信号中的回响》描述呼应 |
| **F21 雪原小屋** | 设定层，于漂泊者叙事体现（渐湖小屋冬日） |
| **F22 结契人** | 文案出现处**必须标注**「AO3 同人原创概念，非官方设定」（沿用 `docs/WORLDVIEW.md` 约定） |

### 4.9 捐赠（F23）
- 右下 `donate-fab`（`#donate-fab`）+ `#donate-modal`（微信/支付宝 `donate-qr-img`，`data-method`）。
- 复用旧版 `donation.js`（已合并入 bundle）；样式用 `--rose` 心形图标 + 玻璃弹窗。

### 4.10 页脚（F24 · §5 红线）
- **必须恢复夜电台页脚**（`sn-footer`）：EQ 频谱条 + `FREQ · 90.72 MHz` + `ON AIR · 飞行雪绒夜电台` + `#sn-footer-time` 实时时钟 + `SENT · 9072` 邮戳 + 版权列（`#sn-footer-year` 自动年号）+ 跨站入口（论坛/角色档案）。
- 取代 redesign 当前的极简 `.foot`。

### 4.11 基建（F30–F33 · 上线必须）
- **CSP**：根 `index.html` `<meta http-equiv>` 保留 `img-src 'self' data: blob: https://*.supabase.co` / `connect-src 'self' https://*.supabase.co wss://*.supabase.co`。
- **SW**：`js/sw-register.js` 保留；`sw.js` 沿用 network-first 策略（v11.5.2 已修陈旧缓存）。
- **web-vitals**：`js/web-vitals-collector.js`（module）保留。
- **SRI vendor**：dompurify / marked / highlight / notyf 维持 `integrity` + `crossorigin`。
- **admin-panel**：`#admin-panel-open-btn` + `admin-panel.js` 后续阶段接入。

---

## 5. 既有特性保留清单（不可遗漏 / 不可覆盖 · 红线）

以下特性在「提升重构为线上主站」时**必须完整保留**，任何重构不得删减或覆盖：

1. **夜电台页脚（F24）**：EQ 频谱 + `FREQ 90.72 MHz` + `ON AIR` + 实时时钟 + `SENT · 9072` 邮戳 + 版权列 + 跨站入口。
2. **彩蛋全集（F14–F22）**：调频 9072、雪臂彩蛋、秘密传送门、频谱签名页脚、五连点彩蛋、SnowRealm 五地址、电子幽灵/电子海、雪原小屋、结契人（标注）。
3. **音乐播放器（F9）**：Web Audio 合成逻辑、可视化、播放列表（含《调频9072》）。
4. **Supabase 账号系统（F3）**：注册/登录/管理员，与 `dist/bundle-main.js` 挂载点一致。
5. **捐赠（F23）**：`donate-fab` + 双码弹窗。
6. **投稿（F13）**：含 auth 状态栏。
7. **基建（F30–F33）**：CSP、SW、web-vitals、SRI vendor。
8. **论坛已重设计项（F25–F29）**：左固定栏、夜电台尾页、音乐播放器、捐赠按钮、9072 触发 —— 保持已落地状态，不回退。

---

## 6. 落地路径 / 迁移步骤

1. **提升 redesign 为根 `index.html`**：以 `redesign/index.html` 为骨架，按 §4 补全 F2–F24 的 DOM 挂载点。
2. **CSS 合并**：`refined.css` 为活动设计系统；补充 `music / account / submit / egg / donate / sn-footer` 模块样式（并入 `refined.css` 或独立 `modules.css`，在 `refined.css` 后加载）。
3. **脚本挂载**：保留 `vendor/*` + `js/supabase-loader.js` + `dist/bundle-main.js` + `js/web-vitals-collector.js` + `js/sw-register.js`，确保 §4 挂载点 ID 不被改名。
4. **角色专区收敛（F8）**：删除达妮娅/西格莉卡卡片。
5. **页脚恢复（F24）**：用 `sn-footer` 替换 `.foot`。
6. **预览核对**：本地 HTTP 服务（`python -m http.server`）逐项比对 §3 清单，确认 ✅ 项不回退、❌ 项已补。
7. **提交推送**：经服务代理 `git -c credential.helper=wincred -c "http.proxy=$HTTPS_PROXY" push origin main`；CI（`pages-deploy.yml`）自动部署。
8. **后续阶段**：管理后台（F32）、SnowRealm 设定页（F19）、结契人标注页（F22）。

---

## 附：与旧 `design.md` 的差异

- 设计系统由「ZCOOL XiaoWei + 旧 oklch」统一为 **Fraunces + Noto Serif SC 编辑式**（反 AI 味）。
- 新增 **§3 功能点需求清单（33 项）** 与 **§4 缺失项可落地方案**，旧版仅含令牌与流派表。
- 明确 **飞行雪绒 = 爱弥斯×漂泊者** 的收敛（F8）与 **星炬学院 = 主站** 的架构（F4/F25–F29）。
- 锁定 **页脚 + 彩蛋为不可覆盖红线（§5）**。
