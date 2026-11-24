CREATE OR REPLACE FUNCTION public.agent_dashboard_summary(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_result jsonb;
BEGIN
  SELECT cm.user_id INTO v_uid
  FROM public.company_members cm
  WHERE cm.company_id = p_company_id
  ORDER BY cm.created_at
  LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Empresa sem membro para calcular o resumo';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  SELECT public.dashboard_get_summary(p_company_id) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_dashboard_summary(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_dashboard_summary(uuid) TO service_role;
