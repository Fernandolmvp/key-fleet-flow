CREATE OR REPLACE FUNCTION public.validate_vehicle_plate_input()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.plate IS NOT DISTINCT FROM OLD.plate THEN RETURN NEW; END IF;
  END IF;
  IF NEW.plate IS NULL OR length(btrim(NEW.plate)) > 16 OR upper(regexp_replace(btrim(NEW.plate), '[[:space:]-]', '', 'g')) !~ '^([A-Z]{3}[0-9]{4}|[A-Z]{3}[0-9][A-Z][0-9]{2})$' THEN
    RAISE EXCEPTION 'Placa inválida — use ABC1234 ou ABC1D23.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_vehicle_plate_input() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_vehicle_plate_input() TO authenticated, service_role;
CREATE TRIGGER t_aa_validate_vehicle_plate_input BEFORE INSERT OR UPDATE OF plate ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.validate_vehicle_plate_input();

CREATE OR REPLACE FUNCTION public.validate_fuel_driver_input()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.driver_id IS NOT DISTINCT FROM OLD.driver_id AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id THEN RETURN NEW; END IF;
  END IF;
  IF NEW.driver_id IS NULL THEN
    RAISE EXCEPTION 'Selecione um motorista — obrigatório no abastecimento.' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = NEW.driver_id AND d.company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'Motorista inválido para esta empresa.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_fuel_driver_input() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_fuel_driver_input() TO authenticated, service_role;
CREATE TRIGGER t_aa_validate_fuel_driver_input BEFORE INSERT OR UPDATE OF driver_id, company_id ON public.fuel_records FOR EACH ROW EXECUTE FUNCTION public.validate_fuel_driver_input();