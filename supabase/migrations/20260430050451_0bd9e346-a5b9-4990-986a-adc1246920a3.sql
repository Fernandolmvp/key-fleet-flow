ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS has_assigned_vehicle boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_vehicle_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_drivers_assigned_vehicle ON public.drivers(assigned_vehicle_id);