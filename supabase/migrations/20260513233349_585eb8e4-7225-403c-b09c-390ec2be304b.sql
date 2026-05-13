-- 1) Trigger anti-fraude: aceita placa Mercosul, chassi e RENAVAM do PDF.
CREATE OR REPLACE FUNCTION public.tg_ipv_block_ai_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_plate_norm text;
  v_chassis_norm text;
  v_renavam_norm text;
  v_in_ai boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.is_ai_policy(NEW.policy_id) THEN
      SELECT public.normalize_plate(v.plate),
             upper(regexp_replace(coalesce(v.chassis,''),'[^A-Za-z0-9]','','g')),
             regexp_replace(coalesce(v.renavam,''),'[^0-9]','','g')
        INTO v_plate_norm, v_chassis_norm, v_renavam_norm
        FROM public.vehicles v WHERE v.id = NEW.vehicle_id;

      SELECT EXISTS (
        -- placas em ai_extracted.plates[]
        SELECT 1
          FROM public.insurance_policies p
          CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.ai_extracted->'plates','[]'::jsonb)) AS pdf_plate
         WHERE p.id = NEW.policy_id
           AND public.normalize_plate(pdf_plate) = v_plate_norm
        UNION ALL
        -- veículos em ai_extracted.vehicles[]: aceita placa, chassi ou renavam
        SELECT 1
          FROM public.insurance_policies p
          CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.ai_extracted->'vehicles','[]'::jsonb)) AS elem
         WHERE p.id = NEW.policy_id
           AND (
             (v_plate_norm IS NOT NULL AND v_plate_norm <> ''
              AND public.normalize_plate(elem->>'plate') = v_plate_norm)
             OR (v_chassis_norm <> ''
                 AND upper(regexp_replace(coalesce(elem->>'chassis',''),'[^A-Za-z0-9]','','g')) IN (v_chassis_norm, right(v_chassis_norm,8)))
             OR (v_renavam_norm <> ''
                 AND regexp_replace(coalesce(elem->>'renavam',''),'[^0-9]','','g') = v_renavam_norm)
           )
      ) INTO v_in_ai;

      IF NOT v_in_ai THEN
        RAISE EXCEPTION 'Apólice importada via IA — só é permitido vincular veículos cujas placas, chassi ou RENAVAM constam no PDF.';
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF public.is_ai_policy(NEW.policy_id) THEN
      IF NEW.policy_id IS DISTINCT FROM OLD.policy_id
         OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id THEN
        RAISE EXCEPTION 'Apólice importada via IA — não é permitido alterar vínculos.';
      END IF;
      IF OLD.removed_at IS NOT NULL AND NEW.removed_at IS NULL THEN
        SELECT public.normalize_plate(v.plate),
               upper(regexp_replace(coalesce(v.chassis,''),'[^A-Za-z0-9]','','g')),
               regexp_replace(coalesce(v.renavam,''),'[^0-9]','','g')
          INTO v_plate_norm, v_chassis_norm, v_renavam_norm
          FROM public.vehicles v WHERE v.id = NEW.vehicle_id;

        SELECT EXISTS (
          SELECT 1
            FROM public.insurance_policies p
            CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.ai_extracted->'plates','[]'::jsonb)) AS pdf_plate
           WHERE p.id = NEW.policy_id
             AND public.normalize_plate(pdf_plate) = v_plate_norm
          UNION ALL
          SELECT 1
            FROM public.insurance_policies p
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.ai_extracted->'vehicles','[]'::jsonb)) AS elem
           WHERE p.id = NEW.policy_id
             AND (
               (v_plate_norm IS NOT NULL AND v_plate_norm <> '' AND public.normalize_plate(elem->>'plate') = v_plate_norm)
               OR (v_chassis_norm <> '' AND upper(regexp_replace(coalesce(elem->>'chassis',''),'[^A-Za-z0-9]','','g')) IN (v_chassis_norm, right(v_chassis_norm,8)))
               OR (v_renavam_norm <> '' AND regexp_replace(coalesce(elem->>'renavam',''),'[^0-9]','','g') = v_renavam_norm)
             )
        ) INTO v_in_ai;

        IF NOT v_in_ai THEN
          RAISE EXCEPTION 'Apólice importada via IA — não é permitido reativar vínculo fora do PDF.';
        END IF;
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF public.is_ai_policy(OLD.policy_id) THEN
      RAISE EXCEPTION 'Apólice importada via IA — não é permitido excluir vínculos.';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- 2) RPC para vincular automaticamente (chamada do frontend)
