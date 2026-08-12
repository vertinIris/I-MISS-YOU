# CloudStudio + CloudBase 迁移操作手册

> **生成日期**：2026-08-11
> **项目**：飞行雪绒 · Snow（I-MISS-YOU）
> **GitHub 仓库**：https://github.com/vertinIris/I-MISS-YOU
> **Supabase 项目**：`https://lmlyfyjffaaddysiliht.supabase.co`

---

## ⚠️ 重要说明（必读）

经核实 CloudStudio 官方文档，需澄清其定位：

| 产品 | 定位 | 适合生产 | 临时链接 | 大陆访问 |
|---|---|---|---|---|
| **CloudStudio** | 在线 IDE + 临时预览 | ❌ 不适合 | 会变化/失效 | ✅ 快 |
| **CloudBase 静态托管** | 生产级静态网站托管 | ✅ 适合 | 永久域名 | ✅ 快（CDN） |
| **EdgeOne Pages** | 全球 CDN 静态站 | ✅ 适合 | 永久域名 | ⚠️ 需备案才走大陆节点 |

**结论**：
- **CloudStudio** → 用作**开发环境**（在线 IDE + 协作 + 临时预览）
- **CloudBase 静态网站托管** → 用作**生产部署**（大陆访问镜像，`*.tcloudbaseapp.com` 默认域名无需备案）

本手册涵盖两者的完整配置。

---

## 第一部分：CloudStudio 开发环境配置

### 前置条件

- GitHub 账号（已有：`vertinIris`）
- 腾讯云账号（用于 CloudBase，可用微信扫码注册）

### 步骤 1：注册/登录 CloudStudio

1. 打开浏览器访问 **https://cloudstudio.net**
2. 点击右上角「登录」
3. 选择「GitHub 登录」（推荐，直接绑定仓库权限）
4. 授权 CloudStudio 访问你的 GitHub 账号
5. 授权完成后自动跳回 CloudStudio 控制台

### 步骤 2：创建工作区

1. 在 CloudStudio 首页点击「创建工作空间」
2. 选择「从 Git 仓库导入」
3. 填写仓库信息：
   - **仓库地址**：`https://github.com/vertinIris/I-MISS-YOU.git`
   - **分支**：`main`
   - **工作空间名称**：`I-MISS-YOU`（或自定义）
4. 选择运行环境模板：**Node.js 18**（或「All in One」）
5. 点击「创建」

等待 30-60 秒，CloudStudio 会自动：
- 克隆你的 GitHub 仓库
- 配置 Node.js 环境
- 打开在线 VS Code IDE

### 步骤 3：配置预览服务

本项目是纯静态站（HTML/CSS/JS），需要启动一个本地 HTTP 服务器来预览。

在 CloudStudio 工作区根目录创建 `.vscode/preview.yml` 文件：

```yaml
# .vscode/preview.yml
applications:
  - port: 8080
    commands:
      - npx http-server . -p 8080 --cors -c-1
    description: 飞行雪绒主站预览
```

或者用 Python（更轻量）：

```yaml
# .vscode/preview.yml
applications:
  - port: 8080
    commands:
      - python -m http.server 8080
    description: 飞行雪绒主站预览
```

### 步骤 4：启动预览

