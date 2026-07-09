-- ============================================================================
-- 飞行雪绒 migration-012 — 用户举报 RPC
-- ============================================================================
-- 前提: 已执行 migration-001~011
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_content_report(
    p_target_type VARCHAR(20),
    p_target_id   BIGINT,
    p_reason      VARCHAR(200) DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid   UUID := auth.uid();
    v_count INTEGER;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', '请先登录后再举报');
    END IF;

    IF p_target_type NOT IN ('comment', 'submission') THEN
        RETURN jsonb_build_object('success', false, 'reason', '无效的举报类型');
    END IF;

    IF p_target_id IS NULL OR p_target_id <= 0 THEN
        RETURN jsonb_build_object('success', false, 'reason', '无效的内容 ID');
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM moderation_logs
    WHERE operator_id = v_uid
      AND action = 'report'
      AND created_at > NOW() - INTERVAL '1 day';

    IF v_count >= 20 THEN
        RETURN jsonb_build_object('success', false, 'reason', '今日举报次数已达上限，请明日再试');
    END IF;

    INSERT INTO moderation_logs (action, target_type, target_id, operator_id, operator_role, reason)
    VALUES (
        'report',
        p_target_type,
        p_target_id,
        v_uid,
        COALESCE((SELECT role FROM profiles WHERE id = v_uid), 'user'),
        LEFT(COALESCE(NULLIF(TRIM(p_reason), ''), '用户举报'), 200)
    );

    RETURN jsonb_build_object('success', true, 'message', '举报已提交，版主会尽快处理');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_content_report(VARCHAR, BIGINT, VARCHAR)
    TO authenticated, anon;