CREATE OR REPLACE FUNCTION public.auto_link_ai_policies(_company_id uuid)
RETURNS TABLE(linked_count int, synced_vehicles uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
  v_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF _company_id IS NULL THEN
    RETURN QUERY SELECT 0, ARRAY[]::uuid[];
    RETURN;
  END IF;

  IF NOT (public.can_manage_fleet(auth.uid(), _company_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  WITH ai AS (
    SELECT p.id AS policy_id,
           coalesce(elem->>'inclusion_type','apolice') AS inclusion_type,
           public.normalize_plate(elem->>'plate') AS np,
           upper(regexp_replace(coalesce(elem->>'chassis',''),'[^A-Za-z0-9]','','g')) AS ch,
           regexp_replace(coalesce(elem->>'renavam',''),'[^0-9]','','g') AS rn
      FROM public.insurance_policies p
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.ai_extracted->'vehicles','[]'::jsonb)) elem
     WHERE p.company_id = _company_id
       AND p.status = 'ativa'
       AND (p.end_date IS NULL OR p.end_date >= current_date)
  ),
  ai_plates AS (
    SELECT p.id AS policy_id, 'apolice'::text AS inclusion_type,
           public.normalize_plate(plate_val) AS np, ''::text AS ch, ''::text AS rn
      FROM public.insurance_policies p
      CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(p.ai_extracted->'plates','[]'::jsonb)) plate_val
     WHERE p.company_id = _company_id
       AND p.status = 'ativa'
       AND (p.end_date IS NULL OR p.end_date >= current_date)
       AND jsonb_array_length(coalesce(p.ai_extracted->'vehicles','[]'::jsonb)) = 0
  ),
  candidates AS (SELECT * FROM ai UNION ALL SELECT * FROM ai_plates),
  matches AS (
    SELECT DISTINCT ON (cd.policy_id, v.id)
           cd.policy_id, v.id AS vehicle_id,
           CASE WHEN cd.inclusion_type='adendo' THEN 'adendo' ELSE 'apolice' END AS inclusion_type
      FROM candidates cd
      JOIN public.vehicles v ON v.company_id = _company_id
       AND (
         (cd.np <> '' AND v.normalized_plate = cd.np)
         OR (cd.ch <> '' AND upper(regexp_replace(coalesce(v.chassis,''),'[^A-Za-z0-9]','','g')) IN (cd.ch, right(cd.ch,8)))
         OR (cd.rn <> '' AND regexp_replace(coalesce(v.renavam,''),'[^0-9]','','g') = cd.rn)
       )
  ),
  ins AS (
    INSERT INTO public.insurance_policy_vehicles
      (company_id, policy_id, vehicle_id, inclusion_type, removed_at, included_at)
    SELECT _company_id, m.policy_id, m.vehicle_id, m.inclusion_type, NULL, current_date
      FROM matches m
    ON CONFLICT (policy_id, vehicle_id) DO UPDATE
      SET removed_at = NULL,
          inclusion_type = EXCLUDED.inclusion_type,
          updated_at = now()
    RETURNING vehicle_id
  )
  SELECT count(*)::int, coalesce(array_agg(DISTINCT vehicle_id), ARRAY[]::uuid[])
    INTO v_inserted, v_ids
    FROM ins;

  IF array_length(v_ids, 1) IS NOT NULL THEN
    PERFORM public.sync_vehicle_insurance_fields(v_ids);
  END IF;

  RETURN QUERY SELECT v_inserted, v_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_link_ai_policies(uuid) TO authenticated;

