DROP POLICY IF EXISTS "documents_select_company_members" ON storage.objects;
CREATE POLICY "documents_select_company_members"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND public.is_company_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);

DROP POLICY IF EXISTS "documents_insert_fleet_managers" ON storage.objects;
CREATE POLICY "documents_insert_fleet_managers"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND public.can_manage_fleet(auth.uid(), (storage.foldername(name))[1]::uuid)
);

DROP POLICY IF EXISTS "documents_update_fleet_managers" ON storage.objects;
CREATE POLICY "documents_update_fleet_managers"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents'
  AND public.can_manage_fleet(auth.uid(), (storage.foldername(name))[1]::uuid)
);

DROP POLICY IF EXISTS "documents_delete_fleet_managers" ON storage.objects;
CREATE POLICY "documents_delete_fleet_managers"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND public.can_manage_fleet(auth.uid(), (storage.foldername(name))[1]::uuid)
);