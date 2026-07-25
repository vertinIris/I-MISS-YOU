# 飞行雪绒 (Snow / I-MISS-YOU) — 项目概览

> 当前版本：v9.6（+ R17/R18/R19 视觉与性能增强）
> 纯前端静态站 + Supabase BaaS，GitHub Pages 从 `main` 分支根目录发布。

## 本轮对话完成的工作

### R17 — 全站色彩三级角色重构（逐页回归）✅
**问题**：`--gradient-dynamic` 多停渐变被用在 12+ 处小装饰元素（时间线圆点、头像、日记日期、分隔线、进度条、选中态、导航下划线、音乐波形），且内容卡全站共用玻璃拟态，视觉同质化（"AI 模板味"）。

**做法**（仅改 `css/style.css`）：
- `:root` 新增三级表面令牌：`--surface-card` / `--surface-card-border` / `--surface-inset` / `--surface-inset-border` / `--surface-accent` / `--surface-accent-border`
- **内容卡去玻璃化**：`.community-card`（最列表化区域）由 `glass(blur20/sat180)` 改为 `surface-card` 实色低透明底；`.comment-item`→`surface-inset`；`.diary-entry` 加基础 `surface-inset` 底
- **渐变收敛**：12 处小装饰降级为实色/品牌单色（粉 `--c-primary` / 浅蓝 `--c-core-blue-light` / 粉低透明 `--surface-accent` / `gradient-brand-soft`）
- **渐变现仅保留**：Hero 背景/标题 + 主 CTA + 未使用的 opt-in 工具类 → 符合「主色仅 hero/CTA、辅助纯色、强调交互态」三级角色

**校验**：CSS 大括号平衡通过；`node --check js/main.js` 通过。

### 此前已完成（本会话早前轮次）
- **R19**：评论/投稿列表增量 DOM 协调（替掉整列表 innerHTML 重绘），长列表不再闪烁
- **R18**：字体四级 type scale（Display/Title/Body/Caption）+ 统一 spacing
- 账号面板：注册/登录职责拆分（新增独立 `registerUser`）、评论按钮重叠修复、管理员快捷入口
- v9.1 历史文件清理（已被现有代码替代，已删除）

## 待办（下一对话 / 外部手动）
- **R17 已完结**；v10 前端（4 角色专区页 + L0→L1 导航 + 首页 `#archive` 瘦身）为独立任务，内容源 `docs/content/*.md` 已就绪（爱弥斯/达妮娅），西格莉卡/漂泊者待写
- **外部手动（Supabase Dashboard）**：设管理员/版主角色（`UPDATE profiles SET role=...`）、跑 `migration-014/015/016`
- 收藏夹「我的收藏」整页管理 + 公开分享链接
- 14 项手测清单 + Playwright E2E（P3）

## 部署提醒
改动在本地未提交。GitHub Desktop：勾选 `css/style.css`（+`overview.md`），Summary 填 `style: R17 三级色彩角色逐页回归（去玻璃同质化+渐变收敛）`，Commit → Push origin → 等 1~2 分钟 → Ctrl+F5。
