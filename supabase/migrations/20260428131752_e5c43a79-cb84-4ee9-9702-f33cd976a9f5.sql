
CREATE TYPE public.fuel_anomaly AS ENUM (
  'km_regressivo','consumo_alto','consumo_baixo','tanque_excedido',
  'duplicado','valor_atipico','horario_suspeito','cidade_incomum'
);
CREATE TYPE public.payment_method AS ENUM ('cartao_frota','dinheiro','pix','credito','debito','faturado','outro');

CREATE TABLE public.fuel_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  fueled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  station_name TEXT, station_cnpj TEXT, city TEXT, state TEXT,
  fuel_type public.fuel_type NOT NULL,
  liters NUMERIC(8,3) NOT NULL CHECK (liters > 0),
  price_per_liter NUMERIC(8,3) NOT NULL CHECK (price_per_liter > 0),
  total_value NUMERIC(12,2) NOT NULL CHECK (total_value > 0),
  full_tank BOOLEAN NOT NULL DEFAULT FALSE,
  km_at_fueling INT NOT NULL CHECK (km_at_fueling >= 0),
  payment_method public.payment_method, card_number TEXT,
  km_driven INT, km_per_liter NUMERIC(6,2), cost_per_km NUMERIC(8,3),
  anomalies public.fuel_anomaly[] NOT NULL DEFAULT '{}',
  anomaly_severity TEXT, anomaly_notes TEXT,
  invoice_url TEXT, receipt_url TEXT, dashboard_photo_url TEXT, pump_photo_url TEXT,
  latitude NUMERIC(10,6), longitude NUMERIC(10,6),
  notes TEXT, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fuel_company_date ON public.fuel_records(company_id, fueled_at DESC);
CREATE INDEX idx_fuel_vehicle_date ON public.fuel_records(vehicle_id, fueled_at DESC);
CREATE INDEX idx_fuel_driver ON public.fuel_records(driver_id);

ALTER TABLE public.fuel_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view fuel" ON public.fuel_records FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write fuel" ON public.fuel_records FOR ALL
  USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER t_fuel_updated BEFORE UPDATE ON public.fuel_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_fuel_compute()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prev RECORD; v RECORD; hist RECORD;
  anom public.fuel_anomaly[] := '{}';
  sev TEXT := NULL; hour_local INT;
BEGIN
  SELECT * INTO v FROM public.vehicles WHERE id = NEW.vehicle_id;
  SELECT * INTO prev FROM public.fuel_records
    WHERE vehicle_id = NEW.vehicle_id AND fueled_at < NEW.fueled_at
      AND (TG_OP = 'INSERT' OR id <> NEW.id)
    ORDER BY fueled_at DESC LIMIT 1;

  IF prev IS NOT NULL THEN
    NEW.km_driven := NEW.km_at_fueling - prev.km_at_fueling;
    IF NEW.km_driven IS NOT NULL AND NEW.km_driven > 0 AND NEW.liters > 0 THEN
      NEW.km_per_liter := ROUND((NEW.km_driven::numeric / NEW.liters), 2);
      NEW.cost_per_km := ROUND((NEW.total_value / NEW.km_driven), 3);
    END IF;
    IF NEW.km_at_fueling < prev.km_at_fueling THEN
      anom := array_append(anom, 'km_regressivo'::public.fuel_anomaly); sev := 'alta';
    END IF;
    IF NEW.fueled_at - prev.fueled_at < INTERVAL '30 minutes' THEN
      anom := array_append(anom, 'duplicado'::public.fuel_anomaly); sev := COALESCE(sev,'media');
    END IF;
  END IF;

  IF v.tank_capacity IS NOT NULL AND NEW.liters > v.tank_capacity * 1.05 THEN
    anom := array_append(anom, 'tanque_excedido'::public.fuel_anomaly); sev := 'alta';
  END IF;

  SELECT AVG(km_per_liter) AS avg_kml, COUNT(*) AS n INTO hist
  FROM public.fuel_records
  WHERE vehicle_id = NEW.vehicle_id AND km_per_liter IS NOT NULL
    AND (TG_OP = 'INSERT' OR id <> NEW.id);
  IF NEW.km_per_liter IS NOT NULL AND hist.n >= 3 AND hist.avg_kml > 0 THEN
    IF NEW.km_per_liter < hist.avg_kml * 0.65 THEN
      anom := array_append(anom, 'consumo_alto'::public.fuel_anomaly); sev := COALESCE(sev,'media');
    ELSIF NEW.km_per_liter > hist.avg_kml * 1.45 THEN
      anom := array_append(anom, 'consumo_baixo'::public.fuel_anomaly); sev := COALESCE(sev,'baixa');
    END IF;
  END IF;

  hour_local := EXTRACT(HOUR FROM NEW.fueled_at);
  IF hour_local >= 0 AND hour_local < 5 THEN
    anom := array_append(anom, 'horario_suspeito'::public.fuel_anomaly); sev := COALESCE(sev,'baixa');
  END IF;

  SELECT AVG(price_per_liter) AS avg_price, COUNT(*) AS n INTO hist
  FROM public.fuel_records
  WHERE company_id = NEW.company_id AND fuel_type = NEW.fuel_type
    AND fueled_at > now() - INTERVAL '60 days'
    AND (TG_OP = 'INSERT' OR id <> NEW.id);
  IF hist.n >= 5 AND hist.avg_price > 0 THEN
    IF NEW.price_per_liter > hist.avg_price * 1.25 OR NEW.price_per_liter < hist.avg_price * 0.75 THEN
      anom := array_append(anom, 'valor_atipico'::public.fuel_anomaly); sev := COALESCE(sev,'media');
    END IF;
  END IF;

  NEW.anomalies := anom;
  NEW.anomaly_severity := sev;

  IF NEW.km_at_fueling > COALESCE(v.current_km, 0) THEN
    UPDATE public.vehicles SET current_km = NEW.km_at_fueling WHERE id = NEW.vehicle_id;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER t_fuel_compute
BEFORE INSERT OR UPDATE ON public.fuel_records
FOR EACH ROW EXECUTE FUNCTION public.tg_fuel_compute();

INSERT INTO storage.buckets (id, name, public) VALUES ('fuel-receipts','fuel-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fuel receipts auth read" ON storage.objects FOR SELECT
  USING (bucket_id = 'fuel-receipts' AND auth.uid() IS NOT NULL);
CREATE POLICY "fuel receipts auth write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'fuel-receipts' AND auth.uid() IS NOT NULL);
CREATE POLICY "fuel receipts auth update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'fuel-receipts' AND auth.uid() IS NOT NULL);
CREATE POLICY "fuel receipts auth delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'fuel-receipts' AND auth.uid() IS NOT NULL);
