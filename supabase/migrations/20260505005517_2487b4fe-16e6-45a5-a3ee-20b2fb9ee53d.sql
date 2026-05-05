
-- v2: bootstrap com dados de aquisição (CNPJ, telefone, responsável) + assinatura placeholder
CREATE OR REPLACE FUNCTION public.bootstrap_company_v2(
  _company_name text,
  _full_name text,
  _cnpj text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _contact_name text DEFAULT NULL,
  _email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_company_id uuid;
  default_plan_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.companies (name, cnpj, phone, contact_name, email, status)
  VALUES (_company_name, _cnpj, _phone, _contact_name, _email, 'ativa')
  RETURNING id INTO new_company_id;

  INSERT INTO public.company_members (company_id, user_id)
  VALUES (new_company_id, uid);

  INSERT INTO public.user_roles (company_id, user_id, role)
  VALUES (new_company_id, uid, 'admin');

  INSERT INTO public.profiles (id, full_name, email, phone, current_company_id)
  VALUES (uid, COALESCE(_full_name, ''), _email, _phone, new_company_id)
  ON CONFLICT (id) DO UPDATE
    SET current_company_id = EXCLUDED.current_company_id,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name,''), public.profiles.full_name),
        email = COALESCE(EXCLUDED.email, public.profiles.email),
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  -- Pega o plano ativo mais barato como placeholder
  SELECT id INTO default_plan_id
  FROM public.plans
  WHERE active = true
  ORDER BY COALESCE(monthly_price, 0) ASC, sort_order ASC
  LIMIT 1;

  IF default_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (company_id, plan_id, status, current_period_start, current_period_end)
    VALUES (new_company_id, default_plan_id, 'aguardando_pagamento', CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days');
  END IF;

  RETURN new_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_company_v2(text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.bootstrap_company_v2(text, text, text, text, text, text) TO authenticated;

-- Helper de estado de aquisição para guards de rota
CREATE OR REPLACE FUNCTION public.get_my_acquisition_state()
RETURNS TABLE (
  has_company boolean,
  company_id uuid,
  subscription_status text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cur_company uuid;
  sub_status text;
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, false;
    RETURN;
  END IF;

  SELECT current_company_id INTO cur_company FROM public.profiles WHERE id = uid;

  IF cur_company IS NULL THEN
    SELECT cm.company_id INTO cur_company
    FROM public.company_members cm
    WHERE cm.user_id = uid
    ORDER BY cm.created_at ASC
    LIMIT 1;
  END IF;

  IF cur_company IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, false;
    RETURN;
  END IF;

  SELECT s.status::text INTO sub_status
  FROM public.subscriptions s
  WHERE s.company_id = cur_company
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN QUERY SELECT
    true,
    cur_company,
    COALESCE(sub_status, 'aguardando_pagamento'),
    COALESCE(sub_status, '') = 'ativa';
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_acquisition_state() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_acquisition_state() TO authenticated;
