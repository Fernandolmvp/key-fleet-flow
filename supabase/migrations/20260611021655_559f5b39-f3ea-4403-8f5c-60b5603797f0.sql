
DROP POLICY IF EXISTS "self insert membership" ON public.company_members;

DROP POLICY IF EXISTS "cpm_select_member" ON public.company_payment_methods;
CREATE POLICY "cpm_select_manager" ON public.company_payment_methods
  FOR SELECT TO authenticated
  USING (public.can_manage_fleet(auth.uid(), company_id));

DROP POLICY IF EXISTS "members view fuel stations" ON public.fuel_stations;
CREATE POLICY "managers view fuel stations" ON public.fuel_stations
  FOR SELECT TO authenticated
  USING (public.can_manage_fleet(auth.uid(), company_id));

DROP POLICY IF EXISTS "members view suppliers" ON public.suppliers;
CREATE POLICY "managers view suppliers" ON public.suppliers
  FOR SELECT TO authenticated
  USING (public.can_manage_fleet(auth.uid(), company_id));

DROP POLICY IF EXISTS "members view workshops" ON public.workshops;
CREATE POLICY "managers view workshops" ON public.workshops
  FOR SELECT TO authenticated
  USING (public.can_manage_fleet(auth.uid(), company_id));

DROP POLICY IF EXISTS "anyone reads active plans" ON public.plans;
CREATE POLICY "authenticated reads active plans" ON public.plans
  FOR SELECT TO authenticated
  USING (active = true OR public.is_super_admin(auth.uid()));

REVOKE SELECT (password_hash) ON public.fuel_station_users FROM authenticated, anon;
REVOKE SELECT (password_hash, invite_token) ON public.workshop_users FROM authenticated, anon;

-- checklist-media
DROP POLICY IF EXISTS "auth upload checklist media" ON storage.objects;
DROP POLICY IF EXISTS "auth update checklist media" ON storage.objects;
DROP POLICY IF EXISTS "auth delete checklist media" ON storage.objects;
CREATE POLICY "company upload checklist media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checklist-media' AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "company update checklist media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'checklist-media' AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "company delete checklist media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'checklist-media' AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid));

-- driver-photos
DROP POLICY IF EXISTS "driver photos auth write" ON storage.objects;
DROP POLICY IF EXISTS "driver photos auth update" ON storage.objects;
DROP POLICY IF EXISTS "driver photos auth delete" ON storage.objects;
CREATE POLICY "driver photos company write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'driver-photos' AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "driver photos company update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'driver-photos' AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "driver photos company delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'driver-photos' AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid));

-- fuel-photos
DROP POLICY IF EXISTS "fuel-photos auth upload" ON storage.objects;
DROP POLICY IF EXISTS "fuel-photos auth update" ON storage.objects;
CREATE POLICY "fuel-photos company upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fuel-photos' AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "fuel-photos company update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'fuel-photos' AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

-- vehicle-photos
DROP POLICY IF EXISTS "vehicle photos auth write" ON storage.objects;
DROP POLICY IF EXISTS "vehicle photos auth update" ON storage.objects;
DROP POLICY IF EXISTS "vehicle photos auth delete" ON storage.objects;
CREATE POLICY "vehicle photos company write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-photos' AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "vehicle photos company update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'vehicle-photos' AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "vehicle photos company delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-photos' AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid));
