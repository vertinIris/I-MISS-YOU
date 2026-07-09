@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo  飞行雪绒 - 更新 GitHub Pages
echo  =============================
echo  仓库: https://github.com/vertiniris/I-MISS-YOU
echo  线上: https://vertiniris.github.io/I-MISS-YOU/
echo  注意: URL 是大写 I，不是小写 l
echo.

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未安装 Git: https://git-scm.com/download/win
    pause
    exit /b 1
)

if not exist ".git" (
    echo [1/5] 初始化 Git...
    git init
    git branch -M main
)

git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    echo [2/5] 关联远程仓库...
    git remote add origin https://github.com/vertiniris/I-MISS-YOU.git
) else (
    git remote set-url origin https://github.com/vertiniris/I-MISS-YOU.git
    echo [2/5] 远程仓库已就绪
)

echo [3/5] 拉取远程 main（合并 GitHub 已有内容）...
git fetch origin main 2>nul
if %errorlevel% equ 0 (
    git pull origin main --allow-unrelated-histories --no-edit 2>nul
    if !errorlevel! neq 0 (
        echo [提示] 自动合并失败，尝试 rebase...
        git pull origin main --rebase --allow-unrelated-histories 2>nul
    )
)

echo [4/5] 提交本地更改...
git add -A
git status -sb
git diff --cached --quiet
if %errorlevel% equ 0 (
    echo 工作区无新改动，跳过 commit
) else (
    git commit -m "fix: v7.8 跨设备评论同步 + 投稿 type 映射 + Realtime 刷新"
    if !errorlevel! neq 0 (
        echo [警告] commit 失败，继续尝试推送...
    )
)

echo [5/5] 推送到 GitHub...
git push -u origin main
if %errorlevel% neq 0 (
    echo.
    echo [失败] 推送未成功。请手动在 PowerShell 执行:
    echo   cd "%~dp0"
    echo   git pull origin main --allow-unrelated-histories
    echo   git push -u origin main
    echo.
    echo 若提示登录，请用 GitHub Desktop 或浏览器完成 Git 认证。
    pause
    exit /b 1
)

echo.
echo ========================================
echo  推送成功! 约 1-2 分钟后访问:
echo  https://vertiniris.github.io/I-MISS-YOU/
echo ========================================
pause
