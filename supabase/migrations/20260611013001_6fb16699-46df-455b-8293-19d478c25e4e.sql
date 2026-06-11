-- 0) Drop função que muda assinatura (passou a expor is_blocked)
DROP FUNCTION IF EXISTS public.get_my_acquisition_state();

-- 1) Função central única: is_company_blocked
CREATE OR REPLACE FUNCTION public.is_company_blocked(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exempt boolean;
  v_trial_end timestamptz;
  v_company_status text;
  v_sub_status text;
BEGIN
  IF p_company_id IS NULL THEN RETURN false; END IF;

  SELECT is_exempt_from_trial, trial_ends_at, status
    INTO v_exempt, v_trial_end, v_company_status
    FROM public.companies WHERE id = p_company_id;

  IF COALESCE(v_exempt,false) THEN RETURN false; END IF;
  IF v_company_status IN ('suspensa','cancelada') THEN RETURN true; END IF;

  SELECT status::text INTO v_sub_status
    FROM public.subscriptions
    WHERE company_id = p_company_id
    ORDER BY created_at DESC LIMIT 1;

  IF v_sub_status = 'ativa' THEN RETURN false; END IF;
  IF v_sub_status = 'atrasada' THEN RETURN false; END IF;
  IF v_sub_status IN ('suspensa','cancelada') THEN RETURN true; END IF;

  IF v_trial_end IS NOT NULL AND v_trial_end > now() THEN RETURN false; END IF;
  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.is_company_blocked(uuid) TO authenticated, anon, service_role;

-- 2) is_trial_active = NOT is_company_blocked
CREATE OR REPLACE FUNCTION public.is_trial_active(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT NOT public.is_company_blocked(p_company_id) $$;

-- 3) get_trial_days_remaining baseado apenas em trial_ends_at
CREATE OR REPLACE FUNCTION public.get_trial_days_remaining(p_company_id uuid)
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_exempt boolean; v_trial_end timestamptz; v_sub_status text; v_stripe text;
BEGIN
  IF p_company_id IS NULL THEN RETURN NULL; END IF;
  SELECT is_exempt_from_trial, trial_ends_at INTO v_exempt, v_trial_end
    FROM public.companies WHERE id = p_company_id;
  IF COALESCE(v_exempt,false) THEN RETURN NULL; END IF;
  SELECT status::text, stripe_subscription_id INTO v_sub_status, v_stripe
    FROM public.subscriptions WHERE company_id = p_company_id
    ORDER BY created_at DESC LIMIT 1;
  IF v_sub_status = 'ativa' AND v_stripe IS NOT NULL THEN RETURN NULL; END IF;
  IF v_trial_end IS NULL THEN RETURN NULL; END IF;
  RETURN GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_trial_end - now()))/86400.0)::int);
END $$;

-- 4) get_my_acquisition_state recriada
CREATE OR REPLACE FUNCTION public.get_my_acquisition_state()
RETURNS TABLE(
  has_company boolean,
  company_id uuid,
  subscription_status text,
  is_active boolean,
  is_blocked boolean,
  trial_days_remaining integer,
  is_exempt boolean,
  trial_ends_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cur_company uuid;
  sub_status text;
  v_exempt boolean;
  v_trial_end timestamptz;
  v_days int;
  v_blocked boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, false, false, NULL::int, false, NULL::timestamptz; RETURN;
  END IF;
  SELECT current_company_id INTO cur_company FROM public.profiles WHERE id = uid;
  IF cur_company IS NULL THEN
    SELECT cm.company_id INTO cur_company FROM public.company_members cm
     WHERE cm.user_id = uid ORDER BY cm.created_at ASC LIMIT 1;
  END IF;
  IF cur_company IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, false, false, NULL::int, false, NULL::timestamptz; RETURN;
  END IF;
  SELECT s.status::text INTO sub_status FROM public.subscriptions s
   WHERE s.company_id = cur_company ORDER BY s.created_at DESC LIMIT 1;
  SELECT c.is_exempt_from_trial, c.trial_ends_at INTO v_exempt, v_trial_end
    FROM public.companies c WHERE c.id = cur_company;
  v_blocked := public.is_company_blocked(cur_company);
  v_days := public.get_trial_days_remaining(cur_company);
  RETURN QUERY SELECT true, cur_company,
                      COALESCE(sub_status,'aguardando_pagamento'),
                      NOT v_blocked, v_blocked,
                      v_days, COALESCE(v_exempt,false), v_trial_end;
END $$;

GRANT EXECUTE ON FUNCTION public.get_my_acquisition_state() TO authenticated, service_role;

-- 5) Trigger de criação de empresa: assinatura nasce como 'trial'
CREATE OR REPLACE FUNCTION public.tg_company_create_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  starter_id uuid;
  starter_price numeric(10,2);
  v_end date;
BEGIN
  SELECT id, monthly_price INTO starter_id, starter_price
    FROM public.plans WHERE slug='starter' LIMIT 1;
  IF starter_id IS NULL THEN RETURN NEW; END IF;

  v_end := COALESCE(NEW.trial_ends_at::date, (CURRENT_DATE + INTERVAL '21 days')::date);

  INSERT INTO public.subscriptions (
    company_id, plan_id, status, monthly_amount,
    current_period_start, current_period_end
  ) VALUES (
    NEW.id, starter_id,
    CASE WHEN COALESCE(NEW.is_exempt_from_trial,false)
         THEN 'ativa'::public.subscription_status
         ELSE 'trial'::public.subscription_status END,
    starter_price, CURRENT_DATE, v_end
  )
  ON CONFLICT (company_id) DO NOTHING;

  RETURN NEW;
END $$;

-- =====================================================
-- DATA FIX
-- =====================================================

-- (a) Estende trial da realize por 30 dias
UPDATE public.companies
   SET trial_ends_at = now() + INTERVAL '30 days', updated_at = now()
 WHERE cnpj = '30035063000130';

-- (b) Padroniza subscriptions: empresas em trial real → status 'trial'
UPDATE public.subscriptions s
   SET status = 'trial'::public.subscription_status, updated_at = now()
  FROM public.companies c
 WHERE s.company_id = c.id
   AND COALESCE(c.is_exempt_from_trial,false) = false
   AND c.trial_ends_at IS NOT NULL
   AND c.trial_ends_at > now()
   AND s.stripe_subscription_id IS NULL
   AND s.status::text <> 'trial';

-- (c) Trial vencido sem pagamento → 'expirada'
UPDATE public.subscriptions s
   SET status = 'expirada'::public.subscription_status, updated_at = now()
  FROM public.companies c
 WHERE s.company_id = c.id
   AND COALESCE(c.is_exempt_from_trial,false) = false
   AND c.trial_ends_at IS NOT NULL
   AND c.trial_ends_at <= now()
   AND s.stripe_subscription_id IS NULL
   AND s.status::text IN ('trial','aguardando_pagamento');