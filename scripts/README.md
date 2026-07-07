# 脚本说明

| 文件 | 平台 | 用途 |
|------|------|------|
| `../打开本地预览.bat` | Windows | 启动 Python HTTP 服务器（8848+ 端口），自动打开浏览器 |
| `../run.ps1` | Windows | PowerShell 版本地预览 |
| `../更新GitHubPages.bat` | Windows | `git pull` + 提示 commit + `git push` |
| `../解决合并冲突.bat` | Windows | 合并冲突时对 6 个核心文件 `checkout --ours` |
| `serve.sh` | Linux/macOS | `python3 -m http.server 8848` |

## 本地预览注意

- 必须通过 `http://localhost` 访问，不要直接打开 `index.html`（`file://` 会限制 CDN/云端）
- 若 8848 被占用，bat 会自动尝试更高端口

## 部署

数据库 migration 在 **Supabase SQL Editor** 执行，不通过 Git 部署。  
前端推送 GitHub 后 Pages 约 1–2 分钟生效。
