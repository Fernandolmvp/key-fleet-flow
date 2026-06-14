ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT ARRAY['*']::text[];

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE TABLE IF NOT EXISTS public.api_write_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  api_key_id uuid NULL,
  key_name text NULL,
  resource text NOT NULL,
  action text NOT NULL,
  entity_id uuid NULL,
  payload jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.api_write_audit TO authenticated;
GRANT ALL ON public.api_write_audit TO service_role;

ALTER TABLE public.api_write_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da empresa veem auditoria"
ON public.api_write_audit
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid() AND cm.company_id = api_write_audit.company_id
  )
);

CREATE INDEX IF NOT EXISTS api_write_audit_company_created_idx
  ON public.api_write_audit (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_write_audit_resource_idx
  ON public.api_write_audit (company_id, resource, created_at DESC);