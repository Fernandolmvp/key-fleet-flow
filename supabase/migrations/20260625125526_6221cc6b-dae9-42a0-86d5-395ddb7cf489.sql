-- Allow company admins/managers to view profiles of users that belong to the same company
CREATE POLICY "company managers view member profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.company_members cm_self
    JOIN public.user_roles ur
      ON ur.user_id = auth.uid()
     AND ur.company_id = cm_self.company_id
     AND ur.role IN ('admin','gestor_frota')
    JOIN public.company_members cm_target
      ON cm_target.company_id = cm_self.company_id
     AND cm_target.user_id = profiles.id
    WHERE cm_self.user_id = auth.uid()
  )
);