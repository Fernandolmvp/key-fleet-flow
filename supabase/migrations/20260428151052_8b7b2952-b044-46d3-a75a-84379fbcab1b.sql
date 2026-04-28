-- Recompute km_per_liter for existing rows by re-triggering the BEFORE UPDATE compute
UPDATE public.fuel_records SET updated_at = updated_at;