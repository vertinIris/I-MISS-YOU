-- ============================================================
-- migration-016: Realtime REPLICA IDENTITY 加固（R20，可选）
-- ============================================================
-- 背景：
--   Supabase Realtime 的 DELETE 事件，payload.old 默认只带主键
--   （REPLICA IDENTITY DEFAULT）。当前评论/投稿的"隐藏"走软删
--   （UPDATE is_hidden），硬删走 DELETE——后者在老行内容上
--   只能拿到 id。
--
--   将 REPLICA IDENTITY 设为 FULL 后，DELETE/UPDATE 事件的
--   payload.old 会携带完整旧行，便于：
--     - 客户端在硬删时展示"被删除的是哪一条"
--     - 未来做审计/撤销/操作日志回放
--
-- 说明：
--   本迁移为可选加固，不阻塞现有功能（当前 handler 仅用 old.id，
--   DEFAULT 已够用）。REPLICA IDENTITY FULL 会略微增加 WAL 体积。
--
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴执行（幂等，可重复）
-- ============================================================

ALTER TABLE public.comments    REPLICA IDENTITY FULL;
ALTER TABLE public.submissions REPLICA IDENTITY FULL;

-- 校验（可选）：
-- SELECT relname, relreplident FROM pg_class WHERE relname IN ('comments','submissions');
-- 期望 relreplident = 'f' (FULL)
