# 平台功能缺陷 / 不足 / 未实现项 — 补充核查（v10，2026-08-03）

> 本文是 `POST-PUSH-REVIEW.md` 的**补充审计**，不重复上一份已覆盖的结论（同步、去重、管理员"口令非注册"澄清、性能总览、§4.1/§4.2 改进方案）。
> 本轮改为**逐模块实地读代码 + 查数据库迁移**核实，区分「已确认正常 / 真实缺陷 / 明确未做 / 需你确认的配置项」四类。

---

## 一、本轮实地核查：已确认正常（排除误判）

| 项目 | 核查结论 | 证据 |
|---|---|---|
| 导航 `#character-hub` 死链 | **否**，section 存在于 index.html:465，角色页双入口（aimisi/denia）正常 | index.html:139,465 |
| 移动端导航 | **已实现**汉堡菜单：`.nav-links` + `.active` 切换，768px / 480px 断点 | css/style.css:3412,3431,3529 |
| 插画投稿端到端可用 | UploadManager 上传 → Storage `works` 桶 → 匿名用户属 `authenticated` 角色，上传策略放行 → URL 入库 → `ContentUtils.extractImageUrl` 渲染 | migration-009:20-22；content-utils.js:6；main.js:2726 |
| 举报功能 | 评论（main.js:1422）+ 投稿（main.js:3264）均有入口，弹窗可填理由 → `submitContentReport` → RPC `submit_content_report` → `moderation_logs` → 后台读取 | main.js:1994-2040；adapter:1115；migration-012 |
| 日记区 | 静态 HTML + 注入评论区，6 篇种子评论，双击标题信号闪光等彩蛋齐全 | main.js:890,1068-1130,2126-2151 |
| 角色页 | aimisi/denia 各 200+ 行，无 TODO/占位 | characters/*.html |

---

## 二、真实缺陷与不足（技术债 / 设计问题）

### D1. 插画图片以明文塞进 `content` 字段（设计缺陷）
- **现象**：投稿提交时，图片 URL 被拼成 `[插图] URL` 文本追加到正文（main.js:2726-2727），而非写入 submissions 表的结构化 `image_url` 列。
- **后果**：
  1. 云端若未建 `image_url` 列，图片只靠正文文本"搬运"，导出 / 数据迁移 / 按图检索时图片引用极易丢失；
  2. 正文与图片强耦合，预览截断（`previewText` 取前 300 字）可能把 `[插图]` 标记截断导致图不显示；
  3. 无法区分"正文里的 URL"和"插图"。
- **建议**：submissions 表加 `image_url` 列；`UploadManager` 回传结构化 `{image_url}`，提交时单独存列，`buildSubmissionCardHTML` 优先读列而非正则抠文本。

### D2. 移动端管理员进入方式脆弱（体验缺陷，已设计未实现）
- **现象**：管理员入口依赖**页脚双击**触发 + 原生 `prompt()` 输入共享口令。
- **后果**：触屏双击极不可靠（易误触/不触发）；iOS Safari 的 `prompt()` 体验差且部分版本受限；用户找不到入口。
- **状态**：`POST-PUSH-REVIEW.md §4.1` 已给出"长按 800ms + 页面内 modal"方案，但**尚未实现**。

### D3. 表单可访问性细节不足（a11y 缺口）
- 昵称 / 评论输入框只有 `placeholder`，**无关联 `<label>`**（main.js:2082-2083,3273-3274），屏幕阅读器无法朗读字段名；
- 社区卡片图片 `alt=""`（main.js:3234）为空，丢失语义；
- toast / 同步状态指示器缺少 `aria-live` 区域，读屏软件不会播报"同步失败/成功"。
- 注：上轮 P0 已做字阶、模态焦点、脚本 defer，但上述三项未在覆盖范围内。

### D4. 多层背景叠加的性能风险（流畅度隐患）
- 当前同时叠加：Three.js 粒子 + CSS 星空 + 流星递归随机 + 雪花 40/60 双层 + galaxy-river + sparkle JS 动态生成。
- **风险**：低端移动设备（尤其安卓中端机）GPU/CPU 受限时，**60fps 目标难以稳定达成**，可能掉帧、发热、耗电。
- 建议：移动端 / `prefers-reduced-motion` 下**降级**——关闭 Three.js 粒子、减少雪花数量、流星降频；用 IntersectionObserver 对离屏 section 暂停动画。

---

## 三、明确「没做」的功能缺口

### M1. 匿名 → 注册用户身份升级（未做）
- 匿名登录是主路径；`auth-manager.js` 虽有 `signUp`（邮箱密码注册），但**注册后无法把匿名期间发表的评论/投稿归属到新账户**（`author_id` 仍是匿名 id）。
- 影响：鼓励用户"转正"的闭环缺失。

### M2. 评论编辑（未做）
- 投稿编辑已由 migration-013 支持，但**评论仅有删除、无编辑**。误发后只能删重建。

### M3. 社区全文搜索（未做）
- 社区仅支持按「类型 / 标签」筛选（main.js:3164-3180），**无关键词搜索**。投稿量增长后检索体验差。

### M4. 回复通知 / @提及（未做）
- 评论回复（社区卡片内 `reply-bar`）无跨设备通知；Realtime 仅增量渲染，不发提醒。

### M5. 内容 moderation 的"处理闭环"（部分缺失）
- 后台能看举报队列并删除，但**缺少"标记已处理 / 驳回举报 / 封禁用户"的完整闭环**（封禁在提交侧有 `isBanned` 校验，但封禁操作入口与持久化未在主流程暴露）。

---

## 四、需你确认的「配置依赖项」（非代码缺陷）

### C1. Supabase 邮件模板 / 发件域
- `reset-password.html` 存在，说明密码重置流程已搭好，但**依赖 Supabase 已配置发件域名与邮件模板**。免费版若未配置，注册确认 / 重置邮件发不出。
- 由于匿名登录是主路径，此项**不影响主流程**，仅影响"邮箱注册/重置"分支。

### C2. Storage `works` 桶迁移是否执行
- migration-009 已定义桶与策略。若你**未曾在 Supabase SQL Editor 跑过 migration-009**，插画上传会 403。请确认该迁移已执行（与上轮 migration-017/018 同理，需你手动跑）。

---

## 五、架构健康度（维护性不足）

- **单文件巨石**：`main.js` 体量极大（数千行），与 `repository / supabase-adapter / sync-manager / auth-manager / admin-*` 等通过大量**隐式全局变量**耦合，无模块系统、无打包。
- **无自动化测试 / 无 CI**：上次 §4.2 建议的 `.github/workflows` 语法/冒烟卡点**尚未落地**。
- **影响**：新功能易引入回归（如前轮 `.id` 赋值崩溃），且难以定位。

---

## 六、优先级建议（务实落地）

| 优先级 | 项 | 类型 | 谁来做 |
|---|---|---|---|
| P0 | D2 移动端管理员 modal（长按+modal） | 体验缺陷 | 我改 `admin-auth.js`/`main.js` + CSS |
| P0 | C2 确认 migration-009/017/018 已跑 | 配置 | 你跑 SQL |
| P1 | D3 表单 label / aria-live / alt | a11y | 我改 HTML/JS |
| P1 | D4 移动端动画降级 | 性能 | 我改 particles.js / CSS |
| P1 | 五-§架构：加 CI workflow | 健康 | 我加 `.github/workflows` |
| P2 | D1 图片结构化列 | 技术债 | 我改 schema+JS（需你跑迁移） |
| P2 | M2 评论编辑 / M3 搜索 | 功能缺口 | 我实现 |
| P3 | M1 匿名升级 / M4 通知 / M5 处理闭环 | 功能缺口 | 视需求排期 |

---

## 七、我能立即动手的（低风险、零可见副作用）
- **D2** 移动端管理员进入（长按 + 页面内 modal，替代双击+prompt）
- **D3** 表单 `<label>` 关联 + 图片 `alt` + `aria-live` 同步状态
- **D4** 移动端 / reduced-motion 动画降级
- **CI workflow**（.gitHub 自动语法卡点 + 部署已由 Pages 自带）

你说一声「做 D2/D3/D4/CI」，我立即改；按老规矩**最终 push 由你用 GitHub Desktop 完成**，我不会在沙箱代推。
