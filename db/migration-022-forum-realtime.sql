-- ============================================================================
-- 论坛数据上云 · Phase 1-C：开启 Realtime 实时推送
-- 项目: lmlyfyjffaaddysiliht
-- 执行: Supabase SQL Editor（服务角色），可重复跑（含幂等检查）
--
-- 作用: 帖子 / 评论写库后，已订阅的客户端在毫秒级收到变更事件，
--       替代仅同机的 storage 事件，实现「真·跨设备 / 跨用户实时」。
-- ============================================================================

-- 1. 把两表加入实时发布（幂等：已加入则跳过）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'forum_submissions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_submissions;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'forum_comments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_comments;
    END IF;
END $$;

-- 2. 设 REPLICA IDENTITY FULL，使 Realtime 事件携带完整旧 / 新行（便于前端 diff）
ALTER TABLE public.forum_submissions REPLICA IDENTITY FULL;
ALTER TABLE public.forum_comments   REPLICA IDENTITY FULL;

-- 说明:
--   · 客户端 forum-cloud.js 会订阅 postgres_changes 频道，
--     收到 INSERT/UPDATE/DELETE 后调用 StarTorchSync 触发局部刷新。
--   · 若订阅失败（权限 / 网络），forum-sync.js 仍保留 20s 轮询 + storage 兜底。
