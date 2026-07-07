# 变更日志

> 完整版本历史：v1.0 → v7.9

---

## v7.9 (2026-07-07)

### 修复
- **G-04 博文评论数动态更新**：评论渲染/提交/删除后自动更新 `.post-action` 中的评论计数，不再依赖 HTML 写死的静态数字（28/47/63/92/51/156）
- **G-09 博文点赞持久化**：`initLikeButtons()` 改为 localStorage 持久化方案，页面刷新后保留 liked 状态和计数
- **G-10 社区取消点赞云端同步**：新增 `decrement_submission_likes` RPC + `SupabaseAdapter.unlikeSubmission()`，取消点赞现在同步到云端
- **G-10 社区点赞 liked 状态合并修复**：`mergeSubmissions()` 重写为 byKey 合并策略，保留本地 `liked` 状态并使用云端 `likes` 权威值
- **社区点赞 RPC 返回值**：like/unlike 后用云端返回的真实计数修正本地乐观值

### 新增
- `db/migration-005-unlike-rpc.sql` — `decrement_submission_likes` RPC
- `js/supabase-adapter.js` — `unlikeSubmission()` 方法
- `js/main.js` — `updatePostCommentCount()` / `getSubmissionsSync()` / `getPostLikedStates()` / `savePostLikedStates()`

### 修改
- `js/main.js`：`initLikeButtons()` 重写（持久化）；`_renderCommentsList()` 增加评论计数更新；`handleDeleteComment()` 动画分支增加计数更新；社区点赞逻辑全面重写
- `js/repository.js`：`mergeSubmissions()` 重写（byKey 合并 + liked 保留 + cloud likes 权威）
- `js/supabase-adapter.js`：导出 `unlikeSubmission`

---

## v7.8.1 (2026-07-03)

### 修复
- **migration-004**：修复 migration-003 中 `SET search_path = ''` 导致 `rate_limits` 表找不到、评论 INSERT 全部失败的问题
- 评论提交失败时 Toast 提示「云端同步失败，仅保存在本机」
- 文档：新增排错手册、修正日志、**疏漏审计清单**、部署清单（`docs/`）

### 修改
- `db/migration-004-fix-search-path.sql`（新文件）
- `docs/troubleshooting.md`、`docs/fix-journal-v7.8.md`、`docs/gaps-audit.md`、`docs/known-gaps.md`、`docs/deployment-checklist.md`

---

## v7.8 (2026-07-03)

### 修复
- **投稿 type 映射**：前端英文 ↔ 数据库中文 CHECK 约束
- **评论跨设备同步**：云端就绪后全量拉取 + Realtime + 30s 轮询 + 本地-only 评论补传
- **种子同步**：`c.name` → `c.author`
- **AdminAuth**：10 分钟自删窗口常量 `SELF_DELETE_MS`
- **本地预览**：默认端口 8848，避免 8080 冲突

### 新增
- `db/migration-003-fixes.sql` — INSERT 触发器、点赞 RPC、10 分钟删评 RLS
- `打开本地预览.bat`、`run.ps1`、`更新GitHubPages.bat`、`解决合并冲突.bat`
- `repository.isCloudReady()` / `isCloudEnabled()` / `pullCommentsAndPersist()`

### 修改
- `js/main.js`：`refreshAllCommentsFromCloud()`、`setupCloudRealtime()` 延后
- `js/repository.js`：合并策略、始终尝试云端写入
- `js/supabase-adapter.js`：`TYPE_TO_DB` / `TYPE_FROM_DB`
- `index.html`：页脚 v7.8、投稿标题 maxlength 100
- `package.json`：version 7.8.0

---

## v7.7 (2026-07-03)

### 新增
- 🔄 **主动同步按钮**：页脚新增 🔄 按钮，点击后调用 `syncPendingQueue()` 立即将 pending 队列同步到云端
- **pending 队列持久化**：离线同步队列从内存存储改为 `localStorage('fxre_pending_sync')` 持久化，刷新页面不丢失
- 同步按钮带旋转动画 + Toast 提示同步结果

### 修改
- `js/supabase-adapter.js`：pendingSync 改为持久化存储，新增 `savePendingQueue()` / `loadPendingQueue()` 函数
- `index.html`：页脚新增 `#sync-now-btn` 按钮元素
- `css/style.css`：新增 `.sync-now-btn` 样式（旋转动画 + 玻璃拟态）
- `js/main.js`：新增 `handleManualSync()` 函数绑定到同步按钮

---

## v7.6 (2026-07-02)

### 新增
- **评论删除功能（三合一方案）**：
  1. 自删：作者 10 分钟内可删除自己的评论（`author_id` 匹配 + 时间窗口）
  2. 管理员删除：通过共享口令（SHA-256 验证）获取管理员权限，可删除任意评论
  3. Supabase SQL 直删：在 Dashboard SQL Editor 使用 service_role 绕过 RLS
- `js/admin-auth.js`（新文件）：纯 JS SHA-256 实现 + 口令验证 + 管理员状态持久化
- 默认管理员口令：`flyingedelweiss2026`
- 页脚双击触发管理员登录入口
- 评论区条件显示删除按钮（自删 ≤10min 或管理员可见）
- 管理员模式高亮评论项（`.comment-item-admin`）

### 修改
- `js/repository.js`：新增 `deleteComment()` 方法（云端 by id 删除 + 本地 by composite key 删除）
- `js/main.js`：新增 `handleDeleteComment()` 函数；`_renderCommentsList` 加条件删除按钮；`initComments` 加删除按钮事件委托
- `css/style.css`：新增 `.comment-delete-btn` 样式 + `.comment-item-admin` 高亮
- `index.html`：新增 `admin-auth.js` 引用；页脚初始文字改为「☁ 本地模式」
- SEED_VERSION → v7.6

---

## v7.5 (2026-07-02)

### 新增
- **前端速率限制模块** (`js/rate-limiter.js`)：
  - 评论限制：3次/60秒
  - 投稿限制：2次/300秒
  - localStorage 持久化 + 内存回退存储
- **服务器端安全加固** (`db/migration-002-rls-hardening.sql`)：
  - `rate_limits` 表 + 索引
  - `check_rate_limit()` 函数：评论5次/分、投稿3次/5分
  - `check_daily_quota()` 函数：评论50条/天、投稿10篇/天
  - `moderate_content()` 触发器：敏感词过滤（spam/广告/URL）
  - comments INSERT 策略强化：内容长度校验
  - comments DELETE 策略：作者10分钟内可删
  - `cleanup_rate_limits()` 清理函数
- `escapeHTML()` 强化：全字符转义（& < > " ' /）
- 输入校验：昵称 ≤20字、评论 2-500字、投稿标题 ≤100字、内容 ≤2000字

### 修改
- `js/main.js`：`handleCommentSubmit` 加速率限制 + 输入校验；投稿提交加速率限制 + 校验
- `index.html`：新增 `rate-limiter.js` 引用

---

## v7.4 (2026-07-02)

### 新增 — Phase 3 云端同步
- **Supabase 集成**：PostgreSQL + 匿名登录 + RLS 行级安全 + Realtime 订阅
- `js/supabase-adapter.js`（新文件）：Supabase 客户端封装
  - SDK 轮询等待 (`waitForSDK`) + 12秒认证超时 (`ensureAuthWithTimeout`)
  - SDK 加载失败降级 (`sdkLoadFailed`)
  - pendingSync 离线队列
- `js/repository.js`（新文件）：DataRepository 抽象层
  - localStorage / Supabase 双后端切换
  - 双写策略：本地优先 + 云端异步
  - 合并去重：本地 ∪ 云端，按 author_name + content + created_at 去重
  - 乐观更新：提交后立即本地渲染
  - 种子数据首次写入云端 (`seedCloudIfEmpty`)
- 页脚 `#sync-status` 同步状态指示器：provider / ready / user / pending
- 点击页脚可复制诊断信息

### 修改
- `index.html`：Supabase SDK `<script>` 改为 async + onerror 降级
- `js/main.js`：所有数据操作改用 DataRepository 抽象层

### 修复
- Edge 浏览器转圈问题：SDK 同步阻塞 → 改 async
- 夸克同步问题：合并去重逻辑修复
- 本地未认证：ensureAuthWithTimeout 超时处理
- 云端覆盖本地数据：seedCloudIfEmpty 改为只同步不覆盖

---

## v7.3 (2026-07-02)

### 修复
- **气泡截断修复**：`position:fixed` + `getBoundingClientRect()` 替代 `position:absolute`，脱离 `.profile-card` overflow:hidden
- 移除 `white-space:nowrap`，添加 `max-width:280px` + 自然换行
- 点击外部自动关闭气泡

### 优化
- **SVG 头像优化**：主头像眼睛 sparkle 位置调整（内侧白色 + 外侧 light blue）
- 6个小头像升级：2px蓝眼 + highlight + sparkle + 长发延伸 + 双侧金星 + 胸雪花 + 机兵暗示
- **论坛内容丰富**：SEED_SUBMISSIONS 6篇预置投稿
- **安全性统一**：innerHTML 使用 escapeHTML；localStorage 操作统一改用 safeSetItem/safeGetItem
- **架构预留**：ArchiveAPI/SyncAPI/UserAPI 接口 stub（Phase 4），暴露 `window.__FXRE_API`

---

## v7.2 (2026-07-01)

### 新增
- **多用户预置评论**：9个目标（6动态+3日志）各3-4条评论
  - 7个不同角色身份：诺娃/埃拉拉/塞莱斯特/漂泊者信使/洛瑟菈校长/匿名信号源/调频9072
  - 每条含差异化头像颜色
  - 种子机制：SEED_VERSION 控制首次写入
- **3个新彩蛋互动**：
  1. 头像长按800ms → 隐藏对话气泡（5条轮换）
  2. 双击日志标题 → 蓝紫光脉冲 + 「信号已同步」
  3. 评论关键词 → Toast 回应（8个关键词）
- **头像 SVG 优化**：主头像加入 hairGrad 渐变长发、眼高光、机兵暗示线条
- 6个小头像统一升级（长发+粉白+蓝眼高光+腮红+胸雪花+金星星）
- 评论头像支持动态背景色 + hover 放大
- **配图 CSS 增强**：雪景 + ground glow + snowTextFloat 动画；笑脸 + 粉色径向 + smileyPulse 动画；星空 + 信号河流光带 signalRiverFlow

---

## v7.1 (2026-07-01)

### 角色设定审查（爱弥斯官方设定对齐）
- **角色身份修正**：爱弥斯是星炬学院拉贝尔学部隧者共鸣者，现为电子幽灵（非"偶尔"变成）
- **"飞行雪绒"是秘密歌手身份**，非主身份
- **性格特征**：外表活泼俏皮（元气），内心沉重（心口不一）；说话用"～"结尾
- **核心关系修正**：与漂泊者互视为"家人"；官方好友：埃拉拉、诺娃、琳、塞莱斯特；校长：洛瑟菈
- **标志性台词**："我知道，只要抬头，那颗星总能找到我"
- **彩蛋引用**：调频9072（星炬学院网站隐藏频率）
- **修正要点**：辛吉勒姆教授（非官方）→ 洛瑟菈校长/导师；#爱弥斯 → #飞行雪绒；日志3时间线修正

---

## v7.0 (2026-07-01)

