
-- =========================================================
-- FASE 1: Manutenção Corretiva (Oficinas) — Backend
-- =========================================================

-- workshop_users
CREATE TABLE public.workshop_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'operator' CHECK (role IN ('admin','operator')),
  password_hash text,
  invite_token text,
  invite_sent_at timestamptz,
  invite_accepted_at timestamptz,
  password_set_at timestamptz,
  last_login_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, email)
);
CREATE INDEX idx_workshop_users_workshop ON public.workshop_users(workshop_id);
CREATE INDEX idx_workshop_users_email_lower ON public.workshop_users(lower(email));
CREATE TRIGGER trg_wu_set_updated_at BEFORE UPDATE ON public.workshop_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.workshop_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers manage workshop users" ON public.workshop_users
  FOR ALL USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));
CREATE POLICY "members view workshop users" ON public.workshop_users
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));

CREATE OR REPLACE FUNCTION public.is_workshop_user(_workshop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workshop_users
    WHERE workshop_id = _workshop_id AND id = auth.uid() AND is_active = true
  );
$$;

-- workshops portal columns
ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS has_portal_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- sequence
CREATE TABLE public.work_order_sequences (
  company_id uuid NOT NULL,
  year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, year)
);
ALTER TABLE public.work_order_sequences ENABLE ROW LEVEL SECURITY;

-- maintenance_work_orders
CREATE TABLE public.maintenance_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  origin_type text NOT NULL CHECK (origin_type IN ('corretiva','preventiva','manual_gestor','emergencial')),
  maintenance_request_id uuid REFERENCES public.maintenance_requests(id) ON DELETE SET NULL,
  maintenance_schedule_id uuid,
  os_number text,
  title text NOT NULL,
  description text,
  problem_category text[] NOT NULL DEFAULT '{}',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa','normal','alta','urgente')),
  scheduled_date date NOT NULL,
  scheduled_time time,
  estimated_duration_hours numeric,
  km_at_scheduling integer,
  quote_status text NOT NULL DEFAULT 'pendente'
    CHECK (quote_status IN ('pendente','em_elaboracao','enviado','aprovado','rejeitado','expirado')),
  quote_sent_at timestamptz,
  quote_amount_parts numeric(12,2),
  quote_amount_labor numeric(12,2),
  quote_amount_other numeric(12,2),
  quote_amount_total numeric(12,2),
  quote_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  quote_warranty_days integer DEFAULT 90,
  quote_validity_days integer DEFAULT 7,
  quote_notes text,
  quote_attachment_url text,
  quote_approved_by uuid,
  quote_approved_at timestamptz,
  quote_rejected_reason text,
  quote_approval_notes text,
  execution_status text NOT NULL DEFAULT 'aguardando_aprovacao'
    CHECK (execution_status IN (
      'aguardando_aprovacao','aprovado_aguardando_inicio','em_execucao',
      'aguardando_pecas','concluido','cancelado','problema_relatado'
    )),
  execution_started_at timestamptz,
  execution_completed_at timestamptz,
  km_at_start integer,
  km_at_completion integer,
  actual_amount_total numeric(12,2),
  actual_amount_difference numeric(12,2),
  services_performed jsonb NOT NULL DEFAULT '[]'::jsonb,
  parts_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  before_photos_urls text[] NOT NULL DEFAULT '{}',
  after_photos_urls text[] NOT NULL DEFAULT '{}',
  invoice_number text,
  invoice_url text,
  warranty_until date,
  final_notes text,
  payment_status text NOT NULL DEFAULT 'pendente'
    CHECK (payment_status IN ('pendente','parcial','pago','em_recurso')),
  payment_method text,
  payment_due_date date,
  payment_paid_at date,
  payment_receipt_url text,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  rating_comment text,
  rated_by uuid,
  rated_at timestamptz,
  maintenance_record_id uuid REFERENCES public.maintenance_records(id) ON DELETE SET NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wo_company_status ON public.maintenance_work_orders(company_id, execution_status);
CREATE INDEX idx_wo_workshop_date ON public.maintenance_work_orders(workshop_id, scheduled_date);
CREATE INDEX idx_wo_vehicle ON public.maintenance_work_orders(vehicle_id);
CREATE INDEX idx_wo_driver ON public.maintenance_work_orders(driver_id);
CREATE INDEX idx_wo_request ON public.maintenance_work_orders(maintenance_request_id);

