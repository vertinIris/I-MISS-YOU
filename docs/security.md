# 安全措施全景

> **版本**: v7.7 | **原则**: 纵深防御（Defense in Depth）

---

## 1. 安全架构总览

```
┌─────────────────────────────────────────────────────┐
│                    用户浏览器                         │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  第一层：前端输入校验                            │  │
│  │  - 昵称 ≤ 20 字符                              │  │
│  │  - 评论内容 2-500 字符                          │  │
│  │  - 投稿标题 ≤ 100 字符                          │  │
│  │  - 投稿内容 ≤ 2000 字符                         │  │
│  │  - escapeHTML() 全字符转义                      │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  第二层：前端速率限制 (rate-limiter.js)        │  │
│  │  - 评论: 3次/60秒                              │  │
│  │  - 投稿: 2次/300秒                             │  │
│  │  - localStorage 持久化 + 内存回退              │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  第三层：管理员认证 (admin-auth.js)            │  │
│  │  - SHA-256 口令哈希验证                        │  │
│  │  - localStorage 状态持久化                     │  │
│  │  - 双击页脚触发隐藏入口                         │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────┐
│                 Supabase Cloud                       │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  第四层：RLS 行级安全 (PostgreSQL)              │  │
│  │  - comments: 全部可读, 认证可写, 作者可删       │  │
│  │  - submissions: 全部可读, 认证可写              │  │
│  │  - rate_limits: 仅本人可读写                    │  │
│  │  - INSERT 内容长度校验 (CHECK约束)              │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  第五层：服务器端速率限制 (migration-002)       │  │
│  │  - check_rate_limit(): 评论5次/分, 投稿3次/5分  │  │
│  │  - check_daily_quota(): 评论50条/天, 投稿10篇/天│  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  第六层：内容审核 (migration-002)               │  │
│  │  - moderate_content() 触发器                    │  │
│  │  - 敏感词过滤 (spam/广告/URL)                   │  │
│  │  - INSERT 前自动审查                            │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  第七层：匿名认证 (GoTrue)                     │  │
│  │  - 匿名登录 + JWT 令牌                          │  │
│  │  - 所有写操作需要 authenticated 角色            │  │
│  │  - author_id 自动绑定 auth.uid()                │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 2. XSS 防护

### 2.1 escapeHTML 函数

```javascript
// main.js — 全字符转义，防止 XSS
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}
```

### 2.2 使用规范

- 所有用户输入（昵称、评论、投稿标题/内容）渲染前必须经过 `escapeHTML()`
- `innerHTML` 赋值时，动态部分必须 escape
- 例外：预置种子数据（代码中硬编码）可直接使用

### 2.3 评论关键词 Toast 响应

```javascript
// 关键词匹配后的 Toast 回应也使用 escapeHTML
var keywords = {
    '爱弥斯': '爱弥斯正在信号另一端倾听～',
    '漂泊者': '漂泊者...你也在看这片星空吗？',
    '雪花': '❄️ 雪花落下的频率，你听到了吗？',
    // ...
};
// 用户输入的评论内容在匹配前已 escape，关键词匹配使用原始值
```

---

## 3. 速率限制

### 3.1 前端速率限制（rate-limiter.js）

```javascript
var RateLimiter = {
    // 评论限制: 3次/60秒
    commentLimit: 3,
    commentWindowMs: 60 * 1000,

    // 投稿限制: 2次/5分钟
    submissionLimit: 2,
    submissionWindowMs: 5 * 60 * 1000,

    // localStorage 持久化（跨刷新有效）
    // 内存回退存储（隐私模式/localStorage不可用时）
};
```

### 3.2 后端速率限制（migration-002）

| 操作 | 前端限制 | 后端限制 | 每日配额 |
|------|----------|----------|----------|
| 评论 | 3次/60秒 | 5次/60秒 | 50条/天 |
| 投稿 | 2次/300秒 | 3次/300秒 | 10篇/天 |

> **设计原则**: 前端限制比后端更严格。前端是第一道防线（减少无效请求），后端是最终保障（防止绕过前端）。

### 3.3 超限行为

```
前端超限:
  → Toast 提示 "操作过于频繁，请X秒后再试"
  → 不发送请求到后端

后端超限:
  → RLS INSERT 策略拒绝 (check_rate_limit 返回 false)
  → 前端收到错误，Toast 提示
  → 记录到 rate_limits 表
```

---

## 4. RLS 行级安全策略

### 4.1 comments 表

```sql
-- 所有人可读（包括未认证用户）
CREATE POLICY "comments_public_read" ON comments
    FOR SELECT USING (true);

-- 认证用户可插入（内容长度校验）
CREATE POLICY "comments_auth_insert" ON comments
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        AND char_length(content) >= 2
        AND char_length(content) <= 500
        AND char_length(author_name) >= 1
        AND char_length(author_name) <= 50
    );

-- 作者10分钟内可删除自己的评论
CREATE POLICY "comments_owner_delete" ON comments
    FOR DELETE USING (
        author_id = auth.uid()
        AND created_at > NOW() - INTERVAL '10 minutes'
    );
```

### 4.2 submissions 表

```sql
-- 所有人可读
CREATE POLICY "submissions_public_read" ON submissions
    FOR SELECT USING (true);

