-- ============================================================================
-- 飞行雪绒 v7.9 — 社区投稿取消点赞 RPC
-- 前提: 已执行 migration-001~004
-- 执行: Supabase Dashboard → SQL Editor → Run
-- ============================================================================

-- 投稿取消点赞 RPC（G-10 修复：unlike 不同步云端）
CREATE OR REPLACE FUNCTION public.decrement_submission_likes(submission_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_likes integer;
BEGIN
    UPDATE public.submissions
    SET likes = GREATEST(COALESCE(likes, 0) - 1, 0)
    WHERE id = submission_id
    RETURNING likes INTO v_likes;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    RETURN v_likes;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_submission_likes(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_submission_likes(bigint) TO anon;
