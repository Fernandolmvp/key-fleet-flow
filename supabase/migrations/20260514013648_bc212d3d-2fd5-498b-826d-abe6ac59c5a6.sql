
-- Vehicles: novas colunas FIPE
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS fipe_code text,
  ADD COLUMN IF NOT EXISTS fipe_brand_code text,
  ADD COLUMN IF NOT EXISTS fipe_model_code text,
  ADD COLUMN IF NOT EXISTS fipe_year_code text,
  ADD COLUMN IF NOT EXISTS fipe_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS fipe_value_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS fipe_reference_month text;

-- Histórico FIPE
CREATE TABLE IF NOT EXISTS public.vehicle_fipe_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  fipe_code text,
  fipe_value numeric(12,2) NOT NULL,
  reference_month text,
  queried_at timestamptz NOT NULL DEFAULT now(),
  queried_by uuid,
  depreciation_pct numeric(6,2),
  source text NOT NULL DEFAULT 'api',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vfh_vehicle ON public.vehicle_fipe_history(vehicle_id, queried_at DESC);
CREATE INDEX IF NOT EXISTS idx_vfh_company ON public.vehicle_fipe_history(company_id);

ALTER TABLE public.vehicle_fipe_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vfh_select_member" ON public.vehicle_fipe_history
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "vfh_insert_manager" ON public.vehicle_fipe_history
  FOR INSERT WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

-- Cache FIPE (global, compartilhado)
CREATE TABLE IF NOT EXISTS public.fipe_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fipe_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fipe_cache_read_auth" ON public.fipe_cache
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "fipe_cache_write_auth" ON public.fipe_cache
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "fipe_cache_update_auth" ON public.fipe_cache
  FOR UPDATE USING (auth.role() = 'authenticated');
