# 飞行雪绒 v9.6 — 端到端审查报告

> 审查日期：2026-07-24
> 审查范围：实时同步 / 全功能可用性 / UI 与美术设计
> 方法：逐文件读码 + 子代理广扫 + 关键断言人工复核（含数据库 schema 核对）
> 严重度：🔴 高（功能失效/数据错误）｜🟠 中（体验受损/边界漏洞）｜🟡 低（工程整洁/可维护性）

---

## 总览（按严重度）

| # | 模块 | 问题 | 严重度 | 代码位置 |
|---|------|------|--------|----------|
| R1 | 实时同步 | 全局 `lastSyncTime` 跨评论区共享，轮询去重错乱 | 🔴 | sync-manager.js:27,172-177 |
| R2 | 数据层 | `getSubmissions` 丢弃 `tags`，标签筛选对云端投稿失效 | 🔴 | supabase-adapter.js:506-519 |
| R3 | 实时同步 | 投稿通道无状态回调/无重连/无 DELETE 事件 | 🔴 | sync-manager.js:208-238 |
| R4 | 实时同步 | 轮询模式只识别 INSERT，漏掉 UPDATE/DELETE | 🟠 | sync-manager.js:167-180 |
| R5 | 实时同步 | 乐观插入与实时回显竞态 → 瞬时重复评论 | 🟠 | main.js:2295,2328-2338,2150-2188 |
| R6 | 实时同步 | 双轮询（SyncManager 15s + main 30s）冗余流量 | 🟠 | sync-manager.js:160 / main.js:1280-1290 |
| R7 | 数据层 | 离线队列仅在 init 冲刷一次，重连后不补推 | 🟠 | supabase-adapter.js:354-363,707 |
| R8 | 认证权限 | 封禁用户仍可评论/投稿/收藏（封禁未生效） | 🟠 | auth-manager.js:470 |
| R9 | 内容安全 | 点击频率熔断误锁正常浏览用户 60s | 🟠 | security-shield.js:178,203 |
| R10 | 内容安全 | MutationObserver 防线对动态注入 XSS 无效 | 🟠 | security-shield.js:191 |
| R11 | 上传 | 仅按扩展名伪造 MIME，未校验真实内容 | 🟠 | upload-manager.js:93-105 |
| R12 | 管理后台 | 口令哈希硬编码前端，权限全靠服务端 RLS | 🟠 | admin-auth.js:175 |
| R13 | 数据层 | 云投稿合并不回填 tags；筛选失败静默返回 [] | 🟡 | supabase-adapter.js:1150 |
| R14 | 认证权限 | 升级流程未先 ensureAuth，匿名失效时失败 | 🟡 | main.js:3936 |
| R15 | 图标规范 | emoji 作为功能图标（违反 P0-1） | 🔴 | 见模块八 |
| R16 | UI 美术 | 9+ 背景动画层喧宾夺主，焦点模糊 | 🟠 | index.html:47-58 |
| R17 | UI 美术 | 玻璃拟态 + 多停渐变滥用，同质化 | 🟠 | css/style.css:49-51,66-70 |
| R18 | UI 美术 | 字体层级单薄，缺 display/title/body 四级 | 🟡 | css/style.css:40,62-64 |
| R19 | 性能 | 重背景动画 + 全量重渲染损耗 | 🟡 | index.html:47-58 / sync-manager |
| R20 | 图标规范 | REPLICA IDENTITY 未设（硬删事件旧行不全） | 🟡 | db/* (无) |

> ⚠️ 子代理初报的两项「高」已被人工复核**排除误报**：
> - admin-panel `parseInt(c.id)` → comments/submissions 主键为 `BIGINT IDENTITY`（migration-001:73/95），非 UUID，`parseInt` 安全。
> - repository 管理员删除「本地-only 被云端覆盖」→ 版主隐藏实际走 `SupabaseAdapter.moderateComment` RPC（migration-006），服务端 `is_hidden`，不属于该本地路径。

---

## 模块一：实时同步（Realtime）

### R1 🔴 全局 `lastSyncTime` 跨评论区共享
- **位置**：sync-manager.js:27（定义）、:169-177（轮询使用）
- **根因**：`lastSyncTime` 是单例变量，但页面存在多个评论区（`target_id` 各异）。轮询逐区拉取，每区用各自 `maxTime` 更新**同一个**全局 `lastSyncTime`，先处理的区的时间戳会被后处理的区覆盖。
- **后果**：下一轮轮询中，较早评论区里"稍旧但晚于被覆盖值"的评论会被重复触发 `onNewComment`，造成重复渲染。
- **修复**：改为 `var lastSyncByTarget = {}`，轮询时 `lastSyncByTarget[targetId]` 各自维护；`manualRefresh` 同步按 target 更新。

### R3 🔴 投稿通道无状态回调 / 无重连 / 无 DELETE
- **位置**：sync-manager.js:208-238
- **根因**：`connectSubmissions` 的 `.subscribe()`（:235）**没有状态回调**，对比 `connectComments` 的 `.subscribe(function(status){...})`（:105）。因此投稿通道出错时既不降级轮询、也不重连；且只监听 INSERT/UPDATE，**漏掉 DELETE**。
- **后果**：投稿 Realtime 一旦断开（CHANNEL_ERROR/TIMED_OUT/CLOSED）永久静默失效，用户删帖/被删不实时更新。
- **修复**：① 加 `.subscribe(function(status){...})`，在 CHANNEL_ERROR→POLLING+startPolling、CLOSED→attemptReconnect('submissions')；② `attemptReconnect` 现只处理评论 target，需支持 `'submissions'`；③ 增加 DELETE handler（软删走 UPDATE/is_hidden，硬删需 DELETE 兜底）。

### R4 🟠 轮询模式只识别 INSERT
- **位置**：sync-manager.js:167-180
- **根因**：轮询仅对 `created_at > lastSyncTime` 的评论调用 `onNewComment`，**未处理评论被编辑（UPDATE）或删除（DELETE）**。
- **后果**：网络降级到轮询期间，他人修改/隐藏评论不会实时反映，需手动刷新。
- **修复**：轮询拉取后做**全量差异比对**（按 id 集合 diff：新增→onNewComment，消失→onDeleteComment，字段变→onUpdateComment）。

### R5 🟠 乐观插入与实时回显竞态 → 瞬时重复
- **位置**：main.js:2295（乐观 push 无 id）、:2328-2338（云端回填 id）、:2150-2188（applyRealtimeCommentEvent 按 id 去重）
- **根因**：乐观评论本地无 `id`；若实时 INSERT 在云端 `.then` 回填 id **之前**到达，`applyRealtimeCommentEvent` 用 `c.id` 去重时本地项无 id → 不匹配 → 视为新评论 push 进去；随后 patchList 给乐观项补 id，但不移除实时副本 → 出现两条。
- **修复**：乐观项生成客户端临时键（如 `c._cid = uuid()`），`applyRealtimeCommentEvent` 先按 `_cid` 匹配；或云端回填前用 `window.__fxrePendingIds` 抑制自身回显。

### R6 🟠 双轮询冗余
- **位置**：sync-manager.js:160（startPolling 15s）× main.js:1280-1290（`window.__fxreCommentPoll` 30s）
- **根因**：两套独立轮询在"非 REALTIME"时都跑，重复拉取+重渲染。
- **修复**：删除 main.js 的 `__fxreCommentPoll`，统一由 SyncManager 的轮询兜底（已具备状态感知）。

### R2（数据层，见模块二）与 R19 也影响同步一致性，见对应模块。

---

## 模块二：数据层 / 适配器

### R2 🔴 `getSubmissions` 丢弃 tags → 标签筛选对云端投稿失效
- **位置**：supabase-adapter.js:506-519
- **根因**：映射写死字段（`select('*')` + 手动 map），**未取 `submission_tags` 关联**，也未返回 `tags`。云端投稿 `s.tags` 为 `undefined`。
- **后果**：`_renderCommunityGrid` 标签筛选逻辑 `if (!s.tags || !Array.isArray(s.tags)) return false;`（main.js:2983-2989）对云端投稿恒为假 → **选中任意标签即把所有云端投稿过滤掉**，标签筛选对同步数据完全失效。
- **修复**：
  ```js
  // supabase-adapter.js:488-491
  var query = client.from('submissions')
    .select('*, submission_tags(tag_id, tags(id, name, category, color))')
    .order('created_at', { ascending: false });
  // map 内补：
  tags: (s.submission_tags || []).map(function(st){ return st.tags; }).filter(Boolean)
  ```
  同步修正 `mergeSubmissions`（R13）保留云端 tags，避免本地/云端合并时丢失。

### R7 🟠 离线队列仅在 init 冲刷一次
- **位置**：supabase-adapter.js:354-363（入队）、:707（syncPendingQueue 仅 init 调）
- **根因**：匿名会话下 `addComment` 入 `pendingSync`；`syncPendingQueue` 只在 `init()` 调一次。联网后若不刷新页面，本次会话内离线投稿**不会自动补推**。
- **修复**：在网络状态变 ready（`onAuthStateChange`/Supabase `isReady`）时调用 `syncPendingQueue()`；或 `performFullCloudSync` 触发时合并冲刷。

### R13 🟡 筛选失败静默返回 []
- **位置**：supabase-adapter.js:1150 `filterSubmissionsByTags`
- **根因**：catch 直接 `return []`，标签筛选后端异常时前端无反馈、列表空白。
- **修复**：异常时回退到"不过滤"或提示用户，而非清空。

---

## 模块三：认证与权限

### R8 🟠 封禁用户仍可操作（封禁未生效）
- **位置**：auth-manager.js:470（`fetchRole` 写入 `isBanned`）
- **根因**：`isBanned` 仅存储，但 `canCreateBookmark`/`canDeleteComment`/`canSubmitSubmission` 等均未校验；版主/管理员隐藏逻辑也不拦截被封禁者。
- **后果**：被封禁用户仍评论/投稿/收藏，封禁形同虚设。
- **修复**：在 `handleCommentSubmit`/`initSubmission`/书签动作入口统一加 `if (AuthManager.isBanned()) { toast('账号已被封禁'); return; }`。

### R14 🟡 升级流程未先 ensureAuth
- **位置**：main.js:3936 `upgradeToRegistered`
- **根因**：未先 `ensureAuth()`，匿名会话失效（token 过期）时 `updateUser` 失败且无重试。
- **修复**：升级前 `return ensureAuth().then(function(){ ...updateUser... })`。

---

## 模块四：内容安全（SecurityShield）

### R9 🟠 点击频率熔断误锁正常用户
- **位置**：security-shield.js:178（`onClickCapture` recordAction）、:203（>150/min 令 `guardUserInput` 全部返回频繁）
- **根因**：把"点击"等同于"提交"计入频率；活跃浏览用户轻松破 150 次/分钟 → 被锁 60s 无法发评论。
- **修复**：点击计数与提交计数分离；或仅对"提交类"动作计数，单击导航不计入限流。

### R10 🟠 MutationObserver 防线对动态注入 XSS 无效
- **位置**：security-shield.js:191（`watchDOM`）
- **根因**：内联 `<script>` 在 MutationObserver 回调（微任务）触发前已**同步执行**，移除动作滞后；该层实际无效（主防护靠渲染转义）。
- **修复**：保留作为纵深，但明确标注"非可靠防线"；确保**所有渲染路径**走 `escapeHTML`（已在 handleCommentSubmit 验证），并对 `innerHTML` 拼接处全量 grep 复核。

---

## 模块五：上传（UploadManager）

### R11 🟠 仅按扩展名伪造 MIME，未校验真实内容
- **位置**：upload-manager.js:93-105（`processFile`）
- **根因**：`processFile` 只看扩展名决定 MIME/走图片分支，伪装 `.jpg` 的非图片可被上传。
- **后果**：依赖 Storage 配置兜底；若 Storage 策略宽松，可上传非预期文件。
- **修复**：用 `File.type` + 读取文件头魔数（PNG/JPEG/PDF 签名）二次校验；超类型/超大小在提交前拦截并禁用按钮。

---

## 模块六：管理后台

### R12 🟠 口令哈希硬编码前端
- **位置**：admin-auth.js:175（`isAdmin` 仅校验 sessionStorage 客户端令牌）、源码内口令哈希
- **根因**：前端无法保密，任何拿到源码者均可构造 admin session；真实权限完全依赖服务端 RLS。
- **修复**：维持现状可，但须**确保服务端 `moderate_comment`/`batch_moderate_comments` RPC 内校验 `profiles.role`**（不止 RLS 行级，还要在 RPC 内 deny 非版主调用）。建议在 RPC 里 `IF (SELECT role FROM profiles WHERE id=auth.uid()) NOT IN ('moderator','admin') THEN RAISE`。

---

## 模块七：UI 与美术设计评估

### 总体判断
设计系统**令牌化做得好**（`css/style.css:10-103` 完整定义 color/glass/shadow/radius/transition 变量，暗色主题统一），但**视觉层级与设计完成度偏低**，典型症状：装饰压倒内容、玻璃拟态同质化、字体层级单薄。

### R16 🟠 9+ 背景动画层喧宾夺主
- **位置**：index.html:47-58（`star-field`/`pink-galaxy`/`galaxy-river`/`ult-energy-core`/`hex-shield`/`data-rain`/`shooting-stars`/`css-snow`/`particle-canvas` 共 9 层）
- **问题**：多层动画同时运行，GPU/CPU 占用高，且背景噪点削弱正文可读性，主体内容缺焦点。
- **修复建议**：保留 **2 层主背景**（如 `star-field` + `particle-canvas`），其余降为静态或 `prefers-reduced-motion` 下全关；给内容容器加轻微 `backdrop` 提对比。

### R17 🟠 玻璃拟态 + 多停渐变滥用
- **位置**：css/style.css:49-51（品牌渐变）、:66-70（glass 参数）、大量 `.glass` 容器
- **问题**：全站玻璃卡 + `linear-gradient(135deg,#FF6B9D→#B66BFF→#6B8AFF)` 反复出现，与"AI 模板味"高度接近（P0-2 警示的三位一体中的两项已占）。当前渐变是**品牌自有粉蓝**，非被禁的 indigo→pink，故 P0-2 不触发；但视觉同质化明显。
- **修复建议**：建立**三级色彩角色**——主色（品牌渐变，仅 hero/主 CTA）、辅助色（纯色描边/低透明填充，用于次级卡）、强调色（互动态）。内容列表改用实色低透明底而非玻璃，突出文字。

### R18 🟡 字体层级单薄
- **位置**：css/style.css:40（仅 Noto Sans SC 300-900）、:62-64（text 三级）
- **问题**：标题与正文仅靠字号区分，缺字重/字色/字距节奏；已引入 Noto Serif SC 但未系统用于标题。
- **修复建议**：建立 type scale 四级——Display（Serif, 900, 用于 hero）、Title（Sans 700）、Body（Sans 400）、Caption（Sans 300, tertiary 色）。统一 spacing scale（4/8/16/24/32/48）。

### 可访问性补充
- `--text-tertiary:#8A84A3`（:64）在 `#07070E` 背景上对比度约 3.9:1，**低于 WCAG AA 4.5:1**，次要文字需提亮。
- 确认 `:focus-visible` 全站一致应用 `--focus-ring`（:76），尤其导航/按钮。

---

## 模块八：图标规范（P0-1 违规）

> 项目自身铁律：**禁止 emoji 作为功能图标**，须用统一 SVG 图标库。当前存在多处违规：

| 位置 | 违规内容 | 性质 |
|------|----------|------|
| sync-manager.js:292-297,314,327,330 | 同步指示器状态点 🔄🟢🟡🔴 + "点击🔄重试" | **功能状态图标**（明确违规） |
| main.js:1381 | 版主隐藏按钮 `👁` | **功能图标**（明确违规） |
| admin-auth.js:231,238,241 | 口令提示 🔐 / 结果 ✅❌ | **功能 UI 文本**（违规） |
| main.js:75 `♥` / :148,156,924,934-941 | 彩蛋/对话里的 ✨⚡📡❄️ 等 | 边界：属"即时通讯/彩蛋内容"，可保留，但建议统一为 SVG 或限定在对话气泡内 |

- **修复建议**：① 同步指示器改用 SVG 圆点（绿/黄/红描边圆）+ 文字；② 隐藏按钮用 `eye`/`eye-off` SVG（复用 nav-logo 同套 stroke 风格）；③ 管理提示改用文字 + SVG 锁图标。锁定一套图标库（如 Lucide 风格线性 SVG）全站统一。

---

## 模块九：性能

### R19 🟡 重背景 + 全量重渲染
- **位置**：index.html:47-58（9 层动画）、sync-manager 实时事件触发 `renderCommunity()`/`renderComments()` 全量重画
- **问题**：动画层叠加 + 任一评论/投稿变更即全量 innerHTML 重渲染，长列表卡顿、闪烁。
- **修复建议**：① 背景动画按 R16 收敛；② 实时事件改为**增量 DOM 操作**（按 id 插入/更新/移除单节点）而非整列表重绘；③ 评论/投稿列表加分页或虚拟滚动（见历史 TASKS.md 的 Task E）。

---

## 优先级执行建议（Token 受限时）

1. **必做（核心可用）**：R2（tags 丢失→标签筛选失效）、R3（投稿实时重连）、R1（轮询去重）。三项改动小、收益大。
2. **尽快（上线质量）**：R8（封禁生效）、R9（误锁）、R11（上传校验）、R15/R16/R17（图标+视觉收敛）。
3. **后续（打磨）**：R4/R5/R6/R7/R12/R13/R14/R18/R19/R20。

---

## 验证方法（供 Cursor / 人工接续）

- **R2 复现**：Supabase 有带 tags 的投稿 → 选一个标签 → 观察云端投稿是否消失（应消失=bug 已现）。
- **R3 复现**：开两窗口，A 发帖 → B 应实时出现；断网重连后 B 再发帖，A 是否仍实时（当前不会）。
- **R1 复现**：多个评论区 + 切到轮询态 → 观察重复渲染。
- **改动后回归**：`node --check js/*.js` + 双窗口实时联调 + 标签筛选 + 封禁账号操作。
