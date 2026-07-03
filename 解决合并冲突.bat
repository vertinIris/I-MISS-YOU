@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  解决 Git 合并冲突 — 保留本地 v7.8 版本
echo  ======================================
echo.

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Git
    pause
    exit /b 1
)

if not exist ".git\MERGE_HEAD" (
    echo [提示] 当前没有进行中的合并，无需处理。
    pause
    exit /b 0
)

echo 以下文件将保留【本地版本】（含 v7.8 评论同步修复）:
echo   README.md index.html js\admin-auth.js js\main.js
echo   js\repository.js js\supabase-adapter.js
echo.

git checkout --ours README.md
git checkout --ours index.html
git checkout --ours js/admin-auth.js
git checkout --ours js/main.js
git checkout --ours js/repository.js
git checkout --ours js/supabase-adapter.js

git add README.md index.html js/admin-auth.js js/main.js js/repository.js js/supabase-adapter.js

git commit -m "merge: 保留本地 v7.8 修复，合并 GitHub 远程历史"

if %errorlevel% neq 0 (
    echo [失败] commit 失败
    pause
    exit /b 1
)

echo.
echo [完成] 冲突已解决。正在推送到 GitHub...
git push origin main

if %errorlevel% neq 0 (
    echo [失败] push 失败，请检查网络或登录后重试: git push origin main
    pause
    exit /b 1
)

echo.
echo ========================================
echo  任务完成! 约 1-2 分钟后访问:
echo  https://vertiniris.github.io/I-MISS-YOU/
echo  Ctrl+F5 强刷
echo ========================================
pause
