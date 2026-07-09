# 飞行雪绒 v9.6 进度报告

> **最后更新**: 2026-07-10  
> **状态**: v9.6 P1/P2/P3 可代码化项已完成；smoke-check 通过

---

## v9.6 新增（2026-07-10）

### P1 — 运营与身份
- [x] 版主后台三 Tab：举报 / 评论审核 / 操作日志
- [x] 评论批量 hide·restore·delete（`batch_moderate_comments`，仅 admin）
- [x] 收藏夹重命名、删除
- [x] profiles `upsert` + 登录后 `ensureProfile` + 昵称预填

### P2 — 体验与性能
- [x] 首屏 `syncAllPostCommentCounts`（G-04）
- [x] Realtime 评论增量合并（`applyRealtimeCommentEvent`）
- [x] adapter 服务端分页参数（`getComments`/`getSubmissions` opts）
- [x] pending 队列页脚 tooltip 增强

### P3 — 工程化
- [x] `UserAPI.logout` → `AuthManager.signOut`
- [x] `SyncAPI.pull` → 全量云端同步
- [x] `ArchiveAPI.clearArchive` → 清本地归档
- [x] smoke-check 扩展（12 JS + 符号断言 + migration 001-015）
- [x] 文档对齐：`known-gaps.md` / README v9.6

---

## 仍待人工 / 远期

- [ ] Supabase 跑 migration-014/015（若未跑）
- [ ] 设置 `profiles.role = 'admin'` 以使用批量审核
- [ ] 14 项手测清单（`docs/test-checklist-v9.3.md`）
- [ ] 种子投稿字符串 id（设计限制，演示用）
- [ ] Edge Function 物理删他人评论
- [ ] Playwright E2E

---

## 版本历史摘要

| 版本 | 要点 |
|------|------|
| v9.6 | P1/P2/P3 批量补全 |
| v9.5 | P0 bug 修复、SyncManager 多 target |
| v9.4 | SecurityShield、CSP、OG |
| v9.3 | 收藏夹、投稿编辑、分页 |
