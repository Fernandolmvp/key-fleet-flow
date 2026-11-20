ALTER TABLE public.checklist_templates ADD COLUMN IF NOT EXISTS vehicle_type text;
ALTER TABLE public.checklist_questions ADD COLUMN IF NOT EXISTS is_critical boolean NOT NULL DEFAULT false;
ALTER TABLE public.maintenance_requests ADD COLUMN IF NOT EXISTS checklist_run_id uuid;
ALTER TABLE public.tires ADD COLUMN IF NOT EXISTS last_pressure_psi numeric;
ALTER TABLE public.tires ADD COLUMN IF NOT EXISTS target_pressure_psi numeric;
ALTER TABLE public.tires ADD COLUMN IF NOT EXISTS last_measured_at timestamptz;
ALTER TABLE public.tires ADD COLUMN IF NOT EXISTS measurement_interval_days integer NOT NULL DEFAULT 30;
ALTER TABLE public.fuel_records ADD COLUMN IF NOT EXISTS reconciliation_status text NOT NULL DEFAULT 'pendente';
ALTER TABLE public.fuel_records ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;
ALTER TABLE public.fuel_records ADD COLUMN IF NOT EXISTS reconciliation_notes text;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS freight_value numeric;

CREATE OR REPLACE FUNCTION public.tg_checklist_critical_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_desc text; v_user uuid;
BEGIN
  IF NEW.status IN ('concluido','reprovado') AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT string_agg('• ' || a.question_label || COALESCE(' — ' || a.notes, ''), E'\n')
      INTO v_desc
      FROM public.checklist_answers a
      JOIN public.checklist_questions q ON q.id = a.question_id
      WHERE a.run_id = NEW.id AND a.status = 'nao_conforme' AND q.is_critical;
    IF v_desc IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.maintenance_requests WHERE checklist_run_id = NEW.id
    ) THEN
      v_user := COALESCE(auth.uid(), NEW.created_by);
      IF v_user IS NOT NULL THEN
        INSERT INTO public.maintenance_requests (
          company_id, vehicle_id, driver_id, driver_user_id, problem_category,
          problem_description, severity_self_assessment, km_at_report, checklist_run_id
        ) VALUES (
          NEW.company_id, NEW.vehicle_id, NEW.driver_id, v_user, 'checklist',
          'Item crítico reprovado no checklist:' || E'\n' || v_desc, 'critica', NEW.km_at_check, NEW.id
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tg_checklist_critical_request() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS checklist_critical_request ON public.checklist_runs;
CREATE TRIGGER checklist_critical_request AFTER UPDATE OF status ON public.checklist_runs
FOR EACH ROW EXECUTE FUNCTION public.tg_checklist_critical_request();