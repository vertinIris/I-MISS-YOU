-- ============================================================================
-- migration-030: web-vitals RUM 性能监控表
-- ----------------------------------------------------------------------------
-- 背景：配合 js/web-vitals-collector.js 采集真实用户 Core Web Vitals
--       (LCP/INP/CLS/TTFB/FCP)，写入 Supabase 建立性能基线。
-- 设计：
--   - 匿名采集（不记录 user_id），仅记录路径/指标值/设备类型
--   - RLS 允许 anon INSERT（采集用），SELECT 仅 service_role
--   - 自动清理 30 天前数据（Supabase pg_cron 可选）
-- 执行：Supabase Dashboard → SQL Editor，以服务角色执行，可重复跑
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.performance_metrics (
    id          BIGSERIAL    PRIMARY KEY,
    metric_name VARCHAR(20)  NOT NULL,             -- LCP/INP/CLS/TTFB/FCP
    metric_value DOUBLE PRECISION NOT NULL,         -- 毫秒或无量纲（CLS）
    metric_rating VARCHAR(20) NOT NULL DEFAULT 'good', -- good/needs-improvement/poor
    page_path   VARCHAR(500) NOT NULL,              -- 页面路径（如 / 或 /forum/）
    user_agent  TEXT,                               -- 浏览器 UA（用于设备类型分析）
    connection_type VARCHAR(20),                    -- 4g/wifi/3g 等（若可获取）
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引：按指标名 + 时间查询趋势
CREATE INDEX IF NOT EXISTS idx_perf_metrics_name_time
    ON public.performance_metrics(metric_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_path
    ON public.performance_metrics(page_path, created_at DESC);

-- ----------------------------------------------------------------------------
-- RLS：anon 可 INSERT（采集），不可 SELECT（隐私）
-- ----------------------------------------------------------------------------
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- 匿名用户仅可插入（采集端）
DROP POLICY IF EXISTS "anon_can_insert_metrics" ON public.performance_metrics;
CREATE POLICY "anon_can_insert_metrics"
    ON public.performance_metrics
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (TRUE);

-- 所有用户不可 SELECT（仅 service_role 可读，用于后台分析）
DROP POLICY IF EXISTS "no_select_for_anon" ON public.performance_metrics;
CREATE POLICY "no_select_for_anon"
    ON public.performance_metrics
    FOR SELECT
    TO anon, authenticated
    USING (FALSE);

-- ----------------------------------------------------------------------------
-- 可选：pg_cron 自动清理 30 天前数据（需 Supabase 启用 pg_cron 扩展）
-- ----------------------------------------------------------------------------
-- 取消注释以下代码以启用自动清理（需先在 Supabase Dashboard → Database → Extensions 启用 pg_cron）：
-- SELECT cron.schedule(
--   'cleanup-old-perf-metrics',
--   '0 3 * * *',  -- 每天 03:00 UTC
--   $$DELETE FROM public.performance_metrics WHERE created_at < NOW() - INTERVAL '30 days'$$
-- );

-- ----------------------------------------------------------------------------
-- 备注：前端接入指南
-- ----------------------------------------------------------------------------
-- 1. 在 index.html 和 forum/index.html 引入：
--    <script type="module" src="js/web-vitals-collector.js"></script>
-- 2. 脚本自动采集 LCP/INP/CLS/TTFB/FCP，页面卸载时批量上报
-- 3. 后台分析：SELECT metric_name, AVG(metric_value), COUNT(*) FROM performance_metrics
--    WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY metric_name;
