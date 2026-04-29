-- Enum status para autorização de abastecimento
CREATE TYPE public.fuel_auth_status AS ENUM ('pendente','aprovada','recusada','utilizada','expirada','cancelada');

-- Tabela de autorizações de abastecimento (motorista solicita -> gestor aprova -> código gerado)
CREATE TABLE public.fuel_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  driver_id uuid,
  requested_by uuid NOT NULL,
  approved_by uuid,
  status public.fuel_auth_status NOT NULL DEFAULT 'pendente',
  authorization_code text,
  estimated_liters numeric,
  estimated_value numeric,
  fuel_type text,
  station_name text,
  notes text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  used_at timestamptz,
  expires_at timestamptz,
  fuel_record_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fuel_auth_company_status ON public.fuel_authorizations(company_id, status);
CREATE INDEX idx_fuel_auth_code ON public.fuel_authorizations(authorization_code) WHERE authorization_code IS NOT NULL;
CREATE INDEX idx_fuel_auth_requested_by ON public.fuel_authorizations(requested_by);

ALTER TABLE public.fuel_authorizations ENABLE ROW LEVEL SECURITY;

-- Motoristas podem ver as próprias solicitações
CREATE POLICY "view own or manager fuel auth"
  ON public.fuel_authorizations FOR SELECT
  USING (
    requested_by = auth.uid()
    OR can_manage_fleet(auth.uid(), company_id)
  );

-- Membros da empresa podem criar (motorista solicita p/ si mesmo)
CREATE POLICY "members create fuel auth"
  ON public.fuel_authorizations FOR INSERT
  WITH CHECK (
    is_company_member(auth.uid(), company_id)
    AND requested_by = auth.uid()
  );

-- Gestores aprovam/atualizam
CREATE POLICY "managers update fuel auth"
  ON public.fuel_authorizations FOR UPDATE
  USING (can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (can_manage_fleet(auth.uid(), company_id));

-- O próprio solicitante pode marcar como utilizada (ao anexar cupom)
CREATE POLICY "requester marks used"
  ON public.fuel_authorizations FOR UPDATE
  USING (requested_by = auth.uid())
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "managers delete fuel auth"
  ON public.fuel_authorizations FOR DELETE
  USING (can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER trg_fuel_auth_updated_at
  BEFORE UPDATE ON public.fuel_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Função para gerar código de autorização único de 6 dígitos
CREATE OR REPLACE FUNCTION public.generate_fuel_auth_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  attempts int := 0;
BEGIN
  LOOP
    new_code := lpad(floor(random() * 1000000)::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.fuel_authorizations
      WHERE authorization_code = new_code
        AND status IN ('aprovada')
    );
    attempts := attempts + 1;
    IF attempts > 20 THEN
      RAISE EXCEPTION 'Não foi possível gerar código único';
    END IF;
  END LOOP;
  RETURN new_code;
END;
$$;

-- Trigger: quando aprovar, gerar código + expiração 24h
CREATE OR REPLACE FUNCTION public.tg_fuel_auth_on_approve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'aprovada' AND (OLD.status IS DISTINCT FROM 'aprovada') THEN
    NEW.authorization_code := COALESCE(NEW.authorization_code, public.generate_fuel_auth_code());
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    NEW.expires_at := COALESCE(NEW.expires_at, now() + interval '24 hours');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fuel_auth_approve
  BEFORE UPDATE ON public.fuel_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_fuel_auth_on_approve();

-- Tabela de checklist de manutenção preventiva (template fixo + execuções)
CREATE TABLE public.maintenance_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_record_id uuid NOT NULL,
  company_id uuid NOT NULL,
  item_key text NOT NULL,
  item_label text NOT NULL,
  category text,
  checked boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_record ON public.maintenance_checklist_items(maintenance_record_id);

ALTER TABLE public.maintenance_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view checklist"
  ON public.maintenance_checklist_items FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "managers write checklist"
  ON public.maintenance_checklist_items FOR ALL
  USING (can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (can_manage_fleet(auth.uid(), company_id));

-- Storage bucket para fotos do colaborador (placa, painel, cupom)
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-uploads', 'driver-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "driver upload own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'driver-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "driver read own + managers all"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'driver-uploads'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin','gestor_frota')
      )
    )
  );

CREATE POLICY "driver update own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'driver-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );