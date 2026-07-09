-- ============================================================================
-- 飞行雪绒 migration-010 — 修复 check_daily_quota 类型不匹配
-- ============================================================================
-- 现象: 同步/发评论失败
--   function public.check_daily_quota(uuid, name) does not exist
--
-- 根因: INSERT 触发器里 TG_TABLE_NAME 的类型是 PostgreSQL `name`，
--       而 check_daily_quota 定义为 (uuid, varchar)，函数解析找不到匹配。
--
-- 修复: 函数第二参数改为 TEXT，触发器内显式 ::text 调用。
-- 前提: 已执行 migration-001~009
-- ============================================================================

-- 移除旧签名，避免重载歧义
DROP FUNCTION IF EXISTS public.check_daily_quota(uuid, varchar);
DROP FUNCTION IF EXISTS public.check_daily_quota(uuid, name);

CREATE OR REPLACE FUNCTION public.check_daily_quota(
    p_user_id    UUID,
    p_table_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count  INTEGER;
    v_limit  INTEGER;
    v_role   VARCHAR(20);
    v_action VARCHAR;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;

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
    FROM public.rate_limits
    WHERE user_id = p_user_id
      AND action_type = v_action
      AND created_at > NOW() - INTERVAL '1 day';

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

GRANT EXECUTE ON FUNCTION public.check_daily_quota(uuid, text) TO authenticated, anon;

-- 触发器函数：显式 cast，确保与函数签名匹配
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

    v_check := public.check_rate_limit(v_uid, v_action);
    IF NOT (v_check->>'allowed')::boolean THEN
        RAISE EXCEPTION '%', COALESCE(v_check->>'reason', '速率限制');
    END IF;

    v_quota := public.check_daily_quota(v_uid, TG_TABLE_NAME::text);
    IF NOT (v_quota->>'allowed')::boolean THEN
        RAISE EXCEPTION '%', COALESCE(v_quota->>'reason', '今日配额已满');
    END IF;

    PERFORM public.record_rate_limit(v_uid, v_action);

    RETURN NEW;
END;
$$;
