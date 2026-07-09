# 已知疏漏与后续改进（摘要）

> **版本**: v9.3 | **最后更新**: 2026-07-10  
> **完整审计**: [gaps-audit.md](./gaps-audit.md)

---

## 已修复 — 勿重复排查

v7.8～v9.2 已处理：migration-004～012、profiles 昵称、收藏云端、评论回复、举报 RPC、版主后台、SyncManager、上传预览等。

**v9.3 新增**：
- 公开收藏夹 + `#collection-{id}` 分享
- 投稿插图卡片 + 24h 限时编辑（migration-013）
- 忘记密码落地页 `reset-password.html`
- OG 封面改 PNG（微信兼容）
- 今日推荐 + 社区/评论分页
- Realtime 正常时跳过 30s 全量轮询
- `scripts/smoke-check.mjs` 语法与资源检查

---

## 仍存在的限制（Top 5）

| 优先级 | 疏漏 | 现状 |
|--------|------|------|
| P1 🔧 | migration-013 需在 Supabase 执行 | 投稿编辑 RPC 才生效 |
| P2 | 种子投稿字符串 id | 点赞/编辑无法走云端 RPC |
| P2 | 纯前端口令管理员 | 删评仅本地；需 DB 版主角色才能全网隐藏 |
| P3 | Phase 4 Stub | clearArchive / pull / logout |
| P3 | 社区卡片 Realtime 评论 | 社区内嵌评论区未单独订阅 Realtime |

---

## 运维备忘

```
001 → … → 012 → 013（投稿编辑 RPC）
```

- Site URL / Redirect URLs 需包含 `reset-password.html`
- 版主：在 Supabase 将 `profiles.role` 设为 `moderator` 或 `admin`

---

## 工作区边界

```
CURSOR/
├── Snow/          ← 飞行雪绒（本仓库）
└── app/           ← 独立 Python 项目，与 Snow 无关
```
