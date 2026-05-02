CREATE OR REPLACE FUNCTION public.seed_default_role_permissions(_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    {"role":"gestor_frota","module":"vehicles","actions":["view","create","edit","delete","approve","export"]},
    {"role":"gestor_frota","module":"drivers","actions":["view","create","edit","delete","approve","export"]},
    {"role":"gestor_frota","module":"fuel","actions":["view","create","edit","delete","approve","export"]},
    {"role":"gestor_frota","module":"approvals","actions":["view","create","edit","delete","approve","export"]},
    {"role":"gestor_frota","module":"maintenance","actions":["view","create","edit","delete","approve","export"]},
    {"role":"gestor_frota","module":"tires","actions":["view","create","edit","delete","approve","export"]},
    {"role":"gestor_frota","module":"checklists","actions":["view","create","edit","delete","approve","export"]},
    {"role":"gestor_frota","module":"documents","actions":["view","create","edit","delete","approve","export"]},
    {"role":"gestor_frota","module":"insurance","actions":["view","create","edit","delete","approve","export"]},
    {"role":"gestor_frota","module":"brokers","actions":["view","create","edit","delete","approve","export"]},
    {"role":"gestor_frota","module":"fuel_stations","actions":["view","create","edit","delete","approve","export"]},
    {"role":"gestor_frota","module":"reports","actions":["view","create","edit","delete","approve","export"]},
    {"role":"gestor_frota","module":"settings","actions":["view","create","edit","delete","approve","export"]},

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
      ON CONFLICT (company_id, role, module, action) WHERE tab IS NULL
      DO NOTHING;
    END LOOP;
  END LOOP;
END;
$function$;