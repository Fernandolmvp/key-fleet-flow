
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) WORKSHOPS
CREATE TABLE IF NOT EXISTS public.workshops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  trade_name text,
  document_type text,
  document_number text,
  state_registration text,
  municipal_registration text,
  workshop_type text[] NOT NULL DEFAULT '{}',
  specialties text[] NOT NULL DEFAULT '{}',
  contact_name text,
  contact_role text,
  phone text,
  whatsapp text,
  email text,
  website text,
  zip_code text,
  street text,
  address_number text,
  address_complement text,
  neighborhood text,
  city text,
  state text,
  latitude numeric,
  longitude numeric,
  payment_terms text,
  pix_key text,
  pix_key_type text,
  bank_name text,
  bank_agency text,
  bank_account text,
  bank_account_type text,
  pis text,
  cofins text,
  iss_rate numeric,
  icms_rate numeric,
  issues_invoice boolean NOT NULL DEFAULT false,
  invoice_type text,
  cnae_code text,
  simples_nacional boolean,
  contract_start date,
  contract_end date,
  preferred boolean NOT NULL DEFAULT false,
  credit_limit numeric,
  discount_pct numeric NOT NULL DEFAULT 0,
  warranty_days integer NOT NULL DEFAULT 90,
  rating numeric,
  total_orders integer NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  documents_urls jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  blocked_reason text,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  cnpj_verified boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workshops_company_id ON public.workshops(company_id);
CREATE INDEX IF NOT EXISTS idx_workshops_status ON public.workshops(status);
CREATE INDEX IF NOT EXISTS idx_workshops_document_number ON public.workshops(document_number);
CREATE INDEX IF NOT EXISTS idx_workshops_name_trgm ON public.workshops USING gin (name gin_trgm_ops);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workshops_company_doc
  ON public.workshops(company_id, document_number)
  WHERE document_number IS NOT NULL;
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view workshops" ON public.workshops
  FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write workshops" ON public.workshops
  FOR ALL USING (can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (can_manage_fleet(auth.uid(), company_id));
CREATE TRIGGER trg_workshops_updated_at
  BEFORE UPDATE ON public.workshops
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) SUPPLIERS
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  supplier_category text[] NOT NULL DEFAULT '{}',
  name text NOT NULL,
  trade_name text,
  document_type text,
  document_number text,
  state_registration text,
  municipal_registration text,
  contact_name text,
  contact_role text,
  phone text,
  whatsapp text,
  email text,
  website text,
  zip_code text,
  street text,
  address_number text,
  address_complement text,
  neighborhood text,
  city text,
  state text,
  latitude numeric,
  longitude numeric,
  payment_terms text,
  pix_key text,
  pix_key_type text,
  bank_name text,
  bank_agency text,
  bank_account text,
  bank_account_type text,
  pis text,
  cofins text,
  iss_rate numeric,
  icms_rate numeric,
  issues_invoice boolean NOT NULL DEFAULT false,
  invoice_type text,
  cnae_code text,
  simples_nacional boolean,
  contract_start date,
  contract_end date,
  preferred boolean NOT NULL DEFAULT false,
  credit_limit numeric,
  discount_pct numeric NOT NULL DEFAULT 0,
  delivery_days_avg integer,
  minimum_order numeric,
  rating numeric,
  total_orders integer NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  documents_urls jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  blocked_reason text,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  cnpj_verified boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_document_number ON public.suppliers(document_number);
CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm ON public.suppliers USING gin (name gin_trgm_ops);
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_company_doc
  ON public.suppliers(company_id, document_number)
  WHERE document_number IS NOT NULL;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view suppliers" ON public.suppliers
  FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write suppliers" ON public.suppliers
  FOR ALL USING (can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (can_manage_fleet(auth.uid(), company_id));
CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) FUEL_STATIONS expansion (additive)
ALTER TABLE public.fuel_stations
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'cnpj',
  ADD COLUMN IF NOT EXISTS state_registration text,
  ADD COLUMN IF NOT EXISTS municipal_registration text,
  ADD COLUMN IF NOT EXISTS cnae_code text,
  ADD COLUMN IF NOT EXISTS simples_nacional boolean,
  ADD COLUMN IF NOT EXISTS issues_invoice boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_type text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS has_convenience_store boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_restaurant boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_truck_lane boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_24h_operation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_lubrification boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_car_wash boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS operating_hours jsonb,
  ADD COLUMN IF NOT EXISTS accepted_payment_methods text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_purchase_amount numeric,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_key_type text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_account_type text,
  ADD COLUMN IF NOT EXISTS contract_start date,
  ADD COLUMN IF NOT EXISTS contract_end date,
  ADD COLUMN IF NOT EXISTS preferred boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_limit numeric,
  ADD COLUMN IF NOT EXISTS discount_pct_gasolina numeric,
  ADD COLUMN IF NOT EXISTS discount_pct_etanol numeric,
  ADD COLUMN IF NOT EXISTS discount_pct_diesel numeric,
  ADD COLUMN IF NOT EXISTS supports_fleet_card boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fleet_card_providers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS has_automatic_reading boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS documents_urls jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS anp_register_number text,
  ADD COLUMN IF NOT EXISTS rating numeric,
  ADD COLUMN IF NOT EXISTS total_fuelings integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_fuel_price_gasolina numeric,
  ADD COLUMN IF NOT EXISTS average_fuel_price_etanol numeric,
  ADD COLUMN IF NOT EXISTS average_fuel_price_diesel numeric,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cnpj_verified boolean DEFAULT false;

-- 4) MAINTENANCE_RECORDS: link to workshops
ALTER TABLE public.maintenance_records
  ADD COLUMN IF NOT EXISTS workshop_id uuid;
CREATE INDEX IF NOT EXISTS idx_maintenance_records_workshop_id
  ON public.maintenance_records(workshop_id);

-- 5) CNPJ_CACHE
CREATE TABLE IF NOT EXISTS public.cnpj_cache (
  cnpj text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cnpj_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cnpj_cache_read_auth" ON public.cnpj_cache
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "cnpj_cache_write_auth" ON public.cnpj_cache
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "cnpj_cache_update_auth" ON public.cnpj_cache
  FOR UPDATE USING (auth.role() = 'authenticated');

-- TODO FUTURO: tabela invoices vinculará workshop_id, supplier_id, fuel_station_id.
-- Campos preparados em cada tabela: issues_invoice, invoice_type, cnae_code, alíquotas, dados bancários, PIX.
