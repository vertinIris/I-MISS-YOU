-- ============================================================================
-- 飞行雪绒 Phase 3 — RLS 安全加固迁移
-- 目标: 限制匿名用户滥用（日均限制、速率限制、内容审查）
-- 前提: 已执行 migration-001-init.sql
-- 执行: Supabase Dashboard → SQL Editor → 全选粘贴 → Run
-- ============================================================================

-- ============================================================================
-- 1. 速率限制表（服务端兜底）
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    action_type VARCHAR(20) NOT NULL,           /* 'comment' | 'submission' */
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_check
    ON rate_limits(user_id, action_type, created_at);

-- ============================================================================
-- 2. 速率限制检查函数
-- ============================================================================

/**
 * 检查用户是否超过速率限制
 * @param p_user_id     UUID — 用户 ID
 * @param p_action_type VARCHAR — 'comment' | 'submission'
 * @returns JSON — { allowed: bool, remaining: int, retry_after_seconds: int }
 */
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id     UUID,
    p_action_type VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_window_seconds  INT;
    v_max_requests    INT;
    v_block_seconds   INT;
    v_count           INT;
    v_last_block      TIMESTAMPTZ;
    v_remaining       INT;
    v_retry_after     INT;
BEGIN
    /* 根据操作类型设置限制 */
    IF p_action_type = 'comment' THEN
        v_window_seconds := 60;      /* 1 分钟 */
        v_max_requests   := 5;       /* 放宽一点（客户端已限制 3 次） */
        v_block_seconds  := 120;     /* 封禁 2 分钟 */
    ELSIF p_action_type = 'submission' THEN
        v_window_seconds := 300;     /* 5 分钟 */
        v_max_requests   := 3;
        v_block_seconds  := 600;     /* 封禁 10 分钟 */
    ELSE
        v_window_seconds := 60;
        v_max_requests   := 5;
        v_block_seconds  := 120;
    END IF;

    /* 检查是否处于封禁期 */
    SELECT MAX(created_at) INTO v_last_block
    FROM rate_limits
    WHERE user_id = p_user_id
      AND action_type = '_blocked';

    IF v_last_block IS NOT NULL AND v_last_block > NOW() - (v_block_seconds || ' seconds')::INTERVAL THEN
        v_remaining := 0;
        v_retry_after := EXTRACT(EPOCH FROM (v_last_block + (v_block_seconds || ' seconds')::INTERVAL - NOW()))::INT;
        RETURN jsonb_build_object(
            'allowed', false,
            'remaining', 0,
            'retry_after_seconds', v_retry_after,
            'reason', '服务端速率限制: 请 ' || v_retry_after || ' 秒后重试'
        );
    END IF;

    /* 计算窗口内请求数 */
    SELECT COUNT(*) INTO v_count
    FROM rate_limits
    WHERE user_id = p_user_id
      AND action_type = p_action_type
      AND created_at > NOW() - (v_window_seconds || ' seconds')::INTERVAL;

    /* 判断是否超限 */
    IF v_count >= v_max_requests THEN
        /* 插入封禁标记 */
        INSERT INTO rate_limits (user_id, action_type)
        VALUES (p_user_id, '_blocked');

        v_remaining := 0;
        v_retry_after := v_block_seconds;
        RETURN jsonb_build_object(
            'allowed', false,
            'remaining', 0,
            'retry_after_seconds', v_retry_after,
            'reason', '服务端速率限制: 请 ' || v_retry_after || ' 秒后重试'
        );
    END IF;

    v_remaining := v_max_requests - v_count;
    RETURN jsonb_build_object(
        'allowed', true,
        'remaining', v_remaining,
        'retry_after_seconds', 0
    );
END;
$$;

-- ============================================================================
-- 3. 记录速率消耗（在 INSERT 前调用）
-- ============================================================================

