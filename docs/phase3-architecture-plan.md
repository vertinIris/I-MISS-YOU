# 飞行雪绒 Phase 3 — 网上同步架构规划（修正版）

> **版本**: v1.0 | **日期**: 2026-07-02 | **作者**: 后端架构师（磐石）

---

## 一、核心设计原则

1. **零运维优先** — 低成本方案不应需要管理服务器、配置数据库、打补丁
2. **标准数据出口** — 任何方案的数据必须能导出为标准格式，确保不被厂商锁定
3. **Repository 抽象层** — 前端只调用抽象接口，切换后端无需改业务代码
4. **渐进式上线** — 先本地验证，再云端同步，最后多用户。每步可独立回滚

---

## 二、低成本方案：Supabase Free Tier

### 为什么选 Supabase？

| 对比维度 | Supabase | LeanCloud | 腾讯云 CloudBase | 自建 Node.js |
|---------|----------|-----------|-----------------|-------------|
| 月费 | **¥0** | ¥0（限量） | ¥0（体验版） | ¥50+（云服务器） |
| 数据库 | PostgreSQL 500MB | 专用KV存储 | 文档数据库 | 自行安装维护 |
| 认证系统 | 内置（50k MAU） | 内置 | 内置 | 自行实现 |
| 数据出口 | **pg_dump 标准SQL** | 专用格式需转换 | JSON 导出 | 天然可控 |
| JS SDK | `@supabase/supabase-js` | `leancloud-storage` | `@cloudbase/js-sdk` | 手写 fetch |
| 实时订阅 | 内置 WebSocket | 需 LiveQuery | 需额外配置 | 需手写 Socket.io |
| 国内访问 | 需确认（新加坡节点可用） | ✅ 国内优化 | ✅ 国内节点 | ✅ |
| 学习曲线 | 低（SQL + JS SDK） | 中（自有查询语法） | 中（小程序生态绑定） | **高** |

> **推荐 Supabase**：标准 PostgreSQL 意味着数据迁移零成本；JS SDK 只需在前端 `<script>` 标签引入即可；Row Level Security 让安全规则写在数据库层，无需中间层 API 服务器。

### 架构总览

