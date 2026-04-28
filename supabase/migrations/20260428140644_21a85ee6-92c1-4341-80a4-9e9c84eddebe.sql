DO $$
DECLARE
  new_company_id uuid;
  uid1 uuid := 'd93c24bc-91f2-4f5c-9348-1b8905b2e993';
  uid2 uuid := '0b6dcec7-1935-4302-a56e-760c273145e0';
BEGIN
  INSERT INTO public.companies (name) VALUES ('Volpi Transportes')
  RETURNING id INTO new_company_id;

  INSERT INTO public.company_members (company_id, user_id) VALUES (new_company_id, uid1);
  INSERT INTO public.company_members (company_id, user_id) VALUES (new_company_id, uid2);

  INSERT INTO public.user_roles (company_id, user_id, role) VALUES (new_company_id, uid1, 'admin');
  INSERT INTO public.user_roles (company_id, user_id, role) VALUES (new_company_id, uid2, 'admin');

  UPDATE public.profiles SET current_company_id = new_company_id WHERE id IN (uid1, uid2);
END $$;