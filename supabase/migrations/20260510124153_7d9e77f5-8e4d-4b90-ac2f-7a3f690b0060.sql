
-- 1. plans.tokens_monthly
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS tokens_monthly integer NOT NULL DEFAULT 0;
UPDATE public.plans SET tokens_monthly = 50000   WHERE slug='starter';
UPDATE public.plans SET tokens_monthly = 200000  WHERE slug='pro';
UPDATE public.plans SET tokens_monthly = 500000  WHERE slug='business';
UPDATE public.plans SET tokens_monthly = 1000000 WHERE slug='enterprise';

-- 2. ai_token_packages
CREATE TABLE public.ai_token_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tokens_amount integer NOT NULL CHECK (tokens_amount > 0),
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  stripe_price_id text,
  description text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_token_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read active packages" ON public.ai_token_packages
  FOR SELECT TO authenticated USING (active = true OR public.is_super_admin(auth.uid()));
CREATE POLICY "super admin manages packages" ON public.ai_token_packages
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER set_updated_at_pkg BEFORE UPDATE ON public.ai_token_packages
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.ai_token_packages (name, tokens_amount, price, description, sort_order) VALUES
  ('Bronze', 80000,  20.00, 'Pacote inicial — 80 mil tokens extras', 1),
  ('Prata',  150000, 30.00, 'Pacote intermediário — 150 mil tokens extras', 2),
  ('Ouro',   300000, 50.00, 'Pacote avançado — 300 mil tokens extras', 3);

-- 3. ai_token_purchases
CREATE TABLE public.ai_token_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  package_id uuid NOT NULL REFERENCES public.ai_token_packages(id),
  tokens_purchased integer NOT NULL,
  amount_paid numeric(10,2) NOT NULL,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  purchased_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_token_purchases_company ON public.ai_token_purchases(company_id, created_at DESC);
