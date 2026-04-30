ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS insurance_responsible text NULL;