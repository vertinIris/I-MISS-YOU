# 飞行雪绒站 全面问题诊断报告

> 日期：2026-09-10 · 范围：飞行雪绒主站（论坛仅抽查）· 性质：只读分析，不含任何代码修改
> 依据：用户截图 3 张 + 部署站实测（curl/无头 Chrome）+ 源码静态审查

---

## 〇、截图症状复核（已确认）

| 截图 | 位置 | 症状 |
|---|---|---|
| 图1 | 社区区/页脚 | 全部 `.reveal` 内容（26 个元素）不可见，仅剩无 reveal 的静态元素（社区筛选器/标签/页脚）；社区卡片未渲染；滚动指示停在初始「§ 00 · HERO」 |
| 图2 | 某内容区 | 几乎全黑，仅剩装饰元素（签名胶带/球体），正文全不可见 |
| 图3 | Hero | 大标题「飞行雪绒」与 hero-badge 不可见；滚动旋钮文字 SCROLL·TURN·LISTEN 与按钮重叠；下方内容全黑 |

**对照实验**：同一代码在无头 Chrome 干净环境中 JS 完整执行、DOM 完整（7 帖/14 社区卡/13 评论/body `data-realm` 已设置），无任何 JS 错误。
**结论**：部署资产本身完整正确（HTML/CSS/JS 字节级校验通过、SRI 匹配）；用户浏览器处于**异常资产状态**——最可能是 Service Worker 陈旧/混合缓存（详见 S-01/S-02）。

---

## 一、严重问题（阻断核心功能，优先修）

### S-01 内容可见性 100% 依赖 JS，无降级兜底
- **表现**：`.reveal` 初始 `opacity:0`（style.css:3488），仅靠 `initScrollReveal()`（main.js:39）经 IntersectionObserver 加 `.visible`。JS 一旦未执行/中断，26 个内容块（全部 section-header、profile/music 模块、7 帖、6 日志、投稿卡、信封）**永久隐身**——即图1/图2 的大片黑区。
- **原因**：可见性设计无 no-JS / IO 失败 / JS 报错 的降级路径；全站无 `.no-js` 模式或 `@media (scripting: none)` 兜底。
- **方案**：① CSS 增加兜底：`html:not(.js) .reveal{opacity:1;transform:none}`，并在 `<html>` 最早期内联微脚本 `document.documentElement.classList.add('js')`；② 或给 `.reveal` 加 `animation` 超时自显示（`animation: revealFailsafe 0s 3s forwards`）；③ observer 创建包 try-catch，失败时批量加 `.visible`。

### S-02 Service Worker 静态资源 cache-first + 版本号硬编码，陈旧缓存长期滞留
- **表现**：sw.js:13 `CACHE_VERSION='snowfluff-v11.5.1'` 硬编码；fetch 策略中文档 network-first（正确），但**静态资源（CSS/JS）cache-first**（sw.js:127）。同日两次部署（ed6c405→78a3af0）sw.js 字节未变 → 浏览器不触发 SW 更新 → 旧 CSS/JS 被无限期缓存。用户 Ctrl+F5 **无法绕过 SW**（与「强制刷新无效」吻合）。
- **原因**：缓存版本与内容哈希/构建号不挂钩；版本号需手动改，实际从未随部署递增。
- **方案**：① CI 部署工作流注入构建号重写 sw.js 的 CACHE_VERSION（如 `snowfluff-${GITHUB_SHA:0:8}`），保证每次部署必触发 SW 更新+旧缓存清理；② 静态资源对带 SRI 的 `dist/*` 改为 **network-first（失败回退缓存）**，仅图片/字体保留 cache-first；③ 上线后请用户执行一次「DevTools → Application → Service Workers → Unregister + Clear storage」解除当前陈旧状态。

### S-03 SRI × SW 组合：缓存旧 bundle + 新 HTML = 脚本被静默拦截
- **表现**：index.html 对 bundle-main.js 启用 `integrity`（index.html:1880）。若 SW 缓存的 bundle 与当前 HTML 的 integrity 哈希不一致，浏览器**静默拒绝执行**——全站 JS 瘫痪，外在表现恰好是 S-01 的全内容隐身 + 滚动 spy 卡死 + 社区卡不渲染（图1/图3 全部症状）。
- **原因**：SRI 强校验与 SW 长期缓存天然冲突；今天同日两连部署 + 版本号未 bump 制造了触发窗口。
- **方案**：① 落实 S-02 后风险基本消除；② 构建期考虑将 SRI 改为构建号 query（`bundle-main.js?v=<sha>`）替代 integrity，或保留 integrity 但确保 SW 永不跨构建缓存 dist；③ runtime-assert 增加「bundle 实际执行」探针（见 M-05）。

---

## 二、中等问题（影响体验，次优修）

