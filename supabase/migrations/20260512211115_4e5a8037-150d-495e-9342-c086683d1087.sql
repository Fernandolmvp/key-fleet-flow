CREATE OR REPLACE FUNCTION public.tg_fuel_compute()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prev RECORD; v RECORD; hist RECORD;
  anom public.fuel_anomaly[] := '{}';
  sev TEXT := NULL; hour_local INT;
  expected numeric; tol numeric; deviation numeric;
BEGIN
  SELECT * INTO v FROM public.vehicles WHERE id = NEW.vehicle_id;
  SELECT * INTO prev FROM public.fuel_records
    WHERE vehicle_id = NEW.vehicle_id AND fueled_at < NEW.fueled_at
      AND (TG_OP = 'INSERT' OR id <> NEW.id)
    ORDER BY fueled_at DESC LIMIT 1;

  IF prev IS NOT NULL THEN
    NEW.km_driven := NEW.km_at_fueling - prev.km_at_fueling;
    IF NEW.km_driven IS NOT NULL AND NEW.km_driven > 0 AND NEW.liters > 0 THEN
      NEW.km_per_liter := ROUND((NEW.km_driven::numeric / NEW.liters), 2);
      NEW.cost_per_km := ROUND((NEW.total_value / NEW.km_driven), 3);
    END IF;
    IF NEW.km_at_fueling < prev.km_at_fueling THEN
      anom := array_append(anom, 'km_regressivo'::public.fuel_anomaly); sev := 'alta';
    END IF;
    IF NEW.fueled_at - prev.fueled_at < INTERVAL '30 minutes' THEN
      anom := array_append(anom, 'duplicado'::public.fuel_anomaly); sev := COALESCE(sev,'media');
    END IF;
  END IF;

  IF v.tank_capacity IS NOT NULL AND NEW.liters > v.tank_capacity * 1.05 THEN
    anom := array_append(anom, 'tanque_excedido'::public.fuel_anomaly); sev := 'alta';
  END IF;

  SELECT AVG(km_per_liter) AS avg_kml, COUNT(*) AS n INTO hist
  FROM public.fuel_records
  WHERE vehicle_id = NEW.vehicle_id AND km_per_liter IS NOT NULL
    AND (TG_OP = 'INSERT' OR id <> NEW.id);
  IF NEW.km_per_liter IS NOT NULL AND hist.n >= 3 AND hist.avg_kml > 0 THEN
    IF NEW.km_per_liter < hist.avg_kml * 0.65 THEN
      anom := array_append(anom, 'consumo_alto'::public.fuel_anomaly); sev := COALESCE(sev,'media');
    ELSIF NEW.km_per_liter > hist.avg_kml * 1.45 THEN
      anom := array_append(anom, 'consumo_baixo'::public.fuel_anomaly); sev := COALESCE(sev,'baixa');
    END IF;
  END IF;

  hour_local := EXTRACT(HOUR FROM NEW.fueled_at);
  IF hour_local >= 0 AND hour_local < 5 THEN
    anom := array_append(anom, 'horario_suspeito'::public.fuel_anomaly); sev := COALESCE(sev,'baixa');
  END IF;

  SELECT AVG(price_per_liter) AS avg_price, COUNT(*) AS n INTO hist
  FROM public.fuel_records
  WHERE company_id = NEW.company_id AND fuel_type = NEW.fuel_type
    AND fueled_at > now() - INTERVAL '60 days'
    AND (TG_OP = 'INSERT' OR id <> NEW.id);
  IF hist.n >= 5 AND hist.avg_price > 0 THEN
    IF NEW.price_per_liter > hist.avg_price * 1.25 OR NEW.price_per_liter < hist.avg_price * 0.75 THEN
      anom := array_append(anom, 'valor_atipico'::public.fuel_anomaly); sev := COALESCE(sev,'media');
    END IF;
  END IF;

  -- NOVO: comparação contra consumo esperado configurado no veículo
  expected := v.expected_consumption_kml;
  tol := COALESCE(v.consumption_tolerance_pct, 20);
  IF expected IS NOT NULL AND expected > 0
     AND NEW.km_per_liter IS NOT NULL AND NEW.km_per_liter > 0 THEN
    deviation := ABS(NEW.km_per_liter - expected) / expected * 100.0;
    IF deviation > tol THEN
      IF NEW.km_per_liter < expected THEN
        anom := array_append(anom, 'consumo_acima_esperado'::public.fuel_anomaly);
      ELSE
        anom := array_append(anom, 'consumo_abaixo_esperado'::public.fuel_anomaly);
      END IF;
      IF deviation > 40 THEN sev := 'alta';
      ELSIF deviation > 20 THEN sev := COALESCE(sev,'media');
      ELSE sev := COALESCE(sev,'baixa');
      END IF;
    END IF;
  END IF;

  NEW.anomalies := anom;
  NEW.anomaly_severity := sev;

  IF NEW.km_at_fueling > COALESCE(v.current_km, 0) THEN
    UPDATE public.vehicles SET current_km = NEW.km_at_fueling WHERE id = NEW.vehicle_id;
  END IF;

  RETURN NEW;
END $function$;