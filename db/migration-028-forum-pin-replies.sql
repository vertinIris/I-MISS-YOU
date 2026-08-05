-- ============================================================================
-- 飞行雪绒 migration-028 — 论坛置顶字段 + 评论一层楼中楼
-- ============================================================================
-- 前提: 已执行 migration-020~027（论坛表 + RLS + Realtime + 昵称）
-- 执行: Supabase Dashboard → SQL Editor（服务角色），可重复跑
--
-- 变更:
--   1. forum_submissions.is_pinned（真实置顶；仅管理员可改）
--   2. forum_comments.parent_id（一层回复；禁止无限树）
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) 置顶字段
-- ----------------------------------------------------------------------------
ALTER TABLE public.forum_submissions
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_forum_submissions_pinned_time
    ON public.forum_submissions(is_pinned DESC, created_at DESC);

COMMENT ON COLUMN public.forum_submissions.is_pinned IS '管理员置顶；列表与置顶区优先展示';

-- 收紧 UPDATE：非管理员不得把 is_pinned 改为 true；管理员可改全部字段。
-- 用触发器保证（比拆多条 RLS 策略更稳，避免误伤作者改标题/点赞同步）。
CREATE OR REPLACE FUNCTION public.forum_guard_pin_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.is_pinned IS DISTINCT FROM OLD.is_pinned THEN
        IF NOT public.is_forum_admin() THEN
            RAISE EXCEPTION '仅论坛管理员可修改 is_pinned'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_guard_pin_change ON public.forum_submissions;
CREATE TRIGGER trg_forum_guard_pin_change
    BEFORE UPDATE ON public.forum_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.forum_guard_pin_change();

-- ----------------------------------------------------------------------------
-- 2) 评论一层 parent_id（楼中楼）
-- ----------------------------------------------------------------------------
ALTER TABLE public.forum_comments
    ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES public.forum_comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_forum_comments_parent
    ON public.forum_comments(parent_id, created_at ASC);

COMMENT ON COLUMN public.forum_comments.parent_id IS '回复目标评论 id；NULL=顶层。前端仅嵌套 1 层。';

-- 禁止回复「已经是回复」的评论（服务端兜底，一层即可）
CREATE OR REPLACE FUNCTION public.forum_guard_comment_depth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    parent_parent TEXT;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT c.parent_id INTO parent_parent
    FROM public.forum_comments c
    WHERE c.id = NEW.parent_id;
    IF parent_parent IS NOT NULL THEN
        RAISE EXCEPTION '论坛评论仅支持一层回复'
            USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_guard_comment_depth ON public.forum_comments;
CREATE TRIGGER trg_forum_guard_comment_depth
    BEFORE INSERT ON public.forum_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.forum_guard_comment_depth();
