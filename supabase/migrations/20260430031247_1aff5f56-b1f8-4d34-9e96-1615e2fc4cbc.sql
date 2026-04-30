
-- 1) Mapear price_id (stripe) -> plan_id
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS stripe_price_id text UNIQUE;
UPDATE public.plans SET stripe_price_id = 'starter_monthly'  WHERE slug='starter';
UPDATE public.plans SET stripe_price_id = 'pro_monthly'      WHERE slug='pro';
UPDATE public.plans SET stripe_price_id = 'business_monthly' WHERE slug='business';

-- 2) Campos Stripe na assinatura
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_environment text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_payment_status text;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_cust ON public.subscriptions(stripe_customer_id);

-- 3) Permitir membro da empresa LER os planos (já existe? garantir)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can read plans" ON public.plans;
CREATE POLICY "anyone can read plans" ON public.plans FOR SELECT USING (true);

-- 4) RPC chamada pelo webhook (service role) para aplicar mudanças do Stripe
CREATE OR REPLACE FUNCTION public.apply_stripe_subscription(
  _company_id uuid,
  _stripe_customer_id text,
  _stripe_subscription_id text,
  _stripe_price_id text,
  _stripe_status text,
  _current_period_start timestamptz,
  _current_period_end timestamptz,
  _cancel_at_period_end boolean,
  _environment text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_plan_price numeric(10,2);
  v_status public.subscription_status;
BEGIN
  SELECT id, monthly_price INTO v_plan_id, v_plan_price
    FROM public.plans WHERE stripe_price_id = _stripe_price_id;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'plano não encontrado para stripe_price_id %', _stripe_price_id;
  END IF;

  -- mapear status do stripe -> status interno
  v_status := CASE _stripe_status
    WHEN 'active'              THEN 'ativa'
    WHEN 'trialing'            THEN 'ativa'
    WHEN 'past_due'            THEN 'atrasada'
    WHEN 'unpaid'              THEN 'suspensa'
    WHEN 'incomplete'          THEN 'aguardando_pagamento'
    WHEN 'incomplete_expired'  THEN 'cancelada'
    WHEN 'canceled'            THEN 'cancelada'
    WHEN 'paused'              THEN 'suspensa'
    ELSE 'aguardando_pagamento'
  END::public.subscription_status;

  UPDATE public.subscriptions SET
    plan_id = v_plan_id,
    status = v_status,
    monthly_amount = v_plan_price,
    current_period_start = COALESCE(_current_period_start::date, CURRENT_DATE),
    current_period_end = COALESCE(_current_period_end::date, CURRENT_DATE + INTERVAL '30 days'),
    cancel_at_period_end = COALESCE(_cancel_at_period_end, false),
    stripe_customer_id = _stripe_customer_id,
    stripe_subscription_id = _stripe_subscription_id,
    stripe_environment = _environment,
    suspended_at = CASE WHEN v_status = 'suspensa' THEN now() ELSE NULL END,
    cancelled_at = CASE WHEN v_status = 'cancelada' THEN now() ELSE cancelled_at END
  WHERE company_id = _company_id;
END $$;

-- 5) Registrar pagamento (chamado quando invoice.payment_succeeded)
CREATE OR REPLACE FUNCTION public.record_stripe_payment(
  _company_id uuid,
  _amount numeric,
  _stripe_invoice_id text,
  _stripe_payment_intent_id text,
  _paid_at timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_sub_id uuid;
BEGIN
  SELECT id INTO v_sub_id FROM public.subscriptions WHERE company_id = _company_id;
  IF v_sub_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.subscription_payments (
    subscription_id, company_id, amount, method, reference, paid_at, notes
  ) VALUES (
    v_sub_id, _company_id, _amount, 'cartao',
    COALESCE(_stripe_invoice_id, _stripe_payment_intent_id),
    COALESCE(_paid_at, now()),
    'Cobrança automática Stripe'
  )
  ON CONFLICT DO NOTHING;
END $$;
