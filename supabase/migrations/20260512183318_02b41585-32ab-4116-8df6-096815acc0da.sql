
-- 1) Override columns
ALTER TABLE public.fuel_records        ADD COLUMN IF NOT EXISTS km_override_reason text, ADD COLUMN IF NOT EXISTS km_override_by uuid;
ALTER TABLE public.fuel_authorizations ADD COLUMN IF NOT EXISTS km_override_reason text, ADD COLUMN IF NOT EXISTS km_override_by uuid;
ALTER TABLE public.checklist_runs      ADD COLUMN IF NOT EXISTS km_override_reason text, ADD COLUMN IF NOT EXISTS km_override_by uuid;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS km_override_reason text, ADD COLUMN IF NOT EXISTS km_override_by uuid;

-- 2) Core validator
CREATE OR REPLACE FUNCTION public.validate_vehicle_km(
  _vehicle_id uuid,
  _new_km integer,
  _override boolean,
  _override_reason text,
  _source text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _max_km integer;
BEGIN
  IF _vehicle_id IS NULL OR _new_km IS NULL THEN
    RETURN 0;
  END IF;

  SELECT GREATEST(
    COALESCE((SELECT MAX(km_at_fueling) FROM fuel_records      WHERE vehicle_id = _vehicle_id), 0),
    COALESCE((SELECT MAX(km_at_check)   FROM checklist_runs    WHERE vehicle_id = _vehicle_id), 0),
    COALESCE((SELECT MAX(km_at_service) FROM maintenance_records WHERE vehicle_id = _vehicle_id), 0),
    COALESCE((SELECT MAX(km_at_request) FROM fuel_authorizations WHERE vehicle_id = _vehicle_id), 0),
    COALESCE((SELECT current_km         FROM vehicles          WHERE id = _vehicle_id), 0)
  ) INTO _max_km;

  -- Bloqueia regressão sem override válido
  IF _new_km < _max_km AND NOT COALESCE(_override, false) THEN
    RAISE EXCEPTION 'KM_REGRESSIVO: o KM informado (%) é menor que o último KM registrado do veículo (%). Peça a um gestor para corrigir com justificativa.',
      _new_km, _max_km
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE(_override, false) AND (_override_reason IS NULL OR length(btrim(_override_reason)) < 10) THEN
    RAISE EXCEPTION 'KM_OVERRIDE_REASON: o override de KM exige uma justificativa com pelo menos 10 caracteres.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Aviso (log) se salto for muito grande
  IF _new_km - _max_km > 50000 AND _max_km > 0 THEN
    RAISE NOTICE 'KM_SALTO_ALTO: diferença de % km em %', _new_km - _max_km, _source;
  END IF;

  RETURN _max_km;
END $$;

-- 3) Audit override helper
CREATE OR REPLACE FUNCTION public.log_km_override(
  _table text, _record_id uuid, _company_id uuid,
  _user_id uuid, _km_old integer, _km_new integer, _reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (action, table_name, record_id, company_id, user_id, changes)
  VALUES (
    'km_override', _table, _record_id, _company_id, _user_id,
    jsonb_build_object(
      'km_anterior_max', _km_old,
      'km_novo', _km_new,
      'motivo', _reason,
      'overridden_by', _user_id
    )
  );
END $$;

-- 4) Per-table triggers
-- 4a) fuel_records
CREATE OR REPLACE FUNCTION public.trg_fuel_validate_km() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _max integer;
BEGIN
  _max := public.validate_vehicle_km(
    NEW.vehicle_id, NEW.km_at_fueling,
    NEW.km_override_reason IS NOT NULL,
    NEW.km_override_reason, 'fuel_records'
  );
  IF NEW.km_override_reason IS NOT NULL THEN
    NEW.km_override_by := COALESCE(NEW.km_override_by, auth.uid());
    PERFORM public.log_km_override('fuel_records', NEW.id, NEW.company_id,
      NEW.km_override_by, _max, NEW.km_at_fueling, NEW.km_override_reason);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS t_fuel_aa_validate_km ON public.fuel_records;
CREATE TRIGGER t_fuel_aa_validate_km BEFORE INSERT OR UPDATE OF km_at_fueling, km_override_reason
  ON public.fuel_records FOR EACH ROW EXECUTE FUNCTION public.trg_fuel_validate_km();

