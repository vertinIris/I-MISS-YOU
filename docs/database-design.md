# 数据库设计

> **数据库**: PostgreSQL 15 (Supabase) | **版本**: v7.7

---

## 1. ER 关系图

```
┌─────────────────────┐       ┌──────────────────────────┐
│    auth.users        │       │     public.profiles      │
│    (Supabase内置)    │       │                          │
│                      │  1:1  │  id (FK → auth.users.id) │
│  id (UUID, PK)      │──────▶│  nickname VARCHAR(50)    │
│  email               │       │  avatar_color VARCHAR(20)│
│  created_at          │       │  created_at TIMESTAMPTZ  │
└──────────┬───────────┘       └──────────────────────────┘
           │
           │ 1:N
           ▼
┌──────────────────────────────────┐    ┌──────────────────────────────────┐
│       public.comments             │    │      public.submissions          │
│                                   │    │                                  │
│  id BIGINT (PK, auto)            │    │  id BIGINT (PK, auto)           │
│  target_id VARCHAR(50)  ◄─ 索引  │    │  type VARCHAR(20) CHECK         │
│  author_id UUID (FK, nullable)   │    │  title VARCHAR(100)             │
│  author_name VARCHAR(50)         │    │  content TEXT CHECK(≤2000)      │
│  author_color VARCHAR(20)        │    │  author_id UUID (FK, nullable)  │
│  content TEXT CHECK(≤500)        │    │  author_name VARCHAR(50)        │
│  created_at TIMESTAMPTZ  ◄─ 索引 │    │  author_color VARCHAR(20)       │
│                                   │    │  likes INTEGER DEFAULT 0        │
│  RLS: 全部可读, 认证可写          │    │  created_at TIMESTAMPTZ ◄─ 索引 │
│       作者10分钟内可删            │    │                                  │
│       管理员可删                   │    │  RLS: 全部可读, 认证可写         │
└──────────────────────────────────┘    └──────────────────────────────────┘

┌──────────────────────────────────┐
│      public.rate_limits           │
│      (migration-002 新增)         │
│                                   │
│  id BIGINT (PK, auto)            │
│  user_id UUID                    │
│  action VARCHAR(50)              │
│  created_at TIMESTAMPTZ ◄─ 索引  │
│                                   │
│  RLS: 仅本人可读写                │
│  TTL: 1天后自动清理               │
└──────────────────────────────────┘
```

---

## 2. 表结构详细定义

### 2.1 profiles — 用户资料

```sql
CREATE TABLE public.profiles (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname     VARCHAR(50) NOT NULL DEFAULT '匿名信号源',
    avatar_color VARCHAR(20) DEFAULT '#6B8AFF',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
-- (主键 id 自带索引，无需额外)

-- RLS 策略
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON profiles
    FOR SELECT USING (true);                    -- 所有人可读
CREATE POLICY "profiles_owner_write" ON profiles
    FOR UPDATE USING (auth.uid() = id);         -- 仅本人可改
```

### 2.2 comments — 评论

```sql
CREATE TABLE public.comments (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    target_id    VARCHAR(50) NOT NULL,           -- 对应哪个动态/日志（如 'post_1'）
    author_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name  VARCHAR(50) NOT NULL DEFAULT '匿名',
    author_color VARCHAR(20) DEFAULT '#6B8AFF',
    content      TEXT NOT NULL CHECK (char_length(content) <= 500),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_comments_target ON comments(target_id, created_at DESC);

-- RLS 策略
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 所有人可读
CREATE POLICY "comments_public_read" ON comments
    FOR SELECT USING (true);

-- 认证用户可插入（migration-002 加强：内容长度校验）
CREATE POLICY "comments_auth_insert" ON comments
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        AND char_length(content) >= 2
        AND char_length(content) <= 500
        AND char_length(author_name) >= 1
        AND char_length(author_name) <= 50
    );

-- 作者10分钟内可删除（migration-002 新增）
CREATE POLICY "comments_owner_delete" ON comments
    FOR DELETE USING (
        author_id = auth.uid()
        AND created_at > NOW() - INTERVAL '10 minutes'
    );

-- 实时订阅
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
```

### 2.3 submissions — 投稿

```sql
CREATE TABLE public.submissions (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type         VARCHAR(20) NOT NULL CHECK (type IN ('文字','故事','诗歌','插画','音乐')),
    title        VARCHAR(100) NOT NULL,
    content      TEXT NOT NULL CHECK (char_length(content) <= 2000),
    author_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name  VARCHAR(50) NOT NULL DEFAULT '匿名',
    author_color VARCHAR(20) DEFAULT '#6B8AFF',
    likes        INTEGER DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_submissions_type ON submissions(type, created_at DESC);
CREATE INDEX idx_submissions_time ON submissions(created_at DESC);

-- RLS 策略
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submissions_public_read" ON submissions
    FOR SELECT USING (true);

CREATE POLICY "submissions_auth_insert" ON submissions
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        AND char_length(content) >= 2
        AND char_length(content) <= 2000
        AND char_length(title) >= 1
        AND char_length(title) <= 100
    );

-- 实时订阅
ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
```