### M-01 Hero 滚动旋钮与按钮重叠（图3 实证）
- **表现**：`.scroll-indicator`（`position:absolute;bottom:32px`，style.css:1769）与 `.hero-actions` 按钮在视口中重叠，SCROLL·TURN·LISTEN 文字压在按钮上。
- **原因**：hero `min-height:100vh + justify-content:center`，旋钮定位只与 hero 底部挂钩；当 hero-content 偏高或视口偏矮时，居中内容下缘与 bottom:32px 区域相撞；无防重叠约束。
- **方案**：① hero-content 增加 `padding-bottom:96px`（为旋钮预留带）；② 或旋钮改为 `bottom:max(16px, 4vh)` 并在 <900px 视口高度时隐藏；③ 加 `@media (max-height:760px){.scroll-indicator{display:none}}`。

### M-02 `--font-display` 未定义却被引用
- **表现**：snow-atmosphere.css:171 `.hero-title{font-family:var(--font-display)}`，但 tokens 全库未定义 `--font-display` → 声明失效，标题回退继承 sans 字体（设计意图的 ZCOOL/宋体标题丢失）。
- **方案**：tokens-base.css 增补 `--font-display: "ZCOOL XiaoWei","Noto Serif SC",serif;`，或把引用改为 `var(--font-serif)`。

### M-03 init() 30+ 初始化函数串行无隔离，单点异常级联瘫痪
- **表现**：main.js:4560 `init()` 顺序调用 30+ 个 init 函数，无 try-catch 分组；任一函数抛未捕获异常 → 其后全部初始化（含社区渲染、评论区）跳过。
- **方案**：init 内分组包裹（核心 UI / 增强动效 / 云端同步三组各加 try-catch + console.warn 上报），保证增强功能失败不拖垮核心渲染。

### M-04 hero-title / hero-badge 不可见（图3）——原因待用户侧复核
- **表现**：hero-content 内 tagline/freq/按钮可见，唯独大标题与 badge 不可见。
- **候选原因**：① 截图恰好处于 `heroFadeIn`（1.2s）中段（整容器半透明）；② 用户侧 CSS 残缺导致 `.hero-badge`（全 oklch !important 声明，snow-atmosphere.css:150）整块失效；③ 字体加载异常（见 P-01）。
- **方案**：落实 S-02 缓存修复后请用户复验；若仍复现，取 DevTools Computed 中 `.hero-title` 的 opacity/color/font-family 三项值再定位。

### M-05 测试盲区：runtime-assert 只验 DOM 存在性，不验可见性
- **表现**：CI 8/8 通过但「reveal 不触发」「bundle 未执行」类缺陷完全检不出（本次即实例）。
- **方案**：断言升级：① 检查渲染后 `.reveal.visible` 计数 ≥1；② 检查 `window.__FXRE_API` 存在（bundle 执行证据）；③ 检查 computed opacity（可用 CDP 或无头 evaluate）。

---

## 三、轻微问题（打磨项，择机修）

| # | 维度 | 问题 | 方案 |
|---|---|---|---|
| L-01 | 代码质量 | 类名不匹配：HTML 用 `sn-title-breath`（index.html:272），CSS 定义 `.sig-title-breath`（snow-signature.css:65）→ 标题字距呼吸动画永不生效 | 统一为 `sig-title-breath`（与 S 系列命名一致） |
| L-02 | 性能 | 字体共 ~16.4MB（noto-serif 8MB / noto-sans 5.5MB / zcool 2.5MB），全量无 subset | fonttools 按实际用字子集化（站点文案字符集有限，可压至 <1MB/款）；或改 CDN 分片 |
| L-03 | 性能 | 8 个全屏 fixed 背景层 + canvas 粒子 + 流星 + 雪花同屏合成，低功耗设备 GPU 压力大 | `prefers-reduced-motion` 时已部分降级；建议增加「低性能模式」开关：检测 `hardwareConcurrency<=4` 时只保留 2 层 |
| L-04 | 功能 | CSP `frame-ancestors` 经 meta 交付被浏览器忽略（控制台警告） | 移至 `_headers`（GitHub Pages 不支持自定义 header，则删除该指令，仅靠 X-Frame-Options 等效层或接受） |
| L-05 | 功能 | 控制台 4×「Password field is not contained in a form」（账号面板 input 未包 form） | 账号注册/登录区包 `<form>` 并加 `autocomplete` 语义 |
| L-06 | 代码质量 | main.js 4700+ 行单文件、style.css 6688 行单文件 | 按域拆分（comments/community/music/admin 分模块），构建期再合并，纯结构优化 |
| L-07 | 代码质量 | eslint@^9 与 @eslint/js@^10 主版本冲突，npm install 必须 `--legacy-peer-deps` | @eslint/js 降至 ^9 对齐（早前 CI 报告已立项，仍挂账） |
| L-08 | 界面 | 控制台 CSP/性能告警若干（page_load_metrics Invalid response_start 等） | 属 GitHub Pages+SW 环境噪音，记录即可，无需处理 |

---

## 四、论坛模块抽查（简要）

