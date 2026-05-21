ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_company_onboarding_dismissed(
  p_company_id uuid,
  p_dismissed boolean DEFAULT true
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_value timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.can_manage_fleet(v_uid, p_company_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.companies
     SET onboarding_dismissed_at = CASE WHEN p_dismissed THEN now() ELSE NULL END
   WHERE id = p_company_id
   RETURNING onboarding_dismissed_at INTO v_value;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'company not found';
  END IF;

  RETURN v_value;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_company_onboarding_dismissed(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.dashboard_get_summary(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_today date := (v_now)::date;
  v_month_start date := date_trunc('month', v_now)::date;
  v_prev_month_start date := (date_trunc('month', v_now) - interval '1 month')::date;
  v_prev_month_end date := (date_trunc('month', v_now) - interval '1 day')::date;
  v_in7 date := v_today + 7;
  v_in30 date := v_today + 30;
  v_30d_ago timestamptz := v_now - interval '30 days';
  v_90d_ago timestamptz := v_now - interval '90 days';
  v_12m_start date := (date_trunc('month', v_now) - interval '11 months')::date;

  v_total_vehicles int := 0; v_active int := 0; v_maint int := 0; v_parado int := 0;
  v_fuel_30d int := 0;
  v_drivers int := 0; v_drivers_active int := 0; v_cnh_expiring int := 0;
  v_trips_running int := 0;
  v_docs_expiring int := 0; v_maint_7d int := 0; v_fines_open int := 0; v_approvals_pending int := 0;

  v_month_fuel numeric := 0; v_month_maint numeric := 0; v_month_expenses numeric := 0;
  v_month_fines numeric := 0; v_month_trip_exp numeric := 0;
  v_month_km numeric := 0; v_month_liters numeric := 0;
  v_prev_total numeric := 0; v_prev_km numeric := 0; v_prev_liters numeric := 0;

  v_step_vehicle boolean := false;
  v_step_driver boolean := false;
  v_step_link boolean := false;
  v_step_policy boolean := false;
  v_steps_done int := 0;
  v_steps_total int := 4;
  v_setup_completed boolean := false;
  v_onboarding_dismissed_at timestamptz := null;

  v_alerts jsonb := '[]'::jsonb;
  v_top_vehicles jsonb := '[]'::jsonb;
  v_upcoming jsonb := '[]'::jsonb;
  v_series jsonb := '[]'::jsonb;
  v_ranking jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_company_member(v_uid, p_company_id) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT count(*), count(*) FILTER (WHERE status='ativo'),
         count(*) FILTER (WHERE status='manutencao'),
         count(*) FILTER (WHERE status='parado')
  INTO v_total_vehicles, v_active, v_maint, v_parado
  FROM vehicles WHERE company_id = p_company_id;

  v_step_vehicle := v_total_vehicles > 0;

  SELECT count(*) INTO v_fuel_30d FROM fuel_records
  WHERE company_id = p_company_id AND fueled_at >= v_30d_ago;

  SELECT count(*), count(*) FILTER (WHERE status='ativo'),
         count(*) FILTER (WHERE cnh_expires_at IS NOT NULL AND cnh_expires_at <= v_in30)
  INTO v_drivers, v_drivers_active, v_cnh_expiring
  FROM drivers WHERE company_id = p_company_id;

  v_step_driver := v_drivers > 0;

  SELECT EXISTS (
    SELECT 1
      FROM drivers
     WHERE company_id = p_company_id
       AND has_assigned_vehicle = true
  ) INTO v_step_link;

  SELECT EXISTS (
    SELECT 1
      FROM insurance_policies
     WHERE company_id = p_company_id
  ) INTO v_step_policy;

  v_steps_done :=
    (CASE WHEN v_step_vehicle THEN 1 ELSE 0 END)
    + (CASE WHEN v_step_driver THEN 1 ELSE 0 END)
    + (CASE WHEN v_step_link THEN 1 ELSE 0 END)
    + (CASE WHEN v_step_policy THEN 1 ELSE 0 END);

  v_setup_completed := v_steps_done >= v_steps_total;

  SELECT onboarding_dismissed_at
    INTO v_onboarding_dismissed_at
    FROM public.companies
   WHERE id = p_company_id;

  SELECT count(*) INTO v_trips_running FROM trips
  WHERE company_id = p_company_id AND status='em_andamento';

  SELECT count(*) INTO v_docs_expiring FROM documents
  WHERE company_id = p_company_id AND expires_at IS NOT NULL
    AND expires_at <= v_in30 AND status IN ('vencido','vencendo');

  SELECT count(*) INTO v_maint_7d FROM maintenance_schedules
  WHERE company_id = p_company_id AND status IN ('pendente','proxima','vencida')
    AND target_date IS NOT NULL AND target_date <= v_in7;

  SELECT count(*) INTO v_fines_open FROM traffic_fines
  WHERE company_id = p_company_id AND status NOT IN ('paga','cancelada','arquivada');

  SELECT
    COALESCE((SELECT count(*) FROM fuel_authorizations WHERE company_id=p_company_id AND status='pendente'),0)
    + COALESCE((SELECT count(*) FROM maintenance_work_orders WHERE company_id=p_company_id
                 AND quote_status IN ('pendente','enviado','aguardando_aprovacao')),0)
  INTO v_approvals_pending;

  SELECT COALESCE(sum(total_value),0), COALESCE(sum(km_driven),0), COALESCE(sum(liters),0)
  INTO v_month_fuel, v_month_km, v_month_liters
  FROM fuel_records WHERE company_id=p_company_id AND fueled_at::date >= v_month_start;

  SELECT COALESCE(sum(total_value),0) INTO v_month_maint FROM maintenance_records
  WHERE company_id=p_company_id AND service_at::date >= v_month_start;

  SELECT COALESCE(sum(amount),0) INTO v_month_expenses FROM vehicle_expenses
  WHERE company_id=p_company_id AND expense_date >= v_month_start;

  SELECT COALESCE(sum(COALESCE(paid_amount, amount, 0)),0) INTO v_month_fines FROM traffic_fines
  WHERE company_id=p_company_id AND infraction_date >= v_month_start;

  SELECT COALESCE(sum(amount),0) INTO v_month_trip_exp FROM trip_expenses
  WHERE company_id=p_company_id AND expense_date >= v_month_start;

  SELECT
    COALESCE((SELECT sum(total_value) FROM fuel_records WHERE company_id=p_company_id AND fueled_at::date BETWEEN v_prev_month_start AND v_prev_month_end),0)
    + COALESCE((SELECT sum(total_value) FROM maintenance_records WHERE company_id=p_company_id AND service_at::date BETWEEN v_prev_month_start AND v_prev_month_end),0)
    + COALESCE((SELECT sum(amount) FROM vehicle_expenses WHERE company_id=p_company_id AND expense_date BETWEEN v_prev_month_start AND v_prev_month_end),0)
    + COALESCE((SELECT sum(COALESCE(paid_amount, amount, 0)) FROM traffic_fines WHERE company_id=p_company_id AND infraction_date BETWEEN v_prev_month_start AND v_prev_month_end),0)
    + COALESCE((SELECT sum(amount) FROM trip_expenses WHERE company_id=p_company_id AND expense_date BETWEEN v_prev_month_start AND v_prev_month_end),0)
  INTO v_prev_total;

  SELECT COALESCE(sum(km_driven),0), COALESCE(sum(liters),0)
  INTO v_prev_km, v_prev_liters
  FROM fuel_records WHERE company_id=p_company_id
    AND fueled_at::date BETWEEN v_prev_month_start AND v_prev_month_end;

  SELECT v_alerts || COALESCE(jsonb_agg(jsonb_build_object(
    'kind','document','severity', CASE WHEN expires_at < v_today THEN 'high' ELSE 'medium' END,
    'title', COALESCE(title, doc_type::text),
    'subtitle','Vence em ' || to_char(expires_at,'DD/MM/YYYY'),
    'date', expires_at,'link','/app/documents')),'[]'::jsonb)
  INTO v_alerts FROM (
    SELECT title, doc_type, expires_at FROM documents
    WHERE company_id=p_company_id AND expires_at IS NOT NULL
      AND expires_at <= v_in30 AND status IN ('vencido','vencendo')
    ORDER BY expires_at ASC LIMIT 5) d;

  SELECT v_alerts || COALESCE(jsonb_agg(jsonb_build_object(
    'kind','cnh','severity', CASE WHEN cnh_expires_at < v_today THEN 'high' ELSE 'medium' END,
    'title','CNH de ' || full_name,
    'subtitle','Vence em ' || to_char(cnh_expires_at,'DD/MM/YYYY'),
    'date', cnh_expires_at,'link','/app/drivers')),'[]'::jsonb)
  INTO v_alerts FROM (
    SELECT full_name, cnh_expires_at FROM drivers
    WHERE company_id=p_company_id AND cnh_expires_at IS NOT NULL
      AND cnh_expires_at <= v_in30 ORDER BY cnh_expires_at ASC LIMIT 5) d;

  SELECT v_alerts || COALESCE(jsonb_agg(jsonb_build_object(
    'kind','maintenance','severity', CASE WHEN target_date < v_today THEN 'high' ELSE 'medium' END,
    'title','Manutenção: ' || category,
    'subtitle','Agendada para ' || to_char(target_date,'DD/MM/YYYY'),
    'date', target_date,'link','/app/maintenance')),'[]'::jsonb)
  INTO v_alerts FROM (
    SELECT category, target_date FROM maintenance_schedules
    WHERE company_id=p_company_id AND status IN ('pendente','proxima','vencida')
      AND target_date IS NOT NULL AND target_date <= v_in7
    ORDER BY target_date ASC LIMIT 5) m;

  WITH costs AS (
    SELECT vehicle_id, sum(total_value) AS v FROM fuel_records
      WHERE company_id=p_company_id AND fueled_at::date >= v_month_start GROUP BY vehicle_id
    UNION ALL
    SELECT vehicle_id, sum(total_value) FROM maintenance_records
      WHERE company_id=p_company_id AND service_at::date >= v_month_start GROUP BY vehicle_id
    UNION ALL
    SELECT vehicle_id, sum(amount) FROM vehicle_expenses
      WHERE company_id=p_company_id AND expense_date >= v_month_start GROUP BY vehicle_id
    UNION ALL
    SELECT vehicle_id, sum(COALESCE(paid_amount,amount,0)) FROM traffic_fines
      WHERE company_id=p_company_id AND infraction_date >= v_month_start GROUP BY vehicle_id
  ), totals AS (
    SELECT vehicle_id, sum(v) AS total FROM costs WHERE vehicle_id IS NOT NULL GROUP BY vehicle_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'vehicle_id', t.vehicle_id,'plate', v.plate,
    'model', trim(COALESCE(v.brand,'') || ' ' || COALESCE(v.model,'')),
    'total', t.total) ORDER BY t.total DESC), '[]'::jsonb)
  INTO v_top_vehicles
  FROM (SELECT * FROM totals ORDER BY total DESC LIMIT 5) t
  LEFT JOIN vehicles v ON v.id = t.vehicle_id;

  WITH up AS (
    SELECT 'maintenance' AS kind, target_date AS due, category AS title, NULL::numeric AS amount, '/app/maintenance' AS link
      FROM maintenance_schedules WHERE company_id=p_company_id
        AND target_date BETWEEN v_today AND v_in30 AND status IN ('pendente','proxima','vencida')
    UNION ALL
    SELECT 'document', expires_at, COALESCE(title, doc_type::text), NULL, '/app/documents'
      FROM documents WHERE company_id=p_company_id AND expires_at BETWEEN v_today AND v_in30
    UNION ALL
    SELECT 'fine', due_date, COALESCE(description, fine_type, 'Multa'), COALESCE(amount,0), '/app/multas'
      FROM traffic_fines WHERE company_id=p_company_id AND due_date BETWEEN v_today AND v_in30
        AND status NOT IN ('paga','cancelada','arquivada')
    UNION ALL
    SELECT 'policy', end_date, 'Apólice ' || policy_number, COALESCE(total_value,0), '/app/insurance'
      FROM insurance_policies WHERE company_id=p_company_id AND end_date BETWEEN v_today AND v_in30
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'kind', kind,'date', due,'title', title,'amount', amount,'link', link
  ) ORDER BY due ASC), '[]'::jsonb)
  INTO v_upcoming FROM (SELECT * FROM up ORDER BY due ASC LIMIT 20) x;

  WITH months AS (
    SELECT generate_series(v_12m_start, v_month_start, interval '1 month')::date AS m
  ), agg AS (
    SELECT date_trunc('month', fueled_at)::date AS m, sum(total_value) AS v
      FROM fuel_records WHERE company_id=p_company_id AND fueled_at::date >= v_12m_start GROUP BY 1
    UNION ALL
    SELECT date_trunc('month', service_at)::date, sum(total_value)
      FROM maintenance_records WHERE company_id=p_company_id AND service_at::date >= v_12m_start GROUP BY 1
    UNION ALL
    SELECT date_trunc('month', expense_date)::date, sum(amount)
      FROM vehicle_expenses WHERE company_id=p_company_id AND expense_date >= v_12m_start GROUP BY 1
    UNION ALL
    SELECT date_trunc('month', infraction_date)::date, sum(COALESCE(paid_amount,amount,0))
      FROM traffic_fines WHERE company_id=p_company_id AND infraction_date >= v_12m_start GROUP BY 1
  ), totals AS (
    SELECT m, sum(v) AS total FROM agg GROUP BY m
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('month', months.m,'total', COALESCE(t.total,0)) ORDER BY months.m), '[]'::jsonb)
  INTO v_series FROM months LEFT JOIN totals t ON t.m = months.m;

  WITH fr AS (
    SELECT vehicle_id, sum(km_driven) AS km, sum(liters) AS lt
    FROM fuel_records WHERE company_id=p_company_id AND fueled_at >= v_90d_ago
      AND km_driven IS NOT NULL AND km_driven > 0 AND liters > 0
    GROUP BY vehicle_id HAVING sum(liters) > 0
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'vehicle_id', fr.vehicle_id,'plate', v.plate,
    'km_l', ROUND((fr.km / fr.lt)::numeric, 1)
  ) ORDER BY (fr.km / fr.lt) DESC), '[]'::jsonb)
  INTO v_ranking
  FROM (SELECT * FROM fr ORDER BY (km / lt) DESC LIMIT 6) fr
  LEFT JOIN vehicles v ON v.id = fr.vehicle_id;

  RETURN jsonb_build_object(
    'company_id', p_company_id,
    'generated_at', v_now,
    'onboarding_dismissed_at', v_onboarding_dismissed_at,
    'mode', CASE WHEN v_total_vehicles < 3 AND NOT v_setup_completed THEN 'new' ELSE 'active' END,
    'setup', jsonb_build_object(
      'vehicle', v_step_vehicle,
      'driver', v_step_driver,
      'link', v_step_link,
      'policy', v_step_policy,
      'done', v_steps_done,
      'total', v_steps_total,
      'completed', v_setup_completed
    ),
    'vehicles', jsonb_build_object('total', v_total_vehicles,'active', v_active,'maintenance', v_maint,'parado', v_parado),
    'drivers', jsonb_build_object('total', v_drivers,'active', v_drivers_active,'cnh_expiring', v_cnh_expiring),
    'trips_running', v_trips_running,
    'counts', jsonb_build_object(
      'docs_expiring', v_docs_expiring,'maint_7d', v_maint_7d,
      'fines_open', v_fines_open,'approvals_pending', v_approvals_pending,
      'critical_alerts', (v_docs_expiring + v_maint_7d + v_cnh_expiring)
    ),
    'month', jsonb_build_object(
      'total', (v_month_fuel + v_month_maint + v_month_expenses + v_month_fines + v_month_trip_exp),
      'prev_total', v_prev_total,'km', v_month_km,'prev_km', v_prev_km,
      'km_per_liter', CASE WHEN v_month_liters > 0 THEN ROUND((v_month_km / NULLIF(v_month_liters,0))::numeric, 2) ELSE NULL END,
      'prev_km_per_liter', CASE WHEN v_prev_liters > 0 THEN ROUND((v_prev_km / NULLIF(v_prev_liters,0))::numeric, 2) ELSE NULL END,
      'breakdown', jsonb_build_object(
        'fuel', v_month_fuel,'maintenance', v_month_maint,
        'expenses', v_month_expenses,'fines', v_month_fines,'trip_expenses', v_month_trip_exp
      )
    ),
    'alerts', v_alerts,'top_vehicles', v_top_vehicles,'upcoming', v_upcoming,
    'series_12m', v_series,'ranking_km_l', v_ranking,'fuel_30d', v_fuel_30d
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_get_summary(uuid) TO authenticated;