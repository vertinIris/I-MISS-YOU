# 论坛内容管线（源稿 → 构建 → 云端）

> 单一事实源：**本地离线源稿** `论坛内容/`（gitignore，不进仓库、不进 Pages）  
> 可部署产物：`forum/js/forum-import-data.js`（已跟踪）  
> 云端真相：Supabase `forum_submissions` / `forum_comments`（schema 以 STATUS 为准；Production **027/028 已确认**）

## 路径一览

```
论坛内容/二创内容库/*.md
        │
        │  npm run content:build
        │  (= node scripts/build-forum-import.cjs)
        │  分流：type:lore（档案/设定）→ 不写入讨论区种子
        ▼
forum/js/forum-import-data.js   ← 仓库内讨论区种子（可 commit）
        │
        │  论坛页加载：StarTorchData.ensureSeedData()
        │  云端 pull：StarTorchCloud.pull() 合并
        │  ensureCloudSeed：仅白名单类型（story/poem/art/text/video）upsert
        │  type:lore 永不进入 forum_submissions
        ▼
Supabase forum_* 表
```

## 分区边界（硬约束）

| 内容 | 去向 | 禁止 |
|------|------|------|
| 讨论区帖（story/poem/art/text/video…） | `forum_submissions` + 本地 `stf_submissions` | — |
| 档案向 `type:lore` | 角色档案 HTML / 世界观卡；构建时从讨论区种子剔除 | **禁止** upsert 进 `forum_submissions` |
| 角色扩写 | `characters/*/index.html` + `#characters-archive` | 勿拆进讨论区表 |

## 日常操作

1. **改源稿**（本地，勿 commit 大正稿）  
   编辑 `论坛内容/二创内容库/` 下 Markdown。

2. **生成种子**  
   ```bash
   npm run content:build
   ```
   输出覆盖 `forum/js/forum-import-data.js`。

3. **本地预览**  
   ```bash
   npm run serve:win
   # 或 npm run serve → http://127.0.0.1:8848/forum/
   ```

4. **云端 schema（按序）**  
   - 论坛基础：`020` 表 → `021` RLS → `022` Realtime → `023` 聊天  
   - 种子/清理：`024`…`026` 按需  
   - **Production 已确认**：`017`（硬删 Realtime）+ `027`（profiles nickname RLS）+ `028`（`is_pinned` + `parent_id` 置顶 / 一层楼中楼）。自查 SQL 见 `docs/STATUS.md`；**勿再写「待跑」、勿反复催重跑**。  
   - **分区边界**：讨论区种子 / 云端帖 ≠ 世界观 lore 卡 ≠ 角色档案 HTML。扩展资料勿混入错误表。  
   - **禁止**再跑废弃的 `migration-020-forum-chat.sql`（已改名为 `DEPRECATED-migration-020-forum-chat.sql`）

5. **推上云**  
   - 打开论坛并登录（或透明匿名会话）后点「立即同步」；  
   - 或在 Dashboard 用 `migration-024-import-seed-*.sql` 批量导入历史数据。  
   - 大正稿本身**不要** commit / 不要塞进 Pages。

## npm scripts

| 命令 | 作用 |
|------|------|
| `npm run content:build` | md → `forum-import-data.js` |
| `npm run content:pipeline` | 打印本说明路径提示 |
| `npm run smoke-check` | 冒烟 |
| `npm run extreme-audit` | 深度审计 |
| `npm run db:migrate-028` | 打印 028 执行指引 |

## 注意

- `论坛内容/技术参考/` 是旧快照，**勿覆盖**现网 `js/` / `forum/` / `index.html`。  
- 种子缓存键 `SEED_VERSION` 与产品展示版本号无关。  
- XSS：论坛渲染一律 `escapeHTML` + `SecurityShield` / `safeMediaUrl`。
