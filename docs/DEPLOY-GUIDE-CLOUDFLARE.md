# Cloudflare Pages 部署操作指南

> **版本**：v1.0 · 2026-08-11
> **项目**：飞行雪绒 · Snow（I-MISS-YOU）
> **预计耗时**：30 分钟

---

## 前置条件

- GitHub 账号（已有：`vertinIris`）
- Cloudflare 账号（需新建，免费）
- 邮箱（用于注册 Cloudflare）
- 项目已推送到 GitHub main 分支（已完成）

---

## 步骤 1：注册 Cloudflare（5 分钟）

1. 打开 https://dash.cloudflare.com/sign-up
2. 输入邮箱地址（任意邮箱均可）+ 设置密码
3. 点击「Create Account」
4. 完成邮箱验证
5. 登录 Cloudflare Dashboard

---

## 步骤 2：创建 Pages 项目（10 分钟）

1. 在 Cloudflare Dashboard 左侧菜单找到 **Workers & Pages**
2. 点击 **Create application** → 选择 **Pages**
3. 选择 **Connect to Git**（推荐方式，自动部署）
4. 点击 **Connect to Git** 按钮
5. 在授权页面选择 **GitHub**
6. 点击「Authorize Cloudflare Pages」授权访问 GitHub
7. 选择仓库：`vertinIris/I-MISS-YOU`
8. 配置构建参数：
   - **Production branch**：`main`
   - **Build command**：（留空）
   - **Build output directory**：`.`（根目录）
9. 点击 **Save and Deploy**
10. 等待部署完成（约 30-60 秒）

部署成功后会显示：
```
✨ Deployment complete!
Your new site is available at: https://i-miss-you.pages.dev
```

---

## 步骤 3：配置优选IP CNAME（10 分钟）

### 方法 A：使用优选 CNAME 域名（推荐，更稳定）

1. 访问优选IP 项目主页：https://github.com/jemerci/pages_speedup-FaaS-in-China
2. 在 README 中找到最新的 **Preferred CNAME** 域名列表
3. 选择一个 CNAME（格式类似 `youxuan.cf.090227.xyz`）
4. 进入 Cloudflare Dashboard → Pages → 你的项目 → Custom domains
5. 点击 **Set up a custom domain**
6. 选择 **Connect to an existing domain**
7. 输入优选 CNAME 域名
8. 在 DNS 配置中添加 CNAME 记录：
   - **Type**：CNAME
   - **Name**：Cloudflare Pages 分配的 `i-miss-you.pages.dev`
   - **Target**：优选 CNAME 域名
9. 等待 DNS 生效（约 5-10 分钟）

### 方法 B：使用免费优选 IP（更简单）

1. 访问 https://github.com/jemerci/pages_speedup-FaaS-in-China
2. 找到最新的优选 IP 列表
3. 选择一个延迟最低的 IP
4. 在 Cloudflare Pages 的 Custom domains 配置中添加

---

## 步骤 4：Supabase CORS 配置（5 分钟）

1. 登录 https://supabase.com/dashboard
2. 选择项目 `lmlyfyjffaaddysiliht`
3. 进入 **Settings** → **API**
4. 在 **CORS (Cross-Origin Resource Sharing)** → Allowed Origins 中添加：
   ```
   https://i-miss-you.pages.dev
   *.pages.dev
   ```
5. 点击 **Save**

---

## 步骤 5：Supabase Redirect URLs（2 分钟）

1. 在 Supabase Dashboard 进入 **Authentication** → **URL Configuration**
2. 在 **Redirect URLs** 添加：
   ```
   https://i-miss-you.pages.dev/**
   ```
3. **Site URL** 更新为：
   ```
   https://i-miss-you.pages.dev
   ```
4. 点击 **Save**

---

## 步骤 6：验证（10 分钟）

### 基础功能验证

| 检查项 | 操作 | 预期结果 |
|---|---|---|
| 首页加载 | 打开 `https://i-miss-you.pages.dev/` | 正常渲染，无控制台错误 |
| CSS 加载 | DevTools → Network 查看 | `dist/css/main.min.css` 200 OK |
| JS 加载 | DevTools → Network 查看 | `dist/bundle-main.js` 200 OK |
| SRI 验证 | DevTools → Console 无 SRI 错误 | 无「Failed to execute 'integrity'」 |
| 论坛页面 | 打开 `https://i-miss-you.pages.dev/forum/` | 正常渲染 |
| 角色档案 | 打开 `https://i-miss-you.pages.dev/characters/aimisi/` | 正常渲染 |

### 核心功能验证

