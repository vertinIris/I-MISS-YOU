# Supabase 注册与配置指南（飞行雪绒 Phase 3）

预计耗时：15 分钟 | 所需条件：GitHub 账号（免费注册）

---

## 第一步：注册 Supabase

1. 打开 [supabase.com](https://supabase.com)
2. 点击右上角 **「Sign in」** → 选择 **「Continue with GitHub」**
3. 授权 Supabase 访问你的 GitHub 账号（仅用于登录认证）
4. 进入 Dashboard

## 第二步：创建项目

1. 点击 **「New project」**
2. 填写表单：

| 字段 | 内容 |
|------|------|
| Name | `fxre`（可自定义） |
| Database Password | **生成一个强密码并牢记**（不会在页面外使用） |
| Region | **Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)** |

3. 点击 **「Create project」**，等待 1-2 分钟初始化

## 第三步：执行数据库迁移

在 **SQL Editor** 中**按顺序** Run 以下文件（每次 New query → 粘贴 → Run）：

| 顺序 | 文件 | 说明 |
|------|------|------|
| 1 | `db/migration-001-init.sql` | 建表 + RLS + 种子 |
| 2 | `db/migration-002-rls-hardening.sql` | RLS 加固 |
| 3 | `db/migration-003-fixes.sql` | v7.8 触发器 / 点赞 RPC |
| 4 | `db/migration-004-fix-search-path.sql` | **必跑** — 修复 003 评论写入失败 |

> **验证**：Table Editor 应能看到 `profiles`、`comments`、`submissions`、`rate_limits` 四张表。

> **常见错误**：跳过 004 会导致发评论时数据库报错，评论只保存在本机。见 [troubleshooting.md](./troubleshooting.md)。

## 第四步：启用匿名登录

1. 左侧菜单 → **Authentication** → **Settings**
2. 向下滚动找到 **「Anonymous Sign-ins」**
3. 将开关切换为 **Enabled**
4. 点击页面底部的 **「Save」**

> **说明**：匿名登录让访客无需注册即可发表评论和投稿，零门槛互动。每个访客会自动获得一个匿名会话。

## 第五步：获取 API 密钥

1. 左侧菜单 → **Settings** → **API**
2. 复制以下两个值：

| 需要的值 | 对应 Supabase 字段 |
|---------|-------------------|
| `SUPABASE_URL` | **Project URL**（形如 `https://xxxxx.supabase.co`） |
| `SUPABASE_ANON_KEY` | **anon public**（以 `eyJhbG...` 开头） |

## 第六步：填入项目代码

1. 打开 `js/supabase-adapter.js`
2. 找到顶部配置区，替换占位符：

```javascript
var CONFIG = {
    url:     'https://xxxxx.supabase.co',       // ← 替换为你的 Project URL
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',  // ← 替换为你的 anon key
    enabled: true                                 // ← 改为 true 启用云端同步
};
```

3. 保存文件

## 第七步：验证

1. 用浏览器打开 `index.html`
2. 打开开发者工具 → Console
3. 应看到绿色日志：`[SupabaseAdapter] 初始化成功` + `[SupabaseAdapter] 匿名登录成功`
4. 发表一条评论 → 刷新页面 → 评论仍然存在（已写入云端数据库）
5. 回到 Supabase Dashboard → Table Editor → `comments` 表，应能看到刚发表的评论

---

## 常见问题

### Q: 国内访问 Supabase 慢怎么办？
A: 创建项目时选择 **Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)** 节点。如果仍然太慢，可切换到备选的 LeanCloud 方案（需额外开发适配器）。

### Q: 免费额度够用吗？
- 数据库 500MB（这个项目的数据量很难超过 1MB）
- 认证 50,000 月活用户
- 带宽 5GB/月
- **结论：完全够用**

### Q: Free Tier 项目会被休眠吗？
A: 是的，如果项目超过 1 周没有任何 API 请求，Supabase 会暂停项目。解决方法：用 [UptimeRobot](https://uptimerobot.com) 设置每 5 分钟访问一次（免费）。

### Q: 不想用 Supabase 了怎么办？
A: 数据是标准 PostgreSQL，随时可以 `pg_dump` 导出为 SQL 文件，迁移到任何 PostgreSQL 服务。没有任何厂商锁定。

---

## 下一步

配置完成后，Phase 3 的核心功能（云端同步+匿名登录+实时推送）即已就绪。后续可添加：
- 邮箱密码登录（需在 Supabase Auth Settings 中启用 Email provider）
- 自定义数据备份脚本（cron + pg_dump）
- 管理面板（Supabase Dashboard 自带基础版）
