@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal EnableDelayedExpansion

echo.
echo  飞行雪绒 - 本地预览
echo  ==================
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Python。请安装 Python 3 后重试。
    echo 下载: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM 8080 常被其他软件占用，默认改用 8848
set PORT=8848
:find_port
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    set /a PORT+=1
    if !PORT! GTR 8899 (
        echo [错误] 8848-8899 端口均被占用，请关闭占用端口的程序后重试。
        pause
        exit /b 1
    )
    goto find_port
)

echo 正在启动本地服务器 http://localhost:!PORT!
echo.
echo [提示] 若普通窗口打不开但无痕模式可以，通常是浏览器扩展拦截了 localhost。
echo        可暂时关闭广告拦截/VPN 扩展，或继续用无痕模式预览。
echo.

start "飞行雪绒-本地服务器" cmd /k "cd /d "%~dp0" && echo 服务运行中: http://localhost:!PORT! && python -m http.server !PORT!"

REM 等待服务器就绪（最多 15 秒）
set /a WAIT=0
:wait_loop
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:!PORT!/index.html' -UseBasicParsing -TimeoutSec 2).StatusCode | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 goto open_browser
set /a WAIT+=1
if !WAIT! GEQ 15 (
    echo [警告] 服务器启动较慢，请手动在浏览器打开: http://localhost:!PORT!/
    pause
    exit /b 0
)
timeout /t 1 /nobreak >nul
goto wait_loop

:open_browser
start "" "http://localhost:!PORT!/"
echo.
echo 已在浏览器打开 http://localhost:!PORT!/
echo 关闭标题为「飞行雪绒-本地服务器」的黑窗口即可停止服务。
pause
