
ALTER TABLE public.maintenance_schedules
  ADD COLUMN IF NOT EXISTS scheduled_time time NULL,
  ADD COLUMN IF NOT EXISTS scheduled_workshop_id uuid NULL REFERENCES public.workshops(id) ON DELETE SET NULL;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS maintenance_default_interval_km integer NULL;
