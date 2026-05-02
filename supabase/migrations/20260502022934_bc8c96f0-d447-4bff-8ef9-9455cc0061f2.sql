CREATE OR REPLACE FUNCTION public.seed_default_role_permissions(_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_modules text[] := ARRAY[
    'vehicles','drivers','fuel','approvals','maintenance','tires',
    'checklists','documents','insurance','brokers','fuel_stations',
    'reports','settings'
  ];
  v_actions text[] := ARRAY['view','create','edit','delete','approve','export'];
  v_roles public.app_role[] := ARRAY[
    'admin','gestor_frota','financeiro','manutencao','auditor','visualizador'
  ]::public.app_role[];
  v_tabs jsonb := '{
    "vehicles":["ativos","vendidos","inativos","todos"],
    "drivers":["ativos","inativos","todos"],
    "approvals":["pendente","aprovada","anomalia","historico"],
    "maintenance":["records","schedules","calendar","costs"],
    "tires":["list","map","movements","alerts"],
    "checklists":["pendentes","historico","modelos"],
    "documents":["vehicles","drivers"],
    "fuel_stations":["ativos","inativos","todos"]
  }'::jsonb;
  r public.app_role;
  m text;
  a text;
  t text;
BEGIN
  -- Regras a nível de MÓDULO: tudo liberado para todos os perfis
  FOREACH r IN ARRAY v_roles LOOP
    FOREACH m IN ARRAY v_modules LOOP
      FOREACH a IN ARRAY v_actions LOOP
        INSERT INTO public.role_permissions (company_id, role, module, action, allowed, tab)
        VALUES (_company_id, r, m, a, true, NULL)
        ON CONFLICT (company_id, role, module, action) WHERE tab IS NULL
        DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Regras a nível de ABA: tudo liberado para todos os perfis
  FOREACH r IN ARRAY v_roles LOOP
    FOR m IN SELECT jsonb_object_keys(v_tabs) LOOP
      FOR t IN SELECT jsonb_array_elements_text(v_tabs->m) LOOP
        FOREACH a IN ARRAY v_actions LOOP
          INSERT INTO public.role_permissions (company_id, role, module, action, allowed, tab)
          VALUES (_company_id, r, m, a, true, t)
          ON CONFLICT (company_id, role, module, action, tab) WHERE tab IS NOT NULL
          DO NOTHING;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$function$;