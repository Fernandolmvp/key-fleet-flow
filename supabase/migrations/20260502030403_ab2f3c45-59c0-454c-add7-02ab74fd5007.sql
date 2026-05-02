-- Função que ressincroniza os campos de seguro de uma lista de veículos
CREATE OR REPLACE FUNCTION public.sync_vehicle_insurance_fields(_vehicle_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _vehicle_ids IS NULL OR array_length(_vehicle_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_id IN ARRAY _vehicle_ids LOOP
    WITH best AS (
      SELECT ip.insurer_name, ip.policy_number, ip.end_date, ib.name AS broker_name
        FROM public.insurance_policy_vehicles ipv
        JOIN public.insurance_policies ip ON ip.id = ipv.policy_id
        LEFT JOIN public.insurance_brokers ib ON ib.id = ip.broker_id
       WHERE ipv.vehicle_id = v_id
         AND ipv.removed_at IS NULL
         AND ip.status = 'ativa'
       ORDER BY ip.end_date DESC NULLS LAST
       LIMIT 1
    )
    UPDATE public.vehicles v
       SET insurer = b.insurer_name,
           insurance_policy = b.policy_number,
           insurance_expires_at = b.end_date,
           insurance_responsible = b.broker_name
      FROM best b
     WHERE v.id = v_id;

    -- se não há nenhuma apólice ativa vinculada, limpa
    IF NOT EXISTS (
      SELECT 1 FROM public.insurance_policy_vehicles ipv
      JOIN public.insurance_policies ip ON ip.id = ipv.policy_id
      WHERE ipv.vehicle_id = v_id AND ipv.removed_at IS NULL AND ip.status = 'ativa'
    ) THEN
      UPDATE public.vehicles
         SET insurer = NULL,
             insurance_policy = NULL,
             insurance_expires_at = NULL,
             insurance_responsible = NULL
       WHERE id = v_id;
    END IF;
  END LOOP;
END;
$$;

-- Trigger em insurance_policy_vehicles: ressincroniza os veículos afetados
CREATE OR REPLACE FUNCTION public.tg_ipv_sync_vehicles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.sync_vehicle_insurance_fields(ARRAY[NEW.vehicle_id]);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.sync_vehicle_insurance_fields(ARRAY[NEW.vehicle_id, OLD.vehicle_id]);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.sync_vehicle_insurance_fields(ARRAY[OLD.vehicle_id]);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_ipv_sync_vehicles ON public.insurance_policy_vehicles;
CREATE TRIGGER trg_ipv_sync_vehicles
AFTER INSERT OR UPDATE OR DELETE ON public.insurance_policy_vehicles
FOR EACH ROW EXECUTE FUNCTION public.tg_ipv_sync_vehicles();

-- Trigger em insurance_policies: quando muda end_date/insurer_name/status/broker_id,
-- ressincroniza todos os veículos vinculados
CREATE OR REPLACE FUNCTION public.tg_ip_sync_vehicles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ids uuid[];
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.end_date IS NOT DISTINCT FROM OLD.end_date
     AND NEW.insurer_name IS NOT DISTINCT FROM OLD.insurer_name
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.broker_id IS NOT DISTINCT FROM OLD.broker_id
     AND NEW.policy_number IS NOT DISTINCT FROM OLD.policy_number THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(DISTINCT vehicle_id) INTO ids
    FROM public.insurance_policy_vehicles
   WHERE policy_id = COALESCE(NEW.id, OLD.id);

  IF ids IS NOT NULL THEN
    PERFORM public.sync_vehicle_insurance_fields(ids);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_ip_sync_vehicles ON public.insurance_policies;
CREATE TRIGGER trg_ip_sync_vehicles
AFTER UPDATE OR DELETE ON public.insurance_policies
FOR EACH ROW EXECUTE FUNCTION public.tg_ip_sync_vehicles();

-- Backfill imediato de todos os vínculos existentes
DO $$
DECLARE all_ids uuid[];
BEGIN
  SELECT array_agg(DISTINCT vehicle_id) INTO all_ids
    FROM public.insurance_policy_vehicles;
  IF all_ids IS NOT NULL THEN
    PERFORM public.sync_vehicle_insurance_fields(all_ids);
  END IF;
END $$;