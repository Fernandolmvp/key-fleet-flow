
-- ============ COUPONS ============
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('trial_days','discount_percent','discount_fixed')),
  trial_days integer,
  discount_percent numeric,
  discount_amount numeric,
  discount_months integer,
  max_uses integer,
  current_uses integer NOT NULL DEFAULT 0,
  restrict_to_cnpj text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.tg_coupons_upper_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.code := upper(regexp_replace(NEW.code, '[^A-Za-z0-9_-]', '', 'g'));
  IF length(NEW.code) = 0 THEN RAISE EXCEPTION 'coupon code vazio'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER tg_coupons_upper_code
BEFORE INSERT OR UPDATE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.tg_coupons_upper_code();

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_coupons" ON public.coupons
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- ============ COUPON_REDEMPTIONS ============
CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  applied_type text NOT NULL,
  applied_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  cnpj_at_redemption text,
  UNIQUE (coupon_id, company_id)
);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_redemptions" ON public.coupon_redemptions
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "company_view_own_redemptions" ON public.coupon_redemptions
FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

-- ============ PENDING_COUPON_DISCOUNTS ============
CREATE TABLE public.pending_coupon_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  discount_percent numeric,
  discount_amount numeric,
  months_remaining integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_coupon_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_pending_discounts" ON public.pending_coupon_discounts
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "company_view_pending_discounts" ON public.pending_coupon_discounts
FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

-- ============ PREVIEW RPC ============
CREATE OR REPLACE FUNCTION public.preview_coupon(p_code text, p_cnpj text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9_-]', '', 'g'));
  c RECORD;
  v_cnpj_norm text := regexp_replace(coalesce(p_cnpj,''), '[^0-9]', '', 'g');
BEGIN
  IF v_code = '' THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Código vazio');
  END IF;
  SELECT * INTO c FROM public.coupons WHERE code = v_code LIMIT 1;
  IF c.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Cupom não encontrado');
  END IF;
  IF NOT c.is_active THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Cupom inativo');
  END IF;
  IF c.valid_from IS NOT NULL AND now() < c.valid_from THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Cupom ainda não está válido');
  END IF;
  IF c.valid_until IS NOT NULL AND now() > c.valid_until THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Cupom expirado');
  END IF;
  IF c.max_uses IS NOT NULL AND c.current_uses >= c.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Cupom esgotado');
  END IF;
  IF c.restrict_to_cnpj IS NOT NULL AND regexp_replace(c.restrict_to_cnpj,'[^0-9]','','g') <> v_cnpj_norm THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Cupom não disponível para este CNPJ');
  END IF;
  RETURN jsonb_build_object(
    'valid', true,
    'type', c.type,
    'trial_days', c.trial_days,
    'discount_percent', c.discount_percent,
    'discount_amount', c.discount_amount,
    'discount_months', c.discount_months,
    'description', c.description,
    'message', CASE c.type
      WHEN 'trial_days' THEN 'Você ganhará ' || c.trial_days || ' dias grátis'
      WHEN 'discount_percent' THEN 'Desconto de ' || c.discount_percent || '% ' || COALESCE('por ' || c.discount_months || ' mes(es)', 'na primeira mensalidade')
      WHEN 'discount_fixed' THEN 'Desconto de R$ ' || c.discount_amount || ' ' || COALESCE('por ' || c.discount_months || ' mes(es)', 'na primeira mensalidade')
    END
  );
END $$;

GRANT EXECUTE ON FUNCTION public.preview_coupon(text, text) TO anon, authenticated;

-- ============ REDEEM RPC ============
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code text, p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9_-]', '', 'g'));
  c RECORD;
  cmp RECORD;
  v_cnpj_norm text;
  v_new_end timestamptz;
  v_applied jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Não autenticado');
  END IF;
  IF p_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Empresa obrigatória');
  END IF;
  IF NOT public.is_company_member(auth.uid(), p_company_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sem permissão para esta empresa');
  END IF;

  SELECT * INTO cmp FROM public.companies WHERE id = p_company_id;
  IF cmp.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Empresa não encontrada');
  END IF;
  IF COALESCE(cmp.is_exempt_from_trial, false) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Empresa já possui acesso liberado');
  END IF;
  v_cnpj_norm := regexp_replace(coalesce(cmp.cnpj,''), '[^0-9]', '', 'g');

  SELECT * INTO c FROM public.coupons WHERE code = v_code FOR UPDATE;
  IF c.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cupom não encontrado');
  END IF;
  IF NOT c.is_active THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cupom inativo');
  END IF;
  IF c.valid_from IS NOT NULL AND now() < c.valid_from THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cupom ainda não está válido');
  END IF;
  IF c.valid_until IS NOT NULL AND now() > c.valid_until THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cupom expirado');
  END IF;
  IF c.max_uses IS NOT NULL AND c.current_uses >= c.max_uses THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cupom esgotado');
  END IF;
  IF c.restrict_to_cnpj IS NOT NULL
     AND regexp_replace(c.restrict_to_cnpj,'[^0-9]','','g') <> v_cnpj_norm THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cupom não disponível para este CNPJ');
  END IF;
  IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE coupon_id = c.id AND company_id = p_company_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cupom já utilizado por esta empresa');
  END IF;

  IF c.type = 'trial_days' THEN
    v_new_end := now() + (c.trial_days || ' days')::interval;
    UPDATE public.companies
       SET trial_started_at = COALESCE(trial_started_at, now()),
           trial_ends_at = v_new_end
     WHERE id = p_company_id;
    UPDATE public.subscriptions
       SET status = 'trial'
     WHERE company_id = p_company_id;
    v_applied := jsonb_build_object('trial_days', c.trial_days, 'trial_ends_at', v_new_end);
  ELSIF c.type IN ('discount_percent','discount_fixed') THEN
    INSERT INTO public.pending_coupon_discounts(
      company_id, coupon_id, discount_percent, discount_amount, months_remaining
    ) VALUES (
      p_company_id, c.id, c.discount_percent, c.discount_amount, COALESCE(c.discount_months, 1)
    );
    v_applied := jsonb_build_object(
      'discount_percent', c.discount_percent,
      'discount_amount', c.discount_amount,
      'months', COALESCE(c.discount_months,1)
    );
  END IF;

  INSERT INTO public.coupon_redemptions(coupon_id, company_id, applied_type, applied_value, cnpj_at_redemption)
  VALUES (c.id, p_company_id, c.type, v_applied, v_cnpj_norm);

  UPDATE public.coupons SET current_uses = current_uses + 1 WHERE id = c.id;

  RETURN jsonb_build_object('success', true, 'message', 'Cupom aplicado com sucesso', 'applied_details', v_applied, 'type', c.type);
END $$;

GRANT EXECUTE ON FUNCTION public.redeem_coupon(text, uuid) TO authenticated;

-- updated_at trigger
CREATE TRIGGER tg_coupons_updated BEFORE UPDATE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_pending_discounts_updated BEFORE UPDATE ON public.pending_coupon_discounts
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