### 2.4 rate_limits — 速率限制（migration-002 新增）

```sql
CREATE TABLE public.rate_limits (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    UUID NOT NULL,
    action     VARCHAR(50) NOT NULL,             -- 'comment' | 'submission'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_user_action_time
    ON rate_limits(user_id, action, created_at DESC);

-- RLS: 仅本人可读写
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limits_owner_all" ON rate_limits
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

---

## 3. 服务器端安全函数（migration-002）

### 3.1 check_rate_limit() — 速率检查

```sql
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_user_id UUID,
    p_action VARCHAR(50,
    p_max_count INTEGER,
    p_window_seconds INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    actual_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO actual_count
    FROM public.rate_limits
    WHERE user_id = p_user_id
      AND action = p_action
      AND created_at > NOW() - (p_window_seconds || ' seconds')::INTERVAL;

    RETURN actual_count < p_max_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**调用规则**:
- 评论: 5次/分钟 (max_count=5, window=60)
- 投稿: 3次/5分钟 (max_count=3, window=300)

### 3.2 check_daily_quota() — 每日配额

```sql
CREATE OR REPLACE FUNCTION public.check_daily_quota(
    p_user_id UUID,
    p_action VARCHAR(50),
    p_max_daily INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    daily_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO daily_count
    FROM public.rate_limits
    WHERE user_id = p_user_id
      AND action = p_action
      AND created_at > CURRENT_DATE;

    RETURN daily_count < p_max_daily;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**配额**:
- 评论: 50条/天
- 投稿: 10篇/天

### 3.3 moderate_content() — 敏感词触发器

```sql
CREATE OR REPLACE FUNCTION public.moderate_content()
RETURNS TRIGGER AS $$
BEGIN
    -- 检查敏感词列表（可在数组中扩展）
    IF NEW.content ~* '(spam|广告|http://|https://)' THEN
        RAISE EXCEPTION '内容包含不允许的关键词';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_moderate_comments
    BEFORE INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.moderate_content();

CREATE TRIGGER trigger_moderate_submissions
    BEFORE INSERT ON public.submissions
    FOR EACH ROW EXECUTE FUNCTION public.moderate_content();
```

### 3.4 cleanup_rate_limits() — 清理函数

```sql
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.rate_limits WHERE created_at < NOW() - INTERVAL '1 day';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 4. 种子数据

### 4.1 预置评论（9个目标 × 3-4条 = ~32条）

| target_id | 来源角色 | 头像颜色 |
|-----------|----------|----------|
| post_1 ~ post_6 | 诺娃 / 埃拉拉 / 塞莱斯特 / 漂泊者信使 / 洛瑟菈校长 / 匿名信号源 / 调频9072 | #FF6B9D / #6B8AFF / #B66BFF / #FFD700 / #A8D8FF / #FFB6D9 / #00CED1 |

种子机制：`SEED_VERSION` 常量控制，首次访问时写入，后续不覆盖。

### 4.2 预置投稿（6篇）

| 作者 | 类型 | 标题 |
|------|------|------|
| 诺娃 | 诗歌 | 星炬下的独白 |
| 埃拉拉 | 故事 | 拉贝尔学部的日常 |
| 调频9072 | 文字 | 信号中断记录 |
| 塞莱斯特 | 插画 | 雪原速写 |
| 学院路人C | 音乐 | 电子海的回响 |
| 漂泊者信使 | 文字 | 给她的信 |

---

## 5. 迁移执行顺序

```
步骤 1: 执行 db/migration-001-init.sql
        → 创建 profiles, comments, submissions 表
        → 设置 RLS 策略
        → 添加 Realtime 订阅

步骤 2: 执行 db/migration-002-rls-hardening.sql
        → 创建 rate_limits 表
        → 添加 check_rate_limit / check_daily_quota 函数
        → 添加 moderate_content 触发器
        → 强化 comments INSERT 策略（内容长度校验）
        → 添加 comments DELETE 策略（作者10分钟内可删）
        → 添加 cleanup_rate_limits 清理函数
        → 确认 Realtime 发布

注意: 两个脚本都是幂等的（DROP IF EXISTS / CREATE OR REPLACE），
      重复执行不会报错，不会覆盖已有数据。
```

---

## 6. 数据导出与备份

```bash
# 通过 Supabase CLI 导出（需要安装 supabase CLI）
supabase db dump --data-only > backup_data.sql

# 通过 pg_dump 导出（需要数据库直连密码）
pg_dump "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres" \
    --data-only --no-owner > backup.sql

# 通过 Supabase Dashboard 导出
# Dashboard → Database → Backups → Download
```
