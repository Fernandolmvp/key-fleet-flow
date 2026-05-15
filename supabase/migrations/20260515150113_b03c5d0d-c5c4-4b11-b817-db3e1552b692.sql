
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS expense_auto_approval_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS require_invoice_for_categories text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.trip_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,

  expense_date date NOT NULL,
  expense_time time,
  expense_category text NOT NULL CHECK (expense_category IN (
    'combustivel','pedagio','refeicao','hospedagem','lavagem',
    'estacionamento','manutencao_emergencial','pneu_emergencial',
    'transporte_complementar','comunicacao','taxa_servico',
    'mensageria','taxa_governamental','outros'
  )),
  description text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  city text,
  state text,
  supplier_name text,
  supplier_document text,

  payment_method text NOT NULL CHECK (payment_method IN (
    'dinheiro_empresa','cartao_empresa','pix_empresa',
    'vale_refeicao','vale_combustivel',
    'dinheiro_proprio','cartao_proprio','pix_proprio'
  )),
  company_card_id uuid REFERENCES public.company_payment_methods(id) ON DELETE SET NULL,

  has_invoice boolean NOT NULL DEFAULT false,
  invoice_type text CHECK (invoice_type IS NULL OR invoice_type IN ('nfe','nfce','cupom_fiscal','recibo','outros')),
  invoice_number text,
  invoice_issued_at date,
  invoice_url text,

  receipt_url text NOT NULL,
  additional_photos_urls text[] NOT NULL DEFAULT '{}',

  requires_reimbursement boolean NOT NULL DEFAULT false,
  reimbursement_status text NOT NULL DEFAULT 'nao_aplicavel'
    CHECK (reimbursement_status IN ('nao_aplicavel','aguardando_aprovacao','aprovado','rejeitado','pago')),
  reimbursement_approved_by uuid,
  reimbursement_approved_at timestamptz,
  reimbursement_rejection_reason text,
  reimbursement_paid_at date,
  reimbursement_paid_method text,
  reimbursement_adjusted_amount numeric(14,2),

  auto_approved boolean NOT NULL DEFAULT false,
  within_budget_limit boolean,

  latitude numeric(10,7),
  longitude numeric(10,7),

  notes text,
  created_by uuid,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_te_trip ON public.trip_expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_te_driver ON public.trip_expenses(driver_id);
CREATE INDEX IF NOT EXISTS idx_te_company_status ON public.trip_expenses(company_id, reimbursement_status);
CREATE INDEX IF NOT EXISTS idx_te_category ON public.trip_expenses(company_id, expense_category);

DROP TRIGGER IF EXISTS trg_te_updated_at ON public.trip_expenses;
CREATE TRIGGER trg_te_updated_at BEFORE UPDATE ON public.trip_expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Trigger: calcula reembolso/auto aprovação
CREATE OR REPLACE FUNCTION public.tg_te_calc_approval()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_limits jsonb;
  v_required_inv text[];
  v_limit numeric;
  v_requires_inv boolean;
BEGIN
  -- Define se precisa reembolso
  IF NEW.payment_method IN ('dinheiro_proprio','cartao_proprio','pix_proprio') THEN
    NEW.requires_reimbursement := true;
  ELSE
    NEW.requires_reimbursement := false;
    NEW.reimbursement_status := 'nao_aplicavel';
    NEW.within_budget_limit := true;
    NEW.auto_approved := false;
    RETURN NEW;
  END IF;

  -- Carrega política da empresa
  SELECT expense_auto_approval_limits, require_invoice_for_categories
    INTO v_limits, v_required_inv
    FROM public.companies WHERE id = NEW.company_id;

  v_limits := COALESCE(v_limits, '{}'::jsonb);
  v_required_inv := COALESCE(v_required_inv, ARRAY[]::text[]);

  v_requires_inv := NEW.expense_category = ANY(v_required_inv);

  -- Limite por categoria
  IF v_limits ? NEW.expense_category AND (v_limits->>NEW.expense_category) IS NOT NULL THEN
    v_limit := (v_limits->>NEW.expense_category)::numeric;
    NEW.within_budget_limit := NEW.amount <= v_limit;
  ELSE
    v_limit := NULL;
    NEW.within_budget_limit := NULL;
  END IF;

  -- Se já aprovado/pago manualmente, mantém
  IF TG_OP = 'UPDATE' AND OLD.reimbursement_status IN ('aprovado','rejeitado','pago') THEN
    RETURN NEW;
  END IF;

  -- Auto aprovação
  IF v_limit IS NOT NULL AND NEW.amount <= v_limit AND (NOT v_requires_inv OR NEW.has_invoice) THEN
    NEW.auto_approved := true;
    NEW.reimbursement_status := 'aprovado';
    NEW.reimbursement_approved_at := COALESCE(NEW.reimbursement_approved_at, now());
  ELSE
    NEW.auto_approved := false;
    NEW.reimbursement_status := 'aguardando_aprovacao';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_te_calc_approval ON public.trip_expenses;
