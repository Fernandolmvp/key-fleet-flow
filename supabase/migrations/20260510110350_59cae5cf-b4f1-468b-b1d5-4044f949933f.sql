CREATE OR REPLACE FUNCTION public.tg_ipv_block_ai_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plate_norm text;
  v_in_ai boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.is_ai_policy(NEW.policy_id) THEN
      SELECT regexp_replace(upper(v.plate),'[^A-Z0-9]','','g') INTO v_plate_norm
        FROM public.vehicles v WHERE v.id = NEW.vehicle_id;
      SELECT EXISTS (
        SELECT 1
          FROM public.insurance_policies p
          CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.ai_extracted->'plates','[]'::jsonb)) AS pdf_plate
         WHERE p.id = NEW.policy_id
           AND regexp_replace(upper(pdf_plate),'[^A-Z0-9]','','g') = v_plate_norm
      ) INTO v_in_ai;
      IF NOT v_in_ai THEN
        RAISE EXCEPTION 'Apólice importada via IA — só é permitido vincular veículos cujas placas constam no PDF.';
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
        SELECT regexp_replace(upper(v.plate),'[^A-Z0-9]','','g') INTO v_plate_norm
          FROM public.vehicles v WHERE v.id = NEW.vehicle_id;
        SELECT EXISTS (
          SELECT 1
            FROM public.insurance_policies p
            CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.ai_extracted->'plates','[]'::jsonb)) AS pdf_plate
           WHERE p.id = NEW.policy_id
             AND regexp_replace(upper(pdf_plate),'[^A-Z0-9]','','g') = v_plate_norm
        ) INTO v_in_ai;
        IF NOT v_in_ai THEN
          RAISE EXCEPTION 'Apólice importada via IA — não é permitido reativar vínculo de placa fora do PDF.';
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

WITH src AS (
  SELECT DISTINCT v.company_id, p.id AS policy_id, v.id AS vehicle_id
    FROM public.insurance_policies p
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.ai_extracted->'plates','[]'::jsonb)) AS pdf_plate
    JOIN public.vehicles v
      ON v.company_id = p.company_id
     AND regexp_replace(upper(v.plate),'[^A-Z0-9]','','g') = regexp_replace(upper(pdf_plate),'[^A-Z0-9]','','g')
   WHERE p.status = 'ativa'
)
INSERT INTO public.insurance_policy_vehicles (company_id, policy_id, vehicle_id, inclusion_type, included_at)
SELECT company_id, policy_id, vehicle_id, 'apolice', CURRENT_DATE FROM src
ON CONFLICT (policy_id, vehicle_id) DO UPDATE
  SET removed_at = NULL,
      included_at = COALESCE(public.insurance_policy_vehicles.included_at, EXCLUDED.included_at);

DO $$
DECLARE ids uuid[];
BEGIN
  SELECT array_agg(id) INTO ids FROM public.vehicles;
  IF ids IS NOT NULL THEN
    PERFORM public.sync_vehicle_insurance_fields(ids);
  END IF;
END $$;