-- 3) Backfill imediato dos dados já existentes
DO $$
DECLARE
  c RECORD;
  v_ids uuid[];
BEGIN
  FOR c IN
    SELECT DISTINCT company_id
      FROM public.insurance_policies
     WHERE status='ativa'
       AND ai_extracted IS NOT NULL
       AND (jsonb_array_length(coalesce(ai_extracted->'vehicles','[]'::jsonb)) > 0
            OR jsonb_array_length(coalesce(ai_extracted->'plates','[]'::jsonb)) > 0)
  LOOP
    WITH ai AS (
      SELECT p.id AS policy_id,
             coalesce(elem->>'inclusion_type','apolice') AS inclusion_type,
             public.normalize_plate(elem->>'plate') AS np,
             upper(regexp_replace(coalesce(elem->>'chassis',''),'[^A-Za-z0-9]','','g')) AS ch,
             regexp_replace(coalesce(elem->>'renavam',''),'[^0-9]','','g') AS rn
        FROM public.insurance_policies p
        CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.ai_extracted->'vehicles','[]'::jsonb)) elem
       WHERE p.company_id = c.company_id AND p.status='ativa'
         AND (p.end_date IS NULL OR p.end_date >= current_date)
    ),
    ai_plates AS (
      SELECT p.id AS policy_id, 'apolice'::text AS inclusion_type,
             public.normalize_plate(plate_val) AS np, ''::text AS ch, ''::text AS rn
        FROM public.insurance_policies p
        CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(p.ai_extracted->'plates','[]'::jsonb)) plate_val
       WHERE p.company_id = c.company_id AND p.status='ativa'
         AND (p.end_date IS NULL OR p.end_date >= current_date)
         AND jsonb_array_length(coalesce(p.ai_extracted->'vehicles','[]'::jsonb)) = 0
    ),
    candidates AS (SELECT * FROM ai UNION ALL SELECT * FROM ai_plates),
    matches AS (
      SELECT DISTINCT ON (cd.policy_id, v.id)
             cd.policy_id, v.id AS vehicle_id,
             CASE WHEN cd.inclusion_type='adendo' THEN 'adendo' ELSE 'apolice' END AS inclusion_type
        FROM candidates cd
        JOIN public.vehicles v ON v.company_id = c.company_id
         AND (
           (cd.np <> '' AND v.normalized_plate = cd.np)
           OR (cd.ch <> '' AND upper(regexp_replace(coalesce(v.chassis,''),'[^A-Za-z0-9]','','g')) IN (cd.ch, right(cd.ch,8)))
           OR (cd.rn <> '' AND regexp_replace(coalesce(v.renavam,''),'[^0-9]','','g') = cd.rn)
         )
    )
    INSERT INTO public.insurance_policy_vehicles
      (company_id, policy_id, vehicle_id, inclusion_type, removed_at, included_at)
    SELECT c.company_id, m.policy_id, m.vehicle_id, m.inclusion_type, NULL, current_date
      FROM matches m
    ON CONFLICT (policy_id, vehicle_id) DO UPDATE
      SET removed_at = NULL,
          inclusion_type = EXCLUDED.inclusion_type,
          updated_at = now();

    SELECT ARRAY(
      SELECT DISTINCT vehicle_id
        FROM public.insurance_policy_vehicles
       WHERE company_id = c.company_id AND removed_at IS NULL
    ) INTO v_ids;
    IF array_length(v_ids,1) IS NOT NULL THEN
      PERFORM public.sync_vehicle_insurance_fields(v_ids);
    END IF;
  END LOOP;
END $$;