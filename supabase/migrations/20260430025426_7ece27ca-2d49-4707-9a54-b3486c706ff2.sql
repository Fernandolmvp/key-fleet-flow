
-- 1. ENUM (apenas o novo - payment_method já existe)
CREATE TYPE public.subscription_status AS ENUM (
  'aguardando_pagamento','ativa','atrasada','suspensa','cancelada'
);

CREATE TYPE public.sub_payment_method AS ENUM (
  'pix','boleto','transferencia','cartao','dinheiro','outro'
);

-- 2. PLANS
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  vehicle_limit integer,
  monthly_price numeric(10,2),
  is_custom boolean NOT NULL DEFAULT false,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- 3. SUPER ADMINS
CREATE TABLE public.super_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _user_id)
$$;

CREATE POLICY "super admins view themselves" ON public.super_admins FOR SELECT
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "super admins manage super admins" ON public.super_admins FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status public.subscription_status NOT NULL DEFAULT 'aguardando_pagamento',
  current_period_start date NOT NULL DEFAULT CURRENT_DATE,
  current_period_end date NOT NULL DEFAULT (CURRENT_DATE + interval '7 days'),
  monthly_amount numeric(10,2),
  custom_vehicle_limit integer,
  suspended_at timestamptz,
  suspended_reason text,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_company ON public.subscriptions(company_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 5. PAYMENTS
CREATE TABLE public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  amount numeric(10,2) NOT NULL,
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  method public.sub_payment_method NOT NULL DEFAULT 'pix',
  reference text,
  receipt_url text,
  covers_period_start date,
  covers_period_end date,
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_subscription ON public.subscription_payments(subscription_id);
CREATE INDEX idx_payments_company ON public.subscription_payments(company_id);
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- 6. PLANS POLICIES
CREATE POLICY "anyone reads active plans" ON public.plans FOR SELECT
  USING (active = true OR public.is_super_admin(auth.uid()));
CREATE POLICY "super admin manages plans" ON public.plans FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 7. SUBSCRIPTIONS POLICIES
CREATE POLICY "members view own subscription" ON public.subscriptions FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "super admin manages subscriptions" ON public.subscriptions FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 8. PAYMENTS POLICIES
CREATE POLICY "members view own payments" ON public.subscription_payments FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "super admin manages payments" ON public.subscription_payments FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 9. SEED PLANS
INSERT INTO public.plans (slug, name, vehicle_limit, monthly_price, is_custom, features, sort_order) VALUES
  ('starter','Starter',10,149.00,false,'["Gestão de veículos","Motoristas","Abastecimento","Manutenção","Pneus","Documentos"]'::jsonb,1),
  ('pro','Pro',50,449.00,false,'["Tudo do Starter","Postos cadastrados","Aprovações de abastecimento","Centros de custo","Múltiplas filiais"]'::jsonb,2),
  ('business','Business',100,999.00,false,'["Tudo do Pro","Suporte prioritário","Relatórios avançados","Onboarding assistido"]'::jsonb,3),
  ('enterprise','Enterprise',NULL,NULL,true,'["Acima de 100 veículos","Limite e valor a combinar","SLA dedicado","Treinamento personalizado"]'::jsonb,4);

-- 10. AUTO-SUBSCRIPTION EM NOVA EMPRESA
CREATE OR REPLACE FUNCTION public.tg_company_create_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE starter_id uuid; starter_price numeric(10,2);
BEGIN
  SELECT id, monthly_price INTO starter_id, starter_price FROM public.plans WHERE slug='starter' LIMIT 1;
  IF starter_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (company_id, plan_id, status, monthly_amount)
    VALUES (NEW.id, starter_id, 'aguardando_pagamento', starter_price)
    ON CONFLICT (company_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_company_subscription AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_company_create_subscription();

-- 11. SUBSCRIPTIONS PARA EMPRESAS EXISTENTES
INSERT INTO public.subscriptions (company_id, plan_id, status, monthly_amount, current_period_end)
SELECT c.id, (SELECT id FROM public.plans WHERE slug='starter'), 'ativa',
  (SELECT monthly_price FROM public.plans WHERE slug='starter'),
  CURRENT_DATE + interval '30 days'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.company_id = c.id);

-- 12. HELPERS
CREATE OR REPLACE FUNCTION public.get_company_vehicle_limit(_company_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(s.custom_vehicle_limit, p.vehicle_limit)
  FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id
  WHERE s.company_id = _company_id
$$;

-- 13. TRIGGER BLOQUEIO VEÍCULO
CREATE OR REPLACE FUNCTION public.tg_vehicles_enforce_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_limit integer; v_count integer; v_status public.subscription_status;
BEGIN
  SELECT status INTO v_status FROM public.subscriptions WHERE company_id = NEW.company_id;
  IF v_status IN ('suspensa','cancelada') THEN
    RAISE EXCEPTION 'Assinatura % - cadastro de veículos bloqueado. Regularize o pagamento.', v_status;
  END IF;
  v_limit := public.get_company_vehicle_limit(NEW.company_id);
  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.vehicles WHERE company_id = NEW.company_id;
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'Limite do plano atingido: % veículo(s). Faça upgrade para cadastrar mais.', v_limit;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_vehicles_plan_check BEFORE INSERT ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.tg_vehicles_enforce_plan();

-- 14. VIEW USAGE
CREATE OR REPLACE VIEW public.company_usage AS
SELECT
  c.id AS company_id, c.name AS company_name, c.cnpj, c.created_at AS company_created_at,
  s.id AS subscription_id, s.status AS subscription_status, s.current_period_end,
  s.monthly_amount, s.suspended_at, s.cancelled_at,
  p.id AS plan_id, p.slug AS plan_slug, p.name AS plan_name,
  COALESCE(s.custom_vehicle_limit, p.vehicle_limit) AS vehicle_limit,
  (SELECT COUNT(*) FROM public.vehicles v WHERE v.company_id = c.id) AS vehicles_used,
  (SELECT COUNT(*) FROM public.drivers d WHERE d.company_id = c.id) AS drivers_count,
  (SELECT COUNT(*) FROM public.company_members cm WHERE cm.company_id = c.id) AS members_count,
  (SELECT MAX(paid_at) FROM public.subscription_payments sp WHERE sp.company_id = c.id) AS last_payment_at
FROM public.companies c
LEFT JOIN public.subscriptions s ON s.company_id = c.id
LEFT JOIN public.plans p ON p.id = s.plan_id;
