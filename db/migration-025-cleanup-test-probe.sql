-- ============================================================================
-- migration-025 : 清理论坛测试脏数据 stf_test_probe
-- ----------------------------------------------------------------------------
-- 依赖 : 020-forum-tables (forum_submissions 已存在)
-- 目标 : 删除联调阶段遗留的测试投稿 stf_test_probe，使论坛内容干净
-- 幂等 : 重复执行安全（DELETE WHERE 不存在则影响 0 行）
-- 执行 : Supabase Dashboard → SQL Editor（owner / service_role），整段粘贴 Run
-- ============================================================================

-- 1. 删除测试探针投稿（同时其评论/聊天如有引用也应清理，此处仅投稿本身）
DELETE FROM public.forum_submissions
WHERE id = 'stf_test_probe';

-- 2. 自查：应返回 0 行（确认已清除）
-- SELECT id FROM public.forum_submissions WHERE id = 'stf_test_probe';  -- 期望空结果
