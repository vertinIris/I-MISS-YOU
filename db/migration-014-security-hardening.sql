-- ============================================================================
-- 飞行雪绒 migration-014 — 服务端内容安全加固
-- ============================================================================
-- 前提: migration-003+ 已执行（enforce_insert_limits 触发器）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.contains_dangerous_content(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
    IF p_text IS NULL OR length(p_text) = 0 THEN
        RETURN FALSE;
    END IF;
    IF p_text ~* '<\s*script' THEN RETURN TRUE; END IF;
    IF p_text ~* 'javascript\s*:' THEN RETURN TRUE; END IF;
    IF p_text ~* 'on\w+\s*=' THEN RETURN TRUE; END IF;
    IF p_text ~* '<\s*iframe' THEN RETURN TRUE; END IF;
    IF p_text ~* 'data\s*:\s*text/html' THEN RETURN TRUE; END IF;
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_comment_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF public.contains_dangerous_content(NEW.content) THEN
        RAISE EXCEPTION '内容包含不允许的标记或脚本';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_submission_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF public.contains_dangerous_content(NEW.title)
       OR public.contains_dangerous_content(NEW.content) THEN
        RAISE EXCEPTION '内容包含不允许的标记或脚本';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_comment_content ON public.comments;
CREATE TRIGGER trg_validate_comment_content
    BEFORE INSERT OR UPDATE OF content ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.validate_comment_content();

DROP TRIGGER IF EXISTS trg_validate_submission_content ON public.submissions;
CREATE TRIGGER trg_validate_submission_content
    BEFORE INSERT OR UPDATE OF title, content ON public.submissions
    FOR EACH ROW EXECUTE FUNCTION public.validate_submission_content();

GRANT EXECUTE ON FUNCTION public.contains_dangerous_content(TEXT) TO authenticated, anon;
