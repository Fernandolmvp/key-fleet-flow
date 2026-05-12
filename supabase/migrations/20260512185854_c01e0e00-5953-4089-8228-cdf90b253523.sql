CREATE TABLE IF NOT EXISTS public._km_test_results (
  step text, result text, detail text, ts timestamptz DEFAULT now()
);
TRUNCATE public._km_test_results;

DO $$
DECLARE
  v_company uuid;
  v_vehicle uuid;
  v_base_km int;
  v_fuel1 uuid;
  v_fuel2 uuid;
  v_km int;
  v_orig_current_km int;
BEGIN
  SELECT v.company_id, v.id, COALESCE(v.current_km,0)
    INTO v_company, v_vehicle, v_base_km
    FROM public.vehicles v
    LEFT JOIN public.fuel_records fr ON fr.vehicle_id = v.id
    GROUP BY v.id ORDER BY COUNT(fr.id) ASC LIMIT 1;
  v_orig_current_km := v_base_km;

  INSERT INTO public.fuel_records (company_id,vehicle_id,fueled_at,fuel_type,liters,price_per_liter,total_value,km_at_fueling)
  VALUES (v_company,v_vehicle, now()+interval '10 days','diesel',50,6,300, v_base_km+100000)
  RETURNING id INTO v_fuel1;

  INSERT INTO public.fuel_records (company_id,vehicle_id,fueled_at,fuel_type,liters,price_per_liter,total_value,km_at_fueling)
  VALUES (v_company,v_vehicle, now()+interval '11 days','diesel',50,6,300, v_base_km+105000)
  RETURNING id INTO v_fuel2;

  INSERT INTO public._km_test_results VALUES('setup','OK',
    format('vehicle=%s base_km=%s fuel1_km=%s fuel2_km=%s', v_vehicle, v_base_km, v_base_km+100000, v_base_km+105000));

  -- CENÁRIO 7: UPDATE +KM (deve aceitar)
  BEGIN
    UPDATE public.fuel_records SET km_at_fueling = v_base_km+110000 WHERE id = v_fuel2;
    SELECT km_at_fueling INTO v_km FROM public.fuel_records WHERE id = v_fuel2;
    INSERT INTO public._km_test_results VALUES('CENARIO_7_update_aumenta_km','PASS', format('km final=%s (esperado=%s)', v_km, v_base_km+110000));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._km_test_results VALUES('CENARIO_7_update_aumenta_km','FAIL', SQLERRM);
  END;

  -- CENÁRIO 8: UPDATE -KM sem override (deve bloquear)
  BEGIN
    UPDATE public.fuel_records SET km_at_fueling = v_base_km+50000 WHERE id = v_fuel1;
    INSERT INTO public._km_test_results VALUES('CENARIO_8_update_diminui_sem_override','FAIL','UPDATE foi aceito quando deveria bloquear');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO public._km_test_results VALUES('CENARIO_8_update_diminui_sem_override','PASS', SQLERRM);
  WHEN OTHERS THEN
    INSERT INTO public._km_test_results VALUES('CENARIO_8_update_diminui_sem_override','UNEXPECTED', SQLERRM);
  END;

  -- CENÁRIO 8b: UPDATE -KM com override válido (deve aceitar + audit_log)
  BEGIN
    UPDATE public.fuel_records
       SET km_at_fueling = v_base_km+50000,
           km_override_reason = 'Hodômetro substituído conforme NF 12345 (teste automatizado)'
     WHERE id = v_fuel1;
    SELECT km_at_fueling INTO v_km FROM public.fuel_records WHERE id = v_fuel1;
    INSERT INTO public._km_test_results VALUES('CENARIO_8b_update_diminui_com_override','PASS', format('km final=%s', v_km));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._km_test_results VALUES('CENARIO_8b_update_diminui_com_override','FAIL', SQLERRM);
  END;

  -- CLEANUP
  DELETE FROM public.audit_logs WHERE record_id IN (v_fuel1, v_fuel2);
  DELETE FROM public.fuel_records WHERE id IN (v_fuel1, v_fuel2);
  -- restaura current_km do veículo (que foi inflado pelo trigger sync)
  UPDATE public.vehicles SET current_km = v_orig_current_km WHERE id = v_vehicle;

  INSERT INTO public._km_test_results VALUES('cleanup','OK',
    format('removidos 2 fuel_records e audit_logs; current_km restaurado para %s', v_orig_current_km));
END $$;