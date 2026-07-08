# 飞行雪绒 — 评论系统完整技术设计方案

> **版本**: v9.0 Design Draft | **日期**: 2026-07-08  
> **架构**: 纯前端静态站 (HTML/CSS/JS) + Supabase BaaS  
> **前提**: migration-001~005 已执行，v7.9 评论/点赞修复已完成

---

## 目录

1. [整体架构概览](#1-整体架构概览)
2. [评论删除与权限体系](#2-评论删除与权限体系)
3. [登录与认证方案](#3-登录与认证方案)
4. [同步机制设计](#4-同步机制设计)
5. [评论频率与防刷控制](#5-评论频率与防刷控制)
6. [作品收藏与分类优化](#6-作品收藏与分类优化)
7. [作品提交交互优化](#7-作品提交交互优化)
8. [数据库迁移设计](#8-数据库迁移设计)
9. [边界情况与安全防护](#9-边界情况与安全防护)
10. [实施路线图](#10-实施路线图)

---

## 1. 整体架构概览

### 1.1 当前架构

```
┌─────────────────────────────────────────────────────┐
│                    浏览器前端                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ main.js  │  │ repository│  │ supabase-adapter  │  │
│  │ 交互引擎  │←→│ .js      │←→│ .js               │  │
│  └──────────┘  └──────────┘  └────────┬──────────┘  │
│                                       │              │
│  localStorage (离线缓存)               │              │
└───────────────────────────────────────┼──────────────┘
                                        │ HTTPS + WebSocket
                          ┌─────────────▼──────────────┐
                          │      Supabase Cloud         │
                          │  ┌─────────┐ ┌───────────┐  │
                          │  │Auth     │ │PostgreSQL │  │
                          │  │(匿名)   │ │+ RLS      │  │
                          │  └─────────┘ └───────────┘  │
                          │  ┌─────────┐ ┌───────────┐  │
                          │  │Realtime │ │Storage    │  │
                          │  │(WebSocket)│ │(文件存储) │  │
                          │  └─────────┘ └───────────┘  │
                          └─────────────────────────────┘
```

### 1.2 目标架构（v9.0）

```
┌─────────────────────────────────────────────────────────────┐
│                      浏览器前端                               │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │ main.js  │  │ repository│  │ supabase-adapter.js      │  │
│  │ 交互引擎  │←→│ .js      │←→│  - Auth (匿名+注册)       │  │
│  │          │  │          │  │  - CRUD + RPC             │  │
│  │ - 评论    │  │ - 双写   │  │  - Realtime 订阅          │  │
│  │ - 点赞    │  │ - 合并   │  │  - Storage 上传           │  │
│  │ - 收藏    │  │ - 降级   │  │  - Token 管理             │  │
│  │ - 投稿    │  │          │  │                           │  │
│  └──────────┘  └──────────┘  └───────────┬───────────────┘  │
│                                           │                  │
│  ┌─────────────────────────────────────┐  │                  │
│  │ AuthManager (新增模块)               │  │                  │
│  │ - 会话状态管理                        │  │                  │
│  │ - 匿名→注册升级                      │  │                  │
│  │ - 角色权限判定                        │  │                  │
│  └─────────────────────────────────────┘  │                  │
│                                           │                  │
│  localStorage:                            │                  │
│  - fxre_comments (离线缓存)               │                  │
│  - fxre_post_likes (点赞状态)             │                  │
│  - fxre_delete_tokens (删除令牌)          │                  │
│  - fxre_bookmarks (离线书签)              │                  │
│  - fxre_auth_session (会话缓存)           │                  │
└───────────────────────────────────────────┼──────────────────┘
                                            │
                     ┌──────────────────────▼──────────────────────┐
                     │            Supabase Cloud                    │
                     │                                             │
                     │  ┌──────────┐  ┌────────────────────────┐   │
                     │  │ Auth     │  │ PostgreSQL              │   │
                     │  │ - 匿名   │  │  - comments (+token)    │   │
                     │  │ - Email  │  │  - submissions          │   │
                     │  │ - OAuth  │  │  - tags (新增)          │   │
                     │  │ - 角色   │  │  - bookmarks (新增)     │   │
                     │  └──────────┘  │  - rate_limits          │   │
                     │                │  - RLS (全面升级)        │   │
                     │  ┌──────────┐  └────────────────────────┘   │
                     │  │ Realtime │  ┌────────────────────────┐   │
                     │  │ - 评论    │  │ Storage                │   │
                     │  │ - 投稿    │  │  - 作品附件             │   │
                     │  └──────────┘  └────────────────────────┘   │
                     │                                             │
                     │  ┌──────────────────────────────────────┐   │
                     │  │ Edge Functions (可选)                 │   │
                     │  │  - 管理员批量操作                      │   │
                     │  │  - IP 限流                            │   │
                     │  └──────────────────────────────────────┘   │
                     └─────────────────────────────────────────────┘
```

---

## 2. 评论删除与权限体系

### 2.1 角色权限模型

```
┌─────────────────────────────────────────────────────────────────┐
│                        角色层级定义                               │
├──────────┬──────────┬───────────────────────────────────────────┤
│ Level 0  │ 匿名用户  │ 发表评论/投稿（附删除令牌）                 │
│          │          │ 删除自己的评论（令牌校验）                   │
│          │          │ 点赞/收藏                                 │
├──────────┼──────────┼───────────────────────────────────────────┤
│ Level 1  │ 注册用户  │ 匿名用户全部权限 +                         │
│          │          │ 删除自己的评论（身份校验）                   │
│          │          │ 编辑自己的评论（5分钟内）                    │
│          │          │ 自定义昵称/头像                             │
│          │          │ 创建收藏夹                                 │
├──────────┼──────────┼───────────────────────────────────────────┤
│ Level 2  │ 版主      │ 注册用户全部权限 +                         │
│          │          │ 隐藏/恢复任意评论                           │
│          │          │ 隐藏/恢复任意投稿                           │
│          │          │ 查看已隐藏内容                              │
│          │          │ 标记/移除标签                               │
├──────────┼──────────┼───────────────────────────────────────────┤
│ Level 3  │ 管理员    │ 版主全部权限 +                             │
│          │          │ 删除任意评论/投稿                           │
│          │          │ 批量管理（删除/隐藏/恢复）                   │
│          │          │ 封禁用户（禁止发言）                         │
│          │          │ 管理标签库                                 │
│          │          │ 查看操作日志                               │
└──────────┴──────────┴───────────────────────────────────────────┘
```

### 2.2 数据库 Schema 变更

```sql
-- ============================================================================
-- migration-006: 评论删除令牌 + 软删除 + 角色体系
-- ============================================================================

-- 2.2.1 comments 表新增字段
ALTER TABLE public.comments
    ADD COLUMN IF NOT EXISTS delete_token   VARCHAR(64),    -- 匿名用户删除令牌
    ADD COLUMN IF NOT EXISTS is_hidden      BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS hidden_by      UUID,            -- 操作者 ID
    ADD COLUMN IF NOT EXISTS hidden_reason  VARCHAR(200),    -- 隐藏原因
    ADD COLUMN IF NOT EXISTS hidden_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS edited_at      TIMESTAMPTZ;     -- 最后编辑时间

-- 索引：按令牌快速查找（仅未隐藏）
CREATE INDEX IF NOT EXISTS idx_comments_delete_token
    ON comments(delete_token) WHERE delete_token IS NOT NULL;

-- 索引：按隐藏状态筛选（管理员用）
CREATE INDEX IF NOT EXISTS idx_comments_hidden
    ON comments(is_hidden, created_at DESC) WHERE is_hidden = TRUE;

-- 2.2.2 submissions 表新增字段
ALTER TABLE public.submissions
    ADD COLUMN IF NOT EXISTS delete_token   VARCHAR(64),
    ADD COLUMN IF NOT EXISTS is_hidden      BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS hidden_by      UUID,
    ADD COLUMN IF NOT EXISTS hidden_reason  VARCHAR(200),
    ADD COLUMN IF NOT EXISTS hidden_at      TIMESTAMPTZ;

-- 2.2.3 角色表（使用 profiles 扩展）
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS role            VARCHAR(20) NOT NULL DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS is_banned       BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS banned_until    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ban_reason      VARCHAR(200);

-- 约束：角色枚举
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('user', 'moderator', 'admin'));

-- 2.2.4 操作日志表
CREATE TABLE IF NOT EXISTS public.moderation_logs (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action       VARCHAR(30) NOT NULL,     -- hide / restore / delete / ban / unban
    target_type  VARCHAR(20) NOT NULL,     -- comment / submission / user
    target_id    BIGINT,                   -- 目标记录 ID
    operator_id  UUID NOT NULL REFERENCES auth.users(id),
    operator_role VARCHAR(20) NOT NULL,
    reason       VARCHAR(200),
    metadata     JSONB DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_logs_target
    ON moderation_logs(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_logs_operator
    ON moderation_logs(operator_id, created_at DESC);
```

### 2.3 删除令牌机制（匿名用户）

```
┌─────────────── 评论发布流程 ───────────────┐
│                                             │
│  浏览器                                      │
│  ├── 生成 delete_token = uuidv4()           │
│  ├── 存入 localStorage['fxre_delete_tokens']│
│  │   = { [commentId]: token, ... }          │
│  ├── 评论内容 + delete_token → INSERT        │
│  │                                         │
│  Supabase                                    │
│  ├── INSERT INTO comments                   │
│  │   (target_id, content, author_name,      │
│  │    delete_token, author_id)              │
│  ├── RLS: WITH CHECK (auth.role() = 'auth') │
│  └── 返回 comment.id                         │
│                                             │
│  浏览器                                      │
│  └── 存储 { [returnedId]: token }           │
│                                              │
└──────────────────────────────────────────────┘

┌─────────────── 评论删除流程（匿名）──────────┐
│                                              │
│  浏览器                                       │
│  ├── 读取 localStorage['fxre_delete_tokens'] │
│  │   [commentId] → token                     │
│  ├── 调用 RPC: delete_comment_with_token(    │
│  │     p_comment_id, p_delete_token)         │
│  │                                          │
│  Supabase (RPC, SECURITY DEFINER)            │
│  ├── SELECT delete_token FROM comments       │
│  │   WHERE id = p_comment_id                 │
│  ├── IF delete_token = p_delete_token        │
│  │   AND is_hidden = FALSE                   │
│  │   THEN UPDATE comments                    │
│  │     SET is_hidden = TRUE,                 │
│  │         hidden_at = NOW(),                │
│  │         hidden_reason = '作者删除'         │
│  │   RETURN TRUE                             │
│  ├── ELSE RETURN FALSE                       │
│  └── 记录 moderation_logs                    │
│                                              │
│  浏览器                                       │
│  └── 从 localStorage 移除该令牌               │
│                                              │
└──────────────────────────────────────────────┘
```

```sql
-- 删除令牌校验 RPC
CREATE OR REPLACE FUNCTION public.delete_comment_with_token(
    p_comment_id   BIGINT,
    p_delete_token VARCHAR(64)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE comments
    SET is_hidden = TRUE,
        hidden_at = NOW(),
        hidden_reason = '作者删除（令牌）'
    WHERE id = p_comment_id
      AND delete_token = p_delete_token
      AND is_hidden = FALSE;

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_comment_with_token(BIGINT, VARCHAR)
    TO authenticated, anon;
```

### 2.4 注册用户删除（身份校验）

```sql
-- RLS 策略：注册用户删除自己的评论
DROP POLICY IF EXISTS "comments_owner_delete_v2" ON comments;
CREATE POLICY "comments_owner_delete_v2"
    ON comments FOR DELETE
    USING (
        auth.uid() = author_id
        AND is_hidden = FALSE
    );

-- 实际上"删除"是软删除（UPDATE is_hidden），需要 UPDATE 策略
DROP POLICY IF EXISTS "comments_owner_soft_delete" ON comments;
CREATE POLICY "comments_owner_soft_delete"
    ON comments FOR UPDATE
    USING (auth.uid() = author_id)
    WITH CHECK (
        auth.uid() = author_id
        AND is_hidden = FALSE
    );
```

### 2.5 管理员操作 RPC

```sql
-- 管理员/版主隐藏评论
CREATE OR REPLACE FUNCTION public.moderate_comment(
    p_comment_id BIGINT,
    p_action     VARCHAR(20),   -- hide / restore / delete
    p_reason     VARCHAR(200) DEFAULT ''
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_operator UUID := auth.uid();
    v_role     VARCHAR(20);
BEGIN
    -- 获取操作者角色
    SELECT role INTO v_role FROM profiles WHERE id = v_operator;

    IF v_role NOT IN ('moderator', 'admin') THEN
        RAISE EXCEPTION '权限不足：需要版主或管理员角色';
    END IF;

    IF p_action = 'hide' THEN
        UPDATE comments SET
            is_hidden = TRUE,
            hidden_by = v_operator,
            hidden_reason = p_reason,
            hidden_at = NOW()
        WHERE id = p_comment_id;

    ELSIF p_action = 'restore' THEN
        UPDATE comments SET
            is_hidden = FALSE,
            hidden_by = NULL,
            hidden_reason = NULL,
            hidden_at = NULL
        WHERE id = p_comment_id;

    ELSIF p_action = 'delete' THEN
        IF v_role != 'admin' THEN
            RAISE EXCEPTION '权限不足：仅管理员可永久删除';
        END IF;
        DELETE FROM comments WHERE id = p_comment_id;

    ELSE
        RAISE EXCEPTION '未知操作: %', p_action;
    END IF;

    -- 记录操作日志
    INSERT INTO moderation_logs (action, target_type, target_id, operator_id, operator_role, reason)
    VALUES (p_action, 'comment', p_comment_id, v_operator, v_role, p_reason);

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_comment(BIGINT, VARCHAR, VARCHAR)
    TO authenticated;

-- 批量隐藏评论（管理员）
CREATE OR REPLACE FUNCTION public.batch_moderate_comments(
    p_comment_ids BIGINT[],
    p_action      VARCHAR(20),
    p_reason      VARCHAR(200) DEFAULT ''
)
RETURNS TABLE(success BIGINT, failed BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_operator UUID := auth.uid();
    v_role     VARCHAR(20);
    v_id       BIGINT;
    v_success  BIGINT := 0;
    v_failed   BIGINT := 0;
BEGIN
    SELECT role INTO v_role FROM profiles WHERE id = v_operator;
    IF v_role != 'admin' THEN
        RAISE EXCEPTION '权限不足：仅管理员可批量操作';
    END IF;

    FOREACH v_id IN ARRAY p_comment_ids LOOP
        BEGIN
            PERFORM moderate_comment(v_id, p_action, p_reason);
            v_success := v_success + 1;
        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
        END;
    END LOOP;

    RETURN QUERY SELECT v_success, v_failed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.batch_moderate_comments(BIGINT[], VARCHAR, VARCHAR)
    TO authenticated;
```

### 2.6 RLS 策略全面升级

```sql
-- ============================================================================
-- 评论 RLS 升级：区分隐藏状态读取
-- ============================================================================

-- 公开读取：仅未隐藏评论（管理员/版主可读全部）
DROP POLICY IF EXISTS "comments_public_read_v2" ON comments;
CREATE POLICY "comments_public_read_v2"
    ON comments FOR SELECT
    USING (
        is_hidden = FALSE
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND role IN ('moderator', 'admin')
        )
    );

-- 匿名+认证用户均可发表（附带 delete_token）
DROP POLICY IF EXISTS "comments_insert_v2" ON comments;
CREATE POLICY "comments_insert_v2"
    ON comments FOR INSERT
    WITH CHECK (
        auth.role() IN ('authenticated', 'anon')
        AND content IS NOT NULL
    );

-- 投稿表同理
DROP POLICY IF EXISTS "submissions_public_read_v2" ON submissions;
CREATE POLICY "submissions_public_read_v2"
    ON submissions FOR SELECT
    USING (
        is_hidden = FALSE
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND role IN ('moderator', 'admin')
        )
    );
```

### 2.7 前端权限判定流程

```javascript
// js/auth-manager.js (新增模块)

var AuthManager = (function() {
    var session = {
        uid: null,
        role: 'anonymous',      // anonymous / user / moderator / admin
        isAnonymous: true,
        deleteTokens: {}         // { commentId: token }
    };

    function init() {
        // 从 localStorage 恢复删除令牌
        try {
            session.deleteTokens = JSON.parse(
                localStorage.getItem('fxre_delete_tokens') || '{}'
            );
        } catch(e) { session.deleteTokens = {}; }
    }

    function canDeleteComment(comment) {
        // 注册用户：作者是自己
        if (session.uid && comment.author_id === session.uid) return true;
        // 匿名用户：有删除令牌
        if (session.deleteTokens[comment.id]) return true;
        // 版主以上
        if (session.role === 'moderator' || session.role === 'admin') return true;
        return false;
    }

    function canHideComment() {
        return session.role === 'moderator' || session.role === 'admin';
    }

    function canDeletePermanently() {
        return session.role === 'admin';
    }

    function canBatchModerate() {
        return session.role === 'admin';
    }

    function getDeleteToken(commentId) {
        return session.deleteTokens[commentId] || null;
    }

    function storeDeleteToken(commentId, token) {
        session.deleteTokens[commentId] = token;
        localStorage.setItem('fxre_delete_tokens',
            JSON.stringify(session.deleteTokens));
    }

    function removeDeleteToken(commentId) {
        delete session.deleteTokens[commentId];
        localStorage.setItem('fxre_delete_tokens',
            JSON.stringify(session.deleteTokens));
    }

    return {
        init: init,
        session: session,
        canDeleteComment: canDeleteComment,
        canHideComment: canHideComment,
        canDeletePermanently: canDeletePermanently,
        canBatchModerate: canBatchModerate,
        getDeleteToken: getDeleteToken,
        storeDeleteToken: storeDeleteToken,
        removeDeleteToken: removeDeleteToken
    };
})();
```

---

## 3. 登录与认证方案

### 3.1 认证方式设计

```
┌─────────────────────────────────────────────────────────────┐
│                    认证方式矩阵                               │
├──────────────┬──────────────────┬───────────────────────────┤
│ 方式         │ 身份标识          │ 权限边界                   │
├──────────────┼──────────────────┼───────────────────────────┤
│ 匿名（默认）  │ Supabase 匿名    │ 发言/点赞/收藏             │
│              │ session JWT      │ 删除需令牌                 │
│              │                  │ 无跨设备身份               │
├──────────────┼──────────────────┼───────────────────────────┤
│ 邮箱注册     │ email + password │ 匿名全部 +                 │
│              │ Supabase Auth    │ 跨设备身份                 │
│              │                  │ 身份删除（无需令牌）         │
│              │                  │ 编辑评论                   │
│              │                  │ 创建收藏夹                 │
├──────────────┼──────────────────┼───────────────────────────┤
│ OAuth 第三方  │ GitHub / Google  │ 同邮箱注册                 │
│              │ Supabase Auth    │ + 无需记忆密码              │
├──────────────┼──────────────────┼───────────────────────────┤
│ 管理员       │ 邮箱注册 +        │ 注册用户全部 +             │
│              │ role = admin     │ 管理/版主权限               │
└──────────────┴──────────────────┴───────────────────────────┘
```

### 3.2 认证流程

```
                    ┌──────────────────┐
                    │   用户访问网站    │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ 检查本地 session  │
                    │ (localStorage)   │
                    └────────┬─────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
          有有效 session           无 session
                 │                       │
        ┌────────▼────────┐    ┌─────────▼─────────┐
        │ 恢复登录状态     │    │ 匿名登录           │
        │ (refresh token) │    │ supabase.auth     │
        │                 │    │ .signInAnonymously│
        └────────┬────────┘    └─────────┬─────────┘
                 │                       │
                 └───────────┬───────────┘
                             │
                    ┌────────▼─────────┐
                    │ 获取/创建 profile │
                    │ 读取 role 字段    │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  初始化完成       │
                    │  role = anonymous │
                    │  或 user/mod/admin│
                    └──────────────────┘
```

### 3.3 匿名→注册平滑过渡

```javascript
// 关键：Supabase 原生支持匿名用户升级
// 升级后 anonymous session 的 UID 不变，所有关联数据自动继承

async function upgradeAnonymousUser(email, password) {
    const { data, error } = await supabase.auth.updateUser({
        email: email,
        password: password
    });

    if (error) throw error;

    // UID 不变，comments/submissions 中的 author_id 自动关联
    // delete_token 仍然有效（向后兼容）
    // 但注册后可不再使用 token，改用身份校验删除

    return data;
}

// OAuth 升级（GitHub/Google）
async function linkOAuth(provider) {
    const { data, error } = await supabase.auth.linkIdentity({
        provider: provider  // 'github' or 'google'
    });

    if (error) throw error;
    return data;
}
```

### 3.4 会话管理策略

```
┌─────────────────────────────────────────────────────┐
│                  会话生命周期                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  访问网站                                            │
│    │                                                │
│    ├── supabase.auth.getSession()                   │
│    │   ├── 有 session → 验证 JWT 未过期              │
│    │   │   ├── 未过期 → 直接使用                     │
│    │   │   └── 已过期 → refreshToken 自动刷新        │
│    │   │       ├── 刷新成功 → 新 session             │
│    │   │       └── 刷新失败 → 重新匿名登录            │
│    │   └── 无 session → 匿名登录                     │
│    │                                                │
│    ├── onAuthStateChange 监听器                     │
│    │   ├── INITIAL_SESSION → 初始化完成              │
│    │   ├── SIGNED_IN → 更新 UI（注册用户状态）        │
│    │   ├── SIGNED_OUT → 重新匿名登录                 │
│    │   └── TOKEN_REFRESHED → 更新本地缓存            │
│    │                                                │
│    └── 安全措施                                      │
│        ├── JWT 过期时间: 1小时 (Supabase 默认)       │
│        ├── Refresh Token: 7天滚动过期                │
│        ├── HTTPS Only: 生产环境强制                  │
│        └── CSRF: Supabase 使用 Bearer Token,         │
│            不依赖 Cookie, 天然防 CSRF                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3.5 安全防护

| 威胁 | 防护措施 |
|------|----------|
| **重放攻击** | JWT 含 `iat`/`exp` 时间戳，过期即失效；Supabase 自动刷新 |
| **令牌伪造** | 删除令牌 = UUID v4（122 位熵），不可猜测；RLS 双重校验 |
| **会话劫持** | HTTPS 加密传输；Refresh Token 仅在服务端轮换 |
| **XSS** | 评论内容 `textContent` 渲染（非 innerHTML）；CSP 头部限制 |
| **暴力破解** | 登录接口 Supabase 内置速率限制（5次/分钟） |
| **权限提升** | `role` 字段仅能通过 service_role 修改（RLS 禁止用户自改） |

```sql
-- 防止用户自行修改角色
DROP POLICY IF EXISTS "profiles_owner_update_v2" ON profiles;
CREATE POLICY "profiles_owner_update_v2"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        -- 禁止修改 role / is_banned 字段
        AND role = (SELECT role FROM profiles WHERE id = auth.uid())
        AND is_banned = (SELECT is_banned FROM profiles WHERE id = auth.uid())
    );
```

---

## 4. 同步机制设计

### 4.1 当前问题分析

| 问题 | 原因 | 影响 |
|------|------|------|
| 同步按钮仅能上传自己的评论 | 设计初衷是"离线缓存→联网上传" | 看不到他人新评论 |
| Realtime 已配置但效果有限 | 仅订阅 comments 表 INSERT 事件 | 无 DELETE/UPDATE 同步 |
| 刷新页面才能看到新评论 | Realtime 断连后无重连/降级机制 | 体验割裂 |

### 4.2 方案对比

| 方案 | 实时性 | 复杂度 | 服务器成本 | 适合场景 |
|------|--------|--------|-----------|----------|
| **WebSocket (Realtime)** | ⭐⭐⭐ 即时 | 中（Supabase 内置） | 低（Free Tier 200 连接） | ✅ 本项目首选 |
| **SSE (Server-Sent Events)** | ⭐⭐⭐ 即时 | 高（需自建服务器） | 高 | ❌ 架构不符 |
| **短轮询 (Polling)** | ⭐ 延迟 5-30s | 低 | 中（频繁请求） | ✅ 降级备选 |
| **长轮询 (Long Polling)** | ⭐⭐ 接近实时 | 中 | 中 | ⚠️ 可选 |

### 4.3 推荐方案：Realtime 为主 + 轮询降级

```
┌─────────────────────────────────────────────────────────────┐
│                    同步架构设计                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Realtime Channel Manager                │    │
│  │                                                     │    │
│  │  Channel: public:comments                           │    │
│  │  ├── INSERT → 新评论 → 追加到评论列表                 │    │
│  │  ├── UPDATE → 编辑/隐藏 → 更新对应评论                │    │
│  │  └── DELETE → 删除 → 移除对应评论                     │    │
│  │                                                     │    │
│  │  Channel: public:submissions                        │    │
│  │  ├── INSERT → 新投稿 → 追加到社区列表                 │    │
│  │  └── UPDATE → likes 变化 → 更新点赞数                │    │
│  │                                                     │    │
│  │  连接状态管理:                                       │    │
│  │  ├── CONNECTED → 正常实时同步                        │    │
│  │  ├── DISCONNECTED → 启动轮询降级 (每 15s)            │    │
│  │  ├── RECONNECTING → 指数退避重连 (1s/2s/4s/8s/16s)  │    │
│  │  └── RECONNECTED → 停止轮询, 拉取增量更新             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              轮询降级机制 (Fallback)                  │    │
│  │                                                     │    │
│  │  每 15 秒:                                           │    │
│  │  ├── 查询 comments WHERE target_id = X               │    │
│  │  │   AND created_at > last_sync_time                 │    │
│  │  ├── 对比本地缓存，增量合并                           │    │
│  │  └── 更新 last_sync_time                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              同步按钮 → 侧边动态指示器                 │    │
│  │                                                     │    │
│  │  原"同步"按钮改为实时状态指示器:                      │    │
│  │  ├── 🟢 实时同步中 (Realtime connected)              │    │
│  │  ├── 🟡 降级轮询中 (Polling fallback)                │    │
│  │  ├── 🔴 已断开 (Offline)                             │    │
│  │  └── 点击 → 手动刷新（拉取全量增量）                   │    │
│  │                                                     │    │
│  │  位置: 页面右下角浮动, 悬停展开详情                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 前端实现

```javascript
// js/sync-manager.js (新增模块)

var SyncManager = (function() {

    var STATE = {
        REALTIME: 'realtime',     // 实时连接
        POLLING: 'polling',       // 轮询降级
        OFFLINE: 'offline',       // 离线
        RECONNECTING: 'reconnecting'
    };

    var state = STATE.OFFLINE;
    var reconnectAttempts = 0;
    var maxReconnect = 5;
    var pollInterval = null;
    var lastSyncTime = new Date(0).toISOString();
    var subscriptions = {};

    // ---- Realtime 订阅 ----

    function connectComments(targetId, onNewComment, onUpdateComment, onDeleteComment) {
        if (!window.supabaseClient) return;

        var channel = supabaseClient
            .channel('public:comments:' + targetId)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'comments',
                filter: 'target_id=eq.' + targetId
            }, function(payload) {
                onNewComment(payload.new);
                lastSyncTime = new Date().toISOString();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'comments',
                filter: 'target_id=eq.' + targetId
            }, function(payload) {
                onUpdateComment(payload.new, payload.old);
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'comments'
            }, function(payload) {
                onDeleteComment(payload.old);
            })
            .on('system', { event: 'disconnected' }, function() {
                setState(STATE.RECONNECTING);
                attemptReconnect();
            })
            .subscribe(function(status) {
                if (status === 'SUBSCRIBED') {
                    setState(STATE.REALTIME);
                    reconnectAttempts = 0;
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setState(STATE.POLLING);
                    startPolling(targetId, onNewComment);
                }
            });

        subscriptions[targetId] = channel;
    }

    // ---- 指数退避重连 ----

    function attemptReconnect() {
        if (reconnectAttempts >= maxReconnect) {
            setState(STATE.POLLING);
            return;
        }

        var delay = Math.pow(2, reconnectAttempts) * 1000; // 1s/2s/4s/8s/16s
        reconnectAttempts++;

        setTimeout(function() {
            Object.keys(subscriptions).forEach(function(key) {
                subscriptions[key].subscribe();
            });
        }, delay);
    }

    // ---- 轮询降级 ----

    function startPolling(targetId, onNewComment) {
        if (pollInterval) clearInterval(pollInterval);

        pollInterval = setInterval(function() {
            SupabaseAdapter.fetchComments(targetId, lastSyncTime).then(function(comments) {
                if (comments && comments.length > 0) {
                    comments.forEach(function(c) {
                        if (new Date(c.created_at) > new Date(lastSyncTime)) {
                            onNewComment(c);
                        }
                    });
                    lastSyncTime = new Date().toISOString();
                }
            }).catch(function(err) {
                console.warn('[SyncManager] Polling error:', err);
            });
        }, 15000); // 15秒
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    // ---- 状态管理 ----

    function setState(newState) {
        if (state === newState) return;
        state = newState;
        updateSyncIndicator(newState);
    }

    function updateSyncIndicator(s) {
        var indicator = document.getElementById('sync-indicator');
        if (!indicator) return;

        var config = {
            realtime:   { icon: '🟢', text: '实时同步', class: 'sync-live' },
            polling:    { icon: '🟡', text: '轮询同步', class: 'sync-poll' },
            offline:    { icon: '🔴', text: '已断开',   class: 'sync-off' },
            reconnecting:{ icon: '🔄', text: '重连中',   class: 'sync-conn' }
        };

        var c = config[s] || config.offline;
        indicator.className = 'sync-indicator ' + c.class;
        indicator.innerHTML = '<span class="sync-dot">' + c.icon + '</span><span class="sync-text">' + c.text + '</span>';
    }

    return {
        STATE: STATE,
        connectComments: connectComments,
        setState: setState,
        getState: function() { return state; },
        stopPolling: stopPolling
    };
})();
```

### 4.5 同步指示器 UI（侧边动态跟随式）

```css
/* 同步指示器 — 右下角浮动 */
.sync-indicator {
    position: fixed;
    right: 20px;
    bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 20px;
    background: rgba(20, 20, 35, 0.9);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 13px;
    z-index: 9999;
    cursor: pointer;
    transition: all 0.3s ease;
    opacity: 0.7;
}

.sync-indicator:hover {
    opacity: 1;
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.sync-live .sync-dot { animation: pulse-green 2s infinite; }
.sync-poll .sync-dot { animation: pulse-yellow 3s infinite; }
.sync-off  .sync-dot { animation: none; }
.sync-conn .sync-dot { animation: spin 1s linear infinite; }

@keyframes pulse-green {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}
@keyframes pulse-yellow {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
```

### 4.6 边界情况处理

| 场景 | 处理策略 |
|------|----------|
| Realtime 连接中断 | 自动降级轮询，指数退避重连 |
| 轮询期间恢复 Realtime | 停止轮询，拉取断连期间增量 |
| 同一条评论被多人同时编辑 | 以后到达者为准（last-write-wins），UI 提示"该评论已被编辑" |
| 评论被隐藏后仍在本地缓存 | Realtime UPDATE 事件触发，前端立即移除 |
| 离线发布评论 | 存入 localStorage 队列，联网后按序上传 |
| 重复消息（Realtime + 轮询） | 前端按 comment.id 去重 |

---

## 5. 评论频率与防刷控制

### 5.1 分层限流策略

```
┌──────────────────────────────────────────────────────────────┐
│                    三层限流架构                                 │
│                                                              │
│  Layer 1: 客户端 UI 限流（即时反馈）                           │
│  ├── 发送按钮点击后禁用 3 秒                                   │
│  ├── 输入框字数实时计数 (1-500)                               │
│  └── 连续相同内容检测（禁止 3 秒内重复发送）                    │
│                                                              │
│  Layer 2: Supabase RPC 限流（服务端硬限制）                    │
│  ├── check_rate_limit: 滑动窗口                               │
│  ├── check_daily_quota: 每日配额                              │
│  └── enforce_insert_limits: 触发器自动拦截                     │
│                                                              │
│  Layer 3: IP + 用户 ID 联合限流（Edge Function）               │
│  ├── 按 IP 限流: 防止多账号刷评                                │
│  ├── 按用户 ID 限流: 精确限制单用户                            │
│  └── 异常行为检测: 短时间大量请求 → 临时封禁                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 限流参数

| 用户类型 | 发送间隔 | 窗口上限 | 每日配额 | IP 每日上限 |
|----------|----------|----------|----------|-------------|
| 匿名用户 | 60 秒 | 5 条/60秒 | 20 条/天 | 50 条/天/IP |
| 注册用户 | 30 秒 | 10 条/30秒 | 50 条/天 | 100 条/天/IP |
| 版主/管理员 | 10 秒 | 20 条/10秒 | 不限 | 不限 |

### 5.3 数据库实现

```sql
-- ============================================================================
-- migration-007: 分层限流升级
-- ============================================================================

-- 5.3.1 扩展 rate_limits 表（新增 IP 字段）
ALTER TABLE public.rate_limits
    ADD COLUMN IF NOT EXISTS ip_address INET;

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip
    ON rate_limits(ip_address, action_type, created_at DESC);

-- 5.3.2 升级 check_rate_limit（区分用户类型）
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_user_id     UUID,
    p_action_type VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window_seconds INTEGER;
    v_max_actions   INTEGER;
    v_recent_count  INTEGER;
    v_daily_limit   INTEGER;
    v_role          VARCHAR(20);
BEGIN
    -- 获取用户角色决定限流参数
    SELECT role INTO v_role FROM profiles WHERE id = p_user_id;

    IF v_role IN ('moderator', 'admin') THEN
        v_window_seconds := 10;
        v_max_actions := 20;
        v_daily_limit := 999999;
    ELSIF v_role = 'user' THEN
        v_window_seconds := 30;
        v_max_actions := 10;
        v_daily_limit := 50;
    ELSE
        -- 匿名用户
        v_window_seconds := 60;
        v_max_actions := 5;
        v_daily_limit := 20;
    END IF;

    -- 滑动窗口计数
    SELECT COUNT(*) INTO v_recent_count
    FROM rate_limits
    WHERE user_id = p_user_id
      AND action_type = p_action_type
      AND created_at > NOW() - (v_window_seconds || ' seconds')::INTERVAL;

    IF v_recent_count >= v_max_actions THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', '操作过于频繁，请 ' || v_window_seconds || ' 秒后再试',
            'retry_after', v_window_seconds
        );
    END IF;

    RETURN jsonb_build_object('allowed', true);
END;
$$;

-- 5.3.3 IP 限流 RPC（通过 Edge Function 调用）
CREATE OR REPLACE FUNCTION public.check_ip_rate_limit(
    p_ip_address INET,
    p_action_type VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
    v_limit INTEGER := 50; -- IP 每日上限
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM rate_limits
    WHERE ip_address = p_ip_address
      AND action_type = p_action_type
      AND created_at > NOW() - '1 day'::INTERVAL;

    IF v_count >= v_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', '该 IP 今日操作已达上限',
            'retry_after', 86400
        );
    END IF;

    RETURN jsonb_build_object('allowed', true);
END;
$$;

-- 5.3.4 升级 enforce_insert_limits（记录 IP）
CREATE OR REPLACE FUNCTION public.enforce_insert_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid    UUID := COALESCE(auth.uid(), NULL);
    v_action VARCHAR;
    v_check  JSONB;
    v_quota  JSONB;
BEGIN
    IF TG_TABLE_NAME = 'comments' THEN
        v_action := 'comment';
    ELSIF TG_TABLE_NAME = 'submissions' THEN
        v_action := 'submission';
    ELSE
        RETURN NEW;
    END IF;

    -- 速率限制
    v_check := public.check_rate_limit(v_uid, v_action);
    IF NOT (v_check->>'allowed')::boolean THEN
        RAISE EXCEPTION '%', COALESCE(v_check->>'reason', '速率限制');
    END IF;

    -- 日配额
    v_quota := public.check_daily_quota(v_uid, TG_TABLE_NAME);
    IF NOT (v_quota->>'allowed')::boolean THEN
        RAISE EXCEPTION '%', COALESCE(v_quota->>'reason', '今日配额已满');
    END IF;

    -- 记录限流日志
    PERFORM public.record_rate_limit(v_uid, v_action);

    RETURN NEW;
END;
$$;
```

### 5.4 前端防刷

```javascript
// js/rate-limiter-client.js (增强现有模块)

var ClientRateLimiter = (function() {
    var lastCommentTime = 0;
    var lastCommentText = '';
    var COMMENT_COOLDOWN = 3000; // 3秒 UI 冷却

    function canSend(text) {
        var now = Date.now();

        // 冷却期检查
        if (now - lastCommentTime < COMMENT_COOLDOWN) {
            var wait = Math.ceil((COMMENT_COOLDOWN - (now - lastCommentTime)) / 1000);
            return { allowed: false, reason: '请等待 ' + wait + ' 秒后再发送' };
        }

        // 重复内容检查
        if (text === lastCommentText && (now - lastCommentTime) < 60000) {
            return { allowed: false, reason: '请勿重复发送相同内容' };
        }

        // 字数检查
        if (text.length < 1 || text.length > 500) {
            return { allowed: false, reason: '评论内容需在 1-500 字之间' };
        }

        return { allowed: true };
    }

    function recordSend(text) {
        lastCommentTime = Date.now();
        lastCommentText = text;
    }

    return {
        canSend: canSend,
        recordSend: recordSend
    };
})();
```

---

## 6. 作品收藏与分类优化

### 6.1 AO3 风格标签体系

```
┌──────────────────────────────────────────────────────────────┐
│                    标签分类模型 (AO3-inspired)                 │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ 角色标签     │  │ 类型标签      │  │ 自由标签             │ │
│  │ (character) │  │ (category)   │  │ (freeform)          │ │
│  ├─────────────┤  ├──────────────┤  ├─────────────────────┤ │
│  │ #爱弥斯      │  │ #文字        │  │ #温柔               │ │
│  │ #达妮娅      │  │ #故事        │  │ #日常               │ │
│  │ #西格莉卡    │  │ #诗歌        │  │ #虐心               │ │
│  │ #漂泊者      │  │ #插画        │  │ #异世界             │ │
│  │             │  │ #音乐        │  │ #结契人              │ │
│  └─────────────┘  └──────────────┘  └─────────────────────┘ │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐                          │
│  │ 分级标签     │  │ 警告标签      │                          │
│  │ (rating)    │  │ (warning)    │                          │
│  ├─────────────┤  ├──────────────┤                          │
│  │ #General    │  │ #无警告      │                          │
│  │ #Teen       │  │ #含剧透      │                          │
│  │             │  │              │                          │
│  └─────────────┘  └──────────────┘                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 数据库 Schema

```sql
-- ============================================================================
-- migration-008: 标签体系 + 收藏功能
-- ============================================================================

-- 6.2.1 标签表
CREATE TABLE IF NOT EXISTS public.tags (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    category    VARCHAR(20) NOT NULL CHECK (category IN
                ('character', 'category', 'rating', 'warning', 'freeform')),
    description VARCHAR(200) DEFAULT '',
    color       VARCHAR(20) DEFAULT '#6B8AFF',
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_by  UUID REFERENCES auth.users(id),
    is_official BOOLEAN NOT NULL DEFAULT FALSE,  -- 官方标签 vs 用户自建
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category, usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- 6.2.2 投稿-标签关联表（多对多）
CREATE TABLE IF NOT EXISTS public.submission_tags (
    submission_id BIGINT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    tag_id        BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (submission_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_submission_tags_tag
    ON submission_tags(tag_id, submission_id);

-- 6.2.3 书签收藏表
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    submission_id BIGINT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    collection_id BIGINT REFERENCES bookmark_collections(id) ON DELETE SET NULL,
    note          VARCHAR(500) DEFAULT '',     -- 个人笔记
    is_private    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, submission_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user
    ON bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_submission
    ON bookmarks(submission_id);

-- 6.2.4 收藏夹表（用户自建分类）
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

-- 6.2.5 标签使用计数触发器
CREATE OR REPLACE FUNCTION public.increment_tag_usage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    UPDATE tags SET usage_count = usage_count + 1
    WHERE id = NEW.tag_id;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_tag_usage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    UPDATE tags SET usage_count = GREATEST(usage_count - 1, 0)
    WHERE id = OLD.tag_id;
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_tag_inc AFTER INSERT ON submission_tags
    FOR EACH ROW EXECUTE FUNCTION increment_tag_usage();
CREATE TRIGGER trg_tag_dec AFTER DELETE ON submission_tags
    FOR EACH ROW EXECUTE FUNCTION decrement_tag_usage();

-- 6.2.6 RLS 策略
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_public_read" ON tags FOR SELECT USING (true);

ALTER TABLE submission_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_tags_public_read" ON submission_tags FOR SELECT USING (true);
CREATE POLICY "sub_tags_auth_insert" ON submission_tags FOR INSERT
    WITH CHECK (auth.uid() = (
        SELECT author_id FROM submissions WHERE id = submission_id
    ));

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookmarks_owner_all" ON bookmarks FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
-- 公开收藏夹的 bookmarks 可被他人查看
CREATE POLICY "bookmarks_public_read" ON bookmarks FOR SELECT
    USING (is_private = FALSE);

ALTER TABLE bookmark_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collections_owner_all" ON bookmark_collections FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "collections_public_read" ON bookmark_collections FOR SELECT
    USING (is_public = TRUE);
```

### 6.3 检索与筛选 API

```sql
-- 按标签筛选投稿（支持多标签交集）
CREATE OR REPLACE FUNCTION public.filter_submissions_by_tags(
    p_tag_names VARCHAR[] DEFAULT NULL,
    p_type      VARCHAR DEFAULT NULL,
    p_sort      VARCHAR DEFAULT 'new',  -- new / popular / bookmarked
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

GRANT EXECUTE ON FUNCTION filter_submissions_by_tags TO authenticated, anon;
```

---

## 7. 作品提交交互优化

### 7.1 拖拽上传 + 表单兼容方案

```
┌──────────────────────────────────────────────────────────────┐
│                    投稿提交界面                                │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  📝 标题: [________________________] (1-100字)       │    │
│  │  🏷️ 类型: [文字 ▼] [故事] [诗歌] [插画] [音乐]       │    │
│  │  📌 标签: [#爱弥斯] [#日常] [+ 添加标签]              │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                                                      │    │
│  │     ┌──────────────────────────────────────┐         │    │
│  │     │                                      │         │    │
│  │     │    📂 拖拽文件到此处                   │         │    │
│  │     │    或 [点击选择文件]                  │         │    │
│  │     │                                      │         │    │
│  │     │    支持: .txt .md .jpg .png .gif     │         │    │
│  │     │    限制: 文本 10MB / 图片 5MB         │         │    │
│  │     │                                      │         │    │
│  │     └──────────────────────────────────────┘         │    │
│  │                                                      │    │
│  │  ── 或直接输入内容 ──                                 │    │
│  │                                                      │    │
│  │  ┌──────────────────────────────────────────────┐    │    │
│  │  │                                              │    │    │
│  │  │  (文本编辑区)                                 │    │    │
│  │  │                                              │    │    │
│  │  │                                              │    │    │
│  │  └──────────────────────────────────────────────┘    │    │
│  │  字数: 1234 / 2000                                   │    │
│  │                                                      │    │
│  │  ┌──────────┐  ┌──────────┐                         │    │
│  │  │ 预览     │  │ 提交投稿  │                         │    │
│  │  └──────────┘  └──────────┘                         │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  上传进度 (拖拽上传时显示)                             │    │
│  │  ████████████████░░░░░░░  68%  文件名.jpg             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 前端实现

```javascript
// js/upload-manager.js (新增模块)

var UploadManager = (function() {

    var ALLOWED_TYPES = {
        'text/plain':     { ext: '.txt',  maxSize: 10 * 1024 * 1024, label: '文本' },
        'text/markdown':  { ext: '.md',   maxSize: 10 * 1024 * 1024, label: 'Markdown' },
        'image/jpeg':     { ext: '.jpg',  maxSize: 5 * 1024 * 1024,  label: '图片' },
        'image/png':      { ext: '.png',  maxSize: 5 * 1024 * 1024,  label: '图片' },
        'image/gif':      { ext: '.gif',  maxSize: 5 * 1024 * 1024,  label: '图片' }
    };

    var dropZone = null;
    var fileInput = null;
    var progressBar = null;

    function init(zoneId, inputId, progressId, onFileLoaded) {
        dropZone = document.getElementById(zoneId);
        fileInput = document.getElementById(inputId);
        progressBar = document.getElementById(progressId);

        if (!dropZone) return;

        // 拖拽事件
        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', function(e) {
            handleDrop(e, onFileLoaded);
        });

        // 点击触发文件选择
        dropZone.addEventListener('click', function() {
            fileInput.click();
        });

        // 文件选择
        fileInput.addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                processFile(e.target.files[0], onFileLoaded);
            }
        });
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-active');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-active');
    }

    function handleDrop(e, callback) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-active');

        var files = e.dataTransfer.files;
        if (files.length === 0) return;
        processFile(files[0], callback);
    }

    function processFile(file, callback) {
        // 文件类型校验
        var typeInfo = ALLOWED_TYPES[file.type];
        if (!typeInfo) {
            showError('不支持的文件类型: ' + file.type + '。支持 .txt .md .jpg .png .gif');
            return;
        }

        // 文件大小校验
        if (file.size > typeInfo.maxSize) {
            var maxMB = typeInfo.maxSize / (1024 * 1024);
            showError('文件过大: ' + (file.size / 1024 / 1024).toFixed(1) + 'MB。上限 ' + maxMB + 'MB');
            return;
        }

        // 读取文件内容
        showProgress(0);

        if (file.type.startsWith('image/')) {
            // 图片: 上传到 Supabase Storage
            uploadToStorage(file, callback);
        } else {
            // 文本: 读取内容
            readTextFile(file, callback);
        }
    }

    function readTextFile(file, callback) {
        var reader = new FileReader();
        reader.onprogress = function(e) {
            if (e.lengthComputable) {
                showProgress(Math.round((e.loaded / e.total) * 100));
            }
        };
        reader.onload = function(e) {
            showProgress(100);
            setTimeout(function() { hideProgress(); }, 1000);
            callback({
                type: 'text',
                filename: file.name,
                content: e.target.result
            });
        };
        reader.onerror = function() {
            showError('文件读取失败');
        };
        reader.readAsText(file, 'UTF-8');
    }

    function uploadToStorage(file, callback) {
        if (!window.supabaseClient) {
            showError('存储服务未连接，请使用文本输入');
            return;
        }

        var ext = ALLOWED_TYPES[file.type].ext;
        var fileName = 'submissions/' + Date.now() + '_' + Math.random().toString(36).slice(2) + ext;

        supabaseClient.storage
            .from('works')
            .upload(fileName, file, {
                onUploadProgress: function(e) {
                    showProgress(Math.round((e.loaded / e.total) * 100));
                }
            })
            .then(function(result) {
                if (result.error) {
                    showError('上传失败: ' + result.error.message);
                    return;
                }
                // 获取公开 URL
                var url = supabaseClient.storage
                    .from('works')
                    .getPublicUrl(fileName).data.publicUrl;

                hideProgress();
                callback({
                    type: 'image',
                    filename: file.name,
                    url: url,
                    storagePath: fileName
                });
            })
            .catch(function(err) {
                showError('上传失败: ' + err.message);
            });
    }

    function showProgress(percent) {
        if (!progressBar) return;
        progressBar.style.display = 'block';
        var fill = progressBar.querySelector('.progress-fill');
        if (fill) fill.style.width = percent + '%';
        var text = progressBar.querySelector('.progress-text');
        if (text) text.textContent = percent + '%';
    }

    function hideProgress() {
        if (progressBar) progressBar.style.display = 'none';
    }

    function showError(msg) {
        // 复用现有 Toast 系统
        if (window.showToast) {
            showToast(msg, 'error');
        } else {
            alert(msg);
        }
    }

    return { init: init };
})();
```

### 7.3 拖拽区域 CSS

```css
.upload-drop-zone {
    border: 2px dashed rgba(107, 138, 255, 0.3);
    border-radius: 12px;
    padding: 40px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background: rgba(107, 138, 255, 0.03);
}

.upload-drop-zone:hover {
    border-color: rgba(107, 138, 255, 0.6);
    background: rgba(107, 138, 255, 0.08);
}

.upload-drop-zone.drag-active {
    border-color: #6B8AFF;
    border-style: solid;
    background: rgba(107, 138, 255, 0.15);
    transform: scale(1.02);
}

.upload-progress {
    display: none;
    margin-top: 12px;
    height: 24px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.1);
    overflow: hidden;
    position: relative;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #6B8AFF, #A8D8FF);
    transition: width 0.3s ease;
    border-radius: 12px;
}

.progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 12px;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}
```

---

## 8. 数据库迁移设计

### 8.1 迁移文件清单

```
db/
├── migration-001-init.sql              ✅ 已执行
├── migration-002-rls-hardening.sql     ✅ 已执行
├── migration-003-fixes.sql             ✅ 已执行
├── migration-004-fix-search-path.sql   ✅ 已执行
├── migration-005-unlike-rpc.sql        ✅ 已执行
├── migration-006-comment-moderation.sql 🆕 评论删除令牌 + 软删除 + 角色体系
├── migration-007-rate-limit-v2.sql     🆕 分层限流升级
├── migration-008-tags-bookmarks.sql    🆕 标签体系 + 收藏功能
└── migration-009-storage-bucket.sql    🆕 Storage 存储桶配置
```

### 8.2 执行顺序

```
006 (评论删除+角色) → 007 (限流升级) → 008 (标签+收藏) → 009 (存储桶)
     ↑                    ↑                  ↑                  ↑
   必须先跑            依赖 006 的         依赖 submissions    独立
                       profiles.role      表已存在
```

### 8.3 Storage 桶配置 (migration-009)

```sql
-- 创建作品附件存储桶
INSERT INTO storage.buckets (id, name, public)
VALUES ('works', 'works', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: 认证用户可上传
CREATE POLICY "works_auth_upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'works');

-- 公开读取
CREATE POLICY "works_public_read" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'works');

-- 作者可删除自己的文件
CREATE POLICY "works_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'works' AND owner = auth.uid());
```

---

## 9. 边界情况与安全防护

### 9.1 完整边界情况矩阵

| 模块 | 场景 | 处理策略 | 优先级 |
|------|------|----------|--------|
| **评论删除** | 匿名用户清除浏览器缓存后丢失令牌 | 无法自行删除，可联系管理员 | P3 |
| **评论删除** | 令牌被他人获取（XSS/分享链接） | 令牌仅存 localStorage，不随 URL 传播 | P2 |
| **评论删除** | 注册用户删除评论后子评论孤立 | 软删除保留记录，显示"该评论已被删除" | P2 |
| **认证** | 匿名 session 过期（7天不活动） | 自动重新匿名登录，旧数据通过令牌关联 | P2 |
| **认证** | 升级为注册用户后旧匿名评论 | author_id 不变（Supabase 匿名升级机制），自动继承 | P1 |
| **认证** | 同一邮箱注册多个账号 | Supabase Auth 自动去重（email unique） | P3 |
| **同步** | Realtime 和轮询同时收到同一评论 | 前端按 comment.id 去重 | P1 |
| **同步** | 离线发布多条评论后联网 | 按时间戳排序上传，冲突时服务端时间权威 | P2 |
| **同步** | 页面切换后 Realtime 订阅泄露 | 切换页面时 unsubscribe 旧 channel | P1 |
| **限流** | 用户切换 IP 绕过 IP 限流 | 用户 ID 限流 + IP 限流双轨制 | P2 |
| **限流** | 匿名用户重新登录获取新 UID | IP 限流兜底；同 IP 日上限 50 条 | P2 |
| **收藏** | 投稿被删除后收藏记录 | ON DELETE CASCADE，收藏自动清除 | P3 |
| **收藏** | 收藏夹被删除后书签 | collection_id SET NULL，书签保留但移出收藏夹 | P3 |
| **上传** | 上传过程中网络中断 | FileReader 已读取的内容保留，Storage 上传失败提示重试 | P2 |
| **上传** | 恶意文件伪装扩展名 | 服务端 MIME type 校验 + 文件头魔数校验 | P1 |
| **安全** | 评论中注入 `<script>` | textContent 渲染（非 innerHTML） | P0 |
| **安全** | SQL 注入 | 全部使用 RPC + 参数化查询 | P0 |
| **安全** | 管理员口令暴力破解 | 前端 SHA-256 + 后端登录限流 (5次/分钟) | P1 |

### 9.2 XSS 防护强化

```javascript
// 所有用户输入必须通过此函数渲染
function sanitizeUserInput(text) {
    // 方案1: 纯文本渲染（推荐）
    var div = document.createElement('div');
    div.textContent = text;  // 自动转义 HTML
    return div.innerHTML;    // 返回转义后的 HTML
}