| 检查项 | 操作 | 预期结果 |
|---|---|---|
| 评论加载 | 首页滚动到评论区 | 评论列表正常显示 |
| 登录注册 | 点击登录 → 注册新账号 | 注册成功，邮箱确认后可登录 |
| 评论发布 | 登录后发布评论 | 评论成功，RTE 实时显示 |
| 管理后台 | 输入管理员口令 | 管理后台正常打开 |

### 性能验证（大陆）

用 Chrome DevTools → Network → Throttling → 选「Fast 3G」或「Slow 3G」：
- TTFB（Time to First Byte）< 200ms
- FCP（First Contentful Paint）< 2s

---

## 步骤 7：配置自动部署（已完成）

Cloudflare Pages 默认支持 Git 自动部署：
- 每次推送到 `main` 分支 → 自动部署
- 无需额外配置

---

## 已准备好的项目文件

| 文件 | 用途 |
|---|---|
| [wrangler.toml](file:///c:/Users/lenovo/CURSOR/Snow/wrangler.toml) | Wrangler CLI 配置 |
| [pages.config.json](file:///c:/Users/lenovo/CURSOR/Snow/pages.config.json) | Pages 路由配置 |
| [scripts/deploy-cloudflare.mjs](file:///c:/Users/lenovo/CURSOR/Snow/scripts/deploy-cloudflare.mjs) | Wrangler CLI 部署脚本 |
| [db/migrate-cloudflare-cors.sql](file:///c:/Users/lenovo/CURSOR/Snow/db/migrate-cloudflare-cors.sql) | Supabase CORS SQL |

---

## 部署后验证命令

如果你想用 Wrangler CLI 手动部署（作为 Dashboard 方式的补充）：

```bash
# 1. 确保已登录 Cloudflare
wrangler whoami

# 2. 部署到 Pages
node scripts/deploy-cloudflare.mjs
```

---

## 常见问题

### Q1：Cloudflare Pages 部署后白屏

排查步骤：
1. 打开 DevTools → Console，查看错误信息
2. 打开 DevTools → Network，查看是否有 404 的资源
3. 确认 `dist/bundle-main.js` 和 `dist/css/main.min.css` 路径正确
4. 尝试直接访问 `https://i-miss-you.pages.dev/dist/bundle-main.js`

### Q2：SRI 校验失败

如果 Console 显示 "Failed to execute 'integrity'":
1. 运行 `node scripts/build-phase2.mjs` 重新构建（会自动更新 SRI）
2. 提交代码后 Cloudflare Pages 会自动重新部署
3. 刷新页面（Ctrl+Shift+R 强制刷新）

### Q3：Supabase 请求被 CORS 拦截

排查步骤：
1. 检查 Supabase Dashboard → Settings → API → CORS
2. 确认 `https://i-miss-you.pages.dev` 和 `*.pages.dev` 已添加
3. 检查 Console 中的 CORS 错误详情

### Q4：优选IP 失效

症状：大陆访问突然变慢或连接超时

解决方案：
1. 访问 https://github.com/jemerci/pages_speedup-FaaS-in-China 获取最新 CNAME
2. 在 Cloudflare Pages → Custom domains 中更新 CNAME 记录
3. 或者回退到 Cloudflare 默认域名（删除 CNAME 配置）

### Q5：Cloudflare Pages 无限流量的限制

Cloudflare Pages 免费版确实**无流量限制**，但有：
- 每月 500 次构建
- 每个部署最多 500 个文件
- 单个文件最大 25MB（本项目最大文件约 534KB，远低于限制）

---

## 完成后的后续动作

✅ 完成后，请回来找我，我会：

1. **提醒你 B（PWA）的存在**——如果你决定后续追加推送通知等功能
2. **生成 PWA 实施计划**——包括 Service Worker、Push API 配置
3. **设置 Cloudflare Analytics**——可选，用于分析用户访问数据
4. **配置自定义域名**——可选，绑定品牌域名

---

## 回退方案

如果 Cloudflare Pages 出现问题：

1. GitHub Pages 保持不变，可随时回退
2. 在 Cloudflare Dashboard → Pages → Custom domains 删除 CNAME
3. 在 Supabase CORS 白名单中移除 `*.pages.dev`
4. 用户访问 GitHub Pages 继续使用

---

## 参考资源

- [Cloudflare Pages 官方文档](https://developers.cloudflare.com/pages/)
- [Cloudflare Pages GitHub 部署](https://developers.cloudflare.com/pages/how-to/connect-directly-to-git/)
- [Cloudflare Pages CNAME 配置](https://developers.cloudflare.com/pages/how-to/add-a-custom-domain/)
- [Cloudflare 优选IP 项目](https://github.com/jemerci/pages_speedup-FaaS-in-China)
- [Supabase CORS 配置](https://supabase.com/docs/guides/api/cors)
