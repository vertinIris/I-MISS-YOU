-- ============================================================================
-- migration-029: 论坛服务端搜索 RPC
-- ----------------------------------------------------------------------------
-- 背景：前端 forum.js 已有客户端搜索（标题/正文/作者/标签 ILIKE），
--       但仅覆盖已加载到本地的帖子。本迁移新增服务端 RPC，支持：
--       1) 分页场景下搜索全量云端数据（不依赖本地缓存完整性）
--       2) 未来全文检索扩展基础（tsvector 可后续叠加）
-- 设计：用 ILIKE 模糊匹配（对中文友好，无需 zhparser 扩展），
--       搜索 title / content / author_name，排除 is_hidden 帖子，
--       按 likes DESC + created_at DESC 排序。
-- 执行：Supabase Dashboard → SQL Editor，以服务角色执行，可重复跑
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 搜索 RPC：search_forum_submissions(search_text, limit_count, offset_count)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_forum_submissions(
    search_text  TEXT,
    limit_count  INTEGER DEFAULT 20,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id           TEXT,
    author_name  VARCHAR,
    author_color VARCHAR,
    type         VARCHAR,
    title        VARCHAR,
    content      TEXT,
    image        TEXT,
    tags         TEXT[],
    identity     VARCHAR,
    realm        VARCHAR,
    likes        INTEGER,
    created_at   TIMESTAMPTZ,
    is_pinned    BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        s.id,
        s.author_name,
        s.author_color,
        s.type,
        s.title,
        s.content,
        s.image,
        s.tags,
        s.identity,
        s.realm,
        s.likes,
        s.created_at,
        COALESCE(s.is_pinned, FALSE) AS is_pinned
    FROM public.forum_submissions s
    WHERE s.is_hidden = FALSE
      AND (
          s.title ILIKE '%' || search_text || '%'
          OR s.content ILIKE '%' || search_text || '%'
          OR s.author_name ILIKE '%' || search_text || '%'
      )
    ORDER BY s.likes DESC, s.created_at DESC
    LIMIT GREATEST(1, LEAST(limit_count, 100))
    OFFSET GREATEST(0, offset_count);
$$;

-- 权限：匿名也可搜索（只读，is_hidden=FALSE 已过滤）
GRANT EXECUTE ON FUNCTION public.search_forum_submissions(TEXT, INTEGER, INTEGER) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 评论搜索 RPC：search_forum_comments(search_text, limit_count)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_forum_comments(
    search_text  TEXT,
    limit_count  INTEGER DEFAULT 20
)
RETURNS TABLE (
    id           TEXT,
    submission_id TEXT,
    author_name  VARCHAR,
    author_color VARCHAR,
    content      TEXT,
    created_at   TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        c.id,
        c.submission_id,
        c.author_name,
        c.author_color,
        c.content,
        c.created_at
    FROM public.forum_comments c
    WHERE c.is_hidden = FALSE
      AND c.content ILIKE '%' || search_text || '%'
    ORDER BY c.created_at DESC
    LIMIT GREATEST(1, LEAST(limit_count, 100));
$$;

GRANT EXECUTE ON FUNCTION public.search_forum_comments(TEXT, INTEGER) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 备注：前端接入指南
-- ----------------------------------------------------------------------------
-- const { data, error } = await supabaseClient
--     .rpc('search_forum_submissions', { search_text: '爱弥斯', limit_count: 20, offset_count: 0 });
-- 返回匹配帖列表，可直接渲染为搜索结果页。
-- 客户端 forum.js 现有本地搜索（第329-335行）仍保留作为即时筛选；
-- 本 RPC 用于"搜索全量云端数据"场景（如搜索结果分页、本地缓存未覆盖时）。
