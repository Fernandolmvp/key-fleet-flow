CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.vehicle_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  driver_id uuid,
  incident_date timestamptz NOT NULL DEFAULT now(),
  incident_type text NOT NULL,
  description text,
  km_at_incident integer,
  location text,
  repair_cost numeric,
  insurance_claimed boolean NOT NULL DEFAULT false,
  police_report_number text,
  photos_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'aberto',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicle_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view incidents" ON public.vehicle_incidents
  FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write incidents" ON public.vehicle_incidents
  FOR ALL USING (can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (can_manage_fleet(auth.uid(), company_id));
CREATE TRIGGER trg_vehicle_incidents_updated BEFORE UPDATE ON public.vehicle_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.vehicle_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  expense_category text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text,
  receipt_url text,
  paid boolean NOT NULL DEFAULT true,
  due_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicle_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view expenses" ON public.vehicle_expenses
  FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write expenses" ON public.vehicle_expenses
  FOR ALL USING (can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (can_manage_fleet(auth.uid(), company_id));
CREATE TRIGGER trg_vehicle_expenses_updated BEFORE UPDATE ON public.vehicle_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.traffic_fines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  driver_id uuid,
  fine_date date NOT NULL DEFAULT CURRENT_DATE,
  fine_type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  license_points integer NOT NULL DEFAULT 0,
  description text,
  status text NOT NULL DEFAULT 'pendente',
  notification_number text,
  due_date date,
  paid_at date,
  photo_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.traffic_fines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view fines" ON public.traffic_fines
  FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write fines" ON public.traffic_fines
  FOR ALL USING (can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (can_manage_fleet(auth.uid(), company_id));
CREATE TRIGGER trg_traffic_fines_updated BEFORE UPDATE ON public.traffic_fines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.maintenance_records
  ADD COLUMN IF NOT EXISTS maintenance_category text,
  ADD COLUMN IF NOT EXISTS service_provider_rating integer
    CHECK (service_provider_rating IS NULL OR (service_provider_rating BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS warranty_until date;

CREATE INDEX idx_incidents_company_vehicle ON public.vehicle_incidents(company_id, vehicle_id);
CREATE INDEX idx_expenses_company_vehicle  ON public.vehicle_expenses(company_id, vehicle_id);
CREATE INDEX idx_fines_company_vehicle     ON public.traffic_fines(company_id, vehicle_id);