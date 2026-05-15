
CREATE TABLE IF NOT EXISTS public.trip_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,

  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  advance_date timestamptz NOT NULL DEFAULT now(),
  payment_method_used text NOT NULL DEFAULT 'dinheiro' CHECK (payment_method_used IN ('dinheiro','pix','deposito','transferencia')),

  receipt_number text,
  receipt_url text,

  gestor_signature_url text,
  driver_confirmed_at timestamptz,
  driver_confirmation_method text CHECK (driver_confirmation_method IS NULL OR driver_confirmation_method IN ('app','signature','manual')),
  driver_signature_url text,
  driver_confirmation_notes text,

  status text NOT NULL DEFAULT 'aguardando_confirmacao'
    CHECK (status IN ('aguardando_confirmacao','confirmado','contestado','cancelado')),

  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ta_trip ON public.trip_advances(trip_id);
CREATE INDEX IF NOT EXISTS idx_ta_driver ON public.trip_advances(driver_id);
CREATE INDEX IF NOT EXISTS idx_ta_company_status ON public.trip_advances(company_id, status);

DROP TRIGGER IF EXISTS trg_ta_updated_at ON public.trip_advances;
CREATE TRIGGER trg_ta_updated_at BEFORE UPDATE ON public.trip_advances
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Recalcula totais na trip
CREATE OR REPLACE FUNCTION public.tg_trip_advances_recalc()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_trip uuid;
BEGIN
  v_trip := COALESCE(NEW.trip_id, OLD.trip_id);
  UPDATE public.trips t SET
    total_advance_cash = COALESCE((
      SELECT SUM(amount) FROM public.trip_advances
      WHERE trip_id = v_trip AND status <> 'cancelado'
    ),0),
    updated_at = now()
  WHERE t.id = v_trip;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_ta_recalc ON public.trip_advances;
CREATE TRIGGER trg_ta_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.trip_advances
  FOR EACH ROW EXECUTE FUNCTION public.tg_trip_advances_recalc();

ALTER TABLE public.trip_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ta_select_member_or_driver" ON public.trip_advances
  FOR SELECT TO authenticated
  USING (
    public.is_company_member(auth.uid(), company_id)
    OR public.is_trip_driver(auth.uid(), driver_id)
  );

CREATE POLICY "ta_insert_manager" ON public.trip_advances
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE POLICY "ta_update_manager_or_driver_confirm" ON public.trip_advances
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_fleet(auth.uid(), company_id)
    OR public.is_trip_driver(auth.uid(), driver_id)
  )
  WITH CHECK (
    public.can_manage_fleet(auth.uid(), company_id)
    OR public.is_trip_driver(auth.uid(), driver_id)
  );

CREATE POLICY "ta_delete_manager" ON public.trip_advances
  FOR DELETE TO authenticated
  USING (public.can_manage_fleet(auth.uid(), company_id));
