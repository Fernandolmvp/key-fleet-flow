
CREATE OR REPLACE FUNCTION public.is_trial_active(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_exempt boolean; v_trial_end timestamptz; v_status text;
BEGIN
  IF p_company_id IS NULL THEN RETURN false; END IF;
  SELECT is_exempt_from_trial, trial_ends_at INTO v_exempt, v_trial_end
    FROM public.companies WHERE id = p_company_id;
  IF COALESCE(v_exempt,false) THEN RETURN true; END IF;
  SELECT status::text INTO v_status FROM public.subscriptions
   WHERE company_id = p_company_id ORDER BY created_at DESC LIMIT 1;
  IF v_status = 'ativa' THEN RETURN true; END IF;
  IF v_status = 'trial' AND v_trial_end IS NOT NULL AND v_trial_end > now() THEN RETURN true; END IF;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.get_trial_days_remaining(p_company_id uuid)
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_exempt boolean; v_trial_end timestamptz; v_status text;
BEGIN
  IF p_company_id IS NULL THEN RETURN NULL; END IF;
  SELECT is_exempt_from_trial, trial_ends_at INTO v_exempt, v_trial_end
    FROM public.companies WHERE id = p_company_id;
  IF COALESCE(v_exempt,false) THEN RETURN NULL; END IF;
  SELECT status::text INTO v_status FROM public.subscriptions
   WHERE company_id = p_company_id ORDER BY created_at DESC LIMIT 1;
  IF v_status <> 'trial' OR v_trial_end IS NULL THEN RETURN NULL; END IF;
  RETURN GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_trial_end - now()))/86400.0)::int);
END $$;

DROP FUNCTION IF EXISTS public.get_my_acquisition_state();
CREATE OR REPLACE FUNCTION public.get_my_acquisition_state()
RETURNS TABLE(has_company boolean, company_id uuid, subscription_status text, is_active boolean, trial_days_remaining integer, is_exempt boolean, trial_ends_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cur_company uuid;
  sub_status text;
  v_exempt boolean;
  v_trial_end timestamptz;
  v_days int;
  v_active boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, false, NULL::int, false, NULL::timestamptz; RETURN;
  END IF;
  SELECT current_company_id INTO cur_company FROM public.profiles WHERE id = uid;
  IF cur_company IS NULL THEN
    SELECT cm.company_id INTO cur_company FROM public.company_members cm
     WHERE cm.user_id = uid ORDER BY cm.created_at ASC LIMIT 1;
  END IF;
  IF cur_company IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, false, NULL::int, false, NULL::timestamptz; RETURN;
  END IF;
  SELECT s.status::text INTO sub_status FROM public.subscriptions s
   WHERE s.company_id = cur_company ORDER BY s.created_at DESC LIMIT 1;
  SELECT c.is_exempt_from_trial, c.trial_ends_at INTO v_exempt, v_trial_end
    FROM public.companies c WHERE c.id = cur_company;
  v_active := public.is_trial_active(cur_company);
  v_days := public.get_trial_days_remaining(cur_company);
  RETURN QUERY SELECT true, cur_company, COALESCE(sub_status,'aguardando_pagamento'),
                      v_active, v_days, COALESCE(v_exempt,false), v_trial_end;
END $$;

CREATE OR REPLACE FUNCTION public.bootstrap_company_v2(
  _company_name text, _full_name text,
  _cnpj text DEFAULT NULL, _phone text DEFAULT NULL,
  _contact_name text DEFAULT NULL, _email text DEFAULT NULL,
  _trial_plan_slug text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_company_id uuid;
  trial_plan_id uuid;
  trial_plan_name text;
  snapshot_name text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.companies (name, cnpj, phone, contact_name, email, status, trial_started_at, trial_ends_at)
  VALUES (_company_name, _cnpj, _phone, _contact_name, _email, 'ativa', now(), now() + interval '21 days')
  RETURNING id INTO new_company_id;

  INSERT INTO public.company_members (company_id, user_id) VALUES (new_company_id, uid);
  INSERT INTO public.user_roles (company_id, user_id, role) VALUES (new_company_id, uid, 'admin');

  INSERT INTO public.profiles (id, full_name, email, phone, current_company_id)
  VALUES (uid, COALESCE(_full_name,''), _email, _phone, new_company_id)
  ON CONFLICT (id) DO UPDATE
    SET current_company_id = EXCLUDED.current_company_id,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name,''), public.profiles.full_name),
        email = COALESCE(EXCLUDED.email, public.profiles.email),
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  SELECT id, name INTO trial_plan_id, trial_plan_name
    FROM public.plans WHERE active = true ORDER BY sort_order DESC LIMIT 1;

  IF _trial_plan_slug IS NOT NULL THEN
    SELECT name INTO snapshot_name FROM public.plans WHERE slug = _trial_plan_slug LIMIT 1;
  END IF;
  snapshot_name := COALESCE(snapshot_name, trial_plan_name);

  IF trial_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (company_id, plan_id, status, current_period_start, current_period_end, trial_plan_snapshot)
    VALUES (new_company_id, trial_plan_id, 'trial', CURRENT_DATE, CURRENT_DATE + interval '21 days', snapshot_name);
  END IF;

  RETURN new_company_id;
END $$;
