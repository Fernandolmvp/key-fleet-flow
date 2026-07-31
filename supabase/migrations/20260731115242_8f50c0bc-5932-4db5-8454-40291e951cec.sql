DROP POLICY IF EXISTS "driver update own" ON storage.objects;
CREATE POLICY "driver update own" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'driver-uploads' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'driver-uploads' AND (auth.uid())::text = (storage.foldername(name))[1]);