```
┌─────────────────────────────────────────────────┐
│                    浏览器                         │
│  ┌─────────────────────────────────────────────┐ │
│  │  main.js                                    │ │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐  │ │
│  │  │UserAPI   │ │SyncAPI   │ │ArchiveAPI  │  │ │
│  │  │(Supabase │ │(Supabase │ │(local JSON │  │ │
│  │  │ Auth)    │ │ REST)    │ │export)     │  │ │
│  │  └────┬─────┘ └────┬─────┘ └────────────┘  │ │
│  │       │            │                        │ │
│  │  ┌────┴────────────┴──────────────────────┐ │ │
│  │  │  DataRepository (抽象层)               │ │ │
│  │  │  - getComments(targetId)               │ │ │
│  │  │  - addComment(targetId, comment)       │ │ │
│  │  │  - getSubmissions()                    │ │ │
│  │  │  - addSubmission(sub)                  │ │ │
│  │  └────────────┬───────────────────────────┘ │ │
│  │               │                             │ │
│  │  ┌────────────┴───────────────────────────┐ │ │
│  │  │  localStorage 适配器 (Phase 2 fallback)│ │ │
│  │  │  + Supabase 适配器 (Phase 3 新增)      │ │ │
│  │  └────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS (Supabase JS SDK)
                       ▼
┌──────────────────────────────────────────────────┐
│              Supabase Cloud                       │
│  ┌────────────────┐  ┌─────────────────────────┐ │
│  │  Auth (GoTrue)  │  │  PostgreSQL (PostgREST) │ │
│  │  - 匿名登录     │  │  - comments 表          │ │
│  │  - 邮箱/密码    │  │  - submissions 表       │ │
│  │  - Row Level    │  │  - users 表             │ │
│  │    Security     │  │  - 标准 SQL 可导出      │ │
│  └────────────────┘  └────────┬────────────────┘ │
│                               │                   │
│  ┌────────────────────────────┴─────────────────┐ │
│  │  Realtime (WebSocket)                        │ │
│  │  - 新评论实时推送                             │ │
│  │  - 新投稿实时推送                             │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### 数据模型设计

```sql
-- ============================================
-- 表 1: 用户信息（最小化设计）
-- ============================================
CREATE TABLE public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname    VARCHAR(50) NOT NULL DEFAULT '匿名信号源',
    avatar_color VARCHAR(20) DEFAULT '#6B8AFF',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: 所有人可读，仅本人可改
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read"  ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_owner_write"  ON profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- 表 2: 评论
-- ============================================
CREATE TABLE public.comments (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    target_id   VARCHAR(50) NOT NULL,          -- 对应哪个动态/日志（如 'post_1'）
    author_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name VARCHAR(50) NOT NULL DEFAULT '匿名',
    author_color VARCHAR(20) DEFAULT '#6B8AFF',
    content     TEXT NOT NULL CHECK (char_length(content) <= 500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_target ON comments(target_id, created_at DESC);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_public_read"   ON comments FOR SELECT USING (true);
CREATE POLICY "comments_auth_insert"   ON comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 实时订阅：监听新评论
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- ============================================
-- 表 3: 投稿
-- ============================================
CREATE TABLE public.submissions (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type        VARCHAR(20) NOT NULL CHECK (type IN ('文字','故事','诗歌','插画','音乐')),
    title       VARCHAR(100) NOT NULL,
    content     TEXT NOT NULL CHECK (char_length(content) <= 2000),
    author_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name VARCHAR(50) NOT NULL DEFAULT '匿名',
    author_color VARCHAR(20) DEFAULT '#6B8AFF',
    likes       INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submissions_type ON submissions(type, created_at DESC);
CREATE INDEX idx_submissions_time ON submissions(created_at DESC);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submissions_public_read" ON submissions FOR SELECT USING (true);
CREATE POLICY "submissions_auth_insert" ON submissions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
```

### 前端集成方式

只需添加一个 `<script>` 标签，约 150 行代码即可完成对接：

```javascript
// === Supabase 适配器 ===
// 初始化（API Key 是公开的，RLS 在数据库层控制权限）
const supabase = window.supabase.createClient(
    'https://xxxxx.supabase.co',   // 项目 URL
    'eyJhbG...'                     // 匿名公钥（可公开）
);

// 匿名登录（零门槛，无需注册）
async function ensureAnonymousUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        await supabase.auth.signInAnonymously();
    }
}

// 获取评论（替换 localStorage.getItem）
async function cloud_getComments(targetId) {
    const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('target_id', targetId)
        .order('created_at', { ascending: true });
    return error ? [] : data;
}

// 发表评论（替换 localStorage.setItem）
async function cloud_addComment(targetId, comment) {
    const { error } = await supabase
        .from('comments')
        .insert({
            target_id: targetId,
            author_name: comment.author,
            author_color: comment.color,
            content: comment.text
        });
    return !error;
}

// 实时监听新评论（新增能力）
function onNewComment(targetId, callback) {
    supabase
        .channel('comments:' + targetId)
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'comments',
              filter: `target_id=eq.${targetId}` },
            (payload) => callback(payload.new)
        )
        .subscribe();
}
```

### 双写策略（避免数据丢失）

```javascript
// 发表评论时，同时写 localStorage 和云端
async function addComment(targetId, comment) {
    // 1. 先写本地（同步，不会丢）
    localComments.push(comment);
    saveToLocalStorage(targetId, localComments);

    // 2. 再写云端（异步，失败也没关系）
    try {
        await cloud_addComment(targetId, comment);
    } catch(e) {
        pendingSyncQueue.push({ action: 'addComment', targetId, comment });
    }
}
```

---

## 三、升级路径（平滑迁移方案）

升级的核心保障是 **PostgreSQL 标准协议**——所有方案的下层都是 PG 或其兼容实现，数据迁移只需 `pg_dump` / `pg_restore`。

```
           Phase 3A（当前目标）           Phase 3B              Phase 3C
        ┌─────────────────────┐   ┌──────────────────┐   ┌────────────────┐
        │  Supabase Free Tier │──▶│  Supabase Pro     │──▶│  自托管方案     │
        │  ¥0/月              │   │  $25/月           │   │  ¥100-300/月   │
        │                     │   │                   │   │                │
        │  • 500MB PostgreSQL │   │  • 8GB PostgreSQL │   │  • 无容量限制   │
        │  • 50k MAU 认证     │   │  • 每日自动备份    │   │  • 完整控制权   │
        │  • 1GB 文件存储     │   │  • 无项目休眠      │   │  • 自定义域名   │
        │  • 2 个项目         │   │  • 7 天日志保留    │   │  • 私有部署     │
        │  • 可能被休眠(1周)  │   │                   │   │                │
        └─────────┬───────────┘   └────────┬──────────┘   └───────┬────────┘
                  │                        │                       │
                  └────────── 数据库导出 ──────────┴───────────────┘
                        pg_dump → .sql → pg_restore（零损失）
