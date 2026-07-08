-- ============================================================================
-- 飞行雪绒 v9.0 — 评论删除令牌 + 软删除 + 角色体系
-- 前提: 已执行 migration-001~005
-- 执行: Supabase Dashboard → SQL Editor → Run
-- ============================================================================

-- ============================================================================
-- 1. comments 表新增字段
-- ============================================================================
ALTER TABLE public.comments
    ADD COLUMN IF NOT EXISTS delete_token   VARCHAR(64),
    ADD COLUMN IF NOT EXISTS is_hidden      BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS hidden_by      UUID,
    ADD COLUMN IF NOT EXISTS hidden_reason  VARCHAR(200),
    ADD COLUMN IF NOT EXISTS hidden_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS edited_at      TIMESTAMPTZ;

-- 索引：按令牌快速查找
CREATE INDEX IF NOT EXISTS idx_comments_delete_token
    ON comments(delete_token) WHERE delete_token IS NOT NULL;

-- 索引：按隐藏状态筛选（管理员用）
CREATE INDEX IF NOT EXISTS idx_comments_hidden
    ON comments(is_hidden, created_at DESC) WHERE is_hidden = TRUE;

-- ============================================================================
-- 2. submissions 表新增字段
-- ============================================================================
ALTER TABLE public.submissions
    ADD COLUMN IF NOT EXISTS delete_token   VARCHAR(64),
    ADD COLUMN IF NOT EXISTS is_hidden      BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS hidden_by      UUID,
    ADD COLUMN IF NOT EXISTS hidden_reason  VARCHAR(200),
    ADD COLUMN IF NOT EXISTS hidden_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_submissions_delete_token
    ON submissions(delete_token) WHERE delete_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_hidden
    ON submissions(is_hidden, created_at DESC) WHERE is_hidden = TRUE;

-- ============================================================================
-- 3. profiles 表新增角色字段
-- ============================================================================
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS role            VARCHAR(20) NOT NULL DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS is_banned       BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS banned_until    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ban_reason      VARCHAR(200);

-- 约束：角色枚举
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('user', 'moderator', 'admin'));

-- ============================================================================
-- 4. 操作日志表
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.moderation_logs (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action       VARCHAR(30) NOT NULL,
    target_type  VARCHAR(20) NOT NULL,
    target_id    BIGINT,
    operator_id  UUID NOT NULL REFERENCES auth.users(id),
    operator_role VARCHAR(20) NOT NULL,
    reason       VARCHAR(200),
    metadata     JSONB DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_logs_target
    ON moderation_logs(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_logs_operator
    ON moderation_logs(operator_id, created_at DESC);

ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

-- 版主/管理员可查看操作日志
DROP POLICY IF EXISTS "mod_logs_staff_read" ON moderation_logs;
CREATE POLICY "mod_logs_staff_read"
    ON moderation_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND role IN ('moderator', 'admin')
        )
    );

-- 仅可通过 RPC 插入（SECURITY DEFINER 函数自动记录）
DROP POLICY IF EXISTS "mod_logs_rpc_insert" ON moderation_logs;
CREATE POLICY "mod_logs_rpc_insert"
    ON moderation_logs FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- 5. 删除令牌校验 RPC（匿名用户软删除自己的评论）
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
    UPDATE comments
    SET is_hidden = TRUE,
        hidden_at = NOW(),
        hidden_reason = '作者删除（令牌）'
    WHERE id = p_comment_id
      AND delete_token = p_delete_token
      AND is_hidden = FALSE;

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_comment_with_token(BIGINT, VARCHAR)
    TO authenticated, anon;

