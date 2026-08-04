# 脚本说明

| 文件 | 平台 | 用途 |
|------|------|------|
| `../打开本地预览.bat` | Windows | 启动 Python HTTP 服务器（8848+ 端口），自动打开浏览器 |
| `../run.ps1` | Windows | PowerShell 版本地预览 |
| `../更新GitHubPages.bat` | Windows | `git pull` + 提示 commit + `git push` |
| `../解决合并冲突.bat` | Windows | 合并冲突时对 6 个核心文件 `checkout --ours` |
| `serve.sh` | Linux/macOS | `python3 -m http.server 8848` |
| `build-forum-import.cjs` | 任意 Node | 从离线源稿生成 `forum/js/forum-import-data.js` |
| `smoke-check.mjs` | 任意 Node | 冒烟校验 |

## 论坛内容（离线源稿）

- 仓库根目录的 `论坛内容/` 是**离线源稿与资产库**：不部署到 GitHub Pages，且已写入 `.gitignore`（默认不入 git）。
- 改二创种子后本地构建：`node scripts/build-forum-import.cjs`（输出到已跟踪的 `forum/js/forum-import-data.js`）。
- `论坛内容/技术参考/` 是旧导出快照，**仅对照阅读**；勿用其覆盖现网 `js/`、`forum/`、`index.html` 等，否则会回退 UI。

## 本地预览注意

- 必须通过 `http://localhost` 访问，不要直接打开 `index.html`（`file://` 会限制 CDN/云端）
- 若 8848 被占用，bat 会自动尝试更高端口

## 部署

数据库 migration 在 **Supabase SQL Editor** 执行，不通过 Git 部署。  
前端推送 GitHub 后 Pages 约 1–2 分钟生效。
