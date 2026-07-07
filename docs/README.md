# 飞行雪绒 — 文档索引

> **当前版本**: v7.8.1 | **最后更新**: 2026-07-03

---

## 快速入口

| 我想… | 读这个 |
|--------|--------|
| 第一次部署上线 | [deployment.md](./deployment.md) → [完整部署清单](./deployment-checklist.md) |
| 配置 Supabase | [supabase-setup-guide.md](./supabase-setup-guide.md) |
| 评论/同步出问题 | [troubleshooting.md](./troubleshooting.md) |
| 了解 v7.8 修了啥、为什么 | [fix-journal-v7.8.md](./fix-journal-v7.8.md) |
| **完整疏漏审计（编号清单）** | [**gaps-audit.md**](./gaps-audit.md) |
| 疏漏摘要与路线图 | [known-gaps.md](./known-gaps.md) |
| 架构与设计 | [architecture.md](./architecture.md) |
| 数据库与迁移 | [database-design.md](./database-design.md) |
| 版本历史 | [changelog.md](./changelog.md) |

---

## 数据库迁移执行顺序（必按序）

```
db/migration-001-init.sql
    ↓
db/migration-002-rls-hardening.sql
    ↓
db/migration-003-fixes.sql          ← 接入 INSERT 触发器（v7.8 前必跑）
    ↓
db/migration-004-fix-search-path.sql ← 【必跑】修复 003 的 search_path 致命 bug
```

---

## 线上地址

- **GitHub Pages**: https://vertiniris.github.io/I-MISS-YOU/（注意大写 **I**）
- **仓库**: https://github.com/vertinIris/I-Miss-You

---

## 工作区说明

本仓库 **Snow/** 为飞行雪绒完整项目。若上级目录存在 `app/`（Python 写作工具），与 Snow **无关**，勿混淆。
