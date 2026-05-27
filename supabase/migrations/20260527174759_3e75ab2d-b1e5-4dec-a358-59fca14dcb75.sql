
DROP POLICY IF EXISTS "self bootstrap admin role" ON public.user_roles;

DROP POLICY IF EXISTS "managers view otp codes" ON public.driver_otp_codes;

DROP POLICY IF EXISTS "members view station users" ON public.fuel_station_users;
CREATE POLICY "managers view station users"
ON public.fuel_station_users
FOR SELECT TO authenticated
USING (public.can_manage_fleet(auth.uid(), company_id));

DROP POLICY IF EXISTS "members view workshop users" ON public.workshop_users;
CREATE POLICY "managers view workshop users"
ON public.workshop_users
FOR SELECT TO authenticated
USING (public.can_manage_fleet(auth.uid(), company_id));

DROP POLICY IF EXISTS "members read partner invitations" ON public.partner_invitations;
CREATE POLICY "managers read partner invitations"
ON public.partner_invitations
FOR SELECT TO authenticated
USING (public.can_manage_fleet(auth.uid(), company_id));

DROP POLICY IF EXISTS "driver read own + managers all" ON storage.objects;
CREATE POLICY "driver read own + managers same company"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'driver-uploads'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.drivers d
      JOIN public.user_roles ur ON ur.company_id = d.company_id
      WHERE d.user_id::text = (storage.foldername(name))[1]
        AND ur.user_id = auth.uid()
        AND ur.role IN ('admin','gestor_frota')
    )
  )
);

DROP POLICY IF EXISTS "fuel receipts auth read" ON storage.objects;
DROP POLICY IF EXISTS "fuel receipts auth write" ON storage.objects;
DROP POLICY IF EXISTS "fuel receipts auth update" ON storage.objects;
DROP POLICY IF EXISTS "fuel receipts auth delete" ON storage.objects;

CREATE POLICY "fuel receipts read company scoped"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'fuel-receipts'
  AND ((storage.foldername(name))[1] = 'posto'
       OR public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid))
);
CREATE POLICY "fuel receipts write company scoped"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'fuel-receipts'
  AND ((storage.foldername(name))[1] = 'posto'
       OR public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid))
);
CREATE POLICY "fuel receipts update company scoped"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'fuel-receipts'
  AND ((storage.foldername(name))[1] = 'posto'
       OR public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid))
);
CREATE POLICY "fuel receipts delete company scoped"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'fuel-receipts'
  AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "members read insurance policies" ON storage.objects;
DROP POLICY IF EXISTS "members upload insurance policies" ON storage.objects;
DROP POLICY IF EXISTS "members update insurance policies" ON storage.objects;
DROP POLICY IF EXISTS "members delete insurance policies" ON storage.objects;

CREATE POLICY "insurance policies read company scoped"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'insurance-policies'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "insurance policies write company scoped"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'insurance-policies'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "insurance policies update company scoped"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'insurance-policies'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "insurance policies delete company scoped"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'insurance-policies'
  AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "vehicle docs auth read" ON storage.objects;
DROP POLICY IF EXISTS "vehicle docs auth write" ON storage.objects;
DROP POLICY IF EXISTS "vehicle docs auth update" ON storage.objects;
DROP POLICY IF EXISTS "vehicle docs auth delete" ON storage.objects;

CREATE POLICY "vehicle docs read company scoped"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'vehicle-docs'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "vehicle docs write company scoped"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-docs'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "vehicle docs update company scoped"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'vehicle-docs'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "vehicle docs delete company scoped"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'vehicle-docs'
  AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
