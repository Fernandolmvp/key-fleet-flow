
-- Corretores de seguros
CREATE TABLE public.insurance_brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  legal_name text,
  document text, -- CNPJ ou CPF
  susep text,
  contact_name text,
  phone text,
  email text,
  address text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_brokers_company ON public.insurance_brokers(company_id);
ALTER TABLE public.insurance_brokers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view brokers" ON public.insurance_brokers
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write brokers" ON public.insurance_brokers
  FOR ALL USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER trg_brokers_updated BEFORE UPDATE ON public.insurance_brokers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Apólices da frota (uma apólice cobre vários veículos)
CREATE TABLE public.insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  policy_number text NOT NULL,
  insurer_name text NOT NULL,
  insurer_phone text,
  insurer_email text,
  broker_id uuid REFERENCES public.insurance_brokers(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  total_value numeric(12,2),
  deductible numeric(12,2),
  coverage_summary text,
  file_url text,
  file_name text,
  ai_extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'ativa', -- ativa | vencida | cancelada
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_policies_company ON public.insurance_policies(company_id);
CREATE INDEX idx_policies_broker ON public.insurance_policies(broker_id);
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view policies" ON public.insurance_policies
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write policies" ON public.insurance_policies
  FOR ALL USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER trg_policies_updated BEFORE UPDATE ON public.insurance_policies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Vínculo veículo ↔ apólice (com tipo: original ou adendo)
CREATE TABLE public.insurance_policy_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  policy_id uuid NOT NULL REFERENCES public.insurance_policies(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL,
  inclusion_type text NOT NULL DEFAULT 'apolice', -- 'apolice' | 'adendo'
  included_at date NOT NULL DEFAULT CURRENT_DATE,
  removed_at date,
  endorsement_number text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_id, vehicle_id)
);
CREATE INDEX idx_pv_company ON public.insurance_policy_vehicles(company_id);
CREATE INDEX idx_pv_policy ON public.insurance_policy_vehicles(policy_id);
CREATE INDEX idx_pv_vehicle ON public.insurance_policy_vehicles(vehicle_id);
ALTER TABLE public.insurance_policy_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view policy vehicles" ON public.insurance_policy_vehicles
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write policy vehicles" ON public.insurance_policy_vehicles
  FOR ALL USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER trg_pv_updated BEFORE UPDATE ON public.insurance_policy_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Storage bucket para PDFs de apólices
INSERT INTO storage.buckets (id, name, public)
VALUES ('insurance-policies', 'insurance-policies', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "members read insurance policies" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'insurance-policies'
    AND auth.uid() IS NOT NULL
  );
CREATE POLICY "members upload insurance policies" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'insurance-policies'
    AND auth.uid() IS NOT NULL
  );
CREATE POLICY "members update insurance policies" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'insurance-policies'
    AND auth.uid() IS NOT NULL
  );
CREATE POLICY "members delete insurance policies" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'insurance-policies'
    AND auth.uid() IS NOT NULL
  );
