# 疏漏审计清单（完整版）

> **版本**: v7.8.1 | **审计日期**: 2026-07-03  
> **用途**: 记录项目审查中发现的所有疏漏——含已修复项（备查）与仍待处理项（按模块分类）

快速摘要见 [known-gaps.md](./known-gaps.md)。排错见 [troubleshooting.md](./troubleshooting.md)。v7.8 修正过程见 [fix-journal-v7.8.md](./fix-journal-v7.8.md)。

---

## 图例

| 状态 | 含义 |
|------|------|
| ✅ 已修复 | v7.8 / v7.8.1 代码或 SQL 已处理 |
| ⚠️ 部分实现 | 有功能但行为不完整或仅本地 |
| ❌ 未实现 | 设计/文档有提及，代码未做 |
| 📋 文档偏差 | 文档与代码/SQL 不一致 |
| 🔧 运维待办 | 需人工在 Supabase / GitHub 操作 |

---

## 一、已修复疏漏（v7.8 / v7.8.1）— 备查勿重复排查

| ID | 疏漏 | 表现 | 根因 | 修复位置 | 版本 |
|----|------|------|------|----------|------|
| F-01 | 投稿 type 不匹配 | 投稿 Toast 成功但 Supabase 无记录 | 前端 `text` vs DB CHECK `文字` | `js/supabase-adapter.js` `TYPE_TO_DB` | v7.8 |
| F-02 | 种子昵称错误 | 云端种子评论全显示「匿名信号源」 | `seedCloudIfEmpty` 读 `c.author` 应为 `c.name` | `js/repository.js` | v7.8 |
| F-03 | 评论跨设备不可见 | 每人只见自己的评论 | 初始化竞态 + 云端未就绪跳过写入 | `main.js` / `repository.js` | v7.8 |
| F-04 | Realtime 无效 | 他人发评需手动刷新 | 订阅在 `initCloud()` 完成前执行 | `setupCloudRealtime()` 延后 | v7.8 |
| F-05 | migration-003 致命 bug | 所有评论 INSERT 失败 | `search_path=''` 且无 `public.` 前缀 | `db/migration-004-fix-search-path.sql` | v7.8.1 |
| F-06 | 版本号不一致 | 页脚/文档/package 版本混乱 | 未统一 bump | `index.html` / `package.json` / docs | v7.8.1 |
| F-07 | 本地预览失败 | `ERR_EMPTY_RESPONSE` | 8080 多进程占用 | `打开本地预览.bat` 8848 端口 | v7.8 |
| F-08 | Git 推送/合并 | push rejected、6 文件冲突 | 远程旧历史 vs 本地新 init | `解决合并冲突.bat` / pull 文档 | 运维 |
| F-09 | GitHub Pages 404 | 访问小写 `l-MISS-YOU` | URL 拼写 | 文档标明正确 URL | 运维 |
| F-10 | Actions Deploy 红 | workflow 失败 | Pages 源与 Actions 冲突 | Deploy from branch | 运维 |
| F-11 | 云端失败无提示 | 用户以为已同步 | `addComment` 静默失败 | Toast + `_error` 返回 | v7.8.1 |
| F-12 | 自删窗口不一致 | 文档 10 分钟 vs 代码其他值 | 常量未统一 | `admin-auth.js` `SELF_DELETE_MS` | v7.8 |

---

## 二、功能疏漏（仍待处理）

### 2.1 用户身份与 profiles

| ID | 疏漏 | 现状 | 影响 | 涉及文件 | 建议 |
|----|------|------|------|----------|------|
| G-01 | `profiles` 表未接前端 | 表已建，匿名登录后未写 profile | 昵称每次手填；换设备/浏览器身份不连续 | `migration-001-init.sql`；无前端调用 | 登录后 upsert profile；评论表单默认读 nickname |
| G-02 | 匿名用户无法「登出」 | `UserAPI.logout` 为 Stub | 同一浏览器 session 固定 | `main.js` L2078 | 可 `signOut` + 重新匿名登录（低优） |
| G-03 | 评论 author_id 未始终写入本地缓存 | 部分旧评论无 `authorId` | 自删按钮可能不显示 | `repository.js` `mapCloudComment` | 拉取时补全字段 |

### 2.2 评论系统

| ID | 疏漏 | 现状 | 影响 | 涉及文件 | 建议 |
|----|------|------|------|----------|------|
| G-04 | 动态区评论数写死 | HTML 中 `<span>28</span>` 等静态数字 | 发评后按钮数字不更新 | `index.html` L541 等；`renderComments` 未更新 | 渲染后同步 `.post-actions` 第二按钮数字 |
| G-05 | 管理员删他人云端评论 | RLS 不允许 anon 删他人行 | 管理员删评仅本地消失，他人仍可见 | `repository.js` L327-333 | Edge Function + service_role |
| G-06 | 历史「仅本地」评论 | v7.8 前失败的评论只在 localStorage | 需 `syncLocalOnlyComments` 或用户重发 | `repository.js` | 页脚增加「上传本地评论」提示 |
| G-07 | Realtime 订阅范围 | 仅已 DOM 存在的 `.comment-area` | 后加载社区卡片评论区可能未订阅 | `main.js` `setupCloudRealtime` | 社区展开时补订阅 |
| G-08 | 合并去重边界 | 同昵称+同文+同秒可能重复 | 极低概率重复行 | `repository.js` `mergeComments` | 以云端 `id` 为唯一键（已基本满足） |

### 2.3 点赞与投稿

| ID | 疏漏 | 现状 | 影响 | 涉及文件 | 建议 |
|----|------|------|------|----------|------|
| G-09 | 动态时间线点赞 | `initLikeButtons()` 纯前端计数 | 刷新后恢复 HTML 初始值；不跨设备 | `main.js` L81-94；`index.html` `data-likes` | 与社区区一样接 Supabase 或明确为「装饰数据」 |
| G-10 | 社区取消点赞 | unlike 只改 localStorage | 云端 likes 只增不减 | `main.js` L1643-1651；无 `decrement` RPC | 新增 RPC 或禁止取消 |
| G-11 | 种子投稿点赞 | SEED 投稿 id 为字符串 `sub-1` | 点赞无法调 `increment_submission_likes` | `main.js` SEED_SUBMISSIONS | 种子同步后改用数字 id |
| G-12 | 投稿删除/编辑 | 无 UI、无 API | 发错无法改 | — | P3：RLS DELETE 自删 + 编辑窗口 |
| G-13 | 投稿筛选/排序 | 仅前端 filter | 大量投稿时全量拉取 | `main.js` initCommunity | 服务端分页（远期） |

### 2.4 Phase 4 扩展点（Stub）

| ID | 疏漏 | 现状 | 涉及文件 |
|----|------|------|----------|
| G-14 | `ArchiveAPI.clearArchive` | 恒返回 `false` | `main.js` L2043-2045 |
| G-15 | `SyncAPI.pull` | 仅 warm cache `post_1` | `main.js` L2054-2060 |
| G-16 | `UserAPI.logout` | 恒返回 `false` | `main.js` L2078-2080 |

### 2.5 社区与 UI

| ID | 疏漏 | 现状 | 影响 |
|----|------|------|------|
| G-17 | 分享按钮 | 无 click 逻辑 | 纯装饰 |
| G-18 | pending 队列可见性 | 仅 🔄 按钮 + Console | 用户不知有多少条待同步 |
| G-19 | 云端加载态 | 首屏可能先闪本地再刷新 | 短暂显示旧数据 |
| G-20 | 音乐/粒子 CDN 失败 | 有 CSS 降级 | 功能可用，体验下降 |

---

## 三、数据库与 RLS 疏漏

| ID | 疏漏 | 现状 | 影响 | 建议 |
|----|------|------|------|------|
| D-01 | migration-004 未执行 | 🔧 依赖运维 | 评论仍无法入库 | Supabase SQL Editor 必跑 004 |
| D-02 | 无管理员 DELETE 策略 | 设计如此 | 纯前端无法删他人行 | Edge Function |
| D-03 | `cleanup_rate_limits` 无 cron | 函数存在，无调度 | `rate_limits` 表持续增长 | pg_cron 或 Supabase 定时任务 |
| D-04 | 无 `decrement_submission_likes` | 仅有 increment RPC | 取消点赞无法同步 | 新增 migration |
| D-05 | profiles INSERT 策略 | 仅 UPDATE 策略常见 | 新匿名用户可能无法自动建 profile | 触发器 `on auth.users created` |
| D-06 | Realtime publication | 需确认表已加入 publication | 否则 Realtime 静默无效 | Dashboard → Database → Replication |

---

## 四、安全疏漏

| ID | 疏漏 | 严重度 | 说明 | 缓解 |
|----|------|--------|------|------|
| S-01 | 管理员口令在前端 | 中 | SHA-256 可被暴力尝试 | 改口令；远期 Edge Function 验证 |
| S-02 | security.md 含口令明文注释 | 低 | L244 示例口令 | 文档改为「见维护者」 |
| S-03 | 前端速率限制可绕过 | 低 | 清 localStorage / 换浏览器 | DB 触发器已兜底（需 004） |
| S-04 | anon key 公开 | 预期 | 安全靠 RLS | 勿泄露 service_role key |
| S-05 | XSS | 低 | `escapeHTML` 用于渲染 | 新 UI 须继续转义 |
| S-06 | 敏感词过滤 | 低 | migration-002 有函数 | 前端未调用，仅 DB 层（若启用） |

