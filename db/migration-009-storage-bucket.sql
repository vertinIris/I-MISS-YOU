-- ============================================================================
-- 飞行雪绒 v9.3 — Storage 存储桶配置
-- 前提: 已执行 migration-001~008
-- 执行: Supabase Dashboard → SQL Editor → Run
-- ============================================================================

-- ============================================================================
-- 1. 创建作品附件存储桶
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('works', 'works', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Storage RLS 策略
-- ============================================================================

-- 认证用户可上传
DROP POLICY IF EXISTS "works_auth_upload" ON storage.objects;
CREATE POLICY "works_auth_upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'works');

-- 公开读取
DROP POLICY IF EXISTS "works_public_read" ON storage.objects;
CREATE POLICY "works_public_read" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'works');

-- 作者可删除自己的文件
DROP POLICY IF EXISTS "works_owner_delete" ON storage.objects;
CREATE POLICY "works_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'works' AND owner = auth.uid());

-- ============================================================================
-- 3. 文件大小限制策略（通过 RPC 校验）
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_upload(
    p_filename    VARCHAR,
    p_content_type VARCHAR,
    p_file_size   BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_allowed_types TEXT[] := ARRAY[
        'text/plain', 'text/markdown',
        'image/jpeg', 'image/png', 'image/gif'
    ];
    v_max_sizes JSONB := '{
        "text/plain": 10485760,
        "text/markdown": 10485760,
        "image/jpeg": 5242880,
        "image/png": 5242880,
        "image/gif": 5242880
    }'::JSONB;
    v_max BIGINT;
BEGIN
    -- 检查文件类型
    IF NOT p_content_type = ANY(v_allowed_types) THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', '不支持的文件类型: ' || p_content_type
        );
    END IF;

    -- 检查文件大小
    v_max := (v_max_sizes->>p_content_type)::BIGINT;
    IF p_file_size > v_max THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', '文件过大: ' || (p_file_size / 1048576)::TEXT || 'MB，上限 ' || (v_max / 1048576)::TEXT || 'MB'
        );
    END IF;

    RETURN jsonb_build_object('valid', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_upload(VARCHAR, VARCHAR, BIGINT)
    TO authenticated, anon;
