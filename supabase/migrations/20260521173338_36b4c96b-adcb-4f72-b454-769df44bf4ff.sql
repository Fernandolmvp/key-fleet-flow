
-- Função única que retorna todos os números do dashboard do gestor
-- numa só ida ao banco, com validação de pertencimento à empresa.
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

  v_total_vehicles int := 0;
  v_active int := 0;
  v_maint int := 0;
  v_parado int := 0;

  v_fuel_30d int := 0;

  v_drivers int := 0;
  v_drivers_available int := 0;

  v_trips_running int := 0;

  v_month_fuel numeric := 0;
  v_month_maint numeric := 0;
  v_month_expenses numeric := 0;
  v_month_fines numeric := 0;
  v_month_trip_exp numeric := 0;

  v_prev_total numeric := 0;
  v_month_km numeric := 0;

  v_alerts jsonb := '[]'::jsonb;
  v_top_vehicles jsonb := '[]'::jsonb;
  v_upcoming jsonb := '[]'::jsonb;
  v_recent jsonb := '[]'::jsonb;
  v_breakdown jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.is_company_member(v_uid, p_company_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Veículos
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'ativo'),
    count(*) FILTER (WHERE status = 'manutencao'),
    count(*) FILTER (WHERE status = 'parado')
  INTO v_total_vehicles, v_active, v_maint, v_parado
  FROM vehicles WHERE company_id = p_company_id;

  -- Abastecimentos nos últimos 30 dias (para decidir modo nova/em-uso)
  SELECT count(*) INTO v_fuel_30d
  FROM fuel_records
  WHERE company_id = p_company_id AND fueled_at >= v_30d_ago;

  -- Motoristas
  SELECT count(*), count(*) FILTER (WHERE status = 'ativo')
  INTO v_drivers, v_drivers_available
  FROM drivers WHERE company_id = p_company_id;

  -- Viagens em andamento
  SELECT count(*) INTO v_trips_running
  FROM trips WHERE company_id = p_company_id AND status = 'em_andamento';

  -- Custos do mês corrente
  SELECT COALESCE(sum(total_value),0), COALESCE(sum(km_driven),0)
  INTO v_month_fuel, v_month_km
  FROM fuel_records
  WHERE company_id = p_company_id AND fueled_at::date >= v_month_start;

  SELECT COALESCE(sum(total_value),0) INTO v_month_maint
  FROM maintenance_records
  WHERE company_id = p_company_id AND service_at::date >= v_month_start;

  SELECT COALESCE(sum(amount),0) INTO v_month_expenses
  FROM vehicle_expenses
  WHERE company_id = p_company_id AND expense_date >= v_month_start;

  SELECT COALESCE(sum(COALESCE(paid_amount, amount, 0)),0) INTO v_month_fines
  FROM traffic_fines
  WHERE company_id = p_company_id AND infraction_date >= v_month_start;

  SELECT COALESCE(sum(amount),0) INTO v_month_trip_exp
  FROM trip_expenses
  WHERE company_id = p_company_id AND expense_date >= v_month_start;

  -- Total mês anterior (para comparativo)
  SELECT
    COALESCE((SELECT sum(total_value) FROM fuel_records WHERE company_id = p_company_id AND fueled_at::date BETWEEN v_prev_month_start AND v_prev_month_end),0)
    + COALESCE((SELECT sum(total_value) FROM maintenance_records WHERE company_id = p_company_id AND service_at::date BETWEEN v_prev_month_start AND v_prev_month_end),0)
    + COALESCE((SELECT sum(amount) FROM vehicle_expenses WHERE company_id = p_company_id AND expense_date BETWEEN v_prev_month_start AND v_prev_month_end),0)
    + COALESCE((SELECT sum(COALESCE(paid_amount, amount, 0)) FROM traffic_fines WHERE company_id = p_company_id AND infraction_date BETWEEN v_prev_month_start AND v_prev_month_end),0)
    + COALESCE((SELECT sum(amount) FROM trip_expenses WHERE company_id = p_company_id AND expense_date BETWEEN v_prev_month_start AND v_prev_month_end),0)
  INTO v_prev_total;

  -- Alertas: documentos vencendo em 30d
  SELECT v_alerts || COALESCE(jsonb_agg(jsonb_build_object(
    'kind','document',
    'severity', CASE WHEN expires_at < v_today THEN 'high' ELSE 'medium' END,
    'title', COALESCE(title, doc_type::text),
    'subtitle', 'Vence em ' || to_char(expires_at,'DD/MM/YYYY'),
    'date', expires_at,
    'link', '/app/documents'
  )),'[]'::jsonb)
  INTO v_alerts
  FROM (
    SELECT title, doc_type, expires_at FROM documents
    WHERE company_id = p_company_id
      AND expires_at IS NOT NULL
      AND expires_at <= v_in30
      AND status IN ('vencido','vencendo')
    ORDER BY expires_at ASC LIMIT 5
  ) d;

  -- CNH vencendo em 30d
  SELECT v_alerts || COALESCE(jsonb_agg(jsonb_build_object(
    'kind','cnh',
    'severity', CASE WHEN cnh_expires_at < v_today THEN 'high' ELSE 'medium' END,
    'title', 'CNH de ' || full_name,
    'subtitle', 'Vence em ' || to_char(cnh_expires_at,'DD/MM/YYYY'),
    'date', cnh_expires_at,
    'link', '/app/drivers'
  )),'[]'::jsonb)
  INTO v_alerts
  FROM (
    SELECT full_name, cnh_expires_at FROM drivers
    WHERE company_id = p_company_id
      AND cnh_expires_at IS NOT NULL
      AND cnh_expires_at <= v_in30
    ORDER BY cnh_expires_at ASC LIMIT 5
  ) d;

  -- Manutenções próximas 7 dias ou atrasadas
  SELECT v_alerts || COALESCE(jsonb_agg(jsonb_build_object(
    'kind','maintenance',
    'severity', CASE WHEN target_date < v_today THEN 'high' ELSE 'medium' END,
    'title', 'Manutenção: ' || category,
    'subtitle', 'Agendada para ' || to_char(target_date,'DD/MM/YYYY'),
    'date', target_date,
    'link', '/app/maintenance'
  )),'[]'::jsonb)
  INTO v_alerts
  FROM (
    SELECT category, target_date FROM maintenance_schedules
    WHERE company_id = p_company_id
      AND status IN ('pendente','proxima','vencida')
      AND target_date IS NOT NULL
      AND target_date <= v_in7
    ORDER BY target_date ASC LIMIT 5
  ) m;

  -- Multas em aberto há mais de 30 dias
  SELECT v_alerts || COALESCE(jsonb_agg(jsonb_build_object(
    'kind','fine',
    'severity','medium',
    'title','Multa em aberto',
    'subtitle', COALESCE(description, fine_type, 'Sem descrição'),
    'date', infraction_date,
    'link','/app/multas'
  )),'[]'::jsonb)
  INTO v_alerts
  FROM (
    SELECT description, fine_type, infraction_date FROM traffic_fines
    WHERE company_id = p_company_id
      AND status NOT IN ('paga','cancelada','arquivada')
      AND infraction_date <= (v_today - 30)
    ORDER BY infraction_date ASC LIMIT 5
  ) f;

  -- Top 3 veículos que mais custaram este mês
  WITH costs AS (
    SELECT vehicle_id, sum(total_value) AS v FROM fuel_records
    WHERE company_id = p_company_id AND fueled_at::date >= v_month_start GROUP BY vehicle_id
    UNION ALL
    SELECT vehicle_id, sum(total_value) FROM maintenance_records
    WHERE company_id = p_company_id AND service_at::date >= v_month_start GROUP BY vehicle_id
    UNION ALL
    SELECT vehicle_id, sum(amount) FROM vehicle_expenses
    WHERE company_id = p_company_id AND expense_date >= v_month_start GROUP BY vehicle_id
    UNION ALL
    SELECT vehicle_id, sum(COALESCE(paid_amount,amount,0)) FROM traffic_fines
    WHERE company_id = p_company_id AND infraction_date >= v_month_start GROUP BY vehicle_id
  ), totals AS (
    SELECT vehicle_id, sum(v) AS total FROM costs GROUP BY vehicle_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'vehicle_id', t.vehicle_id,
    'plate', v.plate,
    'model', COALESCE(v.brand,'') || ' ' || COALESCE(v.model,''),
    'total', t.total
  ) ORDER BY t.total DESC), '[]'::jsonb)
  INTO v_top_vehicles
  FROM (SELECT * FROM totals ORDER BY total DESC LIMIT 3) t
  LEFT JOIN vehicles v ON v.id = t.vehicle_id;

  -- Próximas saídas (30 dias): manutenções agendadas + docs + multas com due_date
  WITH up AS (
    SELECT 'maintenance' AS kind, target_date AS due, category AS title, NULL::numeric AS amount, '/app/maintenance' AS link
      FROM maintenance_schedules
      WHERE company_id = p_company_id AND target_date BETWEEN v_today AND v_in30
        AND status IN ('pendente','proxima','vencida')
    UNION ALL
    SELECT 'document', expires_at, COALESCE(title, doc_type::text), NULL, '/app/documents'
      FROM documents
      WHERE company_id = p_company_id AND expires_at BETWEEN v_today AND v_in30
    UNION ALL
    SELECT 'fine', due_date, COALESCE(description, fine_type, 'Multa'), COALESCE(amount,0), '/app/multas'
      FROM traffic_fines
      WHERE company_id = p_company_id AND due_date BETWEEN v_today AND v_in30
        AND status NOT IN ('paga','cancelada','arquivada')
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'kind', kind, 'date', due, 'title', title, 'amount', amount, 'link', link
  ) ORDER BY due ASC), '[]'::jsonb)
  INTO v_upcoming
  FROM (SELECT * FROM up ORDER BY due ASC LIMIT 15) x;

  -- Atividade recente: últimos 5 eventos
  WITH ev AS (
    SELECT 'fuel' AS kind, fueled_at AS at,
      'Abastecimento ' || COALESCE(total_value::text,'') || ' R$' AS title,
      '/app/fuel' AS link
      FROM fuel_records WHERE company_id = p_company_id
    UNION ALL
    SELECT 'maintenance', service_at,
      'Manutenção ' || COALESCE(category,'realizada'),
      '/app/maintenance'
      FROM maintenance_records WHERE company_id = p_company_id
    UNION ALL
    SELECT 'expense', created_at,
      'Despesa: ' || COALESCE(expense_category,''),
      '/app/despesas'
      FROM vehicle_expenses WHERE company_id = p_company_id
    UNION ALL
    SELECT 'fine', created_at,
      'Multa registrada',
      '/app/multas'
      FROM traffic_fines WHERE company_id = p_company_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'kind', kind, 'date', at, 'title', title, 'link', link
  ) ORDER BY at DESC), '[]'::jsonb)
  INTO v_recent
  FROM (SELECT * FROM ev ORDER BY at DESC LIMIT 5) x;

  v_breakdown := jsonb_build_object(
    'fuel', v_month_fuel,
    'maintenance', v_month_maint,
    'expenses', v_month_expenses,
    'fines', v_month_fines,
    'trip_expenses', v_month_trip_exp
  );

  RETURN jsonb_build_object(
    'company_id', p_company_id,
    'generated_at', v_now,
    'mode', CASE WHEN v_total_vehicles < 3 AND v_fuel_30d = 0 THEN 'new' ELSE 'active' END,
    'vehicles', jsonb_build_object(
      'total', v_total_vehicles, 'active', v_active,
      'maintenance', v_maint, 'parado', v_parado
    ),
    'drivers', jsonb_build_object('total', v_drivers, 'available', v_drivers_available),
    'trips_running', v_trips_running,
    'month', jsonb_build_object(
      'total', (v_month_fuel + v_month_maint + v_month_expenses + v_month_fines + v_month_trip_exp),
      'prev_total', v_prev_total,
      'km', v_month_km,
      'breakdown', v_breakdown
    ),
    'alerts', v_alerts,
    'top_vehicles', v_top_vehicles,
    'upcoming', v_upcoming,
    'recent', v_recent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_get_summary(uuid) TO authenticated;
