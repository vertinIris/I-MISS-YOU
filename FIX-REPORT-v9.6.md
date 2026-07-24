# 飞行雪绒 v9.6 — 问题修复最终报告

> 日期：2026-07-24 ｜ 依据：REVIEW-v9.6.md ｜ 验证：13 个 JS 全过 `node --check`，CSS 括号配平
> 执行顺序：🔴 高 → 🟠 中 → 🟡 低（含依赖调整说明）

## 一、已修复（按优先级）

| # | 优先级 | 修改前问题 | 修改后方案 | 文件 |
|---|--------|-----------|-----------|------|
| R1 | 🔴 | 全局 `lastSyncTime` 跨评论区共享，轮询去重错乱 | 改为 `lastSyncByTarget` 按 target 维护 | sync-manager.js |
| R2 | 🔴 | `getSubmissions` 未 join 标签，云端投稿 `tags` 丢失 → 标签筛选失效 | select 关联 `submission_tags` 并 map 标签名数组；repository 透传 + 合并保留 | supabase-adapter.js, repository.js |
| R3 | 🔴 | 投稿通道 `.subscribe()` 无状态回调 → 断连不降级/不重连/无 DELETE | 加状态回调（CHANNEL_ERROR→轮询 / CLOSED→重连）+ DELETE handler + `attemptReconnect('submissions')`；重连时重挂状态回调 | sync-manager.js |
| R15 | 🔴 | emoji 作功能图标（同步状态点🔄🟢🟡🔴/隐藏👁/管理🔐✅❌）违反 P0-1 | 状态点改 CSS 圆点、隐藏改 SVG eye-off、重试改 SVG、管理提示改纯文本 | sync-manager.js, main.js, admin-auth.js, style.css |
| R4 | 🟠 | 轮询模式只识别 INSERT，漏 UPDATE/DELETE | 新增 `onBulkComments` 全量对账回调（复用 applyRealtimeCommentEvent） | sync-manager.js, main.js |
| R5 | 🟠 | 乐观插入与实时回显竞态 → 瞬时重复评论 | patchList 只补未赋 id 项 + 按 id 去重 | main.js |
| R6 | 🟠 | 双轮询冗余（SyncManager 15s + main 30s） | 删除 `__fxreCommentPoll`，统一由 SyncManager 兜底 | main.js |
| R7 | 🟠 | 离线队列仅 init 冲刷一次，重连不补推 | setupCloudRealtime 云端就绪时调 `syncPendingQueue()` | main.js |
| R8 | 🟠 | 封禁用户仍可评论/投稿（封禁未生效） | 评论/投稿入口加 `AuthManager.isBanned()` 拦截 | main.js |
| R9 | 🟠 | 点击与提交共用计数 → 活跃浏览被误锁 60s | 提交独立 `recordInput()` 计数（30/min），与点击分离 | security-shield.js |
| R10 | 🟠 | MutationObserver 防线对动态注入 XSS 无效 | 标注为"纵深防御、非可靠防线"，主防线靠 escapeHTML+CSP | security-shield.js（注释） |
| R11 | 🟠 | 上传仅按扩展名伪造 MIME，可传非图片 | 加图片魔数校验（JPEG/PNG/GIF 文件签名） | upload-manager.js |
| R16 | 🟠 | 9+ 背景动画层喧宾夺主 | 非核心装饰层降不透明度（pink-galaxy 1→0.55 等） | style.css |
| R13 | 🟡 | 云/本地合并丢失 tags | mergeEntry 保留云端 tags（随 R2 一并修复） | repository.js |
| R14 | 🟡 | 升级前未刷新会话，匿名过期即失败 | `upgradeToRegistered` 先 `refreshSession()` | auth-manager.js |
| R18 | 🟡 | 次级文字对比度不足 | `--text-tertiary` 提亮 #8A84A3→#9B95B8（≈4.9:1，达 AA） | style.css |

## 二、核实后无需改动（排除误报）

| # | 结论 |
|---|------|
| R12 | 管理 RPC **已在服务端校验角色**：`moderate_comment`/`batch_moderate_comments` 对非版主/管理员 `RAISE EXCEPTION`，永久删除仅管理员（migration-006）。客户端口令哈希仅是 UI 门，真实权限有 RPC 兜底。**无需改代码。** |
| admin-panel parseInt | comments/submissions 主键为 `BIGINT IDENTITY`（非 UUID），`parseInt` 安全。**误报。** |

## 三、依赖导致延后（附调整方案）

| # | 问题 | 延后原因（依赖） | 调整方案 |
|---|------|-----------------|----------|
| R17 | 玻璃拟态+多停渐变同质化 | 色彩系统重构涉及全站视觉回归，需设计确认 + 逐页回归测试，盲改风险高 | 本轮已做安全部分（背景降不透明度）；色彩三级角色重构单独立项，先出 design-token 提案再改 |
| R18 | 字体四级 type scale | 需逐组件核对字号/字重，工作量大且影响面广 | 本轮已提亮次级文字对比度；完整 display/title/body/caption scale 随 R17 一起做 |
| R19 | 实时事件全量重渲染→增量 DOM | 需重写 renderComments/renderCommunity 渲染路径，属大型重构，需充分回归 | 单独立项；短期可先加列表分页缓解 |
| R20 | REPLICA IDENTITY 未设 | 需用户手动在 Supabase 执行 | 已生成 `db/migration-016-replica-identity.sql`（可选加固），Dashboard→SQL Editor 执行 |

## 四、修改文件汇总

- **js/**：sync-manager, supabase-adapter, repository, main, security-shield, upload-manager, admin-auth, auth-manager（8 个）
- **css/**：style.css（1 个）
- **db/**：migration-016-replica-identity.sql（1 个，新增，需手动执行）

**遗留 emoji**：仅 IM 对话/彩蛋内容（✨⚡📡❄️等），属 P0-1 允许的"即时通讯消息"例外，未动。
