
-- =========================================================
-- Migration 1: company_payment_methods
-- =========================================================
CREATE TABLE IF NOT EXISTS public.company_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  method_type text NOT NULL CHECK (method_type IN (
    'cartao_credito','cartao_debito','cartao_corporativo',
    'vale_combustivel','vale_refeicao','pix','conta_corrente'
  )),
  name text NOT NULL,
  description text,

  -- Cartão
  card_last_four_digits text,
  card_brand text CHECK (card_brand IS NULL OR card_brand IN ('visa','mastercard','elo','american_express','hipercard','outros')),
  card_holder_name text,
  card_expiry_month integer CHECK (card_expiry_month IS NULL OR (card_expiry_month BETWEEN 1 AND 12)),
  card_expiry_year integer,
  card_limit numeric(14,2),

  -- Bancário
  bank_name text,
  bank_agency text,
  bank_account text,
  bank_account_type text,

  -- Vínculos
  assigned_to_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  assigned_to_vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,

  -- Vale
  voucher_provider text,
  voucher_card_number text,
  voucher_monthly_credit numeric(14,2),

  -- PIX
  pix_key text,
  pix_key_type text,

  is_active boolean NOT NULL DEFAULT true,
  notes text,

  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpm_company ON public.company_payment_methods(company_id);
CREATE INDEX IF NOT EXISTS idx_cpm_driver ON public.company_payment_methods(assigned_to_driver_id);
CREATE INDEX IF NOT EXISTS idx_cpm_vehicle ON public.company_payment_methods(assigned_to_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_cpm_active ON public.company_payment_methods(company_id, is_active);

ALTER TABLE public.company_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpm_select_member" ON public.company_payment_methods
  FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "cpm_insert_manager" ON public.company_payment_methods
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE POLICY "cpm_update_manager" ON public.company_payment_methods
  FOR UPDATE TO authenticated
  USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE POLICY "cpm_delete_manager" ON public.company_payment_methods
  FOR DELETE TO authenticated
  USING (public.can_manage_fleet(auth.uid(), company_id));

DROP TRIGGER IF EXISTS trg_cpm_updated_at ON public.company_payment_methods;
CREATE TRIGGER trg_cpm_updated_at
  BEFORE UPDATE ON public.company_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
