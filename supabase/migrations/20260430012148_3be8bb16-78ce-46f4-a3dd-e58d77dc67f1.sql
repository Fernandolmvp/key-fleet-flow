
CREATE TABLE IF NOT EXISTS public.vehicle_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  movement_type text NOT NULL,
  reason text,
  notes text,
  occurred_at date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_movements_vehicle ON public.vehicle_movements(vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_movements_company ON public.vehicle_movements(company_id);

ALTER TABLE public.vehicle_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view vehicle movements"
ON public.vehicle_movements FOR SELECT
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "managers write vehicle movements"
ON public.vehicle_movements FOR ALL
USING (public.can_manage_fleet(auth.uid(), company_id))
WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));
