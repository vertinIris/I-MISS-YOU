-- ============================================================================
-- 飞行雪绒 migration-013 — 投稿限时编辑（令牌）
-- ============================================================================
-- 前提: migration-006 已执行（submissions.delete_token）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_submission_with_token(
    p_submission_id BIGINT,
    p_delete_token  VARCHAR(64),
    p_title         VARCHAR(100),
    p_content       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row submissions%ROWTYPE;
BEGIN
    IF char_length(TRIM(p_title)) < 1 OR char_length(TRIM(p_title)) > 100 THEN
        RETURN jsonb_build_object('success', false, 'reason', '标题长度无效');
    END IF;
    IF char_length(TRIM(p_content)) < 1 OR char_length(TRIM(p_content)) > 2000 THEN
        RETURN jsonb_build_object('success', false, 'reason', '内容长度无效');
    END IF;

    SELECT * INTO v_row
    FROM submissions
    WHERE id = p_submission_id
      AND is_hidden = FALSE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', '投稿不存在或令牌无效');
    END IF;

    IF NOT (
        (v_row.author_id IS NOT NULL AND auth.uid() IS NOT NULL AND v_row.author_id = auth.uid())
        OR (p_delete_token IS NOT NULL AND p_delete_token <> '' AND v_row.delete_token = p_delete_token)
        OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin')
        )
    ) THEN
        RETURN jsonb_build_object('success', false, 'reason', '无权编辑此投稿');
    END IF;

    IF v_row.created_at < NOW() - INTERVAL '24 hours'
       AND NOT EXISTS (
           SELECT 1 FROM profiles p
           WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin')
       ) THEN
        RETURN jsonb_build_object('success', false, 'reason', '已超过 24 小时编辑窗口');
    END IF;

    UPDATE submissions
    SET title = TRIM(p_title),
        content = TRIM(p_content),
        updated_at = NOW()
    WHERE id = p_submission_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_submission_with_token(BIGINT, VARCHAR, VARCHAR, TEXT)
    TO authenticated, anon;
