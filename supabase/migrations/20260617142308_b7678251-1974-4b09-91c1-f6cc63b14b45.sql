
CREATE OR REPLACE FUNCTION public.recompute_vehicle_maintenance_status(_vehicle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_current public.vehicle_status;
  has_active boolean;
  new_status public.vehicle_status;
BEGIN
  IF _vehicle_id IS NULL THEN RETURN; END IF;

  SELECT company_id, status INTO v_company, v_current
  FROM public.vehicles WHERE id = _vehicle_id;

  IF v_company IS NULL THEN RETURN; END IF;

  -- Status terminais não são tocados automaticamente
  IF v_current IN ('vendido','inativo','roubado_furtado','leiloado','sinistrado','transferido','parado') THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.maintenance_work_orders
    WHERE vehicle_id = _vehicle_id
      AND lower(coalesce(execution_status,'')) IN ('em_execucao','em_andamento','iniciado','iniciada')
  ) OR EXISTS (
    SELECT 1 FROM public.maintenance_records
    WHERE vehicle_id = _vehicle_id AND status = 'em_andamento'
  ) INTO has_active;

  new_status := CASE WHEN has_active THEN 'manutencao'::public.vehicle_status
                     ELSE 'ativo'::public.vehicle_status END;

  IF new_status IS DISTINCT FROM v_current THEN
    UPDATE public.vehicles SET status = new_status, updated_at = now() WHERE id = _vehicle_id;

    INSERT INTO public.vehicle_movements (company_id, vehicle_id, movement_type, reason, occurred_at, metadata)
    VALUES (
      v_company, _vehicle_id,
      CASE WHEN new_status = 'manutencao' THEN 'maintenance_started' ELSE 'maintenance_finished' END,
      CASE WHEN new_status = 'manutencao' THEN 'auto: manutenção iniciada' ELSE 'auto: manutenção concluída' END,
      CURRENT_DATE,
      jsonb_build_object('previous_status', v_current, 'new_status', new_status, 'source','trigger')
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_vehicle_status_wo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_vehicle_maintenance_status(OLD.vehicle_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_vehicle_maintenance_status(NEW.vehicle_id);
  IF TG_OP = 'UPDATE' AND NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id THEN
    PERFORM public.recompute_vehicle_maintenance_status(OLD.vehicle_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_vehicle_status_rec()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_vehicle_maintenance_status(OLD.vehicle_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_vehicle_maintenance_status(NEW.vehicle_id);
  IF TG_OP = 'UPDATE' AND NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id THEN
    PERFORM public.recompute_vehicle_maintenance_status(OLD.vehicle_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recompute_vehicle_status_wo ON public.maintenance_work_orders;
CREATE TRIGGER recompute_vehicle_status_wo
AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_work_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_vehicle_status_wo();

DROP TRIGGER IF EXISTS recompute_vehicle_status_rec ON public.maintenance_records;
CREATE TRIGGER recompute_vehicle_status_rec
AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_records
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_vehicle_status_rec();
