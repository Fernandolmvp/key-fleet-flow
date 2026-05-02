-- 1) Adiciona coluna tab (nullable) em role_permissions
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS tab text;

-- Recria a unicidade considerando tab (NULL = nível módulo)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_permissions_company_id_role_module_action_key'
  ) THEN
    ALTER TABLE public.role_permissions
      DROP CONSTRAINT role_permissions_company_id_role_module_action_key;
  END IF;
END$$;

-- Índice único parcial: regras a nível de módulo (tab IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_module_unique
  ON public.role_permissions (company_id, role, module, action)
  WHERE tab IS NULL;

-- Índice único parcial: regras a nível de aba
CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_tab_unique
  ON public.role_permissions (company_id, role, module, action, tab)
  WHERE tab IS NOT NULL;

-- 2) Atualiza has_permission para considerar tab opcional
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _company_id uuid, _module text, _action text, _tab text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(_user_id, _company_id, 'admin'::app_role)
    OR EXISTS (
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
        AND (
          (_tab IS NOT NULL AND rp.tab = _tab)
          OR (rp.tab IS NULL)
        )
    )
$function$;