### 新增 — Phase 3 社区建设
- **评论系统**（`initComments`）：JS 动态为 6 条动态 + 3 篇日志注入可展开评论区
- **投稿功能**（`initSubmission`）：5 种类型（文字/故事/诗歌/插画/音乐），字数计数器，Toast 提示
- **社区论坛**（`initCommunity`）：类型筛选，投稿卡片含点赞/评论/展开收起，空状态引导，响应式网格
- 导航更新：资料→音乐→动态→日志→投稿→社区
- localStorage 本地存储，try-catch 兼容

**三阶段全部完成**：基础搭建 ✅ + 沉浸体验 ✅ + 社区建设 ✅

---

## v6.0 (2026-07-01)

### 新增 — 鸣潮共振按钮系统
- **四种角色色按钮**：爱弥斯（粉白金）、漂泊者（深空蓝紫）、双形态（黑胶+频谱）、信号（青蓝紫粉）
- **四态交互系统**：default → hover (translateY-3px + scale1.03) → active (scale0.96) → disabled (grayscale)
- **共振特效（JS）**：点击涟漪 (resonance-ripple 0.6s) + 悬停粒子发射 (每120ms角色色粒子)
- **按钮 Token**：--aimisi-pink/white/gold、--drifter-blue/purple/starlight、--spectral-cyan

---

## v5.0 (2026-07-01)

### 视觉与交互打磨
- **导航滚动联动**：scroll 事件 + rAF + section 顶部位置计算
- **彩虹呼吸灯**：.btn-primary 背景渐变扩展为粉→金→浅蓝→蓝→紫→粉 400% 彩虹循环
- **黑胶唱片音乐按钮**：深色唱片底纹 + repeating-radial-gradient 沟槽 + conic 彩虹声波环
- **模块顺序调整**：profile → music → timeline → diary → easter-egg
- **爱弥斯大招背景**：.ult-energy-core 中心脉动光球、.hex-shield 六边形能量场、.data-rain 数据雨
- **雪花层次差异化**：40% 轻盈层 + 60% 饱满层

---

## v4.0 (2026-07-01)

### 雪花系统统一设计
- 导航栏logo、页脚logo、彩蛋图标统一 6臂雪花 SVG
- 蓝白配色（#A8D8FF→#6B8AFF→#FFFFFF渐变）

### 流星随机化系统
- 递归 setTimeout + 4种模式随机切换（连发15%/快速25%/普通35%/长暂停25%）
- 每颗流星独立随机参数

### 地点选择器
- Hero 徽章改造为下拉选择器，5个鸣潮官方地点
- click 事件 toggle + localStorage 持久化

### 暗色模式调优
- 背景 #07070E、文字 #FAF8FF、星光 opacity 0.75

### 音乐模块提升
- v4：Hero 区新增"我的音乐"按钮，与"查看动态""认识飞行雪绒"并列

---

## v3.0 (2026-07-01)

### 高级光效系统
- **呼吸灯光带**（.btn-primary）：三层叠加（gradientShift + conic-gradient + shimmer）
- **漂泊者星空按钮**（.btn-ghost）：深邃星空黑蓝紫渐变 + 星云漂移
- **音乐按钮**（.btn-music）：蓝紫渐变 + conic光带旋转 + 冷色扫光
- **雪花彩蛋**：3层SVG雪花 + Gaussian Blur发光 + 三重动画
- **星河光带**（.galaxy-river）：线性渐变 + blur + rotate + 横向流动
- **闪光粒子**（.sparkle）：JS动态生成 + CSS keyframes

### 音乐模块
- Web Audio API 实时合成，5种音色，5首原创曲目
- Canvas 可视化频谱

---

## v2.0 (2026-07-01)

### 内容搭建
- 角色资料卡片
- 动态时间线（6条）
- 日志（3篇）
- 玻璃拟态设计语言
- 响应式布局
- 暗色模式

---

## v1.0 (2026-07-01)

### 初始版本
- 项目立项
- 基础 HTML 结构
- CSS 样式框架
- 星空背景动画
- 基础导航
