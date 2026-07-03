-- ============================================================================
-- 飞行雪绒 v7.8.1 — 修复 migration-003 导致评论无法写入云端
-- 原因: check_rate_limit / check_daily_quota / record_rate_limit
--       在 search_path='' 下使用了未加 public. 前缀的表名，INSERT 触发器报错
-- 执行: Supabase Dashboard → SQL Editor → Run
-- ============================================================================

-- 1. 修复 check_rate_limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_user_id     UUID,
    p_action_type VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    IF p_action_type = 'comment' THEN
        v_window_seconds := 60;
        v_max_requests   := 5;
        v_block_seconds  := 120;
    ELSIF p_action_type = 'submission' THEN
        v_window_seconds := 300;
        v_max_requests   := 3;
        v_block_seconds  := 600;
    ELSE
        v_window_seconds := 60;
        v_max_requests   := 5;
        v_block_seconds  := 120;
    END IF;

    SELECT MAX(created_at) INTO v_last_block
    FROM public.rate_limits
    WHERE user_id = p_user_id
      AND action_type = '_blocked';

    IF v_last_block IS NOT NULL AND v_last_block > NOW() - (v_block_seconds || ' seconds')::INTERVAL THEN
        v_retry_after := EXTRACT(EPOCH FROM (v_last_block + (v_block_seconds || ' seconds')::INTERVAL - NOW()))::INT;
        RETURN jsonb_build_object(
            'allowed', false,
            'remaining', 0,
            'retry_after_seconds', v_retry_after,
            'reason', '服务端速率限制: 请 ' || v_retry_after || ' 秒后重试'
        );
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM public.rate_limits
    WHERE user_id = p_user_id
      AND action_type = p_action_type
      AND created_at > NOW() - (v_window_seconds || ' seconds')::INTERVAL;

    IF v_count >= v_max_requests THEN
        INSERT INTO public.rate_limits (user_id, action_type)
        VALUES (p_user_id, '_blocked');

        RETURN jsonb_build_object(
            'allowed', false,
            'remaining', 0,
            'retry_after_seconds', v_block_seconds,
            'reason', '服务端速率限制: 请 ' || v_block_seconds || ' 秒后重试'
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

-- 2. 修复 record_rate_limit
CREATE OR REPLACE FUNCTION public.record_rate_limit(
    p_user_id     UUID,
    p_action_type VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.rate_limits (user_id, action_type)
    VALUES (p_user_id, p_action_type);
END;
$$;

-- 3. 修复 check_daily_quota
CREATE OR REPLACE FUNCTION public.check_daily_quota(
    p_user_id     UUID,
    p_table_name  VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count      INT;
    v_max_daily  INT;
    v_remaining  INT;
BEGIN
    IF p_table_name = 'comments' THEN
        v_max_daily := 50;
    ELSIF p_table_name = 'submissions' THEN
        v_max_daily := 10;
    ELSE
        v_max_daily := 50;
    END IF;

    IF p_table_name = 'comments' THEN
        SELECT COUNT(*) INTO v_count
        FROM public.comments
        WHERE author_id = p_user_id
          AND created_at > CURRENT_DATE;
    ELSIF p_table_name = 'submissions' THEN
        SELECT COUNT(*) INTO v_count
        FROM public.submissions
        WHERE author_id = p_user_id
          AND created_at > CURRENT_DATE;
    ELSE
        v_count := 0;
    END IF;

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

-- 4. 修复 enforce_insert_limits（search_path 改为 public）
CREATE OR REPLACE FUNCTION public.enforce_insert_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
