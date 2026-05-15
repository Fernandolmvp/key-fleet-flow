
-- Tabela: maintenance_requests
CREATE TABLE public.maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  driver_user_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  problem_category text NOT NULL,
  problem_description text NOT NULL,
  severity_self_assessment text NOT NULL CHECK (severity_self_assessment IN ('baixa','media','alta','critica')),
  reported_latitude numeric,
  reported_longitude numeric,
  reported_location_text text,
  photos_urls text[] NOT NULL DEFAULT '{}',
  audio_url text,
  video_url text,
  km_at_report integer,
  status text NOT NULL DEFAULT 'pendente_aprovacao'
    CHECK (status IN ('pendente_aprovacao','em_analise','aprovada_agendamento','agendada','em_execucao','concluida','rejeitada','cancelada')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  scheduled_date date,
  scheduled_workshop_id uuid REFERENCES public.workshops(id) ON DELETE SET NULL,
  estimated_cost numeric(12,2),
  gestor_notes text,
  maintenance_record_id uuid REFERENCES public.maintenance_records(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mreq_company ON public.maintenance_requests(company_id);
CREATE INDEX idx_mreq_vehicle ON public.maintenance_requests(vehicle_id);
CREATE INDEX idx_mreq_driver_user ON public.maintenance_requests(driver_user_id);
CREATE INDEX idx_mreq_status ON public.maintenance_requests(company_id, status);
CREATE INDEX idx_mreq_requested_at ON public.maintenance_requests(requested_at DESC);

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drivers see own requests" ON public.maintenance_requests
  FOR SELECT USING (
    driver_user_id = auth.uid()
    OR public.can_manage_fleet(auth.uid(), company_id)
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "drivers insert own requests" ON public.maintenance_requests
  FOR INSERT WITH CHECK (
    driver_user_id = auth.uid()
    AND public.is_company_member(auth.uid(), company_id)
  );

CREATE POLICY "drivers cancel own pending" ON public.maintenance_requests
  FOR UPDATE USING (
    (driver_user_id = auth.uid() AND status IN ('pendente_aprovacao','em_analise'))
    OR public.can_manage_fleet(auth.uid(), company_id)
  ) WITH CHECK (
    (driver_user_id = auth.uid() AND status IN ('pendente_aprovacao','em_analise','cancelada'))
    OR public.can_manage_fleet(auth.uid(), company_id)
  );

CREATE POLICY "managers delete requests" ON public.maintenance_requests
  FOR DELETE USING (public.can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER t_mreq_updated BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Trigger: ao concluir o maintenance_record vinculado, fecha a request
CREATE OR REPLACE FUNCTION public.tg_mreq_sync_from_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.maintenance_requests
       SET status = 'concluida', maintenance_record_id = NEW.id, updated_at = now()
     WHERE maintenance_record_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_mreq_sync AFTER INSERT OR UPDATE ON public.maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_mreq_sync_from_record();

-- Tabela: driver_notifications
CREATE TABLE public.driver_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  related_id uuid,
  related_type text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dnotif_user ON public.driver_notifications(driver_user_id, read_at, created_at DESC);
CREATE INDEX idx_dnotif_company ON public.driver_notifications(company_id);

ALTER TABLE public.driver_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user sees own notifs" ON public.driver_notifications
  FOR SELECT USING (driver_user_id = auth.uid() OR public.can_manage_fleet(auth.uid(), company_id));

CREATE POLICY "managers create notifs" ON public.driver_notifications
  FOR INSERT WITH CHECK (
    public.can_manage_fleet(auth.uid(), company_id)
    OR public.is_company_member(auth.uid(), company_id)
  );

CREATE POLICY "user marks own read" ON public.driver_notifications
  FOR UPDATE USING (driver_user_id = auth.uid() OR public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (driver_user_id = auth.uid() OR public.can_manage_fleet(auth.uid(), company_id));

-- Função: eventos do calendário do motorista
CREATE OR REPLACE FUNCTION public.get_driver_calendar_events(
  p_driver_user_id uuid,
  p_vehicle_id uuid,
  p_start_date date,
  p_end_date date
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company uuid;
  v_vehicles uuid[];
  result jsonb := '[]'::jsonb;
BEGIN
  -- empresa atual via profile
  SELECT current_company_id INTO v_company FROM public.profiles WHERE id = p_driver_user_id;
  IF v_company IS NULL THEN RETURN result; END IF;

  -- veículos do motorista
  IF p_vehicle_id IS NOT NULL THEN
    v_vehicles := ARRAY[p_vehicle_id];
  ELSE
    SELECT array_agg(DISTINCT v.id) INTO v_vehicles
      FROM public.vehicles v
      JOIN public.drivers d ON d.company_id = v.company_id
     WHERE d.user_id = p_driver_user_id AND v.company_id = v_company;
    IF v_vehicles IS NULL THEN v_vehicles := ARRAY[]::uuid[]; END IF;
  END IF;

  -- manutenções agendadas (preventivas + maintenance_records futuras)
  SELECT result || COALESCE(jsonb_agg(jsonb_build_object(
    'id', mr.id,
    'type', CASE WHEN mr.type::text = 'preventiva' THEN 'maintenance_preventive' ELSE 'maintenance_corrective' END,
    'date', COALESCE(mr.next_service_at, mr.service_at::date),
    'title', COALESCE(mr.description, mr.category, 'Manutenção'),
    'vehicle_id', mr.vehicle_id,
    'meta', jsonb_build_object('workshop', mr.workshop_name, 'status', mr.status)
  )), '[]'::jsonb) INTO result
  FROM public.maintenance_records mr
  WHERE mr.company_id = v_company
    AND mr.vehicle_id = ANY(v_vehicles)
    AND COALESCE(mr.next_service_at, mr.service_at::date) BETWEEN p_start_date AND p_end_date;

  -- maintenance_requests agendadas
  SELECT result || COALESCE(jsonb_agg(jsonb_build_object(
    'id', mq.id,
    'type', 'maintenance_request',
    'date', mq.scheduled_date,
    'title', mq.problem_category || ' — ' || mq.severity_self_assessment,
    'vehicle_id', mq.vehicle_id,
    'meta', jsonb_build_object('status', mq.status, 'estimated_cost', mq.estimated_cost)
  )), '[]'::jsonb) INTO result
  FROM public.maintenance_requests mq
  WHERE mq.company_id = v_company
    AND mq.vehicle_id = ANY(v_vehicles)
    AND mq.scheduled_date IS NOT NULL
    AND mq.scheduled_date BETWEEN p_start_date AND p_end_date;

  -- documentos vencendo (veículo)
  SELECT result || COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'type', 'document_expiring',
    'date', d.expires_at,
    'title', COALESCE(d.title, d.doc_type::text),
    'vehicle_id', d.entity_id,
    'meta', jsonb_build_object('doc_type', d.doc_type)
  )), '[]'::jsonb) INTO result
  FROM public.documents d
  WHERE d.company_id = v_company
    AND d.entity_type::text = 'vehicle'
    AND d.entity_id = ANY(v_vehicles)
    AND d.expires_at IS NOT NULL
    AND d.expires_at BETWEEN p_start_date AND p_end_date;

  -- CNH e exame do motorista
  SELECT result || COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'type', 'driver_document_expiring',
    'date', COALESCE(d.cnh_expires_at, d.medical_exam_expires_at),
    'title', CASE WHEN d.cnh_expires_at BETWEEN p_start_date AND p_end_date THEN 'CNH vencendo' ELSE 'Exame médico vencendo' END,
    'vehicle_id', NULL,
    'meta', jsonb_build_object('cnh', d.cnh_expires_at, 'exame', d.medical_exam_expires_at)
  )), '[]'::jsonb) INTO result
  FROM public.drivers d
  WHERE d.user_id = p_driver_user_id
    AND ((d.cnh_expires_at BETWEEN p_start_date AND p_end_date) OR (d.medical_exam_expires_at BETWEEN p_start_date AND p_end_date));

  -- multas com prazo
  SELECT result || COALESCE(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'type', 'fine_due',
    'date', f.due_date,
    'title', 'Multa vence',
    'vehicle_id', f.vehicle_id,
    'meta', jsonb_build_object('status', f.status, 'amount', f.amount_original)
  )), '[]'::jsonb) INTO result
  FROM public.traffic_fines f
  WHERE f.company_id = v_company
    AND f.vehicle_id = ANY(v_vehicles)
    AND f.due_date BETWEEN p_start_date AND p_end_date;

  RETURN result;
END $$;

-- Bucket de fotos de manutenção
INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-requests', 'maintenance-requests', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "company members read maint req files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'maintenance-requests'
    AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "company members upload maint req files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'maintenance-requests'
    AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "managers delete maint req files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'maintenance-requests'
    AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
