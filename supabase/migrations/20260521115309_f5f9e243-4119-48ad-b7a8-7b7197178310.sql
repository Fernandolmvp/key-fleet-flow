
-- 1) Impede que o mesmo usuário crie múltiplas empresas pelo bootstrap.
--    Se já é membro de alguma empresa, devolve a primeira existente
--    e garante que o profile aponte para ela.
CREATE OR REPLACE FUNCTION public.bootstrap_company_v2(
  _company_name text,
  _full_name text,
  _cnpj text DEFAULT NULL::text,
  _phone text DEFAULT NULL::text,
  _contact_name text DEFAULT NULL::text,
  _email text DEFAULT NULL::text,
  _trial_plan_slug text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  new_company_id uuid;
  existing_company_id uuid;
  trial_plan_id uuid;
  trial_plan_name text;
  snapshot_name text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  -- Guarda contra cadastros duplicados: se já existe vínculo, reaproveita.
  SELECT company_id INTO existing_company_id
    FROM public.company_members
    WHERE user_id = uid
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;

  IF existing_company_id IS NOT NULL THEN
    UPDATE public.profiles
       SET current_company_id = existing_company_id
     WHERE id = uid;
    RETURN existing_company_id;
  END IF;

  INSERT INTO public.companies (name, cnpj, phone, contact_name, email, status, trial_started_at, trial_ends_at)
  VALUES (_company_name, _cnpj, _phone, _contact_name, _email, 'ativa', now(), now() + interval '21 days')
  RETURNING id INTO new_company_id;

  INSERT INTO public.company_members (company_id, user_id) VALUES (new_company_id, uid)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (company_id, user_id, role) VALUES (new_company_id, uid, 'admin')
    ON CONFLICT DO NOTHING;

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
    INSERT INTO public.subscriptions (
      company_id, plan_id, status, current_period_start, current_period_end, trial_plan_snapshot
    )
    VALUES (
      new_company_id, trial_plan_id, 'trial', CURRENT_DATE, CURRENT_DATE + interval '21 days', snapshot_name
    )
    ON CONFLICT (company_id) DO UPDATE
      SET plan_id              = EXCLUDED.plan_id,
          status               = 'trial',
          current_period_start = EXCLUDED.current_period_start,
          current_period_end   = EXCLUDED.current_period_end,
          trial_plan_snapshot  = EXCLUDED.trial_plan_snapshot;
  END IF;

  RETURN new_company_id;
END
$function$;

-- 2) Limpa a empresa duplicada criada pelo Clayton (OQUEI TELECOM LTDA fake, sem dados)
--    e fixa o profile dele na empresa "realize" (a primeira que ele criou).
DELETE FROM public.subscriptions WHERE company_id = '8df51e29-79d5-45e9-9c1b-89d57c4f7013';
DELETE FROM public.user_roles    WHERE company_id = '8df51e29-79d5-45e9-9c1b-89d57c4f7013';
DELETE FROM public.company_members WHERE company_id = '8df51e29-79d5-45e9-9c1b-89d57c4f7013';
DELETE FROM public.companies     WHERE id = '8df51e29-79d5-45e9-9c1b-89d57c4f7013';

UPDATE public.profiles
   SET current_company_id = 'fa4694de-b2f7-49f4-8d7f-64629cd05135'
 WHERE id = '03546937-8e5a-43ae-a7bb-9598bd5d7019';
