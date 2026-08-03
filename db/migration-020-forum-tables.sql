-- ============================================================================
-- 论坛数据上云 · Phase 1-A：建表（forum_submissions / forum_comments）
-- 项目: lmlyfyjffaaddysiliht（与飞行雪绒主站同一 Supabase 实例）
-- 执行: Supabase Dashboard → SQL Editor，以服务角色（默认）执行，可重复跑
-- 设计: 独立 forum_* 表，避免污染主站 submissions / comments
--       id 用 TEXT（沿用客户端 stf_* 幂等 id），tags 用 TEXT[] 数组
-- ============================================================================

-- 扩展（主站迁移已启用，这里再确认一次，幂等）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 论坛投稿表
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forum_submissions (
    id            TEXT        PRIMARY KEY,                 -- 客户端幂等 id（stf_<timestamp>）
    author_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name   VARCHAR(60) NOT NULL,
    author_color  VARCHAR(20) NOT NULL DEFAULT '#6B8AFF',
    type          VARCHAR(20) NOT NULL,                   -- text/story/poem/art/music
    title         VARCHAR(300) NOT NULL,
    content       TEXT        NOT NULL,
    image         TEXT        DEFAULT '',
    tags          TEXT[]      DEFAULT '{}',               -- 简化：数组，免关联表
    identity      VARCHAR(30) DEFAULT NULL,              -- 匿名预设身份 id
    realm         VARCHAR(20) NOT NULL DEFAULT 'startorch',
    likes         INTEGER     NOT NULL DEFAULT 0,
    is_hidden     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 论坛评论表
CREATE TABLE IF NOT EXISTS public.forum_comments (
    id            TEXT        PRIMARY KEY,
    submission_id TEXT        NOT NULL REFERENCES public.forum_submissions(id) ON DELETE CASCADE,
    author_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name   VARCHAR(60) NOT NULL,
    author_color  VARCHAR(20) NOT NULL DEFAULT '#6B8AFF',
    content       TEXT        NOT NULL,
    is_hidden     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 索引
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_forum_submissions_realm_time
    ON public.forum_submissions(realm, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_submissions_type
    ON public.forum_submissions(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_submissions_author
    ON public.forum_submissions(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_comments_submission
    ON public.forum_comments(submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_comments_author
    ON public.forum_comments(author_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- updated_at 触发器（复用主站 migration-001 已创建的 update_updated_at_column）
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_forum_submissions_updated_at ON public.forum_submissions;
CREATE TRIGGER set_forum_submissions_updated_at
    BEFORE UPDATE ON public.forum_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 说明: forum_comments 一般不需要 updated_at，内容不可变，故不加触发器。
