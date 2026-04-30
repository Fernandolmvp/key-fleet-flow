
-- Histórico de mudanças de status do motorista
CREATE TABLE public.driver_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  reason text,
  inactivated_at date,
  termination_date date,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_driver_status_history_driver ON public.driver_status_history(driver_id, created_at DESC);

ALTER TABLE public.driver_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view driver status history"
  ON public.driver_status_history FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "managers write driver status history"
  ON public.driver_status_history FOR ALL
  USING (can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (can_manage_fleet(auth.uid(), company_id));

-- Trigger: registra mudança de status, motivo, inactivated_at ou termination_date
CREATE OR REPLACE FUNCTION public.tg_driver_log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.driver_status_history (
      company_id, driver_id, previous_status, new_status, reason,
      inactivated_at, termination_date, changed_by
    ) VALUES (
      NEW.company_id, NEW.id, NULL, NEW.status, NEW.inactive_reason,
      NEW.inactivated_at, NEW.termination_date, auth.uid()
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.inactive_reason IS DISTINCT FROM OLD.inactive_reason
       OR NEW.inactivated_at IS DISTINCT FROM OLD.inactivated_at
       OR NEW.termination_date IS DISTINCT FROM OLD.termination_date THEN
      INSERT INTO public.driver_status_history (
        company_id, driver_id, previous_status, new_status, reason,
        inactivated_at, termination_date, changed_by
      ) VALUES (
        NEW.company_id, NEW.id, OLD.status, NEW.status, NEW.inactive_reason,
        NEW.inactivated_at, NEW.termination_date, auth.uid()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER drivers_status_history
AFTER INSERT OR UPDATE ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.tg_driver_log_status_change();
