-- migration-020: 星炬学院实时公共聊天室
--
-- 背景：v7.8 在论坛增加实时聊天对话功能，需要独立存储聊天消息，
--       避免与 forum_comments / forum_submissions 混在一起。
--
-- 设计：
--   - forum_chat 保存公共聊天消息（ realm='startorch' ）
--   - 任何人可读未隐藏消息
--   - 匿名/邮箱登录用户（authenticated 角色）均可发送
--   - 管理员可隐藏违规消息
--   - Realtime 已随 supabase_realtime publication 发布所有表，无需额外配置

-- 聊天消息表
CREATE TABLE IF NOT EXISTS public.forum_chat (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    realm       text NOT NULL DEFAULT 'startorch',
    name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
    user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    color       text NOT NULL DEFAULT '#6B8AFF',
    content     text NOT NULL CHECK (length(content) BETWEEN 1 AND 1000),
    created_at  timestamptz NOT NULL DEFAULT now(),
    is_hidden   boolean NOT NULL DEFAULT false
);

-- 索引：按时间倒序取最近消息
CREATE INDEX IF NOT EXISTS idx_forum_chat_realm_created
    ON public.forum_chat (realm, created_at DESC);

-- 索引：未隐藏消息快速过滤
CREATE INDEX IF NOT EXISTS idx_forum_chat_hidden
    ON public.forum_chat (is_hidden, realm, created_at DESC);

-- RLS：行级安全
ALTER TABLE public.forum_chat ENABLE ROW LEVEL SECURITY;

-- 任何人可读未隐藏消息
DROP POLICY IF EXISTS forum_chat_public_read ON public.forum_chat;
CREATE POLICY forum_chat_public_read
    ON public.forum_chat
    FOR SELECT
    USING (is_hidden = false);

-- 已登录用户可插入（匿名/邮箱登录均为 authenticated 角色）
DROP POLICY IF EXISTS forum_chat_authenticated_insert ON public.forum_chat;
CREATE POLICY forum_chat_authenticated_insert
    ON public.forum_chat
    FOR INSERT
    TO authenticated
    WITH CHECK (realm = 'startorch');

-- 管理员可更新（隐藏/解隐藏）
DROP POLICY IF EXISTS forum_chat_admin_update ON public.forum_chat;
CREATE POLICY forum_chat_admin_update
    ON public.forum_chat
    FOR UPDATE
    TO authenticated
    USING (is_forum_admin())
    WITH CHECK (is_forum_admin());

-- 管理员可删除
DROP POLICY IF EXISTS forum_chat_admin_delete ON public.forum_chat;
CREATE POLICY forum_chat_admin_delete
    ON public.forum_chat
    FOR DELETE
    TO authenticated
    USING (is_forum_admin());

-- 注释
COMMENT ON TABLE public.forum_chat IS '星炬学院论坛公共实时聊天消息';
