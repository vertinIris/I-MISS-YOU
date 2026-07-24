# 飞行雪绒 / Snow — 项目概览

> 纯前端静态站（HTML/CSS/JS）+ Supabase BaaS，GitHub Pages 部署
> 当前版本：v9.6

## 本次对话完成项（2026-07-25）

按优先级 R19 → R18 → R17 顺序，本次完成 **R19** 与 **R18**，**R17 留待下次对话作为首要任务**。

### R19：评论/投稿增量 DOM 协调（性能）
- 问题：任一评论/投稿变更即整列表 `innerHTML` 重绘，长列表卡顿、闪烁。
- 修复：
  - 新增 `reconcileCommentThread`（按 `data-comment-id` keyed 协调）+ `buildCommentNode`
  - `_renderCommentsList` / `_renderCommunityCommentsList` 改走增量协调
  - 提取 `buildSubmissionCardHTML`，新增 `buildSubmissionCardNode` + `reconcileCommunityGrid`，`_renderCommunityGrid` 实时/筛选/分页均走增量
  - 投稿卡片协调保护：用户正在输入时不替换，避免草稿丢失
- 校验：`node --check js/main.js` 通过

### R18：字体层级四级 Type Scale（UI 美术）
- 新增令牌：`--font-sans/--font-serif`、四级字阶（`--fs-display/title/subtitle/body/caption` + `--fw-*`）、统一间距 `--space-1..6`
- 应用：`.section-title`→Display（衬线 900）、`.section-desc`→Caption（300+tertiary）、`.community-card-title` 及弹窗/面板/合集标题→Title（无衬线 700）
- `index.html` 为 Noto Serif SC 增加 900 字重导入
- 校验：CSS 大括号平衡通过

## 文件改动
- `js/main.js`：R19 增量协调逻辑
- `css/style.css`：R18 字阶令牌 + 应用
- `index.html`：字体导入增加 Serif 900

## 待办（下次对话首要任务）
- **R17**：玻璃拟态 + 粉蓝多停渐变同质化，需建立三级色彩角色（主色/辅助色/强调色），属视觉大改，需先确认设计方向再逐页回归

## 部署提醒
所有改动在本地，**需用户在 GitHub Desktop 提交并 push** 后，GitHub Pages 约 1–2 分钟生效（记得 Ctrl+F5 强刷）。
