# 完整部署清单（从零到上线）

> 按顺序勾选，约 30 分钟

---

## 阶段 A：本地准备

- [ ] 项目目录：`C:\Users\lenovo\CURSOR\Snow`
- [ ] 已安装 Git
- [ ] 本地预览：双击 `打开本地预览.bat` → 浏览器打开 `http://localhost:8848/`

---

## 阶段 B：Supabase

- [ ] 注册 [supabase.com](https://supabase.com)
- [ ] 创建项目（Tokyo / Singapore 区域）
- [ ] SQL Editor 依次 Run：
  - [ ] `db/migration-001-init.sql`
  - [ ] `db/migration-002-rls-hardening.sql`
  - [ ] `db/migration-003-fixes.sql`
  - [ ] `db/migration-004-fix-search-path.sql` **← 必跑**
- [ ] Authentication → Providers → **Anonymous Sign-ins** → Enable
- [ ] Authentication → URL Configuration：
  - Site URL: `https://vertiniris.github.io/I-MISS-YOU/`
  - Redirect URLs: 同上
- [ ] Settings → API → 复制 URL + anon key 到 `js/supabase-adapter.js`

---

## 阶段 C：GitHub Pages

- [ ] 仓库：https://github.com/vertinIris/I-Miss-You
- [ ] Settings → Pages：
  - Source: **Deploy from a branch**
  - Branch: **main** / **(root)**
- [ ] 推送代码：
  ```powershell
  cd C:\Users\lenovo\CURSOR\Snow
  git add -A
  git commit -m "feat: deploy"
  git pull origin main --allow-unrelated-histories   # 若 push 被拒
  git push origin main
  ```
- [ ] Actions 里最新 **pages build and deployment** 为绿色 ✓
- [ ] Pages 设置页显示 **Your site is live at …**

---

## 阶段 D：线上验证

- [ ] 打开 https://vertiniris.github.io/I-MISS-YOU/
- [ ] **Ctrl+F5** 强刷
- [ ] 页脚：**v7.8** + **✅ 云端在线**
- [ ] 发一条评论 → 无失败 Toast
- [ ] Supabase → comments 表有新行
- [ ] 另一浏览器/朋友能看到该评论

---

## 阶段 E：日常更新

```powershell
# 改代码 → 预览 → 推送
cd C:\Users\lenovo\CURSOR\Snow
git add -A
git commit -m "fix: 描述"
git push origin main
# 等 1-2 分钟，线上 Ctrl+F5
```

数据库变更：只在 Supabase SQL Editor 跑新 migration，不通过 GitHub 部署。

---

## 辅助脚本

| 文件 | 用途 |
|------|------|
| `打开本地预览.bat` | 本地 HTTP 服务器（8848 端口） |
| `run.ps1` | PowerShell 版本地预览 |
| `更新GitHubPages.bat` | pull + commit + push |
| `解决合并冲突.bat` | 保留本地 v7.8 完成 merge |
| `scripts/serve.sh` | Linux/macOS 本地预览 |
