-- ============================================================================
-- 飞行雪绒 v9.2 — 分层限流升级
-- 前提: 已执行 migration-001~006（依赖 profiles.role 字段）
-- 执行: Supabase Dashboard → SQL Editor → Run
-- ============================================================================

-- ============================================================================
-- 1. rate_limits 表新增 IP 字段
-- ============================================================================
ALTER TABLE public.rate_limits
    ADD COLUMN IF NOT EXISTS ip_address INET;

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip
    ON rate_limits(ip_address, action_type, created_at DESC);

-- ============================================================================
-- 2. 升级 check_rate_limit（区分用户角色，返回 JSONB）
-- ============================================================================
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
    v_window_seconds INTEGER;
    v_max_actions   INTEGER;
    v_recent_count  INTEGER;
    v_daily_limit   INTEGER;
    v_role          VARCHAR(20);
BEGIN
    -- 获取用户角色决定限流参数
    SELECT role INTO v_role FROM profiles WHERE id = p_user_id;

    IF v_role IN ('moderator', 'admin') THEN
        v_window_seconds := 10;
        v_max_actions := 20;
        v_daily_limit := 999999;
    ELSIF v_role = 'user' THEN
        v_window_seconds := 30;
        v_max_actions := 10;
        v_daily_limit := 50;
    ELSE
        -- 匿名用户
        v_window_seconds := 60;
        v_max_actions := 5;
        v_daily_limit := 20;
    END IF;

    -- 滑动窗口计数
    SELECT COUNT(*) INTO v_recent_count
    FROM rate_limits
    WHERE user_id = p_user_id
      AND action_type = p_action_type
      AND created_at > NOW() - (v_window_seconds || ' seconds')::INTERVAL;

    IF v_recent_count >= v_max_actions THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', '操作过于频繁，请 ' || v_window_seconds || ' 秒后再试',
            'retry_after', v_window_seconds
        );
    END IF;

    RETURN jsonb_build_object('allowed', true);
END;
$$;

-- ============================================================================
-- 3. 升级 check_daily_quota（区分用户角色）
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_daily_quota(
    p_user_id  UUID,
    p_table_name VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count     INTEGER;
    v_limit     INTEGER;
    v_role      VARCHAR(20);
    v_action    VARCHAR;
BEGIN
    SELECT role INTO v_role FROM profiles WHERE id = p_user_id;

    IF p_table_name = 'comments' THEN
        v_action := 'comment';
        IF v_role IN ('moderator', 'admin') THEN
            v_limit := 999999;
        ELSIF v_role = 'user' THEN
            v_limit := 50;
        ELSE
            v_limit := 20;
        END IF;
    ELSIF p_table_name = 'submissions' THEN
        v_action := 'submission';
        IF v_role IN ('moderator', 'admin') THEN
            v_limit := 999999;
        ELSIF v_role = 'user' THEN
            v_limit := 10;
        ELSE
            v_limit := 10;
        END IF;
    ELSE
        RETURN jsonb_build_object('allowed', true);
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM rate_limits
    WHERE user_id = p_user_id
      AND action_type = v_action
      AND created_at > NOW() - '1 day'::INTERVAL;

    IF v_count >= v_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', '今日' || v_action || '配额已满 (' || v_limit || ' 条/天)',
            'retry_after', 86400
        );
    END IF;

    RETURN jsonb_build_object('allowed', true);
END;
$$;

-- ============================================================================
-- 4. IP 限流 RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_ip_rate_limit(
    p_ip_address INET,
    p_action_type VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
    v_limit INTEGER := 50;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM rate_limits
    WHERE ip_address = p_ip_address
      AND action_type = p_action_type
      AND created_at > NOW() - '1 day'::INTERVAL;

    IF v_count >= v_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', '该 IP 今日操作已达上限',
            'retry_after', 86400
        );
    END IF;

    RETURN jsonb_build_object('allowed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_ip_rate_limit(INET, VARCHAR)
    TO authenticated, anon;

-- ============================================================================
-- 5. 升级 enforce_insert_limits 触发器函数
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_insert_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid    UUID := COALESCE(auth.uid(), NULL);
    v_action VARCHAR;
    v_check  JSONB;
    v_quota  JSONB;
BEGIN
    IF TG_TABLE_NAME = 'comments' THEN
        v_action := 'comment';
    ELSIF TG_TABLE_NAME = 'submissions' THEN
        v_action := 'submission';
    ELSE
        RETURN NEW;
    END IF;

    -- 速率限制
    v_check := public.check_rate_limit(v_uid, v_action);
    IF NOT (v_check->>'allowed')::boolean THEN
        RAISE EXCEPTION '%', COALESCE(v_check->>'reason', '速率限制');
    END IF;

    -- 日配额
    v_quota := public.check_daily_quota(v_uid, TG_TABLE_NAME);
    IF NOT (v_quota->>'allowed')::boolean THEN
        RAISE EXCEPTION '%', COALESCE(v_quota->>'reason', '今日配额已满');
    END IF;

    -- 记录限流日志
    PERFORM public.record_rate_limit(v_uid, v_action);

    RETURN NEW;
END;
$$;

-- ============================================================================
-- 6. record_rate_limit 保持兼容（增加 IP 参数可选）
-- ============================================================================
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
    INSERT INTO rate_limits (user_id, action_type)
    VALUES (p_user_id, p_action_type);
END;
$$;
