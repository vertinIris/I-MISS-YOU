-- ============================================================================
-- 飞行雪绒 Phase 3 — 数据库初始化迁移
-- 目标: Supabase PostgreSQL (Free Tier)
-- 执行方式: 在 Supabase Dashboard → SQL Editor 中逐段执行
-- ============================================================================

-- ============================================================================
-- 1. 扩展与基础配置
-- ============================================================================

-- 启用 UUID 生成扩展（用于 auth.users 关联）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. 用户信息表（profiles）
-- ============================================================================
-- auth.users 由 Supabase GoTrue 自动管理，本表仅存储自定义资料字段

CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname    VARCHAR(50)  NOT NULL DEFAULT '匿名信号源',
    avatar_color VARCHAR(20) NOT NULL DEFAULT '#6B8AFF',
    bio         TEXT         DEFAULT '',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_profiles_created ON profiles(created_at);

-- 自动更新 updated_at（幂等：先删除同名触发器，再重建）
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 新用户注册时自动创建 profile（幂等：先删除同名触发器，再重建）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, nickname, avatar_color)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nickname', '匿名信号源'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_color', '#6B8AFF')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 3. 评论表（comments）
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.comments (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    target_id    VARCHAR(50)  NOT NULL,
    author_id    UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name  VARCHAR(50)  NOT NULL DEFAULT '匿名',
    author_color VARCHAR(20)  NOT NULL DEFAULT '#6B8AFF',
    content      TEXT         NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 索引：按目标查询最近评论
CREATE INDEX IF NOT EXISTS idx_comments_target
    ON comments(target_id, created_at DESC);

-- 索引：按作者查询
CREATE INDEX IF NOT EXISTS idx_comments_author
    ON comments(author_id, created_at DESC);

-- ============================================================================
-- 4. 投稿表（submissions）
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.submissions (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type         VARCHAR(20)  NOT NULL CHECK (type IN ('文字', '故事', '诗歌', '插画', '音乐')),
    title        VARCHAR(100) NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
    content      TEXT         NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    author_id    UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name  VARCHAR(50)  NOT NULL DEFAULT '匿名',
    author_color VARCHAR(20)  NOT NULL DEFAULT '#6B8AFF',
    likes        INTEGER      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 索引：按类型筛选 + 时间排序
CREATE INDEX IF NOT EXISTS idx_submissions_type
    ON submissions(type, created_at DESC);

-- 索引：全量时间排序（社区首页）
CREATE INDEX IF NOT EXISTS idx_submissions_time
    ON submissions(created_at DESC);

-- 索引：按作者查询
CREATE INDEX IF NOT EXISTS idx_submissions_author
    ON submissions(author_id, created_at DESC);

-- 自动更新 submissions.updated_at（幂等：先删除同名触发器，再重建）
DROP TRIGGER IF EXISTS set_submissions_updated_at ON public.submissions;

CREATE TRIGGER set_submissions_updated_at
    BEFORE UPDATE ON public.submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. 行级安全策略（RLS）
-- ============================================================================

-- 5.1 profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 所有人可查看他人资料（幂等：先删除同名策略，再重建）
DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
CREATE POLICY "profiles_public_read"
    ON profiles FOR SELECT
    USING (true);

-- 仅本人可修改自己的资料（幂等：先删除同名策略，再重建）
DROP POLICY IF EXISTS "profiles_owner_update" ON profiles;
CREATE POLICY "profiles_owner_update"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 5.2 comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 所有人可读评论（幂等）
DROP POLICY IF EXISTS "comments_public_read" ON comments;
CREATE POLICY "comments_public_read"
    ON comments FOR SELECT
    USING (true);

-- 仅认证用户可发表评论（幂等）
DROP POLICY IF EXISTS "comments_auth_insert" ON comments;
CREATE POLICY "comments_auth_insert"
    ON comments FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- 仅评论作者可删除自己的评论（幂等）
DROP POLICY IF EXISTS "comments_owner_delete" ON comments;
CREATE POLICY "comments_owner_delete"
    ON comments FOR DELETE
    USING (auth.uid() = author_id);

-- 5.3 submissions
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 所有人可读投稿（幂等）
DROP POLICY IF EXISTS "submissions_public_read" ON submissions;
CREATE POLICY "submissions_public_read"
    ON submissions FOR SELECT
    USING (true);

-- 仅认证用户可发表投稿（幂等）
DROP POLICY IF EXISTS "submissions_auth_insert" ON submissions;
CREATE POLICY "submissions_auth_insert"
    ON submissions FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- 仅投稿作者可删除（幂等）
DROP POLICY IF EXISTS "submissions_owner_delete" ON submissions;
CREATE POLICY "submissions_owner_delete"
    ON submissions FOR DELETE
    USING (auth.uid() = author_id);

-- ============================================================================
-- 6. 实时订阅（Realtime）
-- ============================================================================

-- 实时订阅（幂等：先检查是否已存在，避免重复添加报错）
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
-- 7. 匿名认证配置
-- ============================================================================
-- 注意：匿名登录需在 Supabase Dashboard → Authentication → Settings 中启用
-- 路径: Project Settings → Authentication → Enable Anonymous Sign-ins → ON
