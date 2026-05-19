
CREATE TABLE IF NOT EXISTS public.fuel_station_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.fuel_stations(id) ON DELETE CASCADE,
  price_date date NOT NULL DEFAULT CURRENT_DATE,
  fuel_type text NOT NULL,
  price_per_liter numeric(10,3) NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, price_date, fuel_type)
);
CREATE INDEX IF NOT EXISTS idx_fsp_station_date ON public.fuel_station_prices(station_id, price_date DESC);
ALTER TABLE public.fuel_station_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view fuel prices" ON public.fuel_station_prices
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write fuel prices" ON public.fuel_station_prices
  FOR ALL USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER trg_fsp_updated BEFORE UPDATE ON public.fuel_station_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
