-- Enums
CREATE TYPE public.maintenance_type AS ENUM ('preventiva', 'corretiva', 'pneus', 'sinistro');
CREATE TYPE public.maintenance_status AS ENUM ('agendada', 'em_andamento', 'concluida', 'cancelada');
CREATE TYPE public.schedule_status AS ENUM ('pendente', 'proxima', 'vencida', 'concluida');

-- maintenance_records
CREATE TABLE public.maintenance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,
  driver_id UUID,
  cost_center_id UUID,
  type public.maintenance_type NOT NULL,
  category TEXT,
  status public.maintenance_status NOT NULL DEFAULT 'concluida',
  service_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  km_at_service INTEGER,
  next_service_km INTEGER,
  next_service_at DATE,
  workshop_name TEXT,
  workshop_cnpj TEXT,
  city TEXT,
  state TEXT,
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  labor_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  parts_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  invoice_url TEXT,
  attachments TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_maint_company ON public.maintenance_records(company_id);
CREATE INDEX idx_maint_vehicle ON public.maintenance_records(vehicle_id, service_at DESC);

ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view maintenance"
  ON public.maintenance_records FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "managers write maintenance"
  ON public.maintenance_records FOR ALL
  USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER trg_maint_updated
  BEFORE UPDATE ON public.maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- maintenance_schedules
CREATE TABLE public.maintenance_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,
  type public.maintenance_type NOT NULL DEFAULT 'preventiva',
  category TEXT NOT NULL,
  description TEXT,
  target_km INTEGER,
  target_date DATE,
  interval_km INTEGER,
  interval_days INTEGER,
  status public.schedule_status NOT NULL DEFAULT 'pendente',
  completed_record_id UUID REFERENCES public.maintenance_records(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sched_company ON public.maintenance_schedules(company_id);
CREATE INDEX idx_sched_vehicle ON public.maintenance_schedules(vehicle_id);

ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view schedules"
  ON public.maintenance_schedules FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "managers write schedules"
  ON public.maintenance_schedules FOR ALL
  USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER trg_sched_updated
  BEFORE UPDATE ON public.maintenance_schedules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('maintenance-docs', 'maintenance-docs', false);

CREATE POLICY "members read maintenance docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'maintenance-docs'
    AND auth.uid() IS NOT NULL
    AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "managers upload maintenance docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'maintenance-docs'
    AND auth.uid() IS NOT NULL
    AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "managers update maintenance docs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'maintenance-docs'
    AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "managers delete maintenance docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'maintenance-docs'
    AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );