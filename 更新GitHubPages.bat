@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  飞行雪绒 - 更新 GitHub Pages
echo  =============================
echo.
echo  目标仓库: https://github.com/vertiniris/I-MISS-YOU
echo  线上地址: https://vertiniris.github.io/I-MISS-YOU/
echo  注意 URL 是大写 I，不是小写 l
echo.

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未安装 Git。请先安装: https://git-scm.com/download/win
    pause
    exit /b 1
)

if not exist ".git" (
    echo [1/4] 初始化 Git 仓库...
    git init
    git branch -M main
)

git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    echo [2/4] 关联远程仓库...
    git remote add origin https://github.com/vertiniris/I-MISS-YOU.git
) else (
    echo [2/4] 远程仓库已存在，跳过
)

echo [3/4] 提交本地更改...
git add -A
git status -sb
echo.
set /p CONFIRM=确认提交并推送到 GitHub? (Y/N): 
if /i not "%CONFIRM%"=="Y" (
    echo 已取消。
    pause
    exit /b 0
)

git commit -m "fix: v7.8 投稿同步、Realtime、migration-003 修复" 2>nul
if %errorlevel% neq 0 (
    echo 没有新更改需要提交，或提交失败。若已有提交，将直接尝试推送...
)

echo [4/4] 推送到 GitHub（可能需要登录）...
git push -u origin main
if %errorlevel% neq 0 (
    echo.
    echo [提示] 若推送失败，常见原因:
    echo   1. 远程已有历史且与本地冲突 - 需先 git pull origin main --rebase
    echo   2. 未登录 GitHub - 在 GitHub Desktop 或 git credential 中登录
    echo   3. 仓库名不对 - 确认是 vertiniris/I-MISS-YOU
    pause
    exit /b 1
)

echo.
echo 推送成功! GitHub Pages 通常 1-2 分钟后更新。
echo 访问: https://vertiniris.github.io/I-MISS-YOU/
pause
