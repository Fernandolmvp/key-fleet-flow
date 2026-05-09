ALTER TABLE public.insurance_policies
  ADD COLUMN IF NOT EXISTS coverage_type text NULL;

ALTER TABLE public.insurance_policies
  DROP CONSTRAINT IF EXISTS insurance_policies_coverage_type_check;

ALTER TABLE public.insurance_policies
  ADD CONSTRAINT insurance_policies_coverage_type_check
  CHECK (coverage_type IS NULL OR coverage_type IN (
    'compreensivo','terceiros','casco_total','casco_parcial','frota','outro'
  ));