CREATE TRIGGER trg_te_calc_approval
  BEFORE INSERT OR UPDATE ON public.trip_expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_te_calc_approval();

-- Trigger: recalcula totais na trip
CREATE OR REPLACE FUNCTION public.tg_te_recalc_trip()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_trip uuid;
BEGIN
  v_trip := COALESCE(NEW.trip_id, OLD.trip_id);
  UPDATE public.trips t SET
    total_spent_cash = COALESCE((SELECT SUM(amount) FROM public.trip_expenses WHERE trip_id = v_trip AND payment_method = 'dinheiro_empresa'),0),
    total_spent_card = COALESCE((SELECT SUM(amount) FROM public.trip_expenses WHERE trip_id = v_trip AND payment_method IN ('cartao_empresa')),0),
    total_spent_other = COALESCE((SELECT SUM(amount) FROM public.trip_expenses WHERE trip_id = v_trip AND payment_method IN ('pix_empresa','vale_refeicao','vale_combustivel')),0),
    total_reimbursable = COALESCE((SELECT SUM(COALESCE(reimbursement_adjusted_amount, amount)) FROM public.trip_expenses WHERE trip_id = v_trip AND requires_reimbursement = true AND reimbursement_status <> 'rejeitado'),0),
    balance_to_return = GREATEST(
      COALESCE((SELECT total_advance_cash FROM public.trips WHERE id = v_trip),0)
      - COALESCE((SELECT SUM(amount) FROM public.trip_expenses WHERE trip_id = v_trip AND payment_method = 'dinheiro_empresa'),0)
    , 0),
    updated_at = now()
  WHERE t.id = v_trip;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_te_recalc_trip ON public.trip_expenses;
CREATE TRIGGER trg_te_recalc_trip
  AFTER INSERT OR UPDATE OR DELETE ON public.trip_expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_te_recalc_trip();

ALTER TABLE public.trip_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "te_select_member_or_driver" ON public.trip_expenses
  FOR SELECT TO authenticated
  USING (
    public.is_company_member(auth.uid(), company_id)
    OR public.is_trip_driver(auth.uid(), driver_id)
  );

CREATE POLICY "te_insert_driver_or_manager" ON public.trip_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_fleet(auth.uid(), company_id)
    OR (
      public.is_trip_driver(auth.uid(), driver_id)
      AND EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id = trip_id
          AND t.status IN ('programada','em_andamento','aguardando_acerto')
      )
    )
  );

CREATE POLICY "te_update_manager_or_driver_pending" ON public.trip_expenses
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_fleet(auth.uid(), company_id)
    OR (public.is_trip_driver(auth.uid(), driver_id)
        AND reimbursement_status IN ('nao_aplicavel','aguardando_aprovacao'))
  )
  WITH CHECK (
    public.can_manage_fleet(auth.uid(), company_id)
    OR public.is_trip_driver(auth.uid(), driver_id)
  );

CREATE POLICY "te_delete_manager_or_driver_pending" ON public.trip_expenses
  FOR DELETE TO authenticated
  USING (
    public.can_manage_fleet(auth.uid(), company_id)
    OR (public.is_trip_driver(auth.uid(), driver_id)
        AND reimbursement_status IN ('nao_aplicavel','aguardando_aprovacao'))
  );
