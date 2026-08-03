# 飞行雪绒 / 星炬论坛 — v7.8 安全防护加固记录

> 本文档记录 v7.8 新增的安全加固项。完整安全架构仍参见 `docs/security.md`。

## v7.8 新增防护

### 1. 论坛实时聊天安全
- 聊天消息经 `SecurityShield.sanitizeText()` 清洗，移除零宽字符与控制符。
- 经 `SecurityShield.detectThreat()` 检测 XSS/SQL 注入模式，命中即拦截。
- 集成 `ClientRateLimiter.canSendComment()`，防止刷屏。
- 单条消息 ≤200 字符，历史保留 50 条，发送间隔 ≥1 秒。
- 渲染侧统一 `escapeHTML()` 转义。

### 2. 颜色注入白名单
- 新增 `sanitizeColor()` 并统一应用于：
  - `forum/js/forum.js`：投稿卡片、评论者名颜色
  - `forum/js/forum-auth.js`：用户头像色
  - `forum/js/forum-cloud.js`：云端数据颜色字段
  - `forum/js/forum-chat.js`：聊天头像色
- 仅放行 `hex` / `var()` / `rgb()` / `hsl()`，其余回退 `#6B8AFF`。

### 3. 论坛渲染层崩溃修复
- 修复 `forum.js` 中 `var previewText` 遮蔽同名函数导致的卡片白屏。
- 修复 `createSubmission` 双重 HTML 转义导致的 `&amp;` 乱码。

### 4. 云端连接韧性
- `forum-cloud.js` 中 pull 拆分为核心读取与增强同步，后者失败不触发整体降级。
- 增加 401 过期 session 自动清除重试。
- Supabase SDK 三级 CDN 容错：jsdelivr → unpkg → 本地 `forum/js/supabase.min.js`。

### 5. 后端表安全（migration-020）
- 新增 `forum_chat` 表，含 `realm` / `name` / `user_id` / `color` / `content` / `is_hidden`。
- CHECK 约束限制 `name` 1-60 字符、`content` 1-1000 字符。
- RLS：任何人可读未隐藏、authenticated 可写、管理员可更新/删除。

## 推荐服务器响应头

由于静态托管通常不支持自定义响应头，建议在 CDN / Edge Functions 上配置：

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net https://unpkg.com; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';
```

## 模拟攻击验证结果（v7.8）

| 攻击类型 | 载荷 | 结果 |
|---|---|---|
| 反射型 XSS | `<script>alert(1)</script>` | ✅ 转义为纯文本 |
| 图片事件注入 | `<img onerror=alert(1)>` | ✅ 转义为纯文本 |
| 属性断注 | `" onclick=alert(1)` | ✅ 转义为 `&quot;` |
| 颜色表达式注入 | `expression(alert(1))` | ✅ 回退 `#6B8AFF` |
| URL 颜色注入 | `url(javascript:alert(1))` | ✅ 回退 `#6B8AFF` |
| SQL 注入 | `' OR 1=1 --` | ✅ 被 `detectThreat()` 拦截 |

## 已知限制与后续方向

- GitHub Pages 无法直接配置 CSP 响应头，如需强制生效需迁移至 Cloudflare / EdgeOne / Vercel。
- 在线人数统计当前为占位，可基于 Supabase Realtime Presence 实现。
- 图片上传目前仅依赖客户端压缩，建议后续接入服务端内容审核。
