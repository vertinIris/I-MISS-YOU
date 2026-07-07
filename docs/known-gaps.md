# 已知疏漏与后续改进（摘要）

> **版本**: v7.9 | **最后更新**: 2026-07-07  
> **完整审计**: [gaps-audit.md](./gaps-audit.md)（含编号 G-01～G-20、D/S/O/E 系列）

---

## 已修复 — 勿重复排查

v7.8 / v7.8.1 已处理：投稿 type 映射、种子 author/name、评论竞态与 Realtime、migration-004 search_path、版本号、本地 8848 端口、Git 冲突脚本、云端失败 Toast 等。

v7.9 已处理：
- **G-04** 博文评论数动态更新（`updatePostCommentCount()`）
- **G-09** 博文点赞持久化（localStorage `fxre_post_likes`）
- **G-10** 社区取消点赞云端同步（`decrement_submission_likes` RPC + `unlikeSubmission()`）
- **G-10** 社区点赞 liked 状态合并保留（`mergeSubmissions()` 重写）
- **G-10** 社区点赞 RPC 返回值修正本地计数

详情见 [fix-journal-v7.8.md](./fix-journal-v7.8.md) 与 [gaps-audit.md §一](./gaps-audit.md#一已修复疏漏v78--v781--备查勿重复排查)。

---

## 仍存在的限制（Top 7）

| 优先级 | 疏漏 | 现状 |
|--------|------|------|
| P0 🔧 | migration-004 未在 Supabase 执行 | 评论无法入库（运维待办） |
| P0 🔧 | migration-005 未在 Supabase 执行 | 取消点赞无法同步云端 |
| P2 | `profiles` 未接前端 | 昵称无跨设备身份（G-01） |
| P2 | 管理员删他人评论 | 仅本地 UI 移除（G-05） |
| P2 | 种子投稿字符串 id | 点赞无法同步 RPC（G-11） |
| P3 | Phase 4 Stub | clearArchive / pull / logout（G-14～16） |
| P3 | 无 favicon/OG/测试 | 工程化缺口（E-04～06） |

---

## 按模块速查

| 模块 | 主要疏漏 | 审计 ID |
|------|----------|---------|
| 评论 | 评论数静态、管理员删云端、本地-only 历史 | G-04～G-08 |
| 点赞 | 时间线装饰、unlike 不同步、种子 id | G-09～G-11 |
| 身份 | profiles、logout stub | G-01～G-03 |
| 数据库 | 004 必跑、cleanup 无 cron、无 decrement RPC | D-01～D-06 |
| 安全 | 管理员口令前端、文档明文示例 | S-01～S-02 |
| 运维 | Supabase 休眠、CDN 拦截 | O-01～O-02 |
| 文档 | database-design 旧版、assets 缺失 | E-01～E-02 |

---

## 建议路线图

**P0** → Supabase 跑 004 + Site URL  
**P1** → 评论数动态更新、点赞行为一致  
**P2** → profiles、管理员删评 Edge Function  
**P3** → 测试、文档对齐、UptimeRobot  

完整优先级与验证清单：[gaps-audit.md §八～§九](./gaps-audit.md#八修复优先级路线图)

---

## 工作区边界

```
CURSOR/
├── Snow/          ← 飞行雪绒（本仓库）
└── app/           ← 独立 Python 项目，与 Snow 无关
```
