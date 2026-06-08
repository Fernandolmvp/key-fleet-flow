
-- 1. Add individual_premium to insurance_policy_vehicles (additive, nullable)
ALTER TABLE public.insurance_policy_vehicles
  ADD COLUMN IF NOT EXISTS individual_premium numeric(12,2);

-- 2. Create monthly_insurance_costs table
CREATE TABLE IF NOT EXISTS public.monthly_insurance_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  insurance_policy_id uuid NOT NULL REFERENCES public.insurance_policies(id) ON DELETE CASCADE,
  insurance_policy_vehicle_id uuid NOT NULL REFERENCES public.insurance_policy_vehicles(id) ON DELETE CASCADE,
  reference_year int NOT NULL,
  reference_month int NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
  monthly_cost numeric(12,2) NOT NULL CHECK (monthly_cost >= 0),
  days_in_month_covered int NOT NULL CHECK (days_in_month_covered >= 0),
  policy_start_date date NOT NULL,
  policy_end_date date NOT NULL,
  individual_premium numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_insurance_costs_unique UNIQUE (vehicle_id, insurance_policy_id, reference_year, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_mic_company_vehicle_period
  ON public.monthly_insurance_costs (company_id, vehicle_id, reference_year, reference_month);
CREATE INDEX IF NOT EXISTS idx_mic_policy
  ON public.monthly_insurance_costs (insurance_policy_id);

-- 3. Grants
GRANT SELECT ON public.monthly_insurance_costs TO authenticated;
GRANT ALL ON public.monthly_insurance_costs TO service_role;

-- 4. RLS
ALTER TABLE public.monthly_insurance_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mic_select_company_members" ON public.monthly_insurance_costs;
CREATE POLICY "mic_select_company_members"
  ON public.monthly_insurance_costs
  FOR SELECT
  TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "mic_service_role_all" ON public.monthly_insurance_costs;
CREATE POLICY "mic_service_role_all"
  ON public.monthly_insurance_costs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_monthly_insurance_costs()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mic_touch ON public.monthly_insurance_costs;
CREATE TRIGGER trg_mic_touch BEFORE UPDATE ON public.monthly_insurance_costs
  FOR EACH ROW EXECUTE FUNCTION public.touch_monthly_insurance_costs();

-- 6. Recalculation function
CREATE OR REPLACE FUNCTION public.recalculate_insurance_monthly_costs(p_policy_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_policy_start date;
  v_policy_end date;
  v_cov_start date;
  v_cov_end date;
  v_total_days int;
  v_per_day numeric(18,8);
  v_month_start date;
  v_month_end date;
  v_seg_start date;
  v_seg_end date;
  v_days_in_month int;
  v_monthly_cost numeric(12,2);
  v_individual_premium numeric(12,2);
  v_vehicle_count int;
  v_sum numeric(14,4);
  v_diff numeric(14,4);
BEGIN
  -- Cleanup orphans
  DELETE FROM public.monthly_insurance_costs mic
  WHERE NOT EXISTS (
    SELECT 1 FROM public.insurance_policy_vehicles ipv WHERE ipv.id = mic.insurance_policy_vehicle_id
  );

  -- Iterate over policy vehicles
  FOR r IN
    SELECT ipv.id AS ipv_id,
           ipv.policy_id,
           ipv.vehicle_id,
           ipv.company_id,
           ipv.included_at,
           ipv.removed_at,
           ipv.individual_premium AS ipv_premium,
           ip.start_date AS p_start,
           ip.end_date AS p_end,
           ip.total_value AS p_total
    FROM public.insurance_policy_vehicles ipv
    JOIN public.insurance_policies ip ON ip.id = ipv.policy_id
    WHERE (p_policy_id IS NULL OR ipv.policy_id = p_policy_id)
  LOOP
    v_policy_start := r.p_start;
    v_policy_end := r.p_end;

    IF v_policy_start IS NULL OR v_policy_end IS NULL THEN
      CONTINUE;
    END IF;

    -- Coverage window for this vehicle
    v_cov_start := GREATEST(COALESCE(r.included_at, v_policy_start), v_policy_start);
    v_cov_end := LEAST(COALESCE(r.removed_at, v_policy_end), v_policy_end);

    IF v_cov_end < v_cov_start THEN
      DELETE FROM public.monthly_insurance_costs
      WHERE insurance_policy_vehicle_id = r.ipv_id;
      CONTINUE;
    END IF;

    -- Individual premium: use stored value or split policy total equally among vehicles
    IF r.ipv_premium IS NOT NULL AND r.ipv_premium > 0 THEN
      v_individual_premium := r.ipv_premium;
    ELSE
      SELECT COUNT(*) INTO v_vehicle_count
      FROM public.insurance_policy_vehicles
      WHERE policy_id = r.policy_id;
      IF v_vehicle_count = 0 OR r.p_total IS NULL THEN
        CONTINUE;
      END IF;
      v_individual_premium := ROUND(r.p_total / v_vehicle_count, 2);
    END IF;

    v_total_days := (v_policy_end - v_policy_start) + 1;
    IF v_total_days <= 0 THEN
      CONTINUE;
    END IF;
    v_per_day := v_individual_premium::numeric / v_total_days;

    -- Remove previous rows for this ipv (so we don't keep stale months)
    DELETE FROM public.monthly_insurance_costs
    WHERE insurance_policy_vehicle_id = r.ipv_id;

    -- Iterate month by month
    v_month_start := date_trunc('month', v_cov_start)::date;
    WHILE v_month_start <= v_cov_end LOOP
      v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;
      v_seg_start := GREATEST(v_month_start, v_cov_start);
      v_seg_end := LEAST(v_month_end, v_cov_end);
      v_days_in_month := (v_seg_end - v_seg_start) + 1;

      IF v_days_in_month > 0 THEN
        v_monthly_cost := ROUND(v_per_day * v_days_in_month, 2);

        INSERT INTO public.monthly_insurance_costs (
          company_id, vehicle_id, insurance_policy_id, insurance_policy_vehicle_id,
          reference_year, reference_month, monthly_cost, days_in_month_covered,
          policy_start_date, policy_end_date, individual_premium
        ) VALUES (
          r.company_id, r.vehicle_id, r.policy_id, r.ipv_id,
          EXTRACT(YEAR FROM v_month_start)::int, EXTRACT(MONTH FROM v_month_start)::int,
          v_monthly_cost, v_days_in_month,
          v_policy_start, v_policy_end, v_individual_premium
        )
        ON CONFLICT (vehicle_id, insurance_policy_id, reference_year, reference_month) DO UPDATE
        SET monthly_cost = EXCLUDED.monthly_cost,
            days_in_month_covered = EXCLUDED.days_in_month_covered,
            insurance_policy_vehicle_id = EXCLUDED.insurance_policy_vehicle_id,
            policy_start_date = EXCLUDED.policy_start_date,
            policy_end_date = EXCLUDED.policy_end_date,
            individual_premium = EXCLUDED.individual_premium,
            company_id = EXCLUDED.company_id,
            updated_at = now();
      END IF;

      v_month_start := (v_month_start + interval '1 month')::date;
    END LOOP;

    -- Validation: sum of months should equal individual_premium (within tolerance)
    SELECT COALESCE(SUM(monthly_cost), 0) INTO v_sum
    FROM public.monthly_insurance_costs
    WHERE insurance_policy_vehicle_id = r.ipv_id;

    -- Expected sum considering partial coverage
    DECLARE
      v_expected numeric(14,4);
      v_cov_days int;
    BEGIN
      v_cov_days := (v_cov_end - v_cov_start) + 1;
      v_expected := ROUND(v_per_day * v_cov_days, 2);
      v_diff := ABS(v_sum - v_expected);
      IF v_diff > 0.02 THEN
        RAISE WARNING 'Divergencia em insurance_policy_vehicle_id=% sum=% expected=% diff=%',
          r.ipv_id, v_sum, v_expected, v_diff;
      END IF;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_insurance_monthly_costs(uuid) TO service_role;

-- 7. Triggers
CREATE OR REPLACE FUNCTION public.trg_recalc_insurance_costs_ipv()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_policy_id uuid;
BEGIN
  v_policy_id := COALESCE(NEW.policy_id, OLD.policy_id);
  PERFORM public.recalculate_insurance_monthly_costs(v_policy_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_ipv_recalc ON public.insurance_policy_vehicles;
CREATE TRIGGER trg_ipv_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.insurance_policy_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_insurance_costs_ipv();

CREATE OR REPLACE FUNCTION public.trg_recalc_insurance_costs_policy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.start_date IS NOT DISTINCT FROM OLD.start_date
     AND NEW.end_date IS NOT DISTINCT FROM OLD.end_date
     AND NEW.total_value IS NOT DISTINCT FROM OLD.total_value THEN
    RETURN NEW;
  END IF;
  PERFORM public.recalculate_insurance_monthly_costs(COALESCE(NEW.id, OLD.id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_policy_recalc ON public.insurance_policies;
CREATE TRIGGER trg_policy_recalc
  AFTER UPDATE OR DELETE ON public.insurance_policies
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_insurance_costs_policy();

-- 8. Initial populate
SELECT public.recalculate_insurance_monthly_costs(NULL);
