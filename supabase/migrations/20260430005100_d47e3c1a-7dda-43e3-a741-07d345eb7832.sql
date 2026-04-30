-- VEÍCULOS: novos status no enum
ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'inativo';
ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'transferido';
ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'roubado_furtado';
ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'leiloado';

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS inactivated_at date,
  ADD COLUMN IF NOT EXISTS inactive_reason text,
  ADD COLUMN IF NOT EXISTS sale_date date,
  ADD COLUMN IF NOT EXISTS sale_value numeric,
  ADD COLUMN IF NOT EXISTS buyer_name text,
  ADD COLUMN IF NOT EXISTS buyer_doc text;

-- MOTORISTAS: novos status
ALTER TYPE public.driver_status ADD VALUE IF NOT EXISTS 'desligado';
ALTER TYPE public.driver_status ADD VALUE IF NOT EXISTS 'licenca_medica';
ALTER TYPE public.driver_status ADD VALUE IF NOT EXISTS 'suspenso';

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS inactivated_at date,
  ADD COLUMN IF NOT EXISTS inactive_reason text,
  ADD COLUMN IF NOT EXISTS termination_date date;

-- POSTOS
ALTER TABLE public.fuel_stations
  ADD COLUMN IF NOT EXISTS inactivated_at date,
  ADD COLUMN IF NOT EXISTS inactive_reason text;