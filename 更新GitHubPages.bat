@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo  飞行雪绒 - 更新 GitHub Pages
echo  =============================
echo  仓库: https://github.com/vertiniris/I-MISS-YOU
echo  线上: https://vertiniris.github.io/I-MISS-YOU/
echo.

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未安装 Git: https://git-scm.com/download/win
    pause
    exit /b 1
)

if not exist ".git" (
    echo [1/6] 初始化 Git...
    git init
    git branch -M main
)

git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    echo [2/6] 关联远程仓库...
    git remote add origin https://github.com/vertiniris/I-MISS-YOU.git
) else (
    git remote set-url origin https://github.com/vertiniris/I-MISS-YOU.git
    echo [2/6] 远程仓库已就绪
)

echo [3/6] 拉取远程 main...
git fetch origin main
if !errorlevel! neq 0 (
    echo [警告] fetch 失败，可能是网络或登录问题，继续尝试...
)

git pull origin main --allow-unrelated-histories --no-edit
if !errorlevel! neq 0 (
    echo.
    echo [失败] 无法与 GitHub 合并。请在 PowerShell 手动执行:
    echo   cd "%~dp0"
    echo   git pull origin main --allow-unrelated-histories
    echo   git push origin main
    echo.
    echo 若出现 CONFLICT，把报错发给我。
    pause
    exit /b 1
)

echo [4/6] 提交本地更改...
git add -A
git status -sb
git diff --cached --quiet
if %errorlevel% equ 0 (
    echo 无新改动，跳过 commit
) else (
    git commit -m "fix: v7.8 跨设备评论同步 + 投稿 type 映射 + Realtime 刷新"
)

echo [5/6] 推送到 GitHub...
git push -u origin main
if !errorlevel! neq 0 (
    echo.
    echo [失败] push 未成功。请手动执行:
    echo   git push origin main
    pause
    exit /b 1
)

echo.
echo ========================================
echo  推送成功! 约 1-2 分钟后访问:
echo  https://vertiniris.github.io/I-MISS-YOU/
echo  记得 Ctrl+F5 强刷
echo ========================================
pause
