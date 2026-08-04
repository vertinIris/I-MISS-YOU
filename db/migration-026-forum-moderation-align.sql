-- ============================================================================
-- migration-026 · 论坛管理能力对齐 profiles.role + 评论隐藏 UPDATE
-- 项目: lmlyfyjffaaddysiliht
-- 执行: Supabase SQL Editor（服务角色），可重复跑
--
-- 背景:
--   1. is_forum_admin() 原先仅查 forum_admins 邮箱；主站版主/管理员写在 profiles.role。
--   2. forum_comments 缺少 UPDATE 策略，前端 hideComment（is_hidden=true）会被 RLS 拦下。
-- ============================================================================

-- 管理员判定：forum_admins 邮箱 OR profiles.role ∈ {moderator, admin}
CREATE OR REPLACE FUNCTION public.is_forum_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM auth.users u
        JOIN public.forum_admins fa ON lower(fa.email) = lower(u.email)
        WHERE u.id = auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('moderator', 'admin')
    );
$$;

-- 评论：版主/管理员可 UPDATE（用于 is_hidden 软隐藏）
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forum_comments_staff_update" ON public.forum_comments;
CREATE POLICY "forum_comments_staff_update"
    ON public.forum_comments FOR UPDATE
    USING (public.is_forum_admin())
    WITH CHECK (public.is_forum_admin());

-- 可选：作者也可改自己的评论（若未来需要编辑）；本迁移不放开，仅管理隐藏。
-- ============================================================================