1. 在 CloudStudio IDE 中打开终端（`` Ctrl+` ``）
2. 运行预览命令：
   ```bash
   npx http-server . -p 8080 --cors -c-1
   ```
3. CloudStudio 会自动检测端口 8080 并生成预览链接
4. 点击 IDE 右上角的「预览」按钮（或端口面板中的「访问」按钮）
5. 获取临时预览链接，格式类似：
   ```
   https://xxxx-xxx-8080.preview.cloudstudio.net
   ```

### 步骤 5：在线开发与协作

- **编辑代码**：直接在 CloudStudio 的 VS Code 界面中编辑
- **运行自检**：在终端中执行
  ```bash
  npm install  # 首次需要安装 terser/csso
  npm run smoke-check
  node scripts/selfcheck-phase1.mjs
  node scripts/selfcheck-phase2.mjs
  ```
- **Git 推送**：在终端中执行
  ```bash
  git add -A
  git commit -m "your commit message"
  git push origin main
  ```
  推送后 GitHub Pages 和 CloudBase 都会自动更新
- **协作**：CloudStudio 支持多人实时协作编码（类似 Live Share）

### CloudStudio 限制

| 限制项 | 说明 |
|---|---|
| 工作空间休眠 | 不活动 30 分钟后自动休眠，重新打开需手动启动 |
| 预览链接时效 | 临时链接会变化，不适合分享给最终用户 |
| 免费机时 | 每天 4 小时免费机时（足够开发） |
| 存储空间 | 1 GB（项目约 3 MB，充裕） |

---

## 第二部分：CloudBase 生产部署（推荐）

### 为什么选 CloudBase 静态托管

- ✅ 永久域名 `*.tcloudbaseapp.com`（无需备案）
- ✅ CDN 加速（大陆访问快）
- ✅ Git 仓库自动部署（push 到 main 自动更新）
- ✅ 免费 5 GB 存储 + 5 GB 流量/月
- ✅ HTTPS 自动配置

### 步骤 1：创建云开发环境

1. 访问 **https://tcb.cloud.tencent.com/**
2. 用微信或 QQ 扫码登录（或用腾讯云账号登录）
3. 首次使用需要**实名认证**（身份证 + 人脸识别，约 2 分钟）
4. 点击「创建环境」：
   - **环境名称**：`flying-edelweiss`（或自定义）
   - **套餐**：免费基础版
   - **地域**：上海（推荐，大陆访问最快）
5. 等待环境创建完成（约 1 分钟）

### 步骤 2：部署静态网站

1. 进入云开发控制台 → 选择刚创建的环境
2. 左侧菜单点击「静态网站托管」
3. 点击「新建部署」→ 选择「Git 仓库」
4. 选择「个人仓库」
5. 授权 GitHub 账号访问（首次需要 OAuth 授权）
6. 选择仓库和分支：
   - **仓库**：`vertinIris/I-MISS-YOU`
   - **分支**：`main`
7. 配置构建参数：
   - **项目名称**：`I-MISS-YOU`
   - **安装命令**：（留空，纯静态项目无需安装）
   - **构建命令**：（留空，纯静态项目无需构建）
   - **输出目录**：`.`（根目录，因为 index.html 在根目录）
   - **部署路径**：`/`（根路径）
8. 点击「部署」

等待 30-60 秒，部署完成后会显示默认域名：
```
https://<env-id>.tcloudbaseapp.com/
```

### 步骤 3：验证部署

1. 打开默认域名 `https://<env-id>.tcloudbaseapp.com/`
2. 检查页面正常加载
3. 测试以下功能：
   - ✅ 首屏渲染（CSS/JS 加载正常）
   - ✅ 评论系统（Supabase 连接正常）
   - ✅ 登录/注册（Auth 流程正常）
   - ✅ 论坛页面 `https://<env-id>.tcloudbaseapp.com/forum/`
   - ✅ 角色档案页 `https://<env-id>.tcloudbaseapp.com/characters/aimisi/`

### 步骤 4：配置自动部署

CloudBase 的 Git 仓库部署默认支持自动部署：
- 每次推送到 `main` 分支 → 自动触发重新部署
- 无需额外配置

---

## 第三部分：Supabase 适配

> **关键步骤**：必须完成，否则 CloudBase 域名下的页面无法连接 Supabase。

### 步骤 1：添加 CORS 白名单

1. 登录 **Supabase Dashboard** → https://supabase.com/dashboard
2. 选择项目 `lmlyfyjffaaddysiliht`
3. 进入 **Settings** → **API**
4. 找到 **CORS (Cross-Origin Resource Sharing)** 配置
5. 在 Allowed Origins 中添加：
   ```
   https://<env-id>.tcloudbaseapp.com
   ```
   （将 `<env-id>` 替换为 CloudBase 的实际环境 ID）
6. 如果也想在 CloudStudio 中预览，额外添加：
   ```
   https://xxxx-xxx-8080.preview.cloudstudio.net
   ```
   （CloudStudio 预览链接，每次启动可能不同，按需添加）
7. 点击「Save」

### 步骤 2：添加 Redirect URLs

1. 在 Supabase Dashboard 中，进入 **Authentication** → **URL Configuration**
2. 找到 **Redirect URLs** 配置
3. 添加以下 URL：
   ```
   https://<env-id>.tcloudbaseapp.com/**
   https://<env-id>.tcloudbaseapp.com/reset-password.html
   ```
4. （可选）更新 **Site URL** 为 CloudBase 域名（如果主要入口变为 CloudBase）：
   ```
   https://<env-id>.tcloudbaseapp.com
   ```
5. 点击「Save」

### 步骤 3：验证 Supabase 连接

1. 打开 CloudBase 域名 `https://<env-id>.tcloudbaseapp.com/`
2. 打开浏览器 DevTools → Network 面板
3. 尝试登录或加载评论
4. 确认 Supabase 请求（`https://lmlyfyjffaaddysiliht.supabase.co/...`）返回 200，无 CORS 错误

---

## 第四部分：CSP 适配

> **好消息**：无需修改 CSP。

