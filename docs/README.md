# 文档索引

权威现状与版本以代码 + SQL 为准，入口如下。

| 文档 | 用途 |
|------|------|
| [STATUS.md](./STATUS.md) | 对外版本 v10.0、migration 要点、Production 确认项 |
| [CONTENT-PIPELINE.md](./CONTENT-PIPELINE.md) | 论坛内容源 → `content:build` → 导入 / 种子 |
| [WORLDVIEW.md](./WORLDVIEW.md) | 世界观正文与考据约定 |
| [WORLDVIEW-REVIEW.md](./WORLDVIEW-REVIEW.md) | 世界观评审记录 |
| [CHARACTER-EXPAND-REVIEW.md](./CHARACTER-EXPAND-REVIEW.md) | 角色档案扩写评审 |
| [CHARACTERS-EXPAND-REVIEW.md](./CHARACTERS-EXPAND-REVIEW.md) | 角色扩写汇总 |
| [worldview-glossary.json](./worldview-glossary.json) | 术语表数据 |

## 常用命令

```bash
npm run smoke-check
npm run content:build
npm run content:pipeline   # 打印管线说明
```

迁移指引（仅打印，需在 Supabase SQL Editor 执行）：

```bash
npm run db:migrate-017
npm run db:migrate-023
npm run db:migrate-027
npm run db:migrate-028
```

详见 [STATUS.md](./STATUS.md)。