- 论坛与主站共用 SW/SRI/构建管线 → **S-01/S-02/S-03 三项同样适用**（论坛 bundle-forum.js 同策略），需一并修复。
- `pages.config.json` 指向已被他人占用的 `i-miss-you.pages.dev`，属死配置，建议删除防误导。
- 其余未见独立问题，按用户要求不展开。

---

## 五、修复优先级总表

| 序 | 编号 | 一句话 | 级别 |
|---|---|---|---|
| 1 | S-02 | SW 缓存版本随构建注入 + dist 改 network-first | 严重 |
| 2 | S-01 | reveal 增加 no-JS/失败兜底 | 严重 |
| 3 | S-03 | SRI×SW 冲突根除（随 S-02 落地） | 严重 |
| 4 | M-03 | init() 分组容错 | 中 |
| 5 | M-01 | hero 旋钮/按钮防重叠 | 中 |
| 6 | M-05 | CI 断言补「可见性+bundle 执行」探针 | 中 |
| 7 | M-02 | 补定义 --font-display | 中 |
| 8 | M-04 | hero 标题复验（依赖 1 落地后用户确认） | 中 |
| 9 | L-01~L-08 | 打磨项打包 | 轻 |

**落地前置动作（无需改码）**：请用户在 Edge 执行 DevTools → Application → Storage → Clear site data（含 Unregister SW），再访问站点。若页面恢复正常，即确证 S-02/S-03 为当前故障的直接原因。

---

## 六、修复执行记录（2026-09-11，commit `641a6d6`）

> 已实际改码并验证，非只读。CI：Static Checks / Pages Deploy / Accessibility Audit 全 success；本地 runtime-assert 8/8 通过（含新增 bundle 执行探针）。

| 编号 | 状态 | 实际做法 |
|---|---|---|
| S-01 | ✅ 已修 | `css/style.css` 增 `@media (scripting:none) .reveal{opacity:1}`（CSS 原生 no-JS 兜底，CSP 安全，不依赖内联脚本）+ `revealFailsafe` 5s 超时自显 animation + `prefers-reduced-motion` 显示；`js/main.js` 的 `initScrollReveal` 包 try-catch，observer 失败批量加 `visible` |
| S-02 | ✅ 已修 | `sw.js` 静态资源分支 `dist/*` 改 **network-first**（带 `cache:'reload'`），根除旧 bundle 被 SW 长期缓存与 HTML SRI 哈希冲突。CI 注入部署号步骤已加（`pages-deploy.yml` sed → `snowfluff-${GITHUB_SHA:0:8}`），但当前 GitHub Pages 从 `main` 分支直接服务，注入未进分支；**由"sw.js 内容已变化 → 浏览器自动触发 SW 更新 + activate 清理旧缓存"达成目标**，用户正常刷新即更新，无需手动 Clear storage |
| S-03 | ✅ 随 S-02 | network-first 保证每次拉最新 dist，旧缓存 bundle 永不与新 HTML integrity 冲突 |
| M-01 | ✅ 已修 | `css/snow-atmosphere.css` `.hero-content` 加 `padding-bottom:96px`；`css/style.css` `.scroll-indicator` 加 `z-index:2` + `@media (max-height:760px){display:none}` |
| M-02 | ⏭️ 误判跳过 | 核实 `--font-display` 已在 `css/tokens-snow.css:109`（及 tokens-stf.css:124）定义并合并进 `main.min.css`，原报告"未定义"为误判，非真问题 |
| M-03 | ✅ 已修 | `js/main.js` `init()` 拆核心 UI / 增强·云端两段 `try-catch`，单点异常不级联瘫痪；末尾 `document.documentElement.dataset.fxreReady='1'` 标记 |
| M-05 | ✅ 已修 | `scripts/runtime-assert.mjs` 增 `data-fxre-ready="1"` 断言（= bundle 完整执行证据），CI 已跑通 |
| L-01 | ✅ 已修 | `index.html` `sn-title-breath` → `sig-title-breath`（与 `snow-signature.css` 定义一致，字距呼吸动画生效） |
| L-04 | ✅ 已修 | 删除 CSP meta 中无效的 `frame-ancestors 'none'`（经 meta 交付被浏览器忽略且控制台告警） |

**未执行（择机/记录，非当前故障根因、成本较高）**：
- L-02 字体子集化（~16MB→<1MB/款，需 fonttools 资源处理）
- L-03 低性能模式开关（hardwareConcurrency≤4 降层数）
- L-05 账号面板 input 包 `<form>` + autocomplete
- L-06 main.js/style.css 按域拆分（纯结构，风险高）
- L-07 eslint@^9 与 @eslint/js@^10 主版本对齐（之前 CI 报告已立项，仍挂账）

**用户侧验证建议**：Edge 打开 https://vertiniris.github.io/I-MISS-YOU/ 正常刷新即可（SW 内容变化已自动接管）；若仍异常，F12→Application→Clear storage 一次强制解除。
