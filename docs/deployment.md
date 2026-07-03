# 部署指南

> **版本**: v7.7 | **平台**: GitHub Pages + Supabase

---

## 1. 部署架构

```
┌─────────────────────┐     ┌──────────────────────────┐
│   GitHub Pages      │     │     Supabase Cloud        │
│   (静态文件托管)     │     │     (数据库+认证)         │
│                     │     │                          │
│  index.html         │     │  PostgreSQL 15           │
│  css/style.css      │     │  ├── profiles 表         │
│  js/*.js            │     │  ├── comments 表 (RLS)   │
│  assets/*           │     │  ├── submissions 表 (RLS)│
│                     │     │  └── rate_limits 表      │
│  URL:               │     │                          │
│  vertiniris.github  │     │  Auth (GoTrue)           │
│  .io/I-MISS-YOU/    │     │  ├── 匿名登录            │
│                     │     │  └── JWT 令牌             │
└──────────┬──────────┘     └────────────┬─────────────┘
           │                             │
           │    HTTPS (Supabase JS SDK)  │
           └─────────────────────────────┘
```

---

## 2. GitHub Pages 部署

### 2.1 创建仓库

```bash
# 1. 在 GitHub 上创建新仓库（如 I-MISS-YOU）
# 2. 初始化本地仓库
cd Snow
git init
git add -A
git commit -m "v7.7: 飞行雪绒项目完整版"

# 3. 关联远程仓库并推送
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git branch -M main
git push -u origin main
```

### 2.2 启用 GitHub Pages

1. 打开 GitHub 仓库 → **Settings** → **Pages**
2. **Source** 选择 **Deploy from a branch**
3. **Branch** 选择 `main` → 文件夹选择 `/ (root)`
4. 点击 **Save**
5. 等待 1-2 分钟，页面顶部会显示部署 URL

### 2.3 访问地址

```
https://<你的用户名>.github.io/<仓库名>/
```

> **注意**: 如果仓库名为 `<用户名>.github.io`，则直接访问 `https://<用户名>.github.io/`

### 2.4 更新部署

```bash
# 修改文件后
git add -A
git commit -m "描述修改内容"
git push origin main

# GitHub Pages 会自动重新构建部署（通常 1-2 分钟）
```

### 2.5 自定义域名（可选）

1. GitHub 仓库 → Settings → Pages → Custom domain
2. 输入你的域名（如 `edelweiss.example.com`）
3. 在域名 DNS 设置中添加 CNAME 记录：
   ```
   CNAME  edelweiss  <用户名>.github.io.
   ```
4. 勾选 "Enforce HTTPS"

---

## 3. Supabase 配置

### 3.1 创建项目

1. 打开 [supabase.com](https://supabase.com) → 用 GitHub 登录
2. **New project** → 填写：
   - Name: `fxre`（可自定义）
   - Database Password: 生成强密码并保存
   - Region: **Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)**
3. 等待 1-2 分钟初始化

### 3.2 执行数据库迁移

1. Dashboard → **SQL Editor** → **New query**
2. 复制 `db/migration-001-init.sql` 全部内容 → **Run**
3. 看到成功消息后，再复制 `db/migration-002-rls-hardening.sql` → **Run**
4. 验证：Dashboard → **Table Editor**，应看到 `profiles`、`comments`、`submissions`、`rate_limits` 四张表

### 3.3 启用匿名登录

1. Dashboard → **Authentication** → **Settings**
2. 找到 **Anonymous Sign-ins** → 切换为 **Enabled**
3. 点击 **Save**

### 3.4 配置 Site URL

1. Dashboard → **Authentication** → **URL Configuration**
2. **Site URL** 设置为你的 GitHub Pages 地址：
   ```
   https://<你的用户名>.github.io/<仓库名>/
   ```
3. **Redirect URLs** → Allowed URLs 中添加相同地址
4. 点击 **Save**

### 3.5 获取 API 密钥

1. Dashboard → **Settings** → **API**
2. 复制以下两个值：

| 需要的值 | 对应字段 |
|---------|---------|
| Project URL | `https://xxxxx.supabase.co` |
| anon key | `eyJhbG...`（以 eyJ 开头） |

### 3.6 填入项目代码

打开 `js/supabase-adapter.js`，替换顶部 CONFIG：

```javascript
var CONFIG = {
    url: 'https://你的项目.supabase.co',
    anonKey: 'eyJhbG你的anon_key',
    enabled: true
};
```

---

## 4. 验证清单

部署完成后，按以下清单逐项验证：

### 4.1 基础访问
- [ ] 访问 GitHub Pages URL，页面正常加载
- [ ] 页面标题显示「飞行雪绒」
- [ ] 页脚版本号显示 v7.7
- [ ] 所有 section（资料/音乐/动态/日志/投稿/社区）可见