-- 认证用户可插入（内容长度校验）
CREATE POLICY "submissions_auth_insert" ON submissions
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        AND char_length(content) >= 2
        AND char_length(content) <= 2000
        AND char_length(title) >= 1
        AND char_length(title) <= 100
    );
```

### 4.3 rate_limits 表

```sql
-- 仅本人可读写自己的速率记录
CREATE POLICY "rate_limits_owner_all" ON rate_limits
    FOR ALL USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
```

### 4.4 profiles 表

```sql
-- 所有人可读
CREATE POLICY "profiles_public_read" ON profiles
    FOR SELECT USING (true);

-- 仅本人可修改
CREATE POLICY "profiles_owner_write" ON profiles
    FOR UPDATE USING (auth.uid() = id);
```

---

## 5. 管理员认证

### 5.1 认证流程

```
1. 用户双击页脚 #sync-status 区域
2. 弹出 prompt 输入框
3. 用户输入口令
4. admin-auth.js 对输入做 SHA-256 哈希
5. 与 ADMIN_PASSWORD_HASH 常量比对
6. 匹配 → localStorage.setItem('fxre_admin_logged_in', 'true')
7. 页脚显示管理员状态
8. 评论区显示删除按钮（所有评论可删）
```

### 5.2 SHA-256 实现

```javascript
// admin-auth.js 使用纯 JS SHA-256 实现（无外部依赖）
// 口令: flyingedelweiss2026
// 哈希: 70a05acb...（存储在代码中，非明文）
```

### 5.3 删除权限矩阵

| 场景 | 自删 (10分钟内) | 管理员删除 | Supabase SQL 直删 |
|------|-----------------|------------|-------------------|
| 触发方式 | 评论旁删除按钮 | 评论旁删除按钮 | Dashboard SQL Editor |
| 权限校验 | author_id 匹配 + 时间窗口 | isAdmin() 状态 | service_role 绕过 RLS |
| RLS策略 | comments_owner_delete | 需要管理员口令 | 无限制 |
| 适用场景 | 普通用户改错评论 | 管理员清理垃圾 | 紧急删除/批量清理 |

---

## 6. 敏感词过滤（migration-002）

```sql
CREATE OR REPLACE FUNCTION public.moderate_content()
RETURNS TRIGGER AS $$
BEGIN
    -- 正则匹配敏感词（可扩展）
    IF NEW.content ~* '(spam|广告|http://|https://)' THEN
        RAISE EXCEPTION '内容包含不允许的关键词';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 评论 INSERT 前触发
CREATE TRIGGER trigger_moderate_comments
    BEFORE INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.moderate_content();

-- 投稿 INSERT 崩触发
CREATE TRIGGER trigger_moderate_submissions
    BEFORE INSERT ON public.submissions
    FOR EACH ROW EXECUTE FUNCTION public.moderate_content();
```

**扩展敏感词列表**: 修改 `moderate_content()` 函数中的正则表达式，添加更多敏感词模式。

---

## 7. CDN 与 SDK 安全

### 7.1 Supabase anon key 安全性

Supabase 的 anon key 是 **公开的**（类似于 Firebase API Key）。这不是安全漏洞，因为：

1. **RLS 是真正的安全边界** — 即使有人拿到 anon key，也只能执行 RLS 策略允许的操作
2. **anon key 只有匿名权限** — 无法绕过 RLS，无法访问 service_role key 的权限
3. **service_role key 永不暴露** — 仅用于服务端/Supabase Dashboard

### 7.2 SDK 加载降级

```html
<!-- async 加载，不阻塞页面 -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" async
        onerror="console.warn('Supabase SDK 加载失败，降级为本地模式')">
</script>
```

- CDN 加载失败时自动降级为 localStorage 本地模式
- 页面功能不受影响，仅失去云端同步
- 浏览器扩展（如 Edge 的广告拦截器）可能拦截 jsdelivr CDN

---

## 8. 数据安全

### 8.1 localStorage 安全

- 所有 localStorage 操作使用 try-catch 包装（`safeGetItem` / `safeSetItem`）
- 隐私模式或空间不足时自动降级为内存存储
- 不存储敏感信息（仅存储公开的评论/投稿数据和匿名用户ID）

### 8.2 传输安全

- 所有与 Supabase 的通信通过 HTTPS 加密
- JWT 令牌由 Supabase SDK 自动管理（存储在 localStorage 或 session）
- 令牌自动刷新，无需手动处理

### 8.3 数据备份

```bash
# Supabase Dashboard → Database → Backups → Download
# 或使用 pg_dump
pg_dump "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres" \
    --data-only --no-owner > backup_$(date +%Y%m%d).sql
```

---

## 9. 已知限制

| 限制 | 影响 | 缓解措施 |
|------|------|----------|
| 管理员口令在前端代码中 | 理论上可被逆向 | SHA-256 哈希存储，增加逆向难度；后续可迁移到 Supabase Auth 管理员角色 |
| 敏感词列表在前端可见 | 攻击者可绕过 | 后端触发器是最终防线；可定期更新敏感词列表 |
| 匿名用户无法被永久封禁 | 删评论后可重新发布 | 速率限制 + 每日配额减少影响；后续可引入 IP 限制 |
| CDN 被拦截导致降级 | 云端同步不可用 | 本地模式保证基本功能可用；可更换 CDN |
