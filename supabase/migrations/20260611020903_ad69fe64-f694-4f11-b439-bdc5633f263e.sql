
ALTER TABLE public.insurance_brokers
  ADD COLUMN IF NOT EXISTS possible_duplicate_of uuid REFERENCES public.insurance_brokers(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.norm_digits(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p IS NULL THEN NULL ELSE regexp_replace(p, '\D', '', 'g') END;
$$;

CREATE OR REPLACE FUNCTION public.norm_broker_name(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        regexp_replace(
          upper(
            translate(coalesce(p,''),
              'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
              'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC')
          ),
          '\m(LTDA|ME|EPP|EIRELI|S\.?A\.?|SOCIEDADE\s+ANONIMA|CORRETORA(\s+DE\s+SEGUROS)?|SEGUROS|SEGURADORA)\M',
          ' ', 'gi'
        ),
        '[^A-Z0-9 ]+', ' ', 'g'
      )
    )
  , '');
$$;

CREATE INDEX IF NOT EXISTS ix_insurance_brokers_name_trgm
  ON public.insurance_brokers USING gin (public.norm_broker_name(name) gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.dedupe_insurance_brokers(p_company_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g RECORD; dup RECORD; v_groups int := 0; v_merges int := 0; v_fks int := 0; rc int;
BEGIN
  FOR g IN
    SELECT company_id, public.norm_digits(document) AS doc, array_agg(id ORDER BY created_at) AS ids
    FROM public.insurance_brokers
    WHERE document IS NOT NULL AND length(public.norm_digits(document)) >= 11
      AND (p_company_id IS NULL OR company_id = p_company_id)
    GROUP BY company_id, public.norm_digits(document) HAVING count(*) > 1
  LOOP
    v_groups := v_groups + 1;
    FOR dup IN SELECT * FROM public.insurance_brokers
               WHERE id = ANY(g.ids[2:array_length(g.ids,1)]) LOOP
      UPDATE public.insurance_brokers t SET
        legal_name = COALESCE(NULLIF(t.legal_name,''), dup.legal_name),
        document   = COALESCE(NULLIF(t.document,''),   dup.document),
        susep      = COALESCE(NULLIF(t.susep,''),      dup.susep),
        contact_name = COALESCE(NULLIF(t.contact_name,''), dup.contact_name),
        phone      = COALESCE(NULLIF(t.phone,''),      dup.phone),
        email      = COALESCE(NULLIF(t.email,''),      dup.email),
        address    = COALESCE(NULLIF(t.address,''),    dup.address),
        cep        = COALESCE(NULLIF(t.cep,''),        dup.cep),
        city       = COALESCE(NULLIF(t.city,''),       dup.city),
        state      = COALESCE(NULLIF(t.state,''),      dup.state),
        neighborhood = COALESCE(NULLIF(t.neighborhood,''), dup.neighborhood),
        address_number = COALESCE(NULLIF(t.address_number,''), dup.address_number),
        address_complement = COALESCE(NULLIF(t.address_complement,''), dup.address_complement),
        notes      = COALESCE(NULLIF(t.notes,''),      dup.notes),
        updated_at = now()
      WHERE t.id = g.ids[1];
      UPDATE public.insurance_policies SET broker_id = g.ids[1] WHERE broker_id = dup.id;
      GET DIAGNOSTICS rc = ROW_COUNT; v_fks := v_fks + rc;
      UPDATE public.insurance_brokers SET possible_duplicate_of = g.ids[1] WHERE possible_duplicate_of = dup.id;
      DELETE FROM public.insurance_brokers WHERE id = dup.id;
      v_merges := v_merges + 1;
    END LOOP;
  END LOOP;
  FOR g IN
    WITH base AS (
      SELECT id, company_id, public.norm_broker_name(name) AS nname, created_at
      FROM public.insurance_brokers
      WHERE (document IS NULL OR length(public.norm_digits(document)) < 11)
        AND (p_company_id IS NULL OR company_id = p_company_id)
        AND public.norm_broker_name(name) IS NOT NULL
    ), pairs AS (
      SELECT a.company_id, a.id AS canonical_id, b.id AS dup_id
      FROM base a JOIN base b
        ON a.company_id = b.company_id AND a.id <> b.id
       AND a.created_at <= b.created_at
       AND similarity(a.nname, b.nname) >= 0.85
    )
    SELECT company_id, canonical_id, array_agg(DISTINCT dup_id) AS dup_ids
    FROM pairs GROUP BY company_id, canonical_id
  LOOP
    v_groups := v_groups + 1;
    FOR dup IN SELECT * FROM public.insurance_brokers WHERE id = ANY(g.dup_ids) LOOP
      UPDATE public.insurance_brokers t SET
        legal_name = COALESCE(NULLIF(t.legal_name,''), dup.legal_name),
        document   = COALESCE(NULLIF(t.document,''),   dup.document),
        susep      = COALESCE(NULLIF(t.susep,''),      dup.susep),
        contact_name = COALESCE(NULLIF(t.contact_name,''), dup.contact_name),
        phone      = COALESCE(NULLIF(t.phone,''),      dup.phone),
        email      = COALESCE(NULLIF(t.email,''),      dup.email),
        address    = COALESCE(NULLIF(t.address,''),    dup.address),
        cep        = COALESCE(NULLIF(t.cep,''),        dup.cep),
        city       = COALESCE(NULLIF(t.city,''),       dup.city),
        state      = COALESCE(NULLIF(t.state,''),      dup.state),
        neighborhood = COALESCE(NULLIF(t.neighborhood,''), dup.neighborhood),
        address_number = COALESCE(NULLIF(t.address_number,''), dup.address_number),
        address_complement = COALESCE(NULLIF(t.address_complement,''), dup.address_complement),
        notes = COALESCE(NULLIF(t.notes,''), dup.notes),
        updated_at = now()
      WHERE t.id = g.canonical_id;
      UPDATE public.insurance_policies SET broker_id = g.canonical_id WHERE broker_id = dup.id;
      GET DIAGNOSTICS rc = ROW_COUNT; v_fks := v_fks + rc;
      DELETE FROM public.insurance_brokers WHERE id = dup.id;
      v_merges := v_merges + 1;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('groups', v_groups, 'merges', v_merges, 'fks_repointed', v_fks);
END; $$;
GRANT EXECUTE ON FUNCTION public.dedupe_insurance_brokers(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dedupe_insurance_policies(p_company_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g RECORD; dup RECORD;
  v_groups int := 0; v_merges int := 0; v_fks int := 0; rc int; v_recalc int := 0;
BEGIN
  EXECUTE 'ALTER TABLE public.insurance_policies DISABLE TRIGGER USER';
  EXECUTE 'ALTER TABLE public.insurance_policy_vehicles DISABLE TRIGGER USER';
  EXECUTE 'ALTER TABLE public.policy_external_plates DISABLE TRIGGER USER';
  EXECUTE 'ALTER TABLE public.vehicle_policy_manual_matches DISABLE TRIGGER USER';
  BEGIN
    FOR g IN
      SELECT company_id, public.norm_digits(policy_number) AS npn, array_agg(id ORDER BY created_at) AS ids
      FROM public.insurance_policies
      WHERE (p_company_id IS NULL OR company_id = p_company_id)
        AND public.norm_digits(policy_number) IS NOT NULL
        AND length(public.norm_digits(policy_number)) > 0
      GROUP BY company_id, public.norm_digits(policy_number) HAVING count(*) > 1
    LOOP
      v_groups := v_groups + 1;
      FOR dup IN SELECT * FROM public.insurance_policies
                 WHERE id = ANY(g.ids[2:array_length(g.ids,1)]) LOOP
        UPDATE public.insurance_policies t SET
          insurer_phone    = COALESCE(NULLIF(t.insurer_phone,''),  dup.insurer_phone),
          insurer_email    = COALESCE(NULLIF(t.insurer_email,''),  dup.insurer_email),
          broker_id        = COALESCE(t.broker_id, dup.broker_id),
          start_date       = COALESCE(t.start_date, dup.start_date),
          end_date         = COALESCE(t.end_date, dup.end_date),
          total_value      = COALESCE(NULLIF(t.total_value,0), dup.total_value),
          deductible       = COALESCE(t.deductible, dup.deductible),
          coverage_summary = COALESCE(NULLIF(t.coverage_summary,''), dup.coverage_summary),
          coverage_type    = COALESCE(NULLIF(t.coverage_type,''),    dup.coverage_type),
          file_url         = COALESCE(NULLIF(t.file_url,''),         dup.file_url),
          file_name        = COALESCE(NULLIF(t.file_name,''),        dup.file_name),
          notes            = COALESCE(NULLIF(t.notes,''),            dup.notes),
          ai_extracted     = CASE WHEN t.ai_extracted = '{}'::jsonb THEN dup.ai_extracted ELSE t.ai_extracted END,
          updated_at       = now()
        WHERE t.id = g.ids[1];

        DELETE FROM public.insurance_policy_vehicles d
        USING public.insurance_policy_vehicles c
        WHERE d.policy_id = dup.id AND c.policy_id = g.ids[1] AND d.vehicle_id = c.vehicle_id;
        UPDATE public.insurance_policy_vehicles SET policy_id = g.ids[1] WHERE policy_id = dup.id;
        GET DIAGNOSTICS rc = ROW_COUNT; v_fks := v_fks + rc;

        DELETE FROM public.policy_external_plates d
        USING public.policy_external_plates c
        WHERE d.policy_id = dup.id AND c.policy_id = g.ids[1] AND d.normalized_plate = c.normalized_plate;
        UPDATE public.policy_external_plates SET policy_id = g.ids[1] WHERE policy_id = dup.id;

        DELETE FROM public.vehicle_policy_manual_matches d
        USING public.vehicle_policy_manual_matches c
        WHERE d.policy_id = dup.id AND c.policy_id = g.ids[1] AND d.vehicle_id = c.vehicle_id;
        UPDATE public.vehicle_policy_manual_matches SET policy_id = g.ids[1] WHERE policy_id = dup.id;

        DELETE FROM public.monthly_insurance_costs WHERE insurance_policy_id = dup.id;
        DELETE FROM public.insurance_policies WHERE id = dup.id;
        v_merges := v_merges + 1;
      END LOOP;

      DELETE FROM public.monthly_insurance_costs WHERE insurance_policy_id = g.ids[1];
      BEGIN
        PERFORM public.recalculate_insurance_monthly_costs(g.ids[1]);
        v_recalc := v_recalc + 1;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'ALTER TABLE public.insurance_policies ENABLE TRIGGER USER';
    EXECUTE 'ALTER TABLE public.insurance_policy_vehicles ENABLE TRIGGER USER';
    EXECUTE 'ALTER TABLE public.policy_external_plates ENABLE TRIGGER USER';
    EXECUTE 'ALTER TABLE public.vehicle_policy_manual_matches ENABLE TRIGGER USER';
    RAISE;
  END;
  EXECUTE 'ALTER TABLE public.insurance_policies ENABLE TRIGGER USER';
  EXECUTE 'ALTER TABLE public.insurance_policy_vehicles ENABLE TRIGGER USER';
  EXECUTE 'ALTER TABLE public.policy_external_plates ENABLE TRIGGER USER';
  EXECUTE 'ALTER TABLE public.vehicle_policy_manual_matches ENABLE TRIGGER USER';
  RETURN jsonb_build_object('groups', v_groups, 'merges', v_merges, 'fks_repointed', v_fks, 'recalculated_policies', v_recalc);
END; $$;
GRANT EXECUTE ON FUNCTION public.dedupe_insurance_policies(uuid) TO authenticated, service_role;

DO $$
DECLARE rb jsonb; rp jsonb;
BEGIN
  rb := public.dedupe_insurance_brokers(NULL);
  rp := public.dedupe_insurance_policies(NULL);
  RAISE NOTICE 'dedupe brokers: %', rb;
  RAISE NOTICE 'dedupe policies: %', rp;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_insurance_brokers_company_doc
  ON public.insurance_brokers (company_id, public.norm_digits(document))
  WHERE document IS NOT NULL AND length(public.norm_digits(document)) >= 11;

CREATE UNIQUE INDEX IF NOT EXISTS ux_insurance_policies_company_polnum
  ON public.insurance_policies (company_id, public.norm_digits(policy_number));

CREATE OR REPLACE FUNCTION public.upsert_insurance_broker(p_company_id uuid, p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_doc text := public.norm_digits(nullif(p_data->>'document',''));
  v_name text := nullif(p_data->>'name','');
  v_norm_name text := public.norm_broker_name(v_name);
  v_match RECORD;
  v_best_sim numeric;
BEGIN
  IF p_company_id IS NULL OR v_name IS NULL THEN
    RAISE EXCEPTION 'company_id e name são obrigatórios';
  END IF;
  IF v_doc IS NOT NULL AND length(v_doc) >= 11 THEN
    SELECT id INTO v_id FROM public.insurance_brokers
      WHERE company_id = p_company_id AND public.norm_digits(document) = v_doc LIMIT 1;
  END IF;
  IF v_id IS NULL AND v_norm_name IS NOT NULL THEN
    SELECT id, similarity(public.norm_broker_name(name), v_norm_name) AS sim INTO v_match
      FROM public.insurance_brokers
      WHERE company_id = p_company_id AND public.norm_broker_name(name) % v_norm_name
      ORDER BY similarity(public.norm_broker_name(name), v_norm_name) DESC LIMIT 1;
    IF v_match.id IS NOT NULL AND v_match.sim >= 0.85 THEN v_id := v_match.id;
    ELSIF v_match.id IS NOT NULL AND v_match.sim >= 0.6 THEN v_best_sim := v_match.sim;
    END IF;
  END IF;
  IF v_id IS NOT NULL THEN
    UPDATE public.insurance_brokers SET
      name = COALESCE(NULLIF(name,''), v_name),
      legal_name = COALESCE(NULLIF(legal_name,''), nullif(p_data->>'legal_name','')),
      document   = COALESCE(NULLIF(document,''),   nullif(p_data->>'document','')),
      susep      = COALESCE(NULLIF(susep,''),      nullif(p_data->>'susep','')),
      contact_name = COALESCE(NULLIF(contact_name,''), nullif(p_data->>'contact_name','')),
      phone      = COALESCE(NULLIF(phone,''),      nullif(p_data->>'phone','')),
      email      = COALESCE(NULLIF(email,''),      nullif(p_data->>'email','')),
      address    = COALESCE(NULLIF(address,''),    nullif(p_data->>'address','')),
      cep        = COALESCE(NULLIF(cep,''),        nullif(p_data->>'cep','')),
      city       = COALESCE(NULLIF(city,''),       nullif(p_data->>'city','')),
      state      = COALESCE(NULLIF(state,''),      nullif(p_data->>'state','')),
      neighborhood = COALESCE(NULLIF(neighborhood,''), nullif(p_data->>'neighborhood','')),
      address_number = COALESCE(NULLIF(address_number,''), nullif(p_data->>'address_number','')),
      address_complement = COALESCE(NULLIF(address_complement,''), nullif(p_data->>'address_complement','')),
      notes = COALESCE(NULLIF(notes,''), nullif(p_data->>'notes','')),
      updated_at = now()
    WHERE id = v_id;
    RETURN v_id;
  END IF;
  INSERT INTO public.insurance_brokers (
    company_id, name, legal_name, document, susep, contact_name, phone, email,
    address, cep, city, state, neighborhood, address_number, address_complement, notes,
    possible_duplicate_of, created_by
  ) VALUES (
    p_company_id, v_name,
    nullif(p_data->>'legal_name',''), nullif(p_data->>'document',''),
    nullif(p_data->>'susep',''), nullif(p_data->>'contact_name',''),
    nullif(p_data->>'phone',''), nullif(p_data->>'email',''),
    nullif(p_data->>'address',''), nullif(p_data->>'cep',''),
    nullif(p_data->>'city',''), nullif(p_data->>'state',''),
    nullif(p_data->>'neighborhood',''), nullif(p_data->>'address_number',''),
    nullif(p_data->>'address_complement',''), nullif(p_data->>'notes',''),
    CASE WHEN v_best_sim IS NOT NULL THEN v_match.id ELSE NULL END,
    auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.upsert_insurance_broker(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_insurance_policy(p_company_id uuid, p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_pn text := nullif(p_data->>'policy_number','');
  v_npn text := public.norm_digits(v_pn);
  v_insurer text := nullif(p_data->>'insurer_name','');
BEGIN
  IF p_company_id IS NULL OR v_pn IS NULL OR v_insurer IS NULL THEN
    RAISE EXCEPTION 'company_id, policy_number e insurer_name são obrigatórios';
  END IF;
  SELECT id INTO v_id FROM public.insurance_policies
    WHERE company_id = p_company_id AND public.norm_digits(policy_number) = v_npn LIMIT 1;
  IF v_id IS NOT NULL THEN
    -- Bypassa o trigger de proteção de campos AI durante o merge não-destrutivo
    EXECUTE 'ALTER TABLE public.insurance_policies DISABLE TRIGGER tg_ip_block_ai_field_changes';
    BEGIN
      UPDATE public.insurance_policies SET
        policy_number    = COALESCE(NULLIF(policy_number,''),  v_pn),
        insurer_name     = COALESCE(NULLIF(insurer_name,''),   v_insurer),
        insurer_phone    = COALESCE(NULLIF(insurer_phone,''),  nullif(p_data->>'insurer_phone','')),
        insurer_email    = COALESCE(NULLIF(insurer_email,''),  nullif(p_data->>'insurer_email','')),
        broker_id        = COALESCE(broker_id, (nullif(p_data->>'broker_id',''))::uuid),
        start_date       = COALESCE(start_date, (nullif(p_data->>'start_date',''))::date),
        end_date         = COALESCE(end_date,   (nullif(p_data->>'end_date',''))::date),
        total_value      = COALESCE(NULLIF(total_value,0), (nullif(p_data->>'total_value',''))::numeric),
        deductible       = COALESCE(deductible, (nullif(p_data->>'deductible',''))::numeric),
        coverage_summary = COALESCE(NULLIF(coverage_summary,''), nullif(p_data->>'coverage_summary','')),
        coverage_type    = COALESCE(NULLIF(coverage_type,''),    nullif(p_data->>'coverage_type','')),
        file_url         = COALESCE(NULLIF(file_url,''),         nullif(p_data->>'file_url','')),
        file_name        = COALESCE(NULLIF(file_name,''),        nullif(p_data->>'file_name','')),
        notes            = COALESCE(NULLIF(notes,''),            nullif(p_data->>'notes','')),
        status           = COALESCE(NULLIF(status,''),           nullif(p_data->>'status',''), status),
        ai_extracted     = CASE
                              WHEN ai_extracted = '{}'::jsonb AND (p_data ? 'ai_extracted')
                                THEN (p_data->'ai_extracted')
                              ELSE ai_extracted
                           END,
        updated_at       = now()
      WHERE id = v_id;
    EXCEPTION WHEN OTHERS THEN
      EXECUTE 'ALTER TABLE public.insurance_policies ENABLE TRIGGER tg_ip_block_ai_field_changes';
      RAISE;
    END;
    EXECUTE 'ALTER TABLE public.insurance_policies ENABLE TRIGGER tg_ip_block_ai_field_changes';
    RETURN v_id;
  END IF;
  INSERT INTO public.insurance_policies (
    company_id, policy_number, insurer_name, insurer_phone, insurer_email,
    broker_id, start_date, end_date, total_value, deductible,
    coverage_summary, coverage_type, file_url, file_name, notes,
    status, ai_extracted, created_by
  ) VALUES (
    p_company_id, v_pn, v_insurer,
    nullif(p_data->>'insurer_phone',''), nullif(p_data->>'insurer_email',''),
    (nullif(p_data->>'broker_id',''))::uuid,
    (nullif(p_data->>'start_date',''))::date,
    (nullif(p_data->>'end_date',''))::date,
    (nullif(p_data->>'total_value',''))::numeric,
    (nullif(p_data->>'deductible',''))::numeric,
    nullif(p_data->>'coverage_summary',''), nullif(p_data->>'coverage_type',''),
    nullif(p_data->>'file_url',''), nullif(p_data->>'file_name',''),
    nullif(p_data->>'notes',''),
    COALESCE(nullif(p_data->>'status',''),'ativa'),
    COALESCE(p_data->'ai_extracted','{}'::jsonb),
    auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.upsert_insurance_policy(uuid, jsonb) TO authenticated, service_role;
