-- ============================================================================
-- 飞行雪绒 migration-011 — 评论一层回复
-- ============================================================================
-- 新增 parent_id，支持回复某条评论（一层缩进，不做无限嵌套）
-- 前提: 已执行 migration-001~010
-- ============================================================================

ALTER TABLE public.comments
    ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES public.comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comments_parent
    ON public.comments(parent_id, created_at ASC);

COMMENT ON COLUMN public.comments.parent_id IS '回复目标评论 ID；NULL 表示顶层评论';
