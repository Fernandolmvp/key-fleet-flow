CREATE OR REPLACE FUNCTION public.sync_policy_vehicle_links(_policy_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  a jsonb;
  v_id uuid;
  v_status text;
  np text;
  touched uuid[] := '{}';
  n integer := 0;
BEGIN
  SELECT id, company_id, status, end_date, ai_extracted
    INTO p
    FROM public.insurance_policies
   WHERE id = _policy_id;

  IF p.id IS NULL THEN RETURN 0; END IF;
  IF p.status <> 'ativa' THEN RETURN 0; END IF;
  IF p.end_date IS NOT NULL AND p.end_date < current_date THEN RETURN 0; END IF;

  FOR a IN
    SELECT elem FROM jsonb_array_elements(coalesce(p.ai_extracted->'vehicles','[]'::jsonb)) AS t(elem)
  LOOP
    SELECT m.vehicle_id INTO v_id
      FROM public.match_vehicles_for_ai_plate(
             p.company_id, a->>'plate', a->>'chassis', a->>'renavam'
           ) m
     ORDER BY CASE m.match_by WHEN 'plate' THEN 1 WHEN 'chassis' THEN 2 ELSE 3 END
     LIMIT 1;

    IF v_id IS NULL THEN CONTINUE; END IF;

    np := public.normalize_plate(a->>'plate');
    SELECT v.status::text INTO v_status FROM public.vehicles v WHERE v.id = v_id;

    IF EXISTS (
      SELECT 1 FROM public.policy_external_plates e
       WHERE e.policy_id = p.id
         AND e.normalized_plate = np
    ) THEN
      -- marcação desatualizada: o veículo existe no cadastro e está em uso
      IF v_status IS NOT NULL AND v_status NOT IN ('vendido','leiloado','roubado_furtado','inativo') THEN
        DELETE FROM public.policy_external_plates e
         WHERE e.policy_id = p.id AND e.normalized_plate = np;
      ELSE
        CONTINUE;
      END IF;
    END IF;

    INSERT INTO public.insurance_policy_vehicles (company_id, policy_id, vehicle_id, inclusion_type, notes)
    VALUES (p.company_id, p.id, v_id, 'apolice', 'Vínculo automático (IA)')
    ON CONFLICT (policy_id, vehicle_id) DO UPDATE
      SET removed_at = NULL, updated_at = now()
      WHERE public.insurance_policy_vehicles.removed_at IS NOT NULL;

    touched := touched || v_id;
    n := n + 1;
  END LOOP;

  IF array_length(touched, 1) IS NOT NULL THEN
    PERFORM public.sync_vehicle_insurance_fields(touched);
  END IF;

  RETURN n;
END
$function$;