// 方案2: 如果需要支持有限 Markdown（加粗/斜体）
function renderSafeMarkdown(text) {
    // 1. 先转义所有 HTML
    var escaped = sanitizeUserInput(text);
    // 2. 仅允许 **bold** 和 *italic*
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // 3. 不允许任何其他 HTML 标签
    return escaped;
}
```

### 9.3 CSP 头部建议

```html
<!-- index.html <head> 中添加 -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'unsafe-inline' cdn.jsdelivr.net;
               style-src 'self' 'unsafe-inline' cdn.jsdelivr.net;
               img-src 'self' data: blob: https://*.supabase.co;
               connect-src 'self' https://*.supabase.co wss://*.supabase.co;
               font-src 'self' cdn.jsdelivr.net;">
```

---

## 10. 实施路线图

### 10.1 阶段划分

```
Phase 1 (v9.0) — 评论删除 + 认证基础
├── migration-006: 删除令牌 + 软删除 + 角色字段
├── AuthManager 模块
├── 匿名→注册升级 UI
├── 删除令牌前端管理
└── 管理员隐藏/恢复 UI

Phase 2 (v9.1) — 同步机制重构
├── SyncManager 模块（Realtime + 轮询降级）
├── 同步指示器 UI
├── Realtime 全事件订阅（INSERT/UPDATE/DELETE）
├── 指数退避重连
└── 移除旧同步按钮

Phase 3 (v9.2) — 限流升级 + 标签收藏
├── migration-007: 分层限流
├── migration-008: 标签 + 收藏
├── ClientRateLimiter 增强
├── 标签管理 UI（选择/创建/筛选）
├── 书签收藏 UI
└── 收藏夹管理 UI

Phase 4 (v9.3) — 上传优化 + 管理后台
├── migration-009: Storage 桶
├── UploadManager 拖拽上传
├── 管理后台面板（批量管理/操作日志）
├── CSP 头部配置
└── 全面测试
```

### 10.2 优先级排序

| 优先级 | 模块 | 理由 |
|--------|------|------|
| P0 | XSS 防护 + SQL 注入防护 | 安全基础，不能有任何疏漏 |
| P0 | 评论删除令牌 | 用户核心诉求 |
| P1 | 认证体系（匿名→注册） | 删除/收藏等功能的前提 |
| P1 | Realtime 全事件同步 | 用户体验核心 |
| P1 | 分层限流 | 防刷基础 |
| P2 | 标签体系 | 检索/分类能力 |
| P2 | 书签收藏 | 用户留存 |
| P2 | 拖拽上传 | 体验优化 |
| P3 | 管理后台面板 | 运营工具 |
| P3 | 收藏夹管理 | 高级功能 |

---

## 附录 A: 文件结构变更预览

```
js/
├── main.js                 (修改: 集成新模块)
├── repository.js           (修改: 支持新字段)
├── supabase-adapter.js     (修改: 新增 RPC 调用)
├── admin-auth.js           (保留: 管理员口令)
├── rate-limiter.js         (保留: 现有限流)
├── particles.js            (保留: 粒子背景)
├── auth-manager.js         (🆕 认证+权限管理)
├── sync-manager.js         (🆕 Realtime+轮询同步)
├── upload-manager.js       (🆕 拖拽上传)
└── rate-limiter-client.js  (🆕 客户端限流)

