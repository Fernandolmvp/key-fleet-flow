-- Bloquear exclusão de veículos com movimentações
CREATE OR REPLACE FUNCTION public.tg_vehicles_block_delete_with_movements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  SELECT COUNT(*) INTO n FROM public.fuel_records WHERE vehicle_id = OLD.id;
  IF n > 0 THEN RAISE EXCEPTION 'Não é possível excluir: veículo possui % abastecimento(s) registrado(s). Inative o veículo.', n; END IF;

  SELECT COUNT(*) INTO n FROM public.maintenance_records WHERE vehicle_id = OLD.id;
  IF n > 0 THEN RAISE EXCEPTION 'Não é possível excluir: veículo possui % manutenção(ões) registrada(s). Inative o veículo.', n; END IF;

  SELECT COUNT(*) INTO n FROM public.tire_movements WHERE vehicle_id = OLD.id;
  IF n > 0 THEN RAISE EXCEPTION 'Não é possível excluir: veículo possui % movimentação(ões) de pneu. Inative o veículo.', n; END IF;

  SELECT COUNT(*) INTO n FROM public.tires WHERE current_vehicle_id = OLD.id;
  IF n > 0 THEN RAISE EXCEPTION 'Não é possível excluir: veículo possui % pneu(s) instalado(s). Remova-os antes.', n; END IF;

  SELECT COUNT(*) INTO n FROM public.checklist_runs WHERE vehicle_id = OLD.id;
  IF n > 0 THEN RAISE EXCEPTION 'Não é possível excluir: veículo possui % checklist(s) registrado(s). Inative o veículo.', n; END IF;

  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_vehicles_block_delete ON public.vehicles;
CREATE TRIGGER trg_vehicles_block_delete
BEFORE DELETE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.tg_vehicles_block_delete_with_movements();

-- Bloquear exclusão de motoristas com movimentações
CREATE OR REPLACE FUNCTION public.tg_drivers_block_delete_with_movements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  SELECT COUNT(*) INTO n FROM public.fuel_records WHERE driver_id = OLD.id;
  IF n > 0 THEN RAISE EXCEPTION 'Não é possível excluir: motorista possui % abastecimento(s) registrado(s). Inative o motorista.', n; END IF;

  SELECT COUNT(*) INTO n FROM public.maintenance_records WHERE driver_id = OLD.id;
  IF n > 0 THEN RAISE EXCEPTION 'Não é possível excluir: motorista possui % manutenção(ões) registrada(s). Inative o motorista.', n; END IF;

  SELECT COUNT(*) INTO n FROM public.checklist_runs WHERE driver_id = OLD.id;
  IF n > 0 THEN RAISE EXCEPTION 'Não é possível excluir: motorista possui % checklist(s) registrado(s). Inative o motorista.', n; END IF;

  SELECT COUNT(*) INTO n FROM public.fuel_authorizations WHERE driver_id = OLD.id;
  IF n > 0 THEN RAISE EXCEPTION 'Não é possível excluir: motorista possui % autorização(ões) de abastecimento. Inative o motorista.', n; END IF;

  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_drivers_block_delete ON public.drivers;
CREATE TRIGGER trg_drivers_block_delete
BEFORE DELETE ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.tg_drivers_block_delete_with_movements();