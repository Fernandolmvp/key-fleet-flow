
CREATE TABLE public.fuel_stations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  cnpj TEXT,
  brand TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  contact_name TEXT,
  fuel_types TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fuel_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view fuel stations" ON public.fuel_stations
  FOR SELECT USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "managers write fuel stations" ON public.fuel_stations
  FOR ALL USING (can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER set_updated_at_fuel_stations
  BEFORE UPDATE ON public.fuel_stations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.fuel_records ADD COLUMN IF NOT EXISTS fuel_station_id UUID;
