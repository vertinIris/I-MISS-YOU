-- CloudBase → Cloudflare Pages 迁移：Supabase CORS + Redirect URLs 配置
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴执行

-- ============================================================
-- 步骤 1：添加 Cloudflare Pages 域名到 CORS 白名单
-- ============================================================
-- 注意：将 '<your-pages-domain>' 替换为你在 Cloudflare Pages 上获得的实际域名
-- 示例：https://i-miss-you.pages.dev

-- 查询当前已有的 CORS 配置
SELECT ORIGIN, HEADERS, METHODS FROM pg_catalog.pg_listen WHERE unlisten_command IS NULL;

-- 在 Supabase Dashboard → Settings → API → CORS 中添加以下域名：
-- 
-- 手动添加（推荐使用 Dashboard UI，更直观）：
-- 1. https://i-miss-you.pages.dev （你的 Cloudflare Pages 域名）
-- 2. *.pages.dev （通配符，支持预览部署）
-- 
-- 或者通过 SQL（如果有 pg_catalog 权限）：
-- ALTER TABLE ... ADD ...

-- ============================================================
-- 步骤 2：添加 Redirect URLs（邮箱确认链接跳转）
-- ============================================================
-- 在 Supabase Dashboard → Authentication → URL Configuration 中添加：
-- 
-- Redirect URLs 添加：
-- https://i-miss-you.pages.dev/**
-- https://i-miss-you.pages.dev/reset-password.html
-- 
-- Site URL 更新为：
-- https://i-miss-you.pages.dev

-- ============================================================
-- 步骤 3：验证配置
-- ============================================================
-- 验证方法：
-- 1. 打开 Cloudflare Pages 域名
-- 2. 尝试登录/注册
-- 3. 检查 Supabase 请求是否返回 200（Network 面板）
-- 4. 点击邮箱确认链接，确认跳转到 Cloudflare Pages 域名