### 4.2 视觉效果
- [ ] 星空背景动画正常运行
- [ ] 流星随机出现
- [ ] 雪花飘落（Three.js 或 CSS 降级）
- [ ] 玻璃拟态卡片效果正常
- [ ] 按钮悬停光效正常

### 4.3 云端同步
- [ ] 页脚显示「✅ 云端在线」（而非「☁ 本地模式」）
- [ ] 页脚显示匿名用户 UUID
- [ ] 点击 🔄 同步按钮可正常触发
- [ ] Console 无 Supabase 错误

### 4.4 评论系统
- [ ] 预置评论正常显示（9个目标各有3-4条）
- [ ] 可发表新评论，提交后立即显示
- [ ] 刷新页面后评论仍在（云端持久化）
- [ ] 10分钟内可删除自己的评论
- [ ] 管理员模式可删除任意评论

### 4.5 投稿系统
- [ ] 预置投稿正常显示（6篇）
- [ ] 可提交新投稿，Toast 提示成功
- [ ] 投稿出现在社区区
- [ ] 点赞功能正常
- [ ] 类型筛选功能正常

### 4.6 音乐模块
- [ ] 点击曲目可播放
- [ ] Canvas 频谱可视化正常
- [ ] 音量控制正常
- [ ] 播放/暂停切换正常

### 4.7 彩蛋
- [ ] 长按头像 800ms 弹出对话气泡
- [ ] 双击日志标题出现蓝紫光脉冲
- [ ] 评论包含关键词时弹出 Toast 回应
- [ ] 调频 9072 引用存在

### 4.8 安全
- [ ] 连续快速评论被速率限制拦截
- [ ] 连续快速投稿被速率限制拦截
- [ ] XSS 测试（输入 `<script>alert(1)</script>` 不执行）
- [ ] 管理员口令验证正常

### 4.9 跨设备
- [ ] 手机端访问正常
- [ ] 不同浏览器评论同步正常
- [ ] 降级模式（CDN不可达）功能正常

---

## 5. 常见部署问题

### Q: GitHub Pages 显示 404

**原因**: URL 路径错误或仓库为空。

**解决**:
- 确认 URL 格式为 `https://<用户名>.github.io/<仓库名>/`（注意末尾 `/`）
- 确认仓库中有 `index.html` 且在正确分支
- 等待 1-2 分钟让 GitHub Pages 完成构建
- 检查 Settings → Pages 中 Source 配置是否正确

### Q: 页脚显示「☁ 本地模式」

**原因**: Supabase SDK 未加载或匿名认证失败。

**解决**:
- 打开浏览器 Console 查看错误信息
- 确认 `js/supabase-adapter.js` 中 CONFIG.url 和 CONFIG.anonKey 正确
- 确认 Supabase 项目未休眠（Free Tier 1周无请求会休眠）
- 确认 Anonymous Sign-ins 已启用
- 检查浏览器扩展是否拦截了 jsdelivr CDN

### Q: 评论发表后刷新消失

**原因**: 云端写入失败，仅写入 localStorage。

**解决**:
- 检查 Console 是否有 RLS 策略拒绝错误
- 确认 migration-001 和 migration-002 都已执行
- 确认匿名登录成功（页脚显示用户 UUID）
- 检查 Supabase Dashboard → Table Editor → comments 表是否有数据

### Q: CDN 被拦截

**原因**: 浏览器扩展（如 Edge 广告拦截器）拦截 jsdelivr。

**解决**:
- 更换 CDN 源（unpkg / cdnjs）
- 或将 Three.js 和 Supabase SDK 下载到本地 `vendor/` 目录引用
- Edge 隐身模式通常不受扩展影响，可用于测试

### Q: Supabase Free Tier 项目休眠

**原因**: 超过 1 周无 API 请求。

**解决**:
- 使用 [UptimeRobot](https://uptimerobot.com) 设置每 5 分钟访问一次
- 或升级到 Supabase Pro ($25/月) 消除休眠限制

---

## 6. 备选部署平台

### 6.1 Vercel

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
cd Snow
vercel --prod
```

### 6.2 Netlify

```bash
# 安装 Netlify CLI
npm i -g netlify-cli

# 部署
cd Snow
netlify deploy --prod --dir .
```

### 6.3 Cloudflare Pages

```bash
# 安装 Wrangler CLI
npm i -g wrangler

# 部署
cd Snow
wrangler pages deploy .
```

### 6.4 腾讯云 EdgeOne Pages

详见项目中的 EdgeOne Makers 连接器配置。

> **注意**: 无论使用哪个静态托管平台，Supabase 配置方式完全相同，只需更新 `js/supabase-adapter.js` 中的 CONFIG 和 Supabase Dashboard 中的 Site URL。
