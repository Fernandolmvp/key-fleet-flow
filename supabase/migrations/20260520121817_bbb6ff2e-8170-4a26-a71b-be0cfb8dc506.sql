-- ============================================================
-- TRIAL ENFORCEMENT TRIGGERS
-- ============================================================
-- Bloqueia INSERT/UPDATE em tabelas de negócio quando o trial
-- da empresa estiver expirado (is_trial_active = false).
--
-- TABELAS PROTEGIDAS (company_id direto):
--   branches, checklist_answers, checklist_questions,
--   checklist_runs, checklist_templates, cost_centers, documents,
--   driver_status_history, drivers, fuel_authorization_items,
--   fuel_authorizations, fuel_records, fuel_station_prices,
--   fuel_stations, insurance_brokers, insurance_policies,
--   insurance_policy_vehicles, maintenance_checklist_items,
--   maintenance_records, maintenance_requests,
--   maintenance_schedules, maintenance_work_orders,
--   partner_invitations, policy_external_plates, suppliers,
--   tire_movements, tires, traffic_fines, trip_advances,
--   trip_expenses, trip_reimbursements, trips,
--   vehicle_axle_layouts, vehicle_expenses, vehicle_incidents,
--   vehicle_movements, vehicle_policy_manual_matches, vehicles,
--   work_order_messages, workshops
--
-- TABELAS EXCLUÍDAS (com justificativa):
--   companies                  - a própria empresa não pode se bloquear
--   subscriptions              - precisa ser atualizada para reativar
--   subscription_payments      - webhook Stripe registra pagamento
--   company_payment_methods    - cartão precisa ser cadastrado p/ pagar
--   profiles                   - dados do usuário logado
--   user_roles, company_members, role_permissions - auth/permissões
--   ai_usage_logs, company_usage - logs técnicos
--   ai_token_balance, ai_token_purchases - top-up de créditos IA
--   vehicle_fipe_history       - cache técnico
--   work_order_sequences, trip_code_seq - sequências técnicas
--   driver_otp_codes           - login OTP do motorista
--   driver_notifications       - notificações inbound do sistema
--   fuel_station_users, workshop_users - login de parceiros
--   audit_logs                 - audit
--   tabelas auth.*             - gerenciadas pelo Supabase
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_trial_active()
RETURNS trigger
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_company_id := NEW.company_id;
  ELSE
    v_company_id := COALESCE(NEW.company_id, OLD.company_id);
  END IF;

  IF v_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_trial_active(v_company_id) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'TRIAL_EXPIRED: Assine um plano para continuar usando o sistema'
    USING ERRCODE = 'P0001';
END;
$$;

-- Cria triggers em todas as tabelas com company_id, exceto a lista de exclusão
DO $$
DECLARE
  r record;
  excluded text[] := ARRAY[
    'companies','subscriptions','subscription_payments','company_payment_methods',
    'profiles','user_roles','company_members','role_permissions',
    'ai_usage_logs','company_usage','ai_token_balance','ai_token_purchases',
    'vehicle_fipe_history','work_order_sequences','trip_code_seq',
    'driver_otp_codes','driver_notifications',
    'fuel_station_users','workshop_users','audit_logs'
  ];
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'company_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name <> ALL(excluded)
      AND c.table_name NOT LIKE 'audit_%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_trial_%I ON public.%I', r.table_name, r.table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_enforce_trial_%I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_trial_active()',
      r.table_name, r.table_name
    );
  END LOOP;
END;
$$;

-- ============================================================
-- TESTE DE VALIDAÇÃO INTERNO
-- ============================================================
DO $$
DECLARE
  v_oquei_id uuid;
  v_temp_company_id uuid;
  v_failed boolean := false;
  v_err text;
BEGIN
  -- 1. Oquei Telecom (isenta) deve permitir insert
  SELECT id INTO v_oquei_id FROM public.companies
    WHERE is_exempt_from_trial = true
    ORDER BY created_at LIMIT 1;

  IF v_oquei_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.vehicles (company_id, plate, brand, model)
      VALUES (v_oquei_id, '__TST'||floor(random()*9999)::text, 'TEST', 'TEST')
      RETURNING id INTO v_temp_company_id;
      -- rollback do insert de teste
      DELETE FROM public.vehicles WHERE id = v_temp_company_id;
      RAISE NOTICE 'OK: empresa isenta permitiu insert';
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'FALHA TESTE 1: empresa isenta foi bloqueada: %', SQLERRM;
    END;
  END IF;

  -- 2. Empresa temporária expirada deve falhar
  INSERT INTO public.companies (name, trial_started_at, trial_ends_at, is_exempt_from_trial)
  VALUES ('__TRIAL_TEST_EXPIRED__', now() - interval '30 days', now() - interval '5 days', false)
  RETURNING id INTO v_temp_company_id;

  BEGIN
    INSERT INTO public.vehicles (company_id, plate, brand, model)
    VALUES (v_temp_company_id, '__TST'||floor(random()*9999)::text, 'TEST', 'TEST');
    v_failed := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF position('TRIAL_EXPIRED' in v_err) = 0 THEN
      DELETE FROM public.companies WHERE id = v_temp_company_id;
      RAISE EXCEPTION 'FALHA TESTE 2: exceção inesperada: %', v_err;
    END IF;
    RAISE NOTICE 'OK: empresa expirada bloqueada corretamente';
  END;

  -- cleanup
  DELETE FROM public.vehicles WHERE company_id = v_temp_company_id;
  DELETE FROM public.companies WHERE id = v_temp_company_id;

  IF v_failed THEN
    RAISE EXCEPTION 'FALHA TESTE 2: insert em empresa expirada NÃO foi bloqueado';
  END IF;
END;
$$;