---

## 五、部署与运维疏漏

| ID | 疏漏 | 说明 | 处理 |
|----|------|------|------|
| O-01 | Supabase Free 休眠 | 1 周无请求暂停 | UptimeRobot 5 分钟 ping |
| O-02 | jsdelivr / Google Fonts | Edge 扩展可能拦截 | 换 CDN 或本地化 vendor |
| O-03 | Site URL 未配 | 匿名登录 redirect 异常 | Auth → URL Configuration |
| O-04 | 文档未 push | 本地 docs 更新未上 GitHub | `git push` |
| O-05 | 双 run.ps1 | `CURSOR/run.ps1` 属 Python 项目 | 只用 `Snow/run.ps1` |

---

## 六、文档与工程疏漏

| ID | 疏漏 | 位置 | 说明 |
|----|------|------|------|
| E-01 | `assets/` 预览图缺失 | 旧 README 提及 | 目录不存在或为空 |
| E-02 | `database-design.md` 版本旧 | 仍标 v7.7 | 未含 migration-003/004 |
| E-03 | `security.md` 策略名 | 与 migration-002 部分命名不同 | 以 SQL 为准 |
| E-04 | 无自动化测试 | — | 回归靠手工 |
| E-05 | `syntax-check` 脚本 | `package.json` | 仅 bash，Windows 需单独验证 |
| E-06 | 无 favicon / OG | `index.html` | 分享预览差 |
| E-07 | `.env.example` ADMIN 哈希 | 占位符 | 以 `admin-auth.js` 为准 |

---

## 七、架构认知疏漏（易误解）

| 误解 | 实际情况 |
|------|----------|
| 「GitHub Pages 不能互动」 | 静态托管 + Supabase BaaS = 可评论/投稿/Realtime |
| 「本地模式 = 坏了」 | SDK 未加载或扩展拦截时**故意降级**，本地仍可用 |
| 「管理员删评 = 全网消失」 | 无 Edge Function 时**仅本机 UI 移除** |
| 「点赞数字是真实的」 | 动态区点赞为**叙事装饰**；社区区部分同步云端 |
| 「跑过 003 就够了」 | **必须再跑 004**，否则评论 INSERT 全失败 |

---

## 八、修复优先级路线图

### P0 — 阻塞互动（运维）

1. 🔧 Supabase 执行 `migration-004-fix-search-path.sql`
2. 🔧 确认 Anonymous Sign-ins + Site URL
3. 🔧 线上 Ctrl+F5 确认 v7.8.1

### P1 — 体验一致性

1. G-04 动态评论数随 `renderComments` 更新
2. G-10 / D-04 点赞 unlike 与云端一致
3. G-09 明确时间线点赞是装饰或接云端
4. G-06 本地-only 评论补传提示

### P2 — 身份与治理

1. G-01 profiles 对接
2. G-05 管理员删评 Edge Function
3. G-12 投稿自删

### P3 — 工程与文档

1. E-02 更新 database-design
2. E-01 补 assets 或删 README 引用
3. E-04 关键路径 smoke test
4. O-01 UptimeRobot

---

## 九、验证「疏漏是否仍存在」的检查表

```
评论互不可见
  → Supabase comments 表有数据吗？
  → 004 跑了吗？
  → 页脚 ✅ 云端在线？

评论数不变
  → 看 index.html 静态 span（G-04，已知疏漏）

管理员删评他人仍可见
  → 预期行为（G-05），需 Dashboard SQL 删

点赞刷新后还原
  → 动态区 G-09；社区种子 id G-11

文档和代码不一致
  → 以本文件 + migration SQL 为准
```

---

## 十、相关文件索引

| 模块 | 路径 |
|------|------|
| 评论 UI/Realtime | `js/main.js` |
| 数据层 | `js/repository.js` |
| 云端适配 | `js/supabase-adapter.js` |
| 管理员 | `js/admin-auth.js` |
| 速率限制 | `js/rate-limiter.js` |
| 数据库迁移 | `db/migration-001` ~ `004` |
| 静态动态卡片 | `index.html` |

---

*本文随版本迭代更新。修复某项后请将对应 ID 移至「一、已修复」并在 changelog 记录。*