-- 4b) fuel_authorizations
CREATE OR REPLACE FUNCTION public.trg_fuel_auth_validate_km() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _max integer;
BEGIN
  IF NEW.km_at_request IS NULL THEN RETURN NEW; END IF;
  _max := public.validate_vehicle_km(
    NEW.vehicle_id, NEW.km_at_request,
    NEW.km_override_reason IS NOT NULL,
    NEW.km_override_reason, 'fuel_authorizations'
  );
  IF NEW.km_override_reason IS NOT NULL THEN
    NEW.km_override_by := COALESCE(NEW.km_override_by, auth.uid());
    PERFORM public.log_km_override('fuel_authorizations', NEW.id, NEW.company_id,
      NEW.km_override_by, _max, NEW.km_at_request, NEW.km_override_reason);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS t_fuel_auth_aa_validate_km ON public.fuel_authorizations;
CREATE TRIGGER t_fuel_auth_aa_validate_km BEFORE INSERT OR UPDATE OF km_at_request, km_override_reason
  ON public.fuel_authorizations FOR EACH ROW EXECUTE FUNCTION public.trg_fuel_auth_validate_km();

-- 4c) checklist_runs
CREATE OR REPLACE FUNCTION public.trg_checklist_validate_km() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _max integer;
BEGIN
  IF NEW.km_at_check IS NULL THEN RETURN NEW; END IF;
  _max := public.validate_vehicle_km(
    NEW.vehicle_id, NEW.km_at_check,
    NEW.km_override_reason IS NOT NULL,
    NEW.km_override_reason, 'checklist_runs'
  );
  IF NEW.km_override_reason IS NOT NULL THEN
    NEW.km_override_by := COALESCE(NEW.km_override_by, auth.uid());
    PERFORM public.log_km_override('checklist_runs', NEW.id, NEW.company_id,
      NEW.km_override_by, _max, NEW.km_at_check, NEW.km_override_reason);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS t_checklist_aa_validate_km ON public.checklist_runs;
CREATE TRIGGER t_checklist_aa_validate_km BEFORE INSERT OR UPDATE OF km_at_check, km_override_reason
  ON public.checklist_runs FOR EACH ROW EXECUTE FUNCTION public.trg_checklist_validate_km();

-- 4d) maintenance_records
CREATE OR REPLACE FUNCTION public.trg_maint_validate_km() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _max integer;
BEGIN
  IF NEW.km_at_service IS NULL THEN RETURN NEW; END IF;
  _max := public.validate_vehicle_km(
    NEW.vehicle_id, NEW.km_at_service,
    NEW.km_override_reason IS NOT NULL,
    NEW.km_override_reason, 'maintenance_records'
  );
  IF NEW.km_override_reason IS NOT NULL THEN
    NEW.km_override_by := COALESCE(NEW.km_override_by, auth.uid());
    PERFORM public.log_km_override('maintenance_records', NEW.id, NEW.company_id,
      NEW.km_override_by, _max, NEW.km_at_service, NEW.km_override_reason);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS t_maint_aa_validate_km ON public.maintenance_records;
CREATE TRIGGER t_maint_aa_validate_km BEFORE INSERT OR UPDATE OF km_at_service, km_override_reason
  ON public.maintenance_records FOR EACH ROW EXECUTE FUNCTION public.trg_maint_validate_km();

-- 5) Sync vehicles.current_km automatically (only forward)
CREATE OR REPLACE FUNCTION public.trg_sync_current_km() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _km integer;
BEGIN
  _km := CASE TG_TABLE_NAME
           WHEN 'fuel_records'        THEN NEW.km_at_fueling
           WHEN 'checklist_runs'      THEN NEW.km_at_check
           WHEN 'maintenance_records' THEN NEW.km_at_service
         END;
  IF _km IS NOT NULL THEN
    UPDATE public.vehicles
       SET current_km = GREATEST(COALESCE(current_km, 0), _km)
     WHERE id = NEW.vehicle_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS t_fuel_sync_current_km ON public.fuel_records;
CREATE TRIGGER t_fuel_sync_current_km AFTER INSERT OR UPDATE OF km_at_fueling
  ON public.fuel_records FOR EACH ROW EXECUTE FUNCTION public.trg_sync_current_km();

DROP TRIGGER IF EXISTS t_checklist_sync_current_km ON public.checklist_runs;
CREATE TRIGGER t_checklist_sync_current_km AFTER INSERT OR UPDATE OF km_at_check
  ON public.checklist_runs FOR EACH ROW EXECUTE FUNCTION public.trg_sync_current_km();

DROP TRIGGER IF EXISTS t_maint_sync_current_km ON public.maintenance_records;
CREATE TRIGGER t_maint_sync_current_km AFTER INSERT OR UPDATE OF km_at_service
  ON public.maintenance_records FOR EACH ROW EXECUTE FUNCTION public.trg_sync_current_km();
