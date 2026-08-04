-- ============================================================================
-- migration-027 · profiles 本人可 INSERT + 显示名 UPDATE 可写 nickname
-- ============================================================================
-- 问题：论坛「保存显示名」使用 upsert，在无 profiles 行或仅有 UPDATE 策略时，
-- INSERT 路径触发：new row violates row-level security policy for table "profiles"
--
-- 请在 Supabase SQL Editor 执行本文件。
-- ============================================================================

-- 本人可插入自己的资料行（触发器未建行时的兜底）
DROP POLICY IF EXISTS "profiles_owner_insert" ON public.profiles;
CREATE POLICY "profiles_owner_insert"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 本人可更新自己的昵称/头像色；禁止改 role / is_banned（若列存在）
DROP POLICY IF EXISTS "profiles_owner_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_update_v2" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_update_v3" ON public.profiles;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_banned'
    ) THEN
        EXECUTE $p$
            CREATE POLICY "profiles_owner_update_v3"
                ON public.profiles FOR UPDATE
                USING (auth.uid() = id)
                WITH CHECK (
                    auth.uid() = id
                    AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
                    AND is_banned IS NOT DISTINCT FROM (SELECT p.is_banned FROM public.profiles p WHERE p.id = auth.uid())
                )
        $p$;
    ELSE
        EXECUTE $p$
            CREATE POLICY "profiles_owner_update_v3"
                ON public.profiles FOR UPDATE
                USING (auth.uid() = id)
                WITH CHECK (auth.uid() = id)
        $p$;
    END IF;
END $$;

COMMENT ON POLICY "profiles_owner_insert" ON public.profiles IS
    'Allow authenticated user to insert their own profile row (nickname fix)';
