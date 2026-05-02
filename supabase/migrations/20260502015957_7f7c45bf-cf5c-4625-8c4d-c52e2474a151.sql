
-- Helper: garantir função de updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 1) Grupos econômicos
CREATE TABLE IF NOT EXISTS public.company_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  extra_company_fee numeric NOT NULL DEFAULT 30.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner views own group"
  ON public.company_groups FOR SELECT
  USING (owner_user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "owner updates own group"
  ON public.company_groups FOR UPDATE
  USING (owner_user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "super admin manages groups"
  ON public.company_groups FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "authenticated creates group"
  ON public.company_groups FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND owner_user_id = auth.uid());

CREATE TRIGGER trg_company_groups_updated_at
  BEFORE UPDATE ON public.company_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) companies.group_id
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.company_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_companies_group_id ON public.companies(group_id);

-- 3) subscriptions.group_id (faturamento único)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.company_groups(id) ON DELETE CASCADE,
  ALTER COLUMN company_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_group_id ON public.subscriptions(group_id);

-- 4) Backfill
DO $$
DECLARE rec RECORD; new_group_id uuid;
BEGIN
  FOR rec IN
    SELECT DISTINCT ON (cm.user_id) cm.user_id, c.name
    FROM public.company_members cm
    JOIN public.companies c ON c.id = cm.company_id
    JOIN public.user_roles ur
      ON ur.user_id = cm.user_id AND ur.company_id = cm.company_id AND ur.role = 'admin'
    WHERE c.group_id IS NULL
    ORDER BY cm.user_id, cm.created_at ASC
  LOOP
    INSERT INTO public.company_groups (owner_user_id, name)
    VALUES (rec.user_id, 'Grupo ' || rec.name)
    RETURNING id INTO new_group_id;

    UPDATE public.companies c SET group_id = new_group_id
     WHERE c.group_id IS NULL
       AND EXISTS (SELECT 1 FROM public.user_roles ur
                   WHERE ur.user_id = rec.user_id AND ur.company_id = c.id AND ur.role = 'admin');

    UPDATE public.subscriptions s SET group_id = new_group_id
     WHERE s.group_id IS NULL
       AND s.company_id IN (SELECT id FROM public.companies WHERE group_id = new_group_id);
  END LOOP;
END $$;

-- 5) calcular valor mensal do grupo
CREATE OR REPLACE FUNCTION public.calculate_group_monthly_amount(_group_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE base_amount numeric := 99.90; extra_fee numeric := 30.00; company_count int := 0;
BEGIN
  SELECT COALESCE(p.monthly_price, 99.90), COALESCE(g.extra_company_fee, 30.00)
    INTO base_amount, extra_fee
  FROM public.company_groups g
  LEFT JOIN public.subscriptions s ON s.group_id = g.id
       AND s.status IN ('ativa','aguardando_pagamento','trial')
  LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE g.id = _group_id LIMIT 1;

  SELECT COUNT(*) INTO company_count FROM public.companies WHERE group_id = _group_id;
  RETURN base_amount + (GREATEST(company_count - 1, 0) * extra_fee);
END; $$;

-- 6) trigger auto-vincular empresa ao grupo do criador
CREATE OR REPLACE FUNCTION public.ensure_company_group()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing_group_id uuid; creator_user_id uuid;
BEGIN
  IF NEW.group_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT ur.user_id INTO creator_user_id
  FROM public.user_roles ur
  WHERE ur.company_id = NEW.id AND ur.role = 'admin'
  ORDER BY ur.created_at ASC LIMIT 1;

  IF creator_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO existing_group_id
  FROM public.company_groups WHERE owner_user_id = creator_user_id LIMIT 1;

  IF existing_group_id IS NULL THEN
    INSERT INTO public.company_groups (owner_user_id, name)
    VALUES (creator_user_id, 'Grupo ' || NEW.name)
    RETURNING id INTO existing_group_id;
  END IF;

  NEW.group_id := existing_group_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_ensure_company_group ON public.companies;
CREATE TRIGGER trg_ensure_company_group
  BEFORE UPDATE OF group_id ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.ensure_company_group();
