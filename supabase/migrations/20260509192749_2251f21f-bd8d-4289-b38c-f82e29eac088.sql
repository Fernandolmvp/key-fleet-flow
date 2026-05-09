CREATE INDEX IF NOT EXISTS idx_ipv_active
  ON public.insurance_policy_vehicles (policy_id)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_chassis
  ON public.vehicles (chassis);