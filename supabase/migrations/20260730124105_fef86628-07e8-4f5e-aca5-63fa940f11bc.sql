CREATE OR REPLACE FUNCTION public.sync_policy_vehicle_links(_policy_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p RECORD;
  a jsonb;
  v_id uuid;
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

    -- não sobrepor placa marcada como externa
    IF EXISTS (
      SELECT 1 FROM public.policy_external_plates e
       WHERE e.policy_id = p.id
         AND e.normalized_plate = public.normalize_plate(a->>'plate')
    ) THEN CONTINUE; END IF;

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
$$;

GRANT EXECUTE ON FUNCTION public.sync_policy_vehicle_links(uuid) TO authenticated, service_role;

-- Sincroniza todas as apólices vigentes de uma empresa
CREATE OR REPLACE FUNCTION public.sync_company_policy_links(_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r RECORD; total integer := 0;
BEGIN
  IF NOT (public.is_company_member(_company_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  FOR r IN
    SELECT id FROM public.insurance_policies
     WHERE company_id = _company_id AND status = 'ativa'
       AND (end_date IS NULL OR end_date >= current_date)
  LOOP
    total := total + public.sync_policy_vehicle_links(r.id);
  END LOOP;
  RETURN total;
END
$$;

GRANT EXECUTE ON FUNCTION public.sync_company_policy_links(uuid) TO authenticated, service_role;

-- Trigger: apólice criada/atualizada
CREATE OR REPLACE FUNCTION public.tg_policy_sync_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.sync_policy_vehicle_links(NEW.id);
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS trg_policy_sync_links ON public.insurance_policies;
CREATE TRIGGER trg_policy_sync_links
AFTER INSERT OR UPDATE OF ai_extracted, status, end_date ON public.insurance_policies
FOR EACH ROW EXECUTE FUNCTION public.tg_policy_sync_links();

-- Trigger: veículo criado/atualizado
CREATE OR REPLACE FUNCTION public.tg_vehicle_sync_policy_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT policy_id FROM public.match_policies_for_vehicle(NEW.id) LOOP
    PERFORM public.sync_policy_vehicle_links(r.policy_id);
  END LOOP;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS trg_vehicle_sync_policy_links ON public.vehicles;
CREATE TRIGGER trg_vehicle_sync_policy_links
AFTER INSERT OR UPDATE OF plate, chassis, renavam ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.tg_vehicle_sync_policy_links();

-- Trigger: vinculação manual confirmada grava vínculo real
CREATE OR REPLACE FUNCTION public.tg_manual_match_create_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.revoked_at IS NULL THEN
    INSERT INTO public.insurance_policy_vehicles (company_id, policy_id, vehicle_id, inclusion_type, notes, created_by)
    VALUES (NEW.company_id, NEW.policy_id, NEW.vehicle_id, 'apolice', 'Vínculo manual confirmado', NEW.matched_by)
    ON CONFLICT (policy_id, vehicle_id) DO UPDATE
      SET removed_at = NULL, updated_at = now();
    PERFORM public.sync_vehicle_insurance_fields(ARRAY[NEW.vehicle_id]);
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS trg_manual_match_create_link ON public.vehicle_policy_manual_matches;
CREATE TRIGGER trg_manual_match_create_link
AFTER INSERT ON public.vehicle_policy_manual_matches
FOR EACH ROW EXECUTE FUNCTION public.tg_manual_match_create_link();

-- Backfill único
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.insurance_policies
     WHERE status = 'ativa' AND (end_date IS NULL OR end_date >= current_date)
  LOOP
    PERFORM public.sync_policy_vehicle_links(r.id);
  END LOOP;
END $$;