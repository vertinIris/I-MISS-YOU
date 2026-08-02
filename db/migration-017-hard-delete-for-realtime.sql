-- ============================================================================
-- 飞行雪绒 migration-017 — 软删改硬删，修复 Realtime 删除事件不投递（R20 真因）
-- ============================================================================
-- 根因（2026-08-02 生产环境探针实测确认）：
--   Supabase Realtime 按订阅者 RLS SELECT 权限投递事件。
--   migration-006 的 SELECT 策略为 USING (is_hidden = FALSE OR 版主/管理员)。
--   软删除 = UPDATE is_hidden = TRUE → 新记录立即不满足普通用户的 SELECT 策略
--   → Realtime 服务器丢弃该 UPDATE 事件 → 其他设备永远收不到"已删除"通知。
--   （探针：INSERT 事件正常到达；软删 UPDATE 事件 3/3 次均未到达。）
--
-- 修复思路（功能性第一）：
--   删除/隐藏一律改为物理 DELETE。DELETE 事件的 RLS 校验针对 OLD 记录，
--   被删行删除前 is_hidden = FALSE → 校验通过 → 事件正常广播，
--   其他设备按 payload.old.id 移除本地条目（前端已支持，无需 REPLICA IDENTITY FULL）。
--
-- 审计保全：
--   moderation_logs 新增 content_snapshot 列，版主"hide"改为硬删前快照内容。
--   被删内容可追溯，但不再支持一键 restore（restore 改为明确报错）。
--
-- 在 Supabase Dashboard → SQL Editor 执行本文件（幂等，可重复执行）。
-- ============================================================================

-- 0. moderation_logs 增加内容快照列
ALTER TABLE public.moderation_logs
    ADD COLUMN IF NOT EXISTS content_snapshot TEXT;

-- ============================================================================
-- 1. 评论作者自删（令牌）：软删 → 硬删
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_comment_with_token(
    p_comment_id   BIGINT,
    p_delete_token VARCHAR(64)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    /* 硬删除：触发 Realtime DELETE 事件广播（OLD 记录通过 RLS SELECT 校验） */
    DELETE FROM comments
    WHERE id = p_comment_id
      AND delete_token = p_delete_token
      AND is_hidden = FALSE;

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_comment_with_token(BIGINT, VARCHAR)
    TO authenticated, anon;

-- ============================================================================
-- 2. 投稿作者自删（令牌/作者/版主）：软删 → 硬删（保持 015 的 JSONB 契约）
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

    DELETE FROM submissions WHERE id = p_submission_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_submission_with_token(BIGINT, VARCHAR)
    TO authenticated, anon;

-- ============================================================================
-- 3. 评论版主操作：hide 改为"快照 + 硬删"；restore 明确报错（已无软删可恢复）
-- ============================================================================
CREATE OR REPLACE FUNCTION public.moderate_comment(
    p_comment_id BIGINT,
    p_action     VARCHAR(20),
    p_reason     VARCHAR(200) DEFAULT ''
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_operator UUID := auth.uid();
    v_role     VARCHAR(20);
    v_snapshot TEXT;
BEGIN
    SELECT role INTO v_role FROM profiles WHERE id = v_operator;

    IF v_role NOT IN ('moderator', 'admin') THEN
        RAISE EXCEPTION '权限不足：需要版主或管理员角色';
    END IF;

    IF p_action = 'hide' THEN
        /* 先快照内容，再硬删除（Realtime DELETE 事件可广播到所有客户端） */
        SELECT author_name || ': ' || content INTO v_snapshot
        FROM comments WHERE id = p_comment_id;

        DELETE FROM comments WHERE id = p_comment_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION '评论不存在: %', p_comment_id;
        END IF;

    ELSIF p_action = 'restore' THEN
        RAISE EXCEPTION 'v017 起删除为物理删除，无法一键恢复；请根据 moderation_logs.content_snapshot 人工处理';

    ELSIF p_action = 'delete' THEN
        IF v_role != 'admin' THEN
            RAISE EXCEPTION '权限不足：仅管理员可永久删除';
        END IF;
        DELETE FROM comments WHERE id = p_comment_id;

    ELSE
        RAISE EXCEPTION '未知操作: %', p_action;
    END IF;

    INSERT INTO moderation_logs (action, target_type, target_id, operator_id, operator_role, reason, content_snapshot)
    VALUES (p_action, 'comment', p_comment_id, v_operator, v_role, p_reason, v_snapshot);

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_comment(BIGINT, VARCHAR, VARCHAR)
    TO authenticated;

-- ============================================================================
-- 4. 投稿版主操作：hide 改为"快照 + 硬删"；restore 明确报错
-- ============================================================================
CREATE OR REPLACE FUNCTION public.moderate_submission(
    p_submission_id BIGINT,
    p_action        VARCHAR(20),
    p_reason        VARCHAR(200) DEFAULT ''
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_operator UUID := auth.uid();
    v_role     VARCHAR(20);
    v_snapshot TEXT;
BEGIN
    SELECT role INTO v_role FROM profiles WHERE id = v_operator;

    IF v_role NOT IN ('moderator', 'admin') THEN
        RAISE EXCEPTION '权限不足：需要版主或管理员角色';
    END IF;

    IF p_action = 'hide' THEN
        SELECT author_name || ': ' || title INTO v_snapshot
        FROM submissions WHERE id = p_submission_id;

        DELETE FROM submissions WHERE id = p_submission_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION '投稿不存在: %', p_submission_id;
        END IF;

    ELSIF p_action = 'restore' THEN
        RAISE EXCEPTION 'v017 起删除为物理删除，无法一键恢复；请根据 moderation_logs.content_snapshot 人工处理';

    ELSIF p_action = 'delete' THEN
        IF v_role != 'admin' THEN
            RAISE EXCEPTION '权限不足：仅管理员可永久删除';
        END IF;
        DELETE FROM submissions WHERE id = p_submission_id;

    ELSE
        RAISE EXCEPTION '未知操作: %', p_action;
    END IF;

    INSERT INTO moderation_logs (action, target_type, target_id, operator_id, operator_role, reason, content_snapshot)
    VALUES (p_action, 'submission', p_submission_id, v_operator, v_role, p_reason, v_snapshot);

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_submission(BIGINT, VARCHAR, VARCHAR)
    TO authenticated;

-- ============================================================================
-- 5. Realtime 发布确认（幂等，防御性重申）
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'comments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'submissions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
    END IF;
END $$;

-- ============================================================================
-- 验证清单（执行后自查）
-- ============================================================================
-- 1. 删除事件投递验证：
--    a) 设备 A 发一条评论并删除；
--    b) 设备 B 的同评论区应实时消失（右下角显示"实时同步"）。
-- 2. 函数行为：
--    SELECT delete_comment_with_token(<id>, '<token>');  -- 应返回 true 且行已物理删除
-- 3. 审计快照：
--    SELECT action, target_id, reason, content_snapshot FROM moderation_logs
--    ORDER BY created_at DESC LIMIT 5;
-- 4. 发布成员确认：
--    SELECT tablename FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime' AND schemaname = 'public';
--    -- 应包含 comments 与 submissions
