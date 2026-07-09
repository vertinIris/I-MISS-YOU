# 已知疏漏与后续改进（摘要）

> **版本**: v9.6 | **最后更新**: 2026-07-10  
> **完整审计**: [gaps-audit.md](./gaps-audit.md)

---

## 已修复 — 勿重复排查

v7.8～v9.6 已处理：migration-004～015、profiles upsert、收藏夹重命名/删除、版主批量审核、Realtime 增量更新、首屏评论数同步、Phase 4 API 实现（logout/pull/clearArchive）、pending 队列提示等。

**v9.6 新增**：
- 版主后台三 Tab：举报 / 评论审核（含批量 hide·restore·delete）/ 操作日志
- profiles `upsert` + 登录后 `ensureProfile`
- 收藏夹重命名、删除
- Realtime 评论增量合并（少拉全量）
- `SyncAPI.pull` / `UserAPI.logout` / `ArchiveAPI.clearArchive` 实现
- adapter 服务端分页参数（`getComments`/`getSubmissions` opts）

---

## 仍存在的限制（Top 5）

| 优先级 | 疏漏 | 现状 |
|--------|------|------|
| P2 | 种子投稿字符串 id | 演示数据无法走云端点赞 RPC |
| P2 | 动态区时间线点赞 | 叙事装饰，刷新后还原 |
| P2 | 纯前端口令管理员 | 删他人云端评论需 DB 版主角色 |
| P3 | Edge Function 物理删评 | 无 service_role，RLS 限制 |
| P3 | E2E 自动化 | 仅有 smoke-check，无 Playwright |

---

## 运维备忘

```
001 → … → 014 → 015（author 删投稿 JSONB）
```

- Site URL / Redirect URLs 需包含 `reset-password.html`
- 版主：`UPDATE profiles SET role = 'moderator'/'admin' WHERE id = '你的 uid'`
- 批量审核 RPC 仅 **admin** 角色可用

---

## 工作区边界

```
CURSOR/
├── Snow/          ← 飞行雪绒（本仓库）
└── app/           ← 独立 Python 项目，与 Snow 无关
```
