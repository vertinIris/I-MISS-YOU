-- ============================================================================
-- 飞行雪绒 v9.2 — 标签体系 + 收藏功能
-- 前提: 已执行 migration-001~007
-- 执行: Supabase Dashboard → SQL Editor → Run
-- ============================================================================

-- ============================================================================
-- 1. 标签表
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tags (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    category    VARCHAR(20) NOT NULL CHECK (category IN
                ('character', 'category', 'rating', 'warning', 'freeform')),
    description VARCHAR(200) DEFAULT '',
    color       VARCHAR(20) DEFAULT '#6B8AFF',
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_by  UUID REFERENCES auth.users(id),
    is_official BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category, usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- ============================================================================
-- 2. 投稿-标签关联表（多对多）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.submission_tags (
    submission_id BIGINT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    tag_id        BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (submission_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_submission_tags_tag
    ON submission_tags(tag_id, submission_id);

-- ============================================================================
-- 3. 收藏夹表
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bookmark_collections (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        VARCHAR(50) NOT NULL,
    description VARCHAR(200) DEFAULT '',
    is_public   BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_user
    ON bookmark_collections(user_id, sort_order);

-- ============================================================================
-- 4. 书签收藏表
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    submission_id BIGINT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    collection_id BIGINT REFERENCES bookmark_collections(id) ON DELETE SET NULL,
    note          VARCHAR(500) DEFAULT '',
    is_private    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, submission_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user
    ON bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_submission
    ON bookmarks(submission_id);

-- ============================================================================
-- 5. 标签使用计数触发器
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_tag_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE tags SET usage_count = usage_count + 1
    WHERE id = NEW.tag_id;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_tag_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE tags SET usage_count = GREATEST(usage_count - 1, 0)
    WHERE id = OLD.tag_id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_tag_inc ON submission_tags;
CREATE TRIGGER trg_tag_inc AFTER INSERT ON submission_tags
    FOR EACH ROW EXECUTE FUNCTION increment_tag_usage();

DROP TRIGGER IF EXISTS trg_tag_dec ON submission_tags;
CREATE TRIGGER trg_tag_dec AFTER DELETE ON submission_tags
    FOR EACH ROW EXECUTE FUNCTION decrement_tag_usage();

-- ============================================================================
-- 6. 书签计数 RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.toggle_bookmark(
    p_submission_id BIGINT,
    p_collection_id BIGINT DEFAULT NULL,
    p_note          VARCHAR(500) DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid    UUID := auth.uid();
    v_exists BOOLEAN;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', '请先登录');
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM bookmarks
        WHERE user_id = v_uid AND submission_id = p_submission_id
    ) INTO v_exists;

    IF v_exists THEN
        DELETE FROM bookmarks
        WHERE user_id = v_uid AND submission_id = p_submission_id;
        RETURN jsonb_build_object('success', true, 'action', 'removed');
    ELSE
        INSERT INTO bookmarks (user_id, submission_id, collection_id, note)
        VALUES (v_uid, p_submission_id, p_collection_id, p_note);
        RETURN jsonb_build_object('success', true, 'action', 'added');
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_bookmark(BIGINT, BIGINT, VARCHAR)
    TO authenticated;

-- ============================================================================
-- 7. 按标签筛选投稿 RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.filter_submissions_by_tags(
    p_tag_names VARCHAR[] DEFAULT NULL,
    p_type      VARCHAR DEFAULT NULL,
    p_sort      VARCHAR DEFAULT 'new',
    p_limit     INTEGER DEFAULT 20,
    p_offset    INTEGER DEFAULT 0
)
RETURNS TABLE(
    id BIGINT, type VARCHAR, title VARCHAR, author_name VARCHAR,
    likes INTEGER, bookmark_count BIGINT, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id, s.type, s.title, s.author_name, s.likes,
        COUNT(b.id)::BIGINT AS bookmark_count,
        s.created_at
    FROM submissions s
    LEFT JOIN bookmarks b ON b.submission_id = s.id
    WHERE s.is_hidden = FALSE
      AND (p_type IS NULL OR s.type = p_type)
      AND (
        p_tag_names IS NULL OR
        s.id IN (
            SELECT st.submission_id FROM submission_tags st
            JOIN tags t ON t.id = st.tag_id
            WHERE t.name = ANY(p_tag_names)
        )
      )
    GROUP BY s.id, s.type, s.title, s.author_name, s.likes, s.created_at
    ORDER BY
        CASE WHEN p_sort = 'popular' THEN s.likes END DESC,
        CASE WHEN p_sort = 'bookmarked' THEN COUNT(b.id) END DESC,
        CASE WHEN p_sort = 'new' OR p_sort IS NULL THEN s.created_at END DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.filter_submissions_by_tags
    TO authenticated, anon;

-- ============================================================================
-- 8. 为投稿添加标签 RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.add_submission_tags(
    p_submission_id BIGINT,
    p_tag_names     VARCHAR[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid    UUID := auth.uid();
    v_tag_id BIGINT;
    v_name   VARCHAR;
BEGIN
    -- 验证当前用户是投稿作者
    IF NOT EXISTS(
        SELECT 1 FROM submissions
        WHERE id = p_submission_id
          AND (author_id = v_uid OR v_uid IS NULL AND delete_token IS NOT NULL)
    ) THEN
        RAISE EXCEPTION '无权为他人投稿添加标签';
    END IF;

    FOREACH v_name IN ARRAY p_tag_names LOOP
        -- 查找或创建标签
        SELECT id INTO v_tag_id FROM tags WHERE name = v_name LIMIT 1;
        IF v_tag_id IS NULL THEN
            INSERT INTO tags (name, category, is_official, created_by)
            VALUES (v_name, 'freeform', FALSE, v_uid)
            RETURNING id INTO v_tag_id;
        END IF;

        -- 插入关联（忽略重复）
        INSERT INTO submission_tags (submission_id, tag_id)
        VALUES (p_submission_id, v_tag_id)
        ON CONFLICT DO NOTHING;
    END LOOP;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_submission_tags(BIGINT, VARCHAR[])
    TO authenticated, anon;

-- ============================================================================
-- 9. RLS 策略
-- ============================================================================
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags_public_read" ON tags;
CREATE POLICY "tags_public_read" ON tags FOR SELECT USING (true);
-- 仅管理员可创建官方标签
DROP POLICY IF EXISTS "tags_admin_insert" ON tags;
CREATE POLICY "tags_admin_insert" ON tags FOR INSERT
    WITH CHECK (
        is_official = FALSE
        OR EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

ALTER TABLE submission_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sub_tags_public_read" ON submission_tags;
CREATE POLICY "sub_tags_public_read" ON submission_tags FOR SELECT USING (true);
DROP POLICY IF EXISTS "sub_tags_auth_insert" ON submission_tags;
CREATE POLICY "sub_tags_auth_insert" ON submission_tags FOR INSERT
    WITH CHECK (
        auth.uid() = (
            SELECT author_id FROM submissions WHERE id = submission_id
        )
    );
DROP POLICY IF EXISTS "sub_tags_owner_delete" ON submission_tags;
CREATE POLICY "sub_tags_owner_delete" ON submission_tags FOR DELETE
    USING (
        auth.uid() = (
            SELECT author_id FROM submissions WHERE id = submission_id
        )
    );

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bookmarks_owner_all" ON bookmarks;
CREATE POLICY "bookmarks_owner_all" ON bookmarks FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "bookmarks_public_read" ON bookmarks;
CREATE POLICY "bookmarks_public_read" ON bookmarks FOR SELECT
    USING (is_private = FALSE);

ALTER TABLE bookmark_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "collections_owner_all" ON bookmark_collections;
CREATE POLICY "collections_owner_all" ON bookmark_collections FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "collections_public_read" ON bookmark_collections;
CREATE POLICY "collections_public_read" ON bookmark_collections FOR SELECT
    USING (is_public = TRUE);

-- ============================================================================
-- 10. 种子标签数据
-- ============================================================================
INSERT INTO tags (name, category, color, is_official, description) VALUES
    ('爱弥斯', 'character', '#FF8FB0', TRUE, '鸣潮角色 — 飞行雪绒'),
    ('达妮娅', 'character', '#B66BFF', TRUE, '鸣潮角色'),
    ('西格莉卡', 'character', '#4EC89A', TRUE, '鸣潮角色'),
    ('漂泊者', 'character', '#D4A040', TRUE, '鸣潮角色'),
    ('文字', 'category', '#6B8AFF', TRUE, '文字类同人作品'),
    ('故事', 'category', '#6B8AFF', TRUE, '故事类同人作品'),
    ('诗歌', 'category', '#6B8AFF', TRUE, '诗歌类同人作品'),
    ('插画', 'category', '#6B8AFF', TRUE, '插画类同人作品'),
    ('音乐', 'category', '#6B8AFF', TRUE, '音乐类同人作品'),
    ('General', 'rating', '#A8D8FF', TRUE, '一般向 — 适合所有读者'),
    ('Teen', 'rating', '#FFD7E8', TRUE, '青少年向'),
    ('无警告', 'warning', '#7FD99E', TRUE, '无特殊警告'),
    ('含剧透', 'warning', '#FF6B6B', TRUE, '包含剧情剧透'),
    ('温柔', 'freeform', '#FFD7E8', FALSE, '温柔细腻风格'),
    ('日常', 'freeform', '#A8D8FF', FALSE, '日常向叙事'),
    ('虐心', 'freeform', '#FF6B6B', FALSE, '虐心内容'),
    ('结契人', 'freeform', '#D4A0FF', FALSE, 'AO3同人原创概念 — 使用须标注来源')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 11. Realtime 发布
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'bookmarks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bookmarks;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'submission_tags'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.submission_tags;
    END IF;
END $$;
