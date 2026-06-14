
-- 1) cnpj_cache: writes service_role only
DROP POLICY IF EXISTS "cnpj_cache_write_auth" ON public.cnpj_cache;
DROP POLICY IF EXISTS "cnpj_cache_update_auth" ON public.cnpj_cache;

CREATE POLICY "cnpj_cache_write_service"
  ON public.cnpj_cache FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "cnpj_cache_update_service"
  ON public.cnpj_cache FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

-- 2) company-logos storage bucket: scope writes by company folder
DROP POLICY IF EXISTS "company logos auth write" ON storage.objects;

CREATE POLICY "company logos auth write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "company logos auth update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "company logos auth delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- 3) Hide credential columns from Data API
REVOKE SELECT (password_hash) ON public.fuel_station_users FROM authenticated, anon;
REVOKE SELECT (password_hash, invite_token) ON public.workshop_users FROM authenticated, anon;
