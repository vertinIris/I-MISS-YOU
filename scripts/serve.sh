#!/usr/bin/env bash
# ============================================================
# 飞行雪绒 — 本地开发服务器启动脚本
# ============================================================
# 用法: bash scripts/serve.sh [端口号]
# 默认端口: 8080
# ============================================================

PORT="${1:-8080}"

echo "❄️  飞行雪绒本地开发服务器"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检测可用的 HTTP 服务器
if command -v python3 &> /dev/null; then
    echo "使用 Python 3 启动服务器 → http://localhost:$PORT"
    python3 -m http.server "$PORT"
elif command -v python &> /dev/null; then
    echo "使用 Python 启动服务器 → http://localhost:$PORT"
    python -m http.server "$PORT"
elif command -v npx &> /dev/null; then
    echo "使用 Node.js (npx serve) 启动服务器 → http://localhost:$PORT"
    npx serve . -l "$PORT"
else
    echo "❌ 未找到 Python 或 Node.js"
    echo "请安装 Python 3.x 或 Node.js 后重试"
    echo ""
    echo "或者直接用浏览器打开 index.html"
    exit 1
fi