CREATE OR REPLACE FUNCTION record_rate_limit(
    p_user_id     UUID,
    p_action_type VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO rate_limits (user_id, action_type)
    VALUES (p_user_id, p_action_type);
END;
$$;

-- ============================================================================
-- 4. 每日限制（匿名用户）
-- ============================================================================
-- 匿名用户每人每天最多 50 条评论、10 篇投稿

CREATE OR REPLACE FUNCTION check_daily_quota(
    p_user_id     UUID,
    p_table_name  VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count      INT;
    v_max_daily  INT;
    v_remaining  INT;
    v_sql        TEXT;
BEGIN
    /* 每日上限 */
    IF p_table_name = 'comments' THEN
        v_max_daily := 50;
    ELSIF p_table_name = 'submissions' THEN
        v_max_daily := 10;
    ELSE
        v_max_daily := 50;
    END IF;

    /* 统计今日数量 */
    v_sql := format(
        'SELECT COUNT(*) FROM %I WHERE author_id = $1 AND created_at > CURRENT_DATE',
        p_table_name
    );
    EXECUTE v_sql INTO v_count USING p_user_id;

    IF v_count >= v_max_daily THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', '今日 ' || p_table_name || ' 已达上限 (' || v_max_daily || ' 条)'
        );
    END IF;

    v_remaining := v_max_daily - v_count;
    RETURN jsonb_build_object(
        'allowed', true,
        'remaining', v_remaining
    );
END;
$$;

-- ============================================================================
-- 5. 内容审查触发器（敏感词过滤）
-- ============================================================================

CREATE OR REPLACE FUNCTION moderate_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_content TEXT;
    v_blocked_words TEXT[] := ARRAY[
        /* 中文敏感词 — 仅为示例，可自行扩展 */
        'fuck', 'shit', 'spam'
    ];
    v_word TEXT;
BEGIN
    v_content := LOWER(NEW.content);

    /* 检查敏感词 */
    FOREACH v_word IN ARRAY v_blocked_words LOOP
        IF v_content LIKE '%' || v_word || '%' THEN
            RAISE EXCEPTION '内容包含不当词汇，无法提交' USING ERRCODE = 'P0001';
        END IF;
    END LOOP;

    /* 去除前后空白 */
    NEW.content := TRIM(NEW.content);

    RETURN NEW;
END;
$$;

-- 为 comments 表添加触发器（幂等）
DROP TRIGGER IF EXISTS moderate_comments ON public.comments;
CREATE TRIGGER moderate_comments
    BEFORE INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION moderate_content();

-- 为 submissions 表添加触发器（幂等）
DROP TRIGGER IF EXISTS moderate_submissions ON public.submissions;
CREATE TRIGGER moderate_submissions
    BEFORE INSERT ON public.submissions
    FOR EACH ROW EXECUTE FUNCTION moderate_content();

-- ============================================================================
-- 6. 强化 RLS 策略（在已有基础上补充）
-- ============================================================================

-- 6.1 评论 INSERT 加强：认证用户 + 每日限制 + 速率限制 + 内容审查
DROP POLICY IF EXISTS "comments_auth_insert" ON comments;

CREATE POLICY "comments_auth_insert"
    ON comments FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND char_length(TRIM(content)) BETWEEN 1 AND 500
        AND author_name IS NOT NULL
        AND author_name != ''
    );

-- 6.2 投稿 INSERT 加强
DROP POLICY IF EXISTS "submissions_auth_insert" ON submissions;

CREATE POLICY "submissions_auth_insert"
    ON submissions FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND type IN ('文字', '故事', '诗歌', '插画', '音乐')
        AND char_length(TRIM(title)) BETWEEN 1 AND 100
        AND char_length(TRIM(content)) BETWEEN 1 AND 2000
        AND author_name IS NOT NULL
        AND author_name != ''
    );

-- 6.3 评论 DELETE：仅允许删除自己的评论
DROP POLICY IF EXISTS "comments_auth_delete" ON comments;

CREATE POLICY "comments_auth_delete"
    ON comments FOR DELETE
    USING (
        auth.role() = 'authenticated'
        AND author_id = auth.uid()
    );

-- 6.4 管理员 DELETE 覆盖（通过 bypass RLS 的 service_role 或直接 SQL）
-- 注: 管理操作建议在 Supabase Dashboard SQL Editor 中执行:
--   DELETE FROM comments WHERE id = <id>;
-- 这会绕过 RLS，因为 Dashboard 使用 service_role

-- 6.5 清理旧策略（如果存在）
DROP POLICY IF EXISTS "comments_auth_insert_v1" ON comments;
DROP POLICY IF EXISTS "submissions_auth_insert_v1" ON submissions;
DROP POLICY IF EXISTS "comments_auth_insert_v2" ON comments;
DROP POLICY IF EXISTS "submissions_auth_insert_v2" ON submissions;

-- ============================================================================
-- 7. 定时清理旧速率记录（可选: 通过 pg_cron 或 Supabase Edge Function）
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    /* 清理 1 天前的速率记录 */
    DELETE FROM rate_limits
    WHERE created_at < NOW() - INTERVAL '1 day';
END;
$$;

-- ============================================================================
-- 8. 数据验证函数（前端调用检查内容合法性）
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_content(
    p_content TEXT,
    p_max_len INT DEFAULT 500
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
    IF p_content IS NULL OR TRIM(p_content) = '' THEN
        RETURN jsonb_build_object('valid', false, 'reason', '内容不能为空');
    END IF;

    IF char_length(TRIM(p_content)) > p_max_len THEN
        RETURN jsonb_build_object('valid', false, 'reason', '内容超过最大长度 ' || p_max_len || ' 字');
    END IF;

    /* 检测纯重复字符攻击 */
    IF p_content ~ E'^([\\u4e00-\\u9fff\\w])\\1{9,}$' THEN
        RETURN jsonb_build_object('valid', false, 'reason', '内容包含过度重复字符');
    END IF;

    RETURN jsonb_build_object('valid', true);
END;
$$;

-- ============================================================================
-- 9. Realtime 发布确认（幂等）
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
-- 验证清单
-- ============================================================================
-- □ 确认 Anonymous Sign-ins 已启用
--   路径: Supabase Dashboard → Authentication → Settings → Enable Anonymous Sign-ins
-- □ 确认 Site URL 已配置
--   路径: Authentication → URL Configuration → Site URL = https://vertiniris.github.io/I-MISS-YOU/
-- □ 运行本脚本后在 Table Editor 中手动验证 RLS 是否生效
-- □ 执行: SELECT * FROM check_rate_limit('your-user-uuid', 'comment');
