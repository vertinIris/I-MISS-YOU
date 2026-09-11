# 飞行雪绒主站 · 功能分区配置修正（2026-09-11）

> 对应 BUG：① 页脚布局塌缩 ②「实时同步」指示器错位到导航区左上角 ③ Hero 区「调频旋钮」与按钮文字重叠
> 修正提交：`2124b89` · 文件：`js/sync-manager.js`、`css/style.css`、`.css/snow-weapons.css`

## 一、主站功能分区总览（修正后）

| 分区 ID | 角色 | 层级 | 放置位置 | 状态 |
|---------|------|------|----------|------|
| `nav`（.nav-glass） | 主导航 / 账号 | 固定顶栏 | `<body>` 直接子级 | ✅ |
| `hero` | 首屏：标题 + 动态/收听按钮 + 调频旋钮滚动提示 | 首屏 | `<main>` 内 | ✅ 已修正 |
| `profile` / `music` / `fanwork` / `timeline` / `diary` / `easter-egg` / `submit` / `community` | 内容模块 | 主区 | `<main>` 内 | ✅ |
| `sn-footer` | 页脚：频谱签名 + 四列信息 | 页脚 | `</main>` 后、`<body>` 直接子级 | ✅ 已修正 |
| **全局悬浮区（独立于上述分区）** | | | | |
| `sync-indicator` | 实时同步状态 | 全局浮层 | **`document.body` 末尾**（右下令牌） | ✅ 已修正 |
| `forum-entry-fab` | 进入星炬学院 | 全局浮层 | `document.body`（左下） | ✅ |
| `donate-fab` | 请制作人喝咖啡 | 全局浮层 | `document.body`（右下，bottom:140px） | ✅ |

## 二、三项分区配置修正

### ① 同步状态区：由「导航栏子节点」改为「body 级全局状态区」
- **原配置（不合理）**：`sync-manager.js` 将 `#sync-indicator`（`position:fixed`）`nav.appendChild` 进 `<nav>`。
- **根因**：`.nav-glass` 带 `backdrop-filter: blur(20px)`，`backdrop-filter` 会为 `fixed` 后代建立**包含块**，使指示器的 `fixed` 相对导航栏而非视口定位 → 塌到导航区左上角（与 BUG ② 完全吻合）。
- **修正后**：`document.body.appendChild(div)`，指示器回归视口级 `fixed; right:20px; bottom:20px`，与 `forum-entry-fab`（左下）、`donate-fab`（右下 140px）互不重叠。
- **预期效果**：「实时同步」令牌稳固显示在页面右下角，不再随导航栏层叠上下文漂移。

### ② Hero 区：为「调频旋钮」预留独立子区，消除与按钮重叠
- **原配置（不合理）**：`.hero` 底部仅 `padding-bottom:40px`，而 `.scroll-indicator`（调频旋钮 + SCROLL·TURN 提示）为 `position:absolute; bottom:32px` 浮于 Hero 底部，与同区 `.hero-actions`（收听动态 / 打开歌单）垂直重叠（BUG ③）。
- **修正后**：`.hero { padding: 80px 24px 120px; }`——为滚动提示在 Hero 底部预留 120px 独立子区，内容区居中于其上方，绝对定位的旋钮落在该预留带内。
- **预期效果**：按钮与「调频旋钮 · 向下旋动 / SCROLL·TURN·LISTEN」提示文字上下分离、不再叠印。

### ③ 页脚区：明确为自包含分区
- **原配置（脆弱点）**：`.sn-footer` 未显式建立层叠/定位上下文，四列 `grid` 依赖全局样式，偶发塌缩为贴左堆叠（BUG ①，多为部署/缓存滞后导致网格未生效）。
- **修正后**：`.sn-footer { position: relative; z-index: 1; }`——页脚成为自包含分区，隔离于任何祖先 `isolation`/`transform` 干扰。
- **预期效果**：四列信息网格（品牌 / 直达频段 / 跨站入口 / 版权）稳定呈现，居中、有内边距；结合本次 CI 重建 + SW 部署号注入，陈旧缓存导致的塌缩一并消除。

## 三、验证
- 本地 `node scripts/build-phase2.mjs` 构建通过，SRI 与 `index.html` 一致。
- 构建产物确认含修正：`document.body.appendChild` 见于 `dist/bundle-main.js`；`padding:80px 24px 120px` 见于 `dist/css/main.min.css`；旧 `nav` 挂载代码已移除。
- 已推送 `main`（`641a6d6..2124b89`），CI 重新构建 `dist/` 并部署 GitHub Pages，SW 部署号注入强制旧缓存更新。
