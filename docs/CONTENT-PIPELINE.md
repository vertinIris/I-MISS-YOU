# 论坛内容管线（源稿 → 构建 → 云端）

> 单一事实源：**本地离线源稿** `论坛内容/`（gitignore，不进仓库、不进 Pages）  
> 可部署产物：`forum/js/forum-import-data.js`（已跟踪）  
> 云端真相：Supabase `forum_submissions` / `forum_comments`（需跑 migration）

## 路径一览

```
论坛内容/二创内容库/*.md
        │
        │  npm run content:build
        │  (= node scripts/build-forum-import.cjs)
        ▼
forum/js/forum-import-data.js   ← 仓库内种子（可 commit）
        │
        │  论坛页加载：StarTorchData.ensureSeedData()
        │  云端 pull：StarTorchCloud.pull() 合并
        │  可选：ensureCloudSeed 把缺失种子 upsert 上云
        ▼
Supabase forum_* 表
```

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
   - 种子/清理：`024`…`027` 按需  
   - **本批**：`028` 置顶 + 楼中楼 → `db/migration-028-forum-pin-replies.sql`  
   - **Production 收口（用户确认已跑）**：`027`（profiles nickname RLS）+ `028`（`is_pinned` + `parent_id`）。自查 SQL 见 `docs/STATUS.md`；勿反复催重跑。  
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