CREATE TRIGGER trg_wo_set_updated_at BEFORE UPDATE ON public.maintenance_work_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_wo_set_os_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  yr integer := EXTRACT(YEAR FROM now())::integer;
  nxt integer;
BEGIN
  IF NEW.os_number IS NOT NULL AND NEW.os_number <> '' THEN RETURN NEW; END IF;
  INSERT INTO public.work_order_sequences (company_id, year, last_number)
  VALUES (NEW.company_id, yr, 1)
  ON CONFLICT (company_id, year) DO UPDATE SET last_number = work_order_sequences.last_number + 1
  RETURNING last_number INTO nxt;
  NEW.os_number := 'OS-' || yr::text || '-' || lpad(nxt::text, 4, '0');
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_wo_set_os_number_ins BEFORE INSERT ON public.maintenance_work_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_wo_set_os_number();

CREATE OR REPLACE FUNCTION public.tg_wo_on_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rec_id uuid;
  avg_rating numeric;
BEGIN
  IF NEW.execution_status = 'concluido'
     AND (OLD.execution_status IS DISTINCT FROM 'concluido')
     AND NEW.maintenance_record_id IS NULL THEN
    INSERT INTO public.maintenance_records (
      company_id, vehicle_id, driver_id, type, category, status,
      service_at, km_at_service, workshop_name,
      labor_value, parts_value, total_value,
      invoice_url, attachments, description, notes, created_by
    )
    SELECT
      NEW.company_id, NEW.vehicle_id, NEW.driver_id, 'corretiva'::maintenance_type, NULL,
      'concluida'::maintenance_status,
      COALESCE(NEW.execution_completed_at, now()),
      NEW.km_at_completion,
      w.name,
      COALESCE(NEW.quote_amount_labor, 0),
      COALESCE(NEW.quote_amount_parts, 0),
      COALESCE(NEW.actual_amount_total, NEW.quote_amount_total, 0),
      NEW.invoice_url, NEW.after_photos_urls,
      NEW.title, NEW.final_notes, NEW.updated_by
    FROM public.workshops w WHERE w.id = NEW.workshop_id
    RETURNING id INTO rec_id;
    NEW.maintenance_record_id := rec_id;

    UPDATE public.workshops
       SET total_orders = COALESCE(total_orders, 0) + 1,
           total_amount = COALESCE(total_amount, 0) + COALESCE(NEW.actual_amount_total, NEW.quote_amount_total, 0)
     WHERE id = NEW.workshop_id;

    IF NEW.maintenance_request_id IS NOT NULL THEN
      UPDATE public.maintenance_requests
         SET status = 'concluida', maintenance_record_id = rec_id
       WHERE id = NEW.maintenance_request_id;
    END IF;
  END IF;

  IF NEW.rating IS NOT NULL AND (OLD.rating IS DISTINCT FROM NEW.rating) THEN
    SELECT AVG(rating)::numeric(3,2) INTO avg_rating
      FROM public.maintenance_work_orders
     WHERE workshop_id = NEW.workshop_id AND rating IS NOT NULL;
    UPDATE public.workshops SET rating = avg_rating WHERE id = NEW.workshop_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_wo_on_complete BEFORE UPDATE ON public.maintenance_work_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_wo_on_complete();

ALTER TABLE public.maintenance_work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers manage work orders" ON public.maintenance_work_orders
  FOR ALL USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE POLICY "drivers see their work orders" ON public.maintenance_work_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = maintenance_work_orders.driver_id
        AND d.user_id = auth.uid()
    )
  );

-- work_order_messages
CREATE TABLE public.work_order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.maintenance_work_orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('gestor','oficina')),
  message text NOT NULL,
  attachments_urls text[] NOT NULL DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wom_wo ON public.work_order_messages(work_order_id, created_at);
CREATE INDEX idx_wom_company ON public.work_order_messages(company_id);

ALTER TABLE public.work_order_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers manage wo messages" ON public.work_order_messages
  FOR ALL USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));
CREATE POLICY "members view wo messages" ON public.work_order_messages
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.work_order_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_work_orders;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-orders', 'work-orders', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "wo bucket: members read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'work-orders'
    AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "wo bucket: managers write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'work-orders'
    AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "wo bucket: managers update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'work-orders'
    AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "wo bucket: managers delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'work-orders'
    AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