```

### 升级触发条件（何时升到下一级）

| 触发条件 | 当前方案 | 应升级至 |
|---------|---------|---------|
| 项目超过 1 周未访问被休眠 | Free Tier | Pro ($25/月) |
| 数据库接近 500MB | Free Tier | Pro ($25/月) |
| 需要自定义域名 | Free Tier | Pro ($25/月) |
| 需要私有化部署 / 国内低延迟 | Pro | 自托管 |
| 月活超过 50k | Pro | 自托管 |

### 自托管方案（Phase 3C 备选）

当 Supabase 云服务成本超过 ¥200/月时，可以用 Docker Compose 一键迁移：

```yaml
# docker-compose.yml（自托管 Supabase）
# 与云端完全兼容，pg_dump 直接恢复

services:
  db:
    image: supabase/postgres:15.6.1.143
    # ... 标准 PostgreSQL，完全兼容云端导出

  rest:
    image: postgrest/postgrest:v12.2
    # ... REST API，与云端相同接口

  auth:
    image: supabase/gotrue:v2.158.1
    # ... 认证服务，与云端相同接口

  studio:
    image: supabase/studio:2025.02.10
    # ... 管理面板

# 前端只需改两行：
# const URL = 'https://xxxxx.supabase.co'  →  'https://api.mydomain.com'
# const KEY = 'eyJhbG...'                   →  '自托管 anon key'
```

### Repository 抽象层（保证切换无痛）

```javascript
// 前端只依赖这个抽象接口，不直接调 Supabase

var DataRepository = {
    provider: 'localStorage',  // 'localStorage' | 'supabase' | 'selfhost'

    // 所有业务代码只调用这些方法
    getComments: function(targetId) {
        if (this.provider === 'supabase') return cloud_getComments(targetId);
        return local_getComments(targetId);
    },

    addComment: function(targetId, comment) {
        if (this.provider === 'supabase') return cloud_addComment(targetId, comment);
        return local_addComment(targetId, comment);
    },

    // 切换后端只需改一行
    switchTo: function(provider) {
        this.provider = provider;
        localStorage.setItem('fxre_data_provider', provider);
    }
};

// 切换示例：
// DataRepository.switchTo('supabase');  ← 从 localStorage 切到云端
// DataRepository.switchTo('localStorage'); ← 降级回本地
```

---

## 四、成本对比

| 方案 | 首年总成本 | 月活上限 | 数据容量 | 维护工作量 |
|------|-----------|---------|---------|-----------|
| **Supabase Free** | **¥0** | 50k | 500MB | 0 小时/月 |
| Supabase Pro | ¥2,143 | 100k | 8GB | 0.5 小时/月 |
| 自托管 Docker | ¥1,200-3,600 | 无限制 | 取决于服务器 | 2-4 小时/月 |
| 腾讯云 CloudBase | ¥0→¥277/月 | 按量 | 2GB | 0.5 小时/月 |
| 自建 Node.js + PG | ¥600+/年 | 无限制 | 无限制 | 10+ 小时/月 |

---

## 五、实施路线图

```
Week 1                     Week 2                  Week 3-4
┌────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ 1. 注册 Supabase │───▶│ 3. 实现 Repository│───▶│ 6. 多设备测试     │
│    创建项目       │    │    抽象层          │    │    数据一致性验证  │
│                  │    │                    │    │                  │
│ 2. 建表+RLS策略  │    │ 4. 实现双写策略     │    │ 7. 实时评论推送   │
│    (执行SQL)     │    │    (本地+云端)      │    │    (可选)        │
│                  │    │                    │    │                  │
│                  │    │ 5. 匿名认证接入     │    │ 8. 上线+监控      │
│                  │    │    (零注册门槛)     │    │                  │
└────────────────┘    └─────────────────┘    └──────────────────┘
```

---

## 六、风险与对策

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| Supabase 国内访问不稳定 | 中 | 高 | 备用 LeanCloud 适配器，Repository 层一键切换 |
| Free Tier 项目被休眠 | 低 | 中 | 设置 cron 定时心跳（如 UptimeRobot） |
| 免费额度耗尽（500MB） | 极低 | 低 | 这个项目数据量很难达到 500MB |
| 用户拒绝注册导致互动少 | 中 | 中 | **匿名登录**——首次访问自动创建匿名会话，零门槛 |

---

## 七、总结

- **主方案**: Supabase Free Tier — ¥0/月，标准 PostgreSQL，零运维
- **核心保障**: Repository 抽象层 + pg_dump 标准导出 → 随时可迁移
- **升级路径**: Free → Pro（一键）→ 自托管 Docker（pg_dump 恢复）
- **前端改动量**: 约 200 行 JS 代码，`index.html` 新增一个 `<script>` 标签
