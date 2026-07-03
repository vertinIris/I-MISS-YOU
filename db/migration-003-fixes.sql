-- ============================================================================
-- 飞行雪绒 Phase 3 — 修复迁移 v7.8
-- 前提: 已执行 migration-001-init.sql 和 migration-002-rls-hardening.sql
-- 执行: Supabase Dashboard → SQL Editor → 全选粘贴 → Run
-- ============================================================================

-- ============================================================================
-- 1. INSERT 前强制执行速率限制 + 每日配额
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_insert_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_action  VARCHAR;
    v_check   JSONB;
    v_quota   JSONB;
    v_uid     UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION '需要已认证用户才能提交' USING ERRCODE = 'P0001';
    END IF;

    IF TG_TABLE_NAME = 'comments' THEN
        v_action := 'comment';
    ELSIF TG_TABLE_NAME = 'submissions' THEN
        v_action := 'submission';
    ELSE
        RETURN NEW;
    END IF;

    v_check := public.check_rate_limit(v_uid, v_action);
    IF NOT (v_check->>'allowed')::boolean THEN
        RAISE EXCEPTION '%', COALESCE(v_check->>'reason', '速率限制');
    END IF;

    v_quota := public.check_daily_quota(v_uid, TG_TABLE_NAME);
    IF NOT (v_quota->>'allowed')::boolean THEN
        RAISE EXCEPTION '%', COALESCE(v_quota->>'reason', '今日配额已满');
    END IF;

    PERFORM public.record_rate_limit(v_uid, v_action);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_comments_limits ON public.comments;
CREATE TRIGGER enforce_comments_limits
    BEFORE INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_limits();

DROP TRIGGER IF EXISTS enforce_submissions_limits ON public.submissions;
CREATE TRIGGER enforce_submissions_limits
    BEFORE INSERT ON public.submissions
    FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_limits();

-- ============================================================================
-- 2. 评论 DELETE：恢复 10 分钟自删窗口（与文档一致）
-- ============================================================================

DROP POLICY IF EXISTS "comments_auth_delete" ON public.comments;

CREATE POLICY "comments_auth_delete"
    ON public.comments FOR DELETE
    USING (
        auth.role() = 'authenticated'
        AND author_id = auth.uid()
        AND created_at > NOW() - INTERVAL '10 minutes'
    );

-- ============================================================================
-- 3. 投稿点赞 RPC（supabase-adapter.likeSubmission 依赖）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_submission_likes(submission_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_likes integer;
BEGIN
    UPDATE public.submissions
    SET likes = COALESCE(likes, 0) + 1
    WHERE id = submission_id
    RETURNING likes INTO v_likes;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    RETURN v_likes;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_submission_likes(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_submission_likes(bigint) TO anon;
