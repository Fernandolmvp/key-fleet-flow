-- 1) Recriar traffic_fines (placeholder vazio)
DROP TABLE IF EXISTS public.traffic_fines CASCADE;

CREATE TABLE public.traffic_fines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  driver_id uuid,

  record_type text NOT NULL DEFAULT 'multa',
  status text NOT NULL DEFAULT 'multa_autuada',

  -- Infração
  infraction_date date NOT NULL DEFAULT CURRENT_DATE,
  infraction_time time,
  location text,
  city text,
  state text,
  fine_type text,
  fine_code text,
  description text,
  severity text,
  equipment text,

  -- Notificação
  notification_number text,
  notification_received_date date,
  amount numeric,
  discount_amount numeric,
  license_points integer NOT NULL DEFAULT 0,
  due_date date,
  recourse_deadline date,
  driver_indication_deadline date,

  -- Indicação
  driver_indicated_at date,
  driver_indication_method text,
  driver_responsibility_signed boolean NOT NULL DEFAULT false,
  driver_responsibility_signed_at timestamptz,

  -- Recurso
  recourse_filed_at date,
  recourse_result text,
  recourse_result_date date,
  recourse_notes text,
  recourse_document_url text,

  -- Pagamento
  paid_at date,
  paid_amount numeric,
  payment_method text,
  payment_receipt_url text,

  -- Anexos
  aviso_photo_url text,
  notification_photo_url text,
  additional_photos_urls text[] DEFAULT '{}',

  -- IA
  ai_extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_confidence numeric,
  external_source text NOT NULL DEFAULT 'manual',
  external_id text,
  last_sync_at timestamptz,

  -- Audit
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.traffic_fines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view traffic fines"
  ON public.traffic_fines FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "managers write traffic fines"
  ON public.traffic_fines FOR ALL
  USING (can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER trg_traffic_fines_updated
  BEFORE UPDATE ON public.traffic_fines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_traffic_fines_company_vehicle ON public.traffic_fines(company_id, vehicle_id);
CREATE INDEX idx_traffic_fines_status ON public.traffic_fines(status);
CREATE INDEX idx_traffic_fines_driver ON public.traffic_fines(driver_id);
CREATE INDEX idx_traffic_fines_due ON public.traffic_fines(due_date);

-- 2) Audit trigger
CREATE OR REPLACE FUNCTION public.tg_audit_traffic_fines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_company uuid; v_changes jsonb;
BEGIN
  v_company := COALESCE(NEW.company_id, OLD.company_id);
  IF TG_OP = 'INSERT' THEN
    v_changes := jsonb_build_object('op','INSERT','new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object('op','UPDATE','old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    v_changes := jsonb_build_object('op','DELETE','old', to_jsonb(OLD));
  END IF;
  INSERT INTO public.audit_logs(table_name, record_id, action, company_id, user_id, changes)
  VALUES ('traffic_fines', COALESCE(NEW.id, OLD.id), TG_OP, v_company, auth.uid(), v_changes);
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_traffic_fines_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.traffic_fines
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_traffic_fines();

-- 3) Função de status automático
CREATE OR REPLACE FUNCTION public.update_fines_auto_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Avisos antigos sem notificação -> arquivada
  UPDATE public.traffic_fines
     SET status = 'arquivada',
         notes = COALESCE(notes,'') || E'\n[auto] Aviso arquivado por 60+ dias sem notificação.',
         updated_at = now()
   WHERE record_type = 'aviso'
     AND status = 'aviso_recebido'
     AND notification_received_date IS NULL
     AND infraction_date < (CURRENT_DATE - INTERVAL '60 days');

  -- Multas com vencimento passado e não pagas
  UPDATE public.traffic_fines
     SET status = 'vencida',
         updated_at = now()
   WHERE record_type = 'multa'
     AND due_date IS NOT NULL
     AND due_date < CURRENT_DATE
     AND paid_at IS NULL
     AND status NOT IN ('paga_com_desconto','paga_integral','vencida','arquivada','cancelada','recurso_deferido','em_recurso');
END $$;

-- 4) Cron diário
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('fines-daily-status');
    PERFORM cron.schedule('fines-daily-status', '0 3 * * *', $sql$ SELECT public.update_fines_auto_status(); $sql$);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5) Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('fines-attachments', 'fines-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "members view fines attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fines-attachments'
    AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "managers upload fines attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fines-attachments'
    AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "managers update fines attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fines-attachments'
    AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "managers delete fines attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fines-attachments'
    AND public.can_manage_fleet(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );