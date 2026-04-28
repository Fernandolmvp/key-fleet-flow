
CREATE OR REPLACE FUNCTION public.bootstrap_company(_company_name text, _full_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_company_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.companies (name) VALUES (_company_name)
  RETURNING id INTO new_company_id;

  INSERT INTO public.company_members (company_id, user_id)
  VALUES (new_company_id, uid);

  INSERT INTO public.user_roles (company_id, user_id, role)
  VALUES (new_company_id, uid, 'admin');

  INSERT INTO public.profiles (id, full_name, current_company_id)
  VALUES (uid, COALESCE(_full_name, ''), new_company_id)
  ON CONFLICT (id) DO UPDATE
    SET current_company_id = EXCLUDED.current_company_id,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name,''), public.profiles.full_name);

  RETURN new_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_company(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.bootstrap_company(text, text) TO authenticated;
