CREATE OR REPLACE FUNCTION public.sync_company_policy_links(_company_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r RECORD; total integer := 0;
BEGIN
  IF NOT (public.is_company_member(auth.uid(), _company_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  FOR r IN
    SELECT id FROM public.insurance_policies
     WHERE company_id = _company_id AND status = 'ativa'
       AND (end_date IS NULL OR end_date >= current_date)
  LOOP
    total := total + public.sync_policy_vehicle_links(r.id);
  END LOOP;
  RETURN total;
END
$function$;