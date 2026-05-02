
-- =========================================================
-- AUDITORIA DE ABASTECIMENTOS (idempotente)
-- =========================================================

-- 1) FOREIGN KEYS (drop se existirem para recriar limpas)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS tbl FROM pg_constraint
    WHERE conname IN (
      'fk_fuel_auth_company','fk_fuel_auth_vehicle','fk_fuel_auth_driver',
      'fk_fuel_auth_station','fk_fuel_auth_record',
      'fk_fuel_auth_items_company','fk_fuel_auth_items_auth',
      'fk_fuel_records_company','fk_fuel_records_vehicle',
      'fk_fuel_records_driver','fk_fuel_records_station',
      'chk_fuel_records_liters_pos','chk_fuel_records_price_pos',
      'chk_fuel_records_total_pos','chk_fuel_records_km_pos'
    )
  LOOP EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname); END LOOP;
END $$;

ALTER TABLE public.fuel_authorizations
  ADD CONSTRAINT fk_fuel_auth_company   FOREIGN KEY (company_id)      REFERENCES public.companies(id)      ON DELETE CASCADE,
  ADD CONSTRAINT fk_fuel_auth_vehicle   FOREIGN KEY (vehicle_id)      REFERENCES public.vehicles(id)       ON DELETE RESTRICT,
  ADD CONSTRAINT fk_fuel_auth_driver    FOREIGN KEY (driver_id)       REFERENCES public.drivers(id)        ON DELETE RESTRICT,
  ADD CONSTRAINT fk_fuel_auth_station   FOREIGN KEY (fuel_station_id) REFERENCES public.fuel_stations(id)  ON DELETE SET NULL,
  ADD CONSTRAINT fk_fuel_auth_record    FOREIGN KEY (fuel_record_id)  REFERENCES public.fuel_records(id)   ON DELETE SET NULL;

ALTER TABLE public.fuel_authorization_items
  ADD CONSTRAINT fk_fuel_auth_items_company FOREIGN KEY (company_id)       REFERENCES public.companies(id)            ON DELETE CASCADE,
  ADD CONSTRAINT fk_fuel_auth_items_auth    FOREIGN KEY (authorization_id) REFERENCES public.fuel_authorizations(id)  ON DELETE CASCADE;

ALTER TABLE public.fuel_records
  ADD CONSTRAINT fk_fuel_records_company FOREIGN KEY (company_id)      REFERENCES public.companies(id)     ON DELETE CASCADE,
  ADD CONSTRAINT fk_fuel_records_vehicle FOREIGN KEY (vehicle_id)      REFERENCES public.vehicles(id)      ON DELETE RESTRICT,
  ADD CONSTRAINT fk_fuel_records_driver  FOREIGN KEY (driver_id)       REFERENCES public.drivers(id)       ON DELETE RESTRICT,
  ADD CONSTRAINT fk_fuel_records_station FOREIGN KEY (fuel_station_id) REFERENCES public.fuel_stations(id) ON DELETE SET NULL;

-- 2) Vínculo bidirecional auth <-> record
ALTER TABLE public.fuel_records
  ADD COLUMN IF NOT EXISTS authorization_id uuid REFERENCES public.fuel_authorizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_origin text NOT NULL DEFAULT 'manual';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fuel_records_source_origin') THEN
    ALTER TABLE public.fuel_records
      ADD CONSTRAINT chk_fuel_records_source_origin
      CHECK (source_origin IN ('manual','autorizacao','importacao'));
  END IF;
END $$;

UPDATE public.fuel_records r
SET authorization_id = a.id,
    source_origin    = 'autorizacao'
FROM public.fuel_authorizations a
WHERE a.fuel_record_id = r.id AND r.authorization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fuel_records_authorization_id
  ON public.fuel_records(authorization_id) WHERE authorization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fuel_records_company_date  ON public.fuel_records(company_id, fueled_at DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_records_vehicle_date  ON public.fuel_records(vehicle_id, fueled_at DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_records_driver_date   ON public.fuel_records(driver_id,  fueled_at DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_auth_company_status   ON public.fuel_authorizations(company_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_auth_record           ON public.fuel_authorizations(fuel_record_id) WHERE fuel_record_id IS NOT NULL;

-- 3) CHECKs de integridade
ALTER TABLE public.fuel_records
  ADD CONSTRAINT chk_fuel_records_liters_pos CHECK (liters > 0),
  ADD CONSTRAINT chk_fuel_records_price_pos  CHECK (price_per_liter > 0),
  ADD CONSTRAINT chk_fuel_records_total_pos  CHECK (total_value > 0),
  ADD CONSTRAINT chk_fuel_records_km_pos     CHECK (km_at_fueling >= 0);

-- 4) Trigger: bloqueia "utilizada" sem record vinculado
CREATE OR REPLACE FUNCTION public.tg_fuel_auth_require_record_on_use()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'utilizada'
     AND (OLD.status IS DISTINCT FROM 'utilizada')
     AND NEW.fuel_record_id IS NULL THEN
    RAISE EXCEPTION 'Autorização % não pode ser marcada como utilizada sem registro de abastecimento vinculado (litros e valor obrigatórios).', NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fuel_auth_require_record ON public.fuel_authorizations;
CREATE TRIGGER trg_fuel_auth_require_record
  BEFORE UPDATE ON public.fuel_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_fuel_auth_require_record_on_use();

-- 5) Trigger: sincroniza auth quando record novo é vinculado
CREATE OR REPLACE FUNCTION public.tg_fuel_record_sync_auth()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.authorization_id IS NOT NULL THEN
    UPDATE public.fuel_authorizations
       SET fuel_record_id = NEW.id,
           status         = 'utilizada',
           used_at        = COALESCE(used_at, now()),
           confirmed_at   = COALESCE(confirmed_at, now())
     WHERE id = NEW.authorization_id
       AND (fuel_record_id IS NULL OR fuel_record_id = NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fuel_record_sync_auth ON public.fuel_records;
CREATE TRIGGER trg_fuel_record_sync_auth
  AFTER INSERT OR UPDATE OF authorization_id ON public.fuel_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_fuel_record_sync_auth();

-- 6) Auditoria automática
CREATE OR REPLACE FUNCTION public.tg_audit_fuel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; v_changes jsonb;
BEGIN
  v_company := COALESCE(NEW.company_id, OLD.company_id);
  IF TG_OP = 'INSERT' THEN
    v_changes := jsonb_build_object('op','INSERT','new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object('op','UPDATE','old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    v_changes := jsonb_build_object('op','DELETE','old', to_jsonb(OLD));
  END IF;
  INSERT INTO public.audit_logs(table_name, record_id, action, company_id, user_id, changes)
  VALUES (TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP, v_company, auth.uid(), v_changes);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_audit_fuel_records ON public.fuel_records;
CREATE TRIGGER trg_audit_fuel_records
  AFTER INSERT OR UPDATE OR DELETE ON public.fuel_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_fuel();

DROP TRIGGER IF EXISTS trg_audit_fuel_auth ON public.fuel_authorizations;
CREATE TRIGGER trg_audit_fuel_auth
  AFTER INSERT OR UPDATE OR DELETE ON public.fuel_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_fuel();