ALTER TABLE public.ai_token_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view own purchases" ON public.ai_token_purchases
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "super admin manages purchases" ON public.ai_token_purchases
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER set_updated_at_purch BEFORE UPDATE ON public.ai_token_purchases
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. ai_token_balance
CREATE TABLE public.ai_token_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  plan_tokens_remaining integer NOT NULL DEFAULT 0,
  extra_tokens_balance integer NOT NULL DEFAULT 0,
  last_plan_reset_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_token_balance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view own balance" ON public.ai_token_balance
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "super admin manages balance" ON public.ai_token_balance
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER set_updated_at_bal BEFORE UPDATE ON public.ai_token_balance
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5. ai_usage_logs
CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid,
  feature text NOT NULL,
  model text,
  tokens_input integer NOT NULL DEFAULT 0,
  tokens_output integer NOT NULL DEFAULT 0,
  tokens_total integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'plan' CHECK (source IN ('plan','extra','mixed','free','blocked')),
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_usage_logs_company ON public.ai_usage_logs(company_id, created_at DESC);
CREATE INDEX idx_usage_logs_feature ON public.ai_usage_logs(feature);
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view own usage" ON public.ai_usage_logs
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "super admin manages usage" ON public.ai_usage_logs
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 6. RPCs
CREATE OR REPLACE FUNCTION public.check_ai_token_balance(_company_id uuid)
RETURNS TABLE(total_available integer, plan_remaining integer, extra_balance integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(plan_tokens_remaining,0)+COALESCE(extra_tokens_balance,0),
         COALESCE(plan_tokens_remaining,0),
         COALESCE(extra_tokens_balance,0)
  FROM public.ai_token_balance WHERE company_id=_company_id
  UNION ALL SELECT 0,0,0 WHERE NOT EXISTS (SELECT 1 FROM public.ai_token_balance WHERE company_id=_company_id)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.consume_ai_tokens(
  _company_id uuid, _user_id uuid, _tokens_used integer, _feature text, _model text DEFAULT NULL,
  _tokens_input integer DEFAULT 0, _tokens_output integer DEFAULT 0,
  _success boolean DEFAULT true, _error text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b RECORD; from_plan int := 0; from_extra int := 0; src text;
BEGIN
  IF _tokens_used IS NULL OR _tokens_used < 0 THEN _tokens_used := 0; END IF;

  INSERT INTO public.ai_token_balance (company_id) VALUES (_company_id)
    ON CONFLICT (company_id) DO NOTHING;

  SELECT * INTO b FROM public.ai_token_balance WHERE company_id=_company_id FOR UPDATE;

  IF (b.plan_tokens_remaining + b.extra_tokens_balance) < _tokens_used THEN
    INSERT INTO public.ai_usage_logs(company_id,user_id,feature,model,tokens_input,tokens_output,tokens_total,source,success,error_message)
    VALUES (_company_id,_user_id,_feature,_model,_tokens_input,_tokens_output,_tokens_used,'blocked',false,'insufficient_tokens');
    RAISE EXCEPTION 'insufficient_tokens';
  END IF;

  IF b.plan_tokens_remaining >= _tokens_used THEN
    from_plan := _tokens_used; src := 'plan';
  ELSE
    from_plan := b.plan_tokens_remaining;
    from_extra := _tokens_used - from_plan;
    src := CASE WHEN from_plan > 0 THEN 'mixed' ELSE 'extra' END;
  END IF;

  UPDATE public.ai_token_balance
     SET plan_tokens_remaining = plan_tokens_remaining - from_plan,
         extra_tokens_balance  = extra_tokens_balance  - from_extra,
         updated_at = now()
   WHERE company_id = _company_id;

  INSERT INTO public.ai_usage_logs(company_id,user_id,feature,model,tokens_input,tokens_output,tokens_total,source,success,error_message)
  VALUES (_company_id,_user_id,_feature,_model,_tokens_input,_tokens_output,_tokens_used,src,_success,_error);

  RETURN jsonb_build_object('ok',true,'from_plan',from_plan,'from_extra',from_extra,'source',src);
END $$;

CREATE OR REPLACE FUNCTION public.add_extra_tokens(_company_id uuid, _tokens integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF _tokens IS NULL OR _tokens <= 0 THEN RETURN; END IF;
  INSERT INTO public.ai_token_balance(company_id, extra_tokens_balance)
  VALUES (_company_id, _tokens)
  ON CONFLICT (company_id) DO UPDATE
    SET extra_tokens_balance = public.ai_token_balance.extra_tokens_balance + EXCLUDED.extra_tokens_balance,
        updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.reset_monthly_plan_tokens()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n int := 0;
BEGIN
  WITH upd AS (
    INSERT INTO public.ai_token_balance(company_id, plan_tokens_remaining, last_plan_reset_at)
    SELECT s.company_id, p.tokens_monthly, now()
      FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id
     WHERE s.status = 'ativa' AND s.company_id IS NOT NULL
    ON CONFLICT (company_id) DO UPDATE
      SET plan_tokens_remaining = EXCLUDED.plan_tokens_remaining,
          last_plan_reset_at    = EXCLUDED.last_plan_reset_at,
          updated_at = now()
    RETURNING 1
  ) SELECT count(*) INTO n FROM upd;
  RETURN n;
END $$;

-- 7. Trigger init balance ao criar subscription
CREATE OR REPLACE FUNCTION public.tg_subscription_init_token_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tokens int;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  SELECT tokens_monthly INTO v_tokens FROM public.plans WHERE id = NEW.plan_id;
  INSERT INTO public.ai_token_balance(company_id, plan_tokens_remaining, last_plan_reset_at)
  VALUES (NEW.company_id, COALESCE(v_tokens,0), now())
  ON CONFLICT (company_id) DO UPDATE
    SET plan_tokens_remaining = EXCLUDED.plan_tokens_remaining,
        last_plan_reset_at    = EXCLUDED.last_plan_reset_at,
        updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER tg_subscription_init_token_balance
AFTER INSERT ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.tg_subscription_init_token_balance();

-- 8. Backfill empresas existentes
INSERT INTO public.ai_token_balance(company_id, plan_tokens_remaining, last_plan_reset_at)
SELECT s.company_id, COALESCE(p.tokens_monthly,0), now()
  FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id
 WHERE s.company_id IS NOT NULL
ON CONFLICT (company_id) DO NOTHING;
