-- Restrict public read policies on private storage buckets to authenticated members
DROP POLICY IF EXISTS "checklist media public read" ON storage.objects;
CREATE POLICY "checklist media company read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'checklist-media' AND is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS "driver photos public read" ON storage.objects;
CREATE POLICY "driver photos company read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'driver-photos' AND is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS "fuel-photos public read" ON storage.objects;
CREATE POLICY "fuel-photos company read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'fuel-photos' AND is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid));