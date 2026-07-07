# v7.8 / v7.8.1 修正日志与纠错思路

> **日期**: 2026-07-03 | **维护者备忘**

本文记录 2026-07-03 集中排查中发现的问题、根因、修复方案与推理过程，供后续维护参考。

---

## 1. 问题总览

| # | 现象 | 根因 | 修复 | 版本 |
|---|------|------|------|------|
| 1 | 投稿云端同步失败 | 前端 `text/story/...` vs DB CHECK 中文 | `supabase-adapter.js` type 映射 | v7.8 |
| 2 | 种子评论昵称变「匿名信号源」 | `seedCloudIfEmpty` 用 `c.author` 而非 `c.name` | `repository.js` | v7.8 |
| 3 | 多人评论互不可见 | 初始化竞态 + 云端未就绪时只写 localStorage | `refreshAllCommentsFromCloud` 等 | v7.8 |
| 4 | Realtime 不生效 | 订阅在 `initCloud` 之前执行 | `setupCloudRealtime` 延后 | v7.8 |
| 5 | migration-003 后评论全失败 | `search_path=''` 下表名无 `public.` 前缀 | `migration-004-fix-search-path.sql` | v7.8.1 |
| 6 | 本地预览 ERR_EMPTY_RESPONSE | 8080 端口被多进程占用 | 默认改 8848 端口 | v7.8 |
| 7 | Git push rejected | 远程已有历史 | pull + merge / bat 脚本 | 运维 |
| 8 | GitHub Actions Deploy 失败 | Pages 源配置与 Actions 冲突 | Settings → Deploy from branch | 运维 |

---

## 2. 纠错思路（方法论）

### 2.1 「只能看到自己的评论」

**推理链：**

```
用户 A 能看到自己的评论
    → 本地 localStorage 写入正常（乐观更新）
用户 B 看不到 A 的评论
    → 要么没进 Supabase，要么读了但没合并

检查 Supabase comments 表
    → 若为空/只有部分：写入失败
    → 若有数据但页面不显示：读取/合并/刷新失败
```

**结论分层：**

1. **写入层**：`addComment` 在 `cloudAvailable=false` 时跳过适配器 → 改为 `isCloudEnabled()` 始终走适配器 + pending 队列
2. **读取层**：首屏 `renderComments` 在 SDK 未就绪时只读本地 → 云端就绪后 `refreshAllCommentsFromCloud()`
3. **数据库层**：migration-003 触发器内函数找不到表 → **migration-004 必跑**

### 2.2 「纯静态」≠「不能互动」

```
GitHub Pages  = 托管 HTML/CSS/JS 文件（无自建服务器）
Supabase      = 云端 PostgreSQL + Auth + Realtime
二者组合      = 静态前端 + BaaS 互动社区
```

### 2.3 Git 合并冲突

本地 v7.8 与 GitHub 旧版修改同一文件 → pull 产生 conflict。

**策略**：保留 **Current Change（本地）**，因含全部 v7.8 修复；或运行 `解决合并冲突.bat`。

---

## 3. 代码改动清单（v7.8）

### js/repository.js

- `isCloudReady()` / `isCloudEnabled()` 分离读取与写入条件
- `pullCommentsAndPersist()` — 拉云端并写回 localStorage
- `syncLocalOnlyComments()` — 补传有 `time` 无 `id` 的用户评论
- `mergeComments()` — 云端 id 优先
- `addComment()` — 始终尝试 Supabase（enabled 时）

### js/main.js

- `refreshAllCommentsFromCloud()` — 云端就绪后全量刷新
- `setupCloudRealtime()` — 延后 + 30s 轮询兜底
- `visibilitychange` — 切回标签页刷新
- 评论提交失败 Toast 提示

### js/supabase-adapter.js

- `TYPE_TO_DB` / `TYPE_FROM_DB` 投稿类型映射
- `addComment` 失败返回 `_error` 供 UI 展示

### js/admin-auth.js

- `SELF_DELETE_MS` 10 分钟自删窗口

### db/

- `migration-003-fixes.sql` — INSERT 触发器（有 bug，需 004）
- `migration-004-fix-search-path.sql` — 修复 search_path

---

## 4. migration-003 → 004 技术细节

**Bug**：函数声明 `SET search_path = ''` 但 SQL 内写 `FROM rate_limits` 而非 `FROM public.rate_limits`。

**表现**：INSERT 触发 `enforce_insert_limits` → 调用 `check_rate_limit` → 报错 `relation "rate_limits" does not exist` → 评论只存本地。

**Fix**：004 将所有相关函数改为 `SET search_path = public` 或显式 `public.` 前缀。

---

## 5. 验证清单（修完后必做）

- [ ] Supabase SQL Editor 已跑 001→002→003→**004**
- [ ] Anonymous Sign-ins 已启用
- [ ] Site URL = GitHub Pages 地址
- [ ] 页脚 **✅ 云端在线** + **v7.8**
- [ ] 发评论无「云端同步失败」Toast
- [ ] Table Editor → `comments` 有新行
- [ ] 另一台设备/浏览器能看到新评论
