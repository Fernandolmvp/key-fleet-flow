-- 1. Schema: parâmetros de consumo esperado por veículo
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS expected_consumption_kml numeric,
  ADD COLUMN IF NOT EXISTS consumption_tolerance_pct numeric DEFAULT 20;

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_expected_kml_positive,
  DROP CONSTRAINT IF EXISTS vehicles_tolerance_range;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_expected_kml_positive
    CHECK (expected_consumption_kml IS NULL OR expected_consumption_kml > 0),
  ADD CONSTRAINT vehicles_tolerance_range
    CHECK (consumption_tolerance_pct IS NULL
           OR (consumption_tolerance_pct >= 5 AND consumption_tolerance_pct <= 50));

-- 2. Enum: novos tipos de anomalia
ALTER TYPE public.fuel_anomaly ADD VALUE IF NOT EXISTS 'consumo_abaixo_esperado';
ALTER TYPE public.fuel_anomaly ADD VALUE IF NOT EXISTS 'consumo_acima_esperado';