db/
├── migration-006-comment-moderation.sql  (🆕)
├── migration-007-rate-limit-v2.sql       (🆕)
├── migration-008-tags-bookmarks.sql      (🆕)
└── migration-009-storage-bucket.sql      (🆕)

css/
└── style.css               (修改: 新增组件样式)
```

## 附录 B: RLS 策略完整对照表

| 表 | 操作 | 匿名 | 注册用户 | 版主 | 管理员 |
|----|------|------|----------|------|--------|
| comments | SELECT (未隐藏) | ✅ | ✅ | ✅ | ✅ |
| comments | SELECT (已隐藏) | ❌ | ❌ | ✅ | ✅ |
| comments | INSERT | ✅ (带token) | ✅ | ✅ | ✅ |
| comments | UPDATE (自己) | ❌ (用RPC) | ✅ | ✅ | ✅ |
| comments | DELETE (自己) | ❌ (用RPC) | ✅ | ✅ | ✅ |
| comments | DELETE (他人) | ❌ | ❌ | ❌ | ✅ |
| comments | 隐藏/恢复 | ❌ | ❌ | ✅ (RPC) | ✅ (RPC) |
| submissions | SELECT (未隐藏) | ✅ | ✅ | ✅ | ✅ |
| submissions | INSERT | ✅ (带token) | ✅ | ✅ | ✅ |
| submissions | DELETE (自己) | ❌ (用RPC) | ✅ | ✅ | ✅ |
| submissions | 隐藏/恢复 | ❌ | ❌ | ✅ (RPC) | ✅ (RPC) |
| tags | SELECT | ✅ | ✅ | ✅ | ✅ |
| tags | INSERT | ❌ | ❌ | ❌ | ✅ |
| bookmarks | SELECT (自己的) | ❌ | ✅ | ✅ | ✅ |
| bookmarks | SELECT (公开的) | ✅ | ✅ | ✅ | ✅ |
| bookmarks | INSERT/UPDATE/DELETE | ❌ | ✅ (仅自己) | ✅ (仅自己) | ✅ (仅自己) |
| profiles | SELECT | ✅ | ✅ | ✅ | ✅ |
| profiles | UPDATE (自己) | ❌ | ✅ (除role/ban) | ✅ (除role/ban) | ✅ (除role/ban) |
| moderation_logs | SELECT | ❌ | ❌ | ✅ (自己操作) | ✅ (全部) |
| moderation_logs | INSERT | ❌ | ❌ | ✅ (via RPC) | ✅ (via RPC) |
