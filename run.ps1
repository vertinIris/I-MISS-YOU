# 飞行雪绒 — Windows 本地开发服务器
# 用法: .\run.ps1 [端口号]   默认 8848（避免 8080 被其他程序占用）
param([int]$Port = 8848)

$Root = $PSScriptRoot
Set-Location $Root

Write-Host "❄️  飞行雪绒本地开发服务器" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "目录: $Root"
Write-Host ""

if (-not (Test-Path "$Root\index.html")) {
    Write-Host "❌ 未找到 index.html，请确认在 Snow 文件夹内运行" -ForegroundColor Red
    exit 1
}

function Test-PortInUse([int]$p) {
    return [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
}

while (Test-PortInUse $Port) {
    Write-Host "端口 $Port 已被占用，尝试 $($Port + 1)..." -ForegroundColor Yellow
    $Port++
    if ($Port -gt 8899) {
        Write-Host "❌ 无可用端口" -ForegroundColor Red
        exit 1
    }
}

if (Get-Command python -ErrorAction SilentlyContinue) {
    Write-Host "使用 Python → http://localhost:$Port"
    Start-Process python -ArgumentList "-m", "http.server", "$Port" -WorkingDirectory $Root -WindowStyle Normal
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/index.html" -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) { break }
        } catch {}
    }
    Start-Process "http://localhost:$Port/"
    Write-Host "✅ 已打开 http://localhost:$Port/"
} else {
    Write-Host "❌ 未找到 Python，请双击「打开本地预览.bat」" -ForegroundColor Red
    exit 1
}