当前 CSP（[index.html](file:///c:/Users/lenovo/CURSOR/Snow/index.html)）中：
```
default-src 'self';
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
```

- `'self'` 会自动适配任何域名（包括 `*.tcloudbaseapp.com` 和 `*.cloudstudio.net`）
- `*.supabase.co` 不变
- **CSP 无需任何修改** ✅

---

## 第五部分：验证清单

完成所有配置后，逐项验证：

### CloudStudio 开发环境

- [ ] 能用 GitHub 账号登录 CloudStudio
- [ ] 能从 GitHub 仓库创建工作区
- [ ] 能启动预览服务并获取临时链接
- [ ] 能在在线 IDE 中编辑代码
- [ ] 能在终端中运行 `npm run smoke-check`
- [ ] 能通过 `git push` 推送代码到 GitHub

### CloudBase 生产部署

- [ ] 能创建云开发环境
- [ ] 能从 GitHub 仓库部署静态网站
- [ ] 默认域名 `*.tcloudbaseapp.com` 可正常访问
- [ ] 首屏渲染正常（CSS/JS 加载无 404）
- [ ] 评论系统正常（Supabase 连接无 CORS 错误）
- [ ] 登录/注册功能正常
- [ ] 论坛页面正常
- [ ] 角色档案页正常
- [ ] 推送代码到 GitHub main 分支后，CloudBase 自动更新

### Supabase 适配

- [ ] CORS 白名单已添加 CloudBase 域名
- [ ] Redirect URLs 已添加 CloudBase 域名
- [ ] 邮箱确认链接能正确跳转到 CloudBase 域名

---

## 常见问题

### Q1：CloudBase 部署后页面白屏

**原因**：可能是 CSP 或路径问题。

**排查**：
1. 打开 DevTools → Console，查看是否有 CSP 报错
2. 打开 DevTools → Network，查看是否有 404 资源
3. 确认 `dist/bundle-main.js` 和 `dist/css/main.min.css` 路径正确

### Q2：Supabase 请求被 CORS 拦截

**原因**：CORS 白名单未添加 CloudBase 域名。

**解决**：按「第三部分 步骤 1」添加 CloudBase 域名到 Supabase CORS 白名单。

### Q3：登录后跳转到错误的域名

**原因**：Supabase Redirect URLs 未配置 CloudBase 域名。

**解决**：按「第三部分 步骤 2」添加 Redirect URLs。

### Q4：CloudBase 自动部署未触发

**原因**：GitHub 授权可能过期。

**解决**：
1. 在 CloudBase 控制台 → 静态网站托管 → 部署列表
2. 检查最近的部署状态
3. 如需手动触发：点击「重新部署」

### Q5：CloudStudio 工作空间休眠了

**解决**：
1. 重新打开 CloudStudio 控制台
2. 点击休眠的工作空间
3. 等待 10-20 秒重新唤醒
4. 重新运行预览命令

### Q6：免费额度用完了

**CloudBase**：
- 免费档：5 GB 存储 + 5 GB 流量/月
- 超出后：按量付费（约 ¥0.02/GB 流量）
- 同人小站流量通常 < 1 GB/月，免费档足够

**CloudStudio**：
- 免费机时：4 小时/天
- 超出后：需升级付费版（¥19/月）
- 开发用途 4 小时/天通常足够

---

## 架构对比

```
配置前（当前）：
  用户 → GitHub Pages (vertiniris.github.io)
         ↓ 大陆访问慢（TTFB 800ms+）
         ↓ Supabase (lmlyfyjffaaddysiliht.supabase.co)

配置后：
  最终用户 → CloudBase 静态托管 (*.tcloudbaseapp.com)
              ↓ 大陆访问快（CDN 加速，TTFB < 200ms）
              ↓ Supabase (lmlyfyjffaaddysiliht.supabase.co)

  开发者 → CloudStudio (cloudstudio.net)
              ↓ 在线 IDE + 预览
              ↓ git push → GitHub → CloudBase 自动部署
```

---

## 回滚方案

如果 CloudBase 出现问题，可随时回退到 GitHub Pages：

1. CloudBase 部署可独立运行，不影响 GitHub Pages
2. 两个部署可并行存在（GitHub Pages + CloudBase）
3. 如需完全回退：
   - 在 CloudBase 控制台删除静态托管应用
   - 在 Supabase CORS 白名单中移除 CloudBase 域名
   - GitHub Pages 保持不变，继续作为主入口

---

## 耗时估算

| 步骤 | 预估耗时 |
|---|---|
| CloudStudio 注册 + 创建工作区 | 5 分钟 |
| CloudStudio 预览配置 | 3 分钟 |
| CloudBase 注册 + 实名认证 | 5 分钟 |
| CloudBase 创建环境 + 部署 | 5 分钟 |
| Supabase CORS + Redirect 配置 | 3 分钟 |
| 验证测试 | 10 分钟 |
| **总计** | **约 30 分钟** |

---

## 参考资源

- [CloudStudio 官方文档](https://cloudstudio.net/docs)
- [CloudBase 静态网站托管文档](https://docs.cloudbase.net/hosting/web-hosting)
- [CloudBase 纯静态项目部署](https://docs.cloudbase.net/hosting/web-hosting-static)
- [Supabase CORS 配置](https://supabase.com/docs/guides/api/cors)
