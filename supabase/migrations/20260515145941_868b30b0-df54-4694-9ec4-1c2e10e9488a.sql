
CREATE TABLE IF NOT EXISTS public.trip_code_seq (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, year)
);
ALTER TABLE public.trip_code_seq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcs_select_member" ON public.trip_code_seq FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE TABLE IF NOT EXISTS public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,

  trip_code text,
  title text NOT NULL,
  description text,
  trip_type text NOT NULL DEFAULT 'entrega' CHECK (trip_type IN (
    'entrega','coleta','transporte_passageiros','visita_comercial',
    'manutencao_externa','treinamento','outros'
  )),

  origin_city text,
  origin_state text,
  destination_city text,
  destination_state text,
  waypoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_km numeric(10,2),
  actual_km numeric(10,2),

  scheduled_start_date date NOT NULL,
  scheduled_end_date date,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  km_at_start integer,
  km_at_end integer,

  budget_total numeric(14,2),
  budget_by_category jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_payment_method_ids uuid[] NOT NULL DEFAULT '{}',

  status text NOT NULL DEFAULT 'programada' CHECK (status IN (
    'programada','em_andamento','aguardando_acerto','acerto_pendente','finalizada','cancelada'
  )),

  total_advance_cash numeric(14,2) NOT NULL DEFAULT 0,
  total_spent_cash numeric(14,2) NOT NULL DEFAULT 0,
  total_spent_card numeric(14,2) NOT NULL DEFAULT 0,
  total_spent_other numeric(14,2) NOT NULL DEFAULT 0,
  total_reimbursable numeric(14,2) NOT NULL DEFAULT 0,
  balance_to_return numeric(14,2) NOT NULL DEFAULT 0,
  settlement_date date,
  settlement_notes text,

  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_code_unique ON public.trips(company_id, trip_code) WHERE trip_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trips_company_status ON public.trips(company_id, status);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON public.trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON public.trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_dates ON public.trips(company_id, scheduled_start_date);

CREATE OR REPLACE FUNCTION public.tg_trips_assign_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_year int; v_num int;
BEGIN
  IF NEW.trip_code IS NOT NULL AND NEW.trip_code <> '' THEN RETURN NEW; END IF;
  v_year := EXTRACT(YEAR FROM COALESCE(NEW.scheduled_start_date, current_date))::int;
  INSERT INTO public.trip_code_seq(company_id, year, last_number)
  VALUES (NEW.company_id, v_year, 1)
  ON CONFLICT (company_id, year) DO UPDATE SET last_number = trip_code_seq.last_number + 1
  RETURNING last_number INTO v_num;
  NEW.trip_code := 'VG-' || v_year::text || '-' || lpad(v_num::text, 4, '0');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_trips_code ON public.trips;
CREATE TRIGGER trg_trips_code BEFORE INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.tg_trips_assign_code();

DROP TRIGGER IF EXISTS trg_trips_updated_at ON public.trips;
CREATE TRIGGER trg_trips_updated_at BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user the driver linked to this trip?
CREATE OR REPLACE FUNCTION public.is_trip_driver(_user_id uuid, _driver_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = _driver_id AND d.user_id = _user_id
  )
$$;

CREATE POLICY "trips_select_member_or_driver" ON public.trips
  FOR SELECT TO authenticated
  USING (
    public.is_company_member(auth.uid(), company_id)
    OR public.is_trip_driver(auth.uid(), driver_id)
  );

CREATE POLICY "trips_insert_manager" ON public.trips
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE POLICY "trips_update_manager_or_driver_progress" ON public.trips
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_fleet(auth.uid(), company_id)
    OR public.is_trip_driver(auth.uid(), driver_id)
  )
  WITH CHECK (
    public.can_manage_fleet(auth.uid(), company_id)
    OR public.is_trip_driver(auth.uid(), driver_id)
  );

CREATE POLICY "trips_delete_manager" ON public.trips
  FOR DELETE TO authenticated
  USING (public.can_manage_fleet(auth.uid(), company_id));
