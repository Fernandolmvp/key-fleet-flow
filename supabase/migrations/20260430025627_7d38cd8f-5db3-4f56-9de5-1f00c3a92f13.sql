
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin(_email text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
  user_email text;
  has_any boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = uid;
  IF user_email IS NULL OR lower(user_email) <> lower(_email) THEN
    RAISE EXCEPTION 'email não confere com usuário autenticado';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.super_admins) INTO has_any;

  -- Permite bootstrap se ainda não há nenhum super admin
  -- OU se o caller já é super admin (para promover outros depois)
  IF has_any AND NOT public.is_super_admin(uid) THEN
    RAISE EXCEPTION 'já existe super admin - peça para um admin existente promover você';
  END IF;

  INSERT INTO public.super_admins (user_id, notes)
  VALUES (uid, 'bootstrap: ' || _email)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN uid;
END $$;
