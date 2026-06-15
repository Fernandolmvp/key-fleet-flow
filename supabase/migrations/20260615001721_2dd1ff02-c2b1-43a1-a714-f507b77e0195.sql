
-- Restrict fipe_cache writes to service_role only (it's a shared lookup cache)
DROP POLICY IF EXISTS "fipe_cache_write_auth" ON public.fipe_cache;
DROP POLICY IF EXISTS "fipe_cache_update_auth" ON public.fipe_cache;

CREATE POLICY "fipe_cache_write_service" ON public.fipe_cache
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "fipe_cache_update_service" ON public.fipe_cache
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.fipe_cache FROM authenticated, anon;

-- Add explicit service_role-only policies on driver_otp_codes (currently no policies)
DROP POLICY IF EXISTS "driver_otp_codes_service_all" ON public.driver_otp_codes;
CREATE POLICY "driver_otp_codes_service_all" ON public.driver_otp_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.driver_otp_codes FROM authenticated, anon;
GRANT ALL ON public.driver_otp_codes TO service_role;