-- 投稿删除令牌校验 RPC
CREATE OR REPLACE FUNCTION public.delete_submission_with_token(
    p_submission_id BIGINT,
    p_delete_token  VARCHAR(64)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE submissions
    SET is_hidden = TRUE,
        hidden_at = NOW(),
        hidden_reason = '作者删除（令牌）'
    WHERE id = p_submission_id
      AND delete_token = p_delete_token
      AND is_hidden = FALSE;

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_submission_with_token(BIGINT, VARCHAR)
    TO authenticated, anon;

-- ============================================================================
-- 6. 版主/管理员操作 RPC
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
BEGIN
    SELECT role INTO v_role FROM profiles WHERE id = v_operator;

    IF v_role NOT IN ('moderator', 'admin') THEN
        RAISE EXCEPTION '权限不足：需要版主或管理员角色';
    END IF;

    IF p_action = 'hide' THEN
        UPDATE comments SET
            is_hidden = TRUE,
            hidden_by = v_operator,
            hidden_reason = p_reason,
            hidden_at = NOW()
        WHERE id = p_comment_id;

    ELSIF p_action = 'restore' THEN
        UPDATE comments SET
            is_hidden = FALSE,
            hidden_by = NULL,
            hidden_reason = NULL,
            hidden_at = NULL
        WHERE id = p_comment_id;

    ELSIF p_action = 'delete' THEN
        IF v_role != 'admin' THEN
            RAISE EXCEPTION '权限不足：仅管理员可永久删除';
        END IF;
        DELETE FROM comments WHERE id = p_comment_id;

    ELSE
        RAISE EXCEPTION '未知操作: %', p_action;
    END IF;

    INSERT INTO moderation_logs (action, target_type, target_id, operator_id, operator_role, reason)
    VALUES (p_action, 'comment', p_comment_id, v_operator, v_role, p_reason);

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_comment(BIGINT, VARCHAR, VARCHAR)
    TO authenticated;

-- 投稿版主操作 RPC
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
BEGIN
    SELECT role INTO v_role FROM profiles WHERE id = v_operator;

    IF v_role NOT IN ('moderator', 'admin') THEN
        RAISE EXCEPTION '权限不足：需要版主或管理员角色';
    END IF;

    IF p_action = 'hide' THEN
        UPDATE submissions SET
            is_hidden = TRUE,
            hidden_by = v_operator,
            hidden_reason = p_reason,
            hidden_at = NOW()
        WHERE id = p_submission_id;

    ELSIF p_action = 'restore' THEN
        UPDATE submissions SET
            is_hidden = FALSE,
            hidden_by = NULL,
            hidden_reason = NULL,
            hidden_at = NULL
        WHERE id = p_submission_id;

    ELSIF p_action = 'delete' THEN
        IF v_role != 'admin' THEN
            RAISE EXCEPTION '权限不足：仅管理员可永久删除';
        END IF;
        DELETE FROM submissions WHERE id = p_submission_id;

    ELSE
        RAISE EXCEPTION '未知操作: %', p_action;
    END IF;

    INSERT INTO moderation_logs (action, target_type, target_id, operator_id, operator_role, reason)
    VALUES (p_action, 'submission', p_submission_id, v_operator, v_role, p_reason);

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_submission(BIGINT, VARCHAR, VARCHAR)
    TO authenticated;

-- 批量操作 RPC（管理员专用）
CREATE OR REPLACE FUNCTION public.batch_moderate_comments(
    p_comment_ids BIGINT[],
    p_action      VARCHAR(20),
    p_reason      VARCHAR(200) DEFAULT ''
)
RETURNS TABLE(success_count BIGINT, failed_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_operator UUID := auth.uid();
    v_role     VARCHAR(20);
    v_id       BIGINT;
    v_success  BIGINT := 0;
    v_failed   BIGINT := 0;
BEGIN
    SELECT role INTO v_role FROM profiles WHERE id = v_operator;
    IF v_role != 'admin' THEN
        RAISE EXCEPTION '权限不足：仅管理员可批量操作';
    END IF;

    FOREACH v_id IN ARRAY p_comment_ids LOOP
        BEGIN
            PERFORM moderate_comment(v_id, p_action, p_reason);
            v_success := v_success + 1;
        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
        END;
    END LOOP;

    RETURN QUERY SELECT v_success, v_failed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.batch_moderate_comments(BIGINT[], VARCHAR, VARCHAR)
    TO authenticated;

-- ============================================================================
-- 7. RLS 策略升级
-- ============================================================================

-- 7.1 评论读取：仅未隐藏（版主/管理员可读全部）
DROP POLICY IF EXISTS "comments_public_read" ON comments;
DROP POLICY IF EXISTS "comments_public_read_v2" ON comments;
CREATE POLICY "comments_public_read_v2"
    ON comments FOR SELECT
    USING (
        is_hidden = FALSE
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND role IN ('moderator', 'admin')
        )
    );

-- 7.2 评论插入：匿名+认证用户均可（附带 delete_token）
DROP POLICY IF EXISTS "comments_auth_insert" ON comments;
DROP POLICY IF EXISTS "comments_insert_v2" ON comments;
CREATE POLICY "comments_insert_v2"
    ON comments FOR INSERT
    WITH CHECK (
        auth.role() IN ('authenticated', 'anon')
        AND content IS NOT NULL
    );

-- 7.3 评论更新：注册用户软删除自己的评论
DROP POLICY IF EXISTS "comments_owner_delete" ON comments;
DROP POLICY IF EXISTS "comments_owner_soft_delete" ON comments;
CREATE POLICY "comments_owner_soft_delete"
    ON comments FOR UPDATE
    USING (auth.uid() = author_id)
    WITH CHECK (
        auth.uid() = author_id
        AND is_hidden = FALSE
    );

-- 7.4 投稿读取：仅未隐藏
DROP POLICY IF EXISTS "submissions_public_read" ON submissions;
DROP POLICY IF EXISTS "submissions_public_read_v2" ON submissions;
CREATE POLICY "submissions_public_read_v2"
    ON submissions FOR SELECT
    USING (
        is_hidden = FALSE
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND role IN ('moderator', 'admin')
        )
    );

-- 7.5 投稿插入：匿名+认证用户均可
DROP POLICY IF EXISTS "submissions_auth_insert" ON submissions;
DROP POLICY IF EXISTS "submissions_insert_v2" ON submissions;
CREATE POLICY "submissions_insert_v2"
    ON submissions FOR INSERT
    WITH CHECK (
        auth.role() IN ('authenticated', 'anon')
        AND title IS NOT NULL
        AND content IS NOT NULL
    );

-- 7.6 profiles 更新策略升级：禁止用户自行修改角色/封禁状态
DROP POLICY IF EXISTS "profiles_owner_update" ON profiles;
DROP POLICY IF EXISTS "profiles_owner_update_v2" ON profiles;
CREATE POLICY "profiles_owner_update_v2"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND role = (SELECT role FROM profiles WHERE id = auth.uid())
        AND is_banned = (SELECT is_banned FROM profiles WHERE id = auth.uid())
    );

-- ============================================================================
-- 8. Realtime 发布更新（确保新字段变更可被订阅）
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'moderation_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.moderation_logs;
    END IF;
END $$;
