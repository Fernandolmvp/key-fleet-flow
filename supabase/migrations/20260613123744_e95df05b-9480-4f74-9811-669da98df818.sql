
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  nome TEXT NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_company ON public.api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage api_keys"
  ON public.api_keys FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Company managers manage api_keys"
  ON public.api_keys FOR ALL
  USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE OR REPLACE FUNCTION public.set_updated_at_api_keys()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_api_keys();

-- Tabela de logs de uso da API pública (auditoria)
CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  company_id UUID,
  key_name TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status INT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_company ON public.api_request_logs(company_id, created_at DESC);

GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin read api logs"
  ON public.api_request_logs FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Company managers read api logs"
  ON public.api_request_logs FOR SELECT
  USING (company_id IS NOT NULL AND public.can_manage_fleet(auth.uid(), company_id));
