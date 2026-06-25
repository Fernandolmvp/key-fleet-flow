-- 1) Add DELETE policy for fuel-photos storage, scoped to fleet managers
CREATE POLICY "fuel-photos manager delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'fuel-photos'
  AND can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 2) Drop unrestricted anon/authenticated INSERT on public.leads.
-- Lead capture flows through the create-lead edge function (service_role), which bypasses RLS.
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;
