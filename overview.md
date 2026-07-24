# 飞行雪绒 / Snow — 项目概览

> 纯前端静态站（HTML/CSS/JS）+ Supabase BaaS，GitHub Pages 部署
> 当前版本：v9.6

## 本次对话完成项（2026-07-25）

本次完成 R19、R18，启动 R17（雪绒玫瑰+锌灰+9072金）。**后续用户反转方向为 v10：粉·白·浅蓝核心 + 橙金辅助，金色降级**（见下）。

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

### R17：三级色彩角色体系（视觉大改，方向已确认）
- 方向：**雪绒玫瑰(#E584A8) 主色 + 锌灰中性(#0B0B14/#14141F…) 辅助色 + 9072金(#F5B544) 强调色**，去除粉紫蓝霓虹均质化
- 新增令牌：`--c-primary` / `--c-neutral-900…200` / `--c-accent` 三级色彩角色
- `--gradient-dynamic` 由粉→紫→蓝糖果渐变改为雪绒玫瑰→9072金暖色系（约10处表面同步生效）
- 液态玻璃：`.glass` 增加 1px 内折射边 + 内阴影，blur 降至 24px/saturate 140%
- 强调色金应用于 导航激活态 / 焦点环 / 音乐播放 CTA / 社区徽章；移除音乐 CTA 与徽章的霓虹紫
- CSS 大括号平衡通过（887/887）
- 剩余：逐页回归 Hero / 角色中心 / 时间线 / 日记 / 社区区，按角色分化表面（中性玻璃/主色/强调色）

### v10：内容分层架构 + 视觉色彩体系反转（2026-07-25 续）
- 用户新要求（反转 R17）：**粉·白·浅蓝为核心**；金色不作为重点色；**橙金(#E8A23D)为辅助点缀**；本任务以内容编写+架构+技术报告为核心，**不实现具体前端交互**（供另一任务对话实现）
- 内容分层架构：L0 首页入口卡 → L1 角色专区（深层级）→ L2 模块折叠/子页；爱弥斯为模板，达妮娅优先，西格莉卡/漂泊者待写
- 内容源：`docs/content/aimisi-layered.md`（爱弥斯，6模块完整）、`docs/content/denia-layered.md`（达妮娅，官方考据+「结契人」来源声明）
- 技术需求报告：`docs/v10-requirements-report.md`（架构/视觉/文件结构/实现指引/考据合规），供另一任务对话参考
- 视觉色彩令牌已落地（静态设计系统，非交互）：`--c-primary:#F4729B` / `--c-core-white:#F0F4FF` / `--c-core-blue:#6B8AFF` / `--c-accent:#E8A23D`；`--gradient-dynamic` 改回粉→白→浅蓝；金色降级、紫仅作达妮娅角色着色
- 同步清理：音乐 CTA / 社区徽章 / 主按钮 / 发光边框 / 焦点环 等金色主色表面改为粉白浅蓝核心 + 橙金点缀；液态玻璃保留
- Ardot 画布适配器仍不可用（NO_ADAPTER），视觉以书面规范交付；实现对话可直接落地
- CSS 大括号平衡通过

## 文件改动
- `js/main.js`：R19 增量协调逻辑
- `css/style.css`：R18 字阶令牌 + 应用；v10 色彩令牌（粉白浅蓝核心+橙金辅助）+ 金色/紫色表面清理
- `index.html`：字体导入增加 Serif 900；archive 信息点/角色卡 data-color 对齐 v10
- `docs/content/aimisi-layered.md`：爱弥斯分层内容源（新增）
- `docs/content/denia-layered.md`：达妮娅分层内容源（新增，优先）
- `docs/v10-requirements-report.md`：技术需求报告（新增）

## 待办（v10 实现对话）
- **建立 4 个角色专区页**：爱弥斯/达妮娅内容源已就绪，西格莉卡/漂泊者待写（沿用 `docs/content/aimisi-layered.md` 模板）
- **实现 L0→L1 导航**（方案 B 子页 / C 浮层，保证首页简洁）与 **L1→L2 折叠面板**（方案 A）
- **首页瘦身**：将 `index.html` 第 441–621 行 `#archive` 扁平区转为角色入口卡
- **视觉走查**：确认全站无金色作主色、无紫色进入品牌主色、橙金仅作点缀
- 参考 `docs/v10-requirements-report.md` 落地

## 部署提醒
所有改动在本地，**需用户在 GitHub Desktop 提交并 push** 后，GitHub Pages 约 1–2 分钟生效（记得 Ctrl+F5 强刷）。
