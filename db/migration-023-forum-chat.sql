-- migration-023: 星炬学院实时公共聊天室（含 Realtime 发布）
--
-- ⚠️ 本文件取代 migration-020-forum-chat.sql
--
-- 背景：db/ 目录下曾同时存在两个 020 编号文件——
--         migration-020-forum-tables.sql（论坛主表）
--         migration-020-forum-chat.sql  （聊天表，现已改名为 DEPRECATED-migration-020-forum-chat.sql）
--       按 019→020→021→022 顺序执行时，020 只会被执行其中一份，
--       导致 forum_chat 始终未创建，前端聊天降级为纯本地模式
--       （REST 探针返回 PGRST205: Could not find the table 'public.forum_chat'）。
--       本文件重编号为 023，彻底消除编号撞车。勿再执行 DEPRECATED-020-chat。
--
-- 修正：原 020-forum-chat 注释称「Realtime 已随 supabase_realtime publication
--       发布所有表，无需额外配置」——这是错误的。migration-022 表明本项目采用
--       逐表 ALTER PUBLICATION ... ADD TABLE 的方式。因此本文件在建表之后
--       补齐 publication 注册与 REPLICA IDENTITY，确保聊天真正具备实时推送。
--
-- 前置依赖：
--   - migration-021-forum-rls.sql 必须已执行（提供 public.is_forum_admin()）
--
-- 执行方式：Supabase Dashboard → SQL Editor → 以服务角色 / 项目 owner 执行
-- 幂等性：全部语句使用 IF NOT EXISTS / DROP IF EXISTS / 条件判断，可重复执行

-- ============================================================
-- 1. 聊天消息表
-- ============================================================
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

-- ============================================================
-- 2. 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_forum_chat_realm_created
    ON public.forum_chat (realm, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forum_chat_hidden
    ON public.forum_chat (is_hidden, realm, created_at DESC);

-- ============================================================
-- 3. 行级安全（RLS）
-- ============================================================
ALTER TABLE public.forum_chat ENABLE ROW LEVEL SECURITY;

-- 任何人可读未隐藏消息
DROP POLICY IF EXISTS forum_chat_public_read ON public.forum_chat;
CREATE POLICY forum_chat_public_read
    ON public.forum_chat
    FOR SELECT
    USING (is_hidden = false);

-- 已登录用户可插入（匿名登录 / 邮箱登录均为 authenticated 角色）
DROP POLICY IF EXISTS forum_chat_authenticated_insert ON public.forum_chat;
CREATE POLICY forum_chat_authenticated_insert
    ON public.forum_chat
    FOR INSERT
    TO authenticated
    WITH CHECK (realm = 'startorch');

-- 管理员可更新（隐藏 / 解隐藏违规消息）
DROP POLICY IF EXISTS forum_chat_admin_update ON public.forum_chat;
CREATE POLICY forum_chat_admin_update
    ON public.forum_chat
    FOR UPDATE
    TO authenticated
    USING (public.is_forum_admin())
    WITH CHECK (public.is_forum_admin());

-- 管理员可删除
DROP POLICY IF EXISTS forum_chat_admin_delete ON public.forum_chat;
CREATE POLICY forum_chat_admin_delete
    ON public.forum_chat
    FOR DELETE
    TO authenticated
    USING (public.is_forum_admin());

-- ============================================================
-- 4. Realtime 发布注册（对齐 migration-022 的逐表 ADD 方式）
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'forum_chat'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_chat;
    END IF;
END
$$;

-- DELETE / UPDATE 事件需要完整旧行，否则前端收不到可用 payload
ALTER TABLE public.forum_chat REPLICA IDENTITY FULL;

-- ============================================================
-- 5. 注释
-- ============================================================
COMMENT ON TABLE public.forum_chat IS '星炬学院论坛公共实时聊天消息（migration-023）';

-- ============================================================
-- 6. 自检查询（执行后手动运行，确认三项全绿）
-- ============================================================
-- 6.1 表存在且列齐全（应返回 8 行）
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='forum_chat' ORDER BY ordinal_position;
--
-- 6.2 RLS 策略齐全（应返回 4 行）
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename='forum_chat';
--
-- 6.3 已加入 Realtime 发布（应返回 1 行）
--   SELECT tablename FROM pg_publication_tables
--   WHERE pubname='supabase_realtime' AND tablename='forum_chat';
