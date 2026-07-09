-- ============================================================================
-- 飞行雪绒 migration-015 — 投稿删除支持 author_id（对齐 013 编辑）
-- 注意：006 中该函数返回 BOOLEAN，改 JSONB 须先 DROP
-- ============================================================================

DROP FUNCTION IF EXISTS public.delete_submission_with_token(BIGINT, VARCHAR);

CREATE OR REPLACE FUNCTION public.delete_submission_with_token(
    p_submission_id BIGINT,
    p_delete_token  VARCHAR(64)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row submissions%ROWTYPE;
BEGIN
    SELECT * INTO v_row
    FROM submissions
    WHERE id = p_submission_id
      AND is_hidden = FALSE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', '投稿不存在或已删除');
    END IF;

    IF NOT (
        (v_row.author_id IS NOT NULL AND auth.uid() IS NOT NULL AND v_row.author_id = auth.uid())
        OR (p_delete_token IS NOT NULL AND p_delete_token <> '' AND v_row.delete_token = p_delete_token)
        OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin')
        )
    ) THEN
        RETURN jsonb_build_object('success', false, 'reason', '无权删除此投稿');
    END IF;

    UPDATE submissions
    SET is_hidden = TRUE,
        hidden_at = NOW(),
        hidden_reason = CASE
            WHEN auth.uid() IS NOT NULL AND v_row.author_id = auth.uid() THEN '作者删除'
            WHEN p_delete_token IS NOT NULL AND p_delete_token <> '' THEN '作者删除（令牌）'
            ELSE '版主删除'
        END
    WHERE id = p_submission_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_submission_with_token(BIGINT, VARCHAR)
    TO authenticated, anon;
