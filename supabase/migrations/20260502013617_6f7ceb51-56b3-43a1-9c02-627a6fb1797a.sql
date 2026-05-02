-- Tabela role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  role public.app_role NOT NULL,
  module text NOT NULL,
  action text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, role, module, action)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_company_role
  ON public.role_permissions (company_id, role);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members view role permissions" ON public.role_permissions;
CREATE POLICY "members view role permissions"
  ON public.role_permissions FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "admins manage role permissions" ON public.role_permissions;
CREATE POLICY "admins manage role permissions"
  ON public.role_permissions FOR ALL
  USING (public.has_role(auth.uid(), company_id, 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), company_id, 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_role_permissions_updated_at ON public.role_permissions;
CREATE TRIGGER trg_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Função has_permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _company_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp
      ON rp.company_id = ur.company_id
     AND rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND ur.company_id = _company_id
      AND rp.module = _module
      AND rp.action = _action
      AND rp.allowed = true
  )
  OR public.has_role(_user_id, _company_id, 'admin'::app_role)
$$;

-- Função seed
CREATE OR REPLACE FUNCTION public.seed_default_role_permissions(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_perms jsonb := '[
    {"role":"admin","module":"vehicles","actions":["view","create","edit","delete","export"]},
    {"role":"admin","module":"drivers","actions":["view","create","edit","delete","export"]},
    {"role":"admin","module":"fuel","actions":["view","create","edit","delete","export"]},
    {"role":"admin","module":"approvals","actions":["view","create","edit","delete","approve"]},
    {"role":"admin","module":"maintenance","actions":["view","create","edit","delete","export"]},
    {"role":"admin","module":"tires","actions":["view","create","edit","delete","export"]},
    {"role":"admin","module":"checklists","actions":["view","create","edit","delete","export"]},
    {"role":"admin","module":"documents","actions":["view","create","edit","delete","export"]},
    {"role":"admin","module":"insurance","actions":["view","create","edit","delete","export"]},
    {"role":"admin","module":"brokers","actions":["view","create","edit","delete"]},
    {"role":"admin","module":"fuel_stations","actions":["view","create","edit","delete"]},
    {"role":"admin","module":"reports","actions":["view","export"]},
    {"role":"admin","module":"settings","actions":["view","create","edit","delete"]},

    {"role":"gestor_frota","module":"vehicles","actions":["view","create","edit","delete","export"]},
    {"role":"gestor_frota","module":"drivers","actions":["view","create","edit","delete","export"]},
    {"role":"gestor_frota","module":"fuel","actions":["view","create","edit","delete","export"]},
    {"role":"gestor_frota","module":"approvals","actions":["view","create","edit","approve"]},
    {"role":"gestor_frota","module":"maintenance","actions":["view","create","edit","delete","export"]},
    {"role":"gestor_frota","module":"tires","actions":["view","create","edit","delete","export"]},
    {"role":"gestor_frota","module":"checklists","actions":["view","create","edit","delete","export"]},
    {"role":"gestor_frota","module":"documents","actions":["view","create","edit","delete","export"]},
    {"role":"gestor_frota","module":"insurance","actions":["view"]},
    {"role":"gestor_frota","module":"brokers","actions":["view"]},
    {"role":"gestor_frota","module":"fuel_stations","actions":["view","create","edit"]},
    {"role":"gestor_frota","module":"reports","actions":["view","export"]},

    {"role":"financeiro","module":"vehicles","actions":["view","export"]},
    {"role":"financeiro","module":"drivers","actions":["view"]},
    {"role":"financeiro","module":"fuel","actions":["view","export"]},
    {"role":"financeiro","module":"approvals","actions":["view"]},
    {"role":"financeiro","module":"maintenance","actions":["view","export"]},
    {"role":"financeiro","module":"tires","actions":["view"]},
    {"role":"financeiro","module":"documents","actions":["view"]},
    {"role":"financeiro","module":"insurance","actions":["view","create","edit","delete","export"]},
    {"role":"financeiro","module":"brokers","actions":["view","create","edit","delete"]},
    {"role":"financeiro","module":"reports","actions":["view","export"]},

    {"role":"manutencao","module":"vehicles","actions":["view"]},
    {"role":"manutencao","module":"drivers","actions":["view"]},
    {"role":"manutencao","module":"fuel","actions":["view"]},
    {"role":"manutencao","module":"maintenance","actions":["view","create","edit","delete","export"]},
    {"role":"manutencao","module":"tires","actions":["view","create","edit","delete"]},
    {"role":"manutencao","module":"checklists","actions":["view","create","edit"]},
    {"role":"manutencao","module":"documents","actions":["view"]},
    {"role":"manutencao","module":"reports","actions":["view"]},

    {"role":"auditor","module":"vehicles","actions":["view","export"]},
    {"role":"auditor","module":"drivers","actions":["view","export"]},
    {"role":"auditor","module":"fuel","actions":["view","export"]},
    {"role":"auditor","module":"approvals","actions":["view"]},
    {"role":"auditor","module":"maintenance","actions":["view","export"]},
    {"role":"auditor","module":"tires","actions":["view"]},
    {"role":"auditor","module":"checklists","actions":["view","export"]},
    {"role":"auditor","module":"documents","actions":["view","export"]},
    {"role":"auditor","module":"insurance","actions":["view","export"]},
    {"role":"auditor","module":"brokers","actions":["view"]},
    {"role":"auditor","module":"fuel_stations","actions":["view"]},
    {"role":"auditor","module":"reports","actions":["view","export"]},
    {"role":"auditor","module":"settings","actions":["view"]},

    {"role":"visualizador","module":"vehicles","actions":["view"]},
    {"role":"visualizador","module":"drivers","actions":["view"]},
    {"role":"visualizador","module":"fuel","actions":["view"]},
    {"role":"visualizador","module":"approvals","actions":["view"]},
    {"role":"visualizador","module":"maintenance","actions":["view"]},
    {"role":"visualizador","module":"tires","actions":["view"]},
    {"role":"visualizador","module":"checklists","actions":["view"]},
    {"role":"visualizador","module":"documents","actions":["view"]},
    {"role":"visualizador","module":"insurance","actions":["view"]},
    {"role":"visualizador","module":"brokers","actions":["view"]},
    {"role":"visualizador","module":"fuel_stations","actions":["view"]},
    {"role":"visualizador","module":"reports","actions":["view"]}
  ]'::jsonb;
  v_item jsonb;
  v_action text;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_perms) LOOP
    FOR v_action IN SELECT jsonb_array_elements_text(v_item->'actions') LOOP
      INSERT INTO public.role_permissions (company_id, role, module, action, allowed)
      VALUES (
        _company_id,
        (v_item->>'role')::public.app_role,
        v_item->>'module',
        v_action,
        true
      )
      ON CONFLICT (company_id, role, module, action) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

-- Trigger ao criar empresa
CREATE OR REPLACE FUNCTION public.tg_company_seed_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.seed_default_role_permissions(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_company_seed_permissions ON public.companies;
CREATE TRIGGER trg_company_seed_permissions
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_company_seed_permissions();

-- Semear empresas existentes
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_default_role_permissions(c.id);
  END LOOP;
END $$;