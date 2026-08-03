-- ============================================================================
-- 论坛数据上云 · Phase 1-B：行级安全（RLS）
-- 项目: lmlyfyjffaaddysiliht
-- 执行: Supabase SQL Editor（服务角色），可重复跑
--
-- 策略要点:
--   1. 任何人（含未登录游客）可读论坛内容。
--   2. 写操作要求 auth.role()='authenticated'。
--      注意: Supabase「匿名登录(anonymous sign-ins)」产生的用户
--            也属于 authenticated 角色 —— 因此论坛「匿名身份发帖」
--            在透明匿名登录后即通过校验，无需强制弹登录框。
--   3. 本人可改 / 删自己的帖子与评论；管理员可改 / 删全部。
-- ============================================================================

-- 多管理员：用 forum_admins 表存储管理员邮箱（支持多人共存，权限完全平等）
-- 增删管理员只需 INSERT / DELETE 一行，无需改写本函数。
CREATE TABLE IF NOT EXISTS public.forum_admins (
    email     TEXT        PRIMARY KEY,
    added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note      TEXT        DEFAULT ''
);

-- 初始管理员（站点 Owner + 第二位管理员）；已存在则跳过（幂等）
INSERT INTO public.forum_admins (email, note) VALUES
    ('2473609011@qq.com', '站点 Owner'),
    ('3604893605@qq.com', '管理员')
ON CONFLICT (email) DO NOTHING;

-- 管理员判定：当前登录用户的邮箱在 forum_admins 表中即视为管理员（多人平等）
CREATE OR REPLACE FUNCTION public.is_forum_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM auth.users u
        JOIN public.forum_admins fa ON fa.email = u.email
        WHERE u.id = auth.uid()
    );
$$;

-- 保护管理员表：仅管理员可读写（客户端侧）；服务角色执行迁移时绕过 RLS，不影响播种
ALTER TABLE public.forum_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forum_admins_admin_manage" ON public.forum_admins;
CREATE POLICY "forum_admins_admin_manage"
    ON public.forum_admins FOR ALL
    USING (public.is_forum_admin())
    WITH CHECK (public.is_forum_admin());

-- ----------------------------------------------------------------------------
-- forum_submissions
-- ----------------------------------------------------------------------------
ALTER TABLE public.forum_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forum_submissions_public_read" ON public.forum_submissions;
CREATE POLICY "forum_submissions_public_read"
    ON public.forum_submissions FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "forum_submissions_auth_insert" ON public.forum_submissions;
CREATE POLICY "forum_submissions_auth_insert"
    ON public.forum_submissions FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND (auth.uid() = author_id OR author_id IS NULL)
    );

DROP POLICY IF EXISTS "forum_submissions_owner_update" ON public.forum_submissions;
CREATE POLICY "forum_submissions_owner_update"
    ON public.forum_submissions FOR UPDATE
    USING (auth.uid() = author_id OR public.is_forum_admin())
    WITH CHECK (auth.uid() = author_id OR public.is_forum_admin());

DROP POLICY IF EXISTS "forum_submissions_owner_delete" ON public.forum_submissions;
CREATE POLICY "forum_submissions_owner_delete"
    ON public.forum_submissions FOR DELETE
    USING (auth.uid() = author_id OR public.is_forum_admin());

-- ----------------------------------------------------------------------------
-- forum_comments
-- ----------------------------------------------------------------------------
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forum_comments_public_read" ON public.forum_comments;
CREATE POLICY "forum_comments_public_read"
    ON public.forum_comments FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "forum_comments_auth_insert" ON public.forum_comments;
CREATE POLICY "forum_comments_auth_insert"
    ON public.forum_comments FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND (auth.uid() = author_id OR author_id IS NULL)
    );

DROP POLICY IF EXISTS "forum_comments_owner_delete" ON public.forum_comments;
CREATE POLICY "forum_comments_owner_delete"
    ON public.forum_comments FOR DELETE
    USING (auth.uid() = author_id OR public.is_forum_admin());

-- ----------------------------------------------------------------------------
-- 多管理员说明（已改为表驱动，支持多人共存、权限平等）:
--   · 管理员以「邮箱」为单位，存于 forum_admins 表；所有管理员权限完全平等。
--   · 本迁移已预置两位管理员：2473609011@qq.com（站点 Owner）、3604893605@qq.com。
--   · 增加管理员：
--       INSERT INTO forum_admins (email, note) VALUES ('新邮箱@x.com', '备注');
--   · 移除管理员：
--       DELETE FROM forum_admins WHERE email = '要移除的邮箱@x.com';
--   · 与飞行雪绒主站打通：用主站注册的同款邮箱登录，该邮箱若在 forum_admins 中即自动为论坛管理员。
--   · forum_admins 表已开启 RLS：仅管理员可读写；服务角色（SQL Editor）不受限。
-- ============================================================================
