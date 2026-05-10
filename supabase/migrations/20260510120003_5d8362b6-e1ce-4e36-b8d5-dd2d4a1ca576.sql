
-- 1. Configuração da empresa: validade do código (em minutos)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS fuel_auth_code_ttl_minutes integer NOT NULL DEFAULT 30;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_fuel_auth_ttl_check CHECK (fuel_auth_code_ttl_minutes BETWEEN 5 AND 1440);

-- 2. fuel_authorizations: valor máximo autorizado
ALTER TABLE public.fuel_authorizations
  ADD COLUMN IF NOT EXISTS approved_amount numeric(10,2);

-- 3. Atualiza trigger de aprovação para usar TTL configurado por empresa
CREATE OR REPLACE FUNCTION public.tg_fuel_auth_on_approve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ttl int;
BEGIN
  IF NEW.status = 'aprovada' AND (OLD.status IS DISTINCT FROM 'aprovada') THEN
    SELECT COALESCE(fuel_auth_code_ttl_minutes, 30) INTO v_ttl
      FROM public.companies WHERE id = NEW.company_id;
    NEW.authorization_code := COALESCE(NEW.authorization_code, public.generate_fuel_auth_code());
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    NEW.expires_at  := COALESCE(NEW.expires_at, now() + make_interval(mins => COALESCE(v_ttl, 30)));
  END IF;
  RETURN NEW;
END;
$function$;

-- mesmo ajuste no auto_approve
CREATE OR REPLACE FUNCTION public.tg_fuel_auth_auto_approve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d RECORD;
  v_ttl int;
BEGIN
  IF NEW.driver_id IS NOT NULL THEN
    SELECT * INTO d FROM public.drivers WHERE id = NEW.driver_id;
  ELSE
    SELECT * INTO d FROM public.drivers
     WHERE company_id = NEW.company_id AND user_id = NEW.requested_by LIMIT 1;
    IF d.id IS NOT NULL THEN NEW.driver_id := d.id; END IF;
  END IF;

  IF NEW.status = 'pendente' AND d.id IS NOT NULL AND COALESCE(d.auto_fuel_authorized,false) = true THEN
    SELECT COALESCE(fuel_auth_code_ttl_minutes,30) INTO v_ttl
      FROM public.companies WHERE id = NEW.company_id;
    NEW.status := 'aprovada';
    NEW.approved_by := COALESCE(NEW.approved_by, NEW.requested_by);
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    NEW.expires_at  := COALESCE(NEW.expires_at, now() + make_interval(mins => COALESCE(v_ttl,30)));
    NEW.authorization_code := COALESCE(NEW.authorization_code, public.generate_fuel_auth_code());
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Tabela fuel_station_users
CREATE TABLE IF NOT EXISTS public.fuel_station_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.fuel_stations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'operador',
  active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_fuel_station_users_station ON public.fuel_station_users(station_id);
CREATE INDEX IF NOT EXISTS idx_fuel_station_users_email_lower ON public.fuel_station_users(lower(email));

ALTER TABLE public.fuel_station_users ENABLE ROW LEVEL SECURITY;

-- Gestores da empresa podem gerenciar usuários dos próprios postos
CREATE POLICY "managers manage station users"
  ON public.fuel_station_users FOR ALL
  USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE POLICY "members view station users"
  ON public.fuel_station_users FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

CREATE TRIGGER trg_fsu_set_updated_at BEFORE UPDATE ON public.fuel_station_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. RPC pública para gerar/regerar código (usada pelo app do motorista)
CREATE OR REPLACE FUNCTION public.regenerate_authorization_code(_authorization_id uuid)
RETURNS TABLE (authorization_code text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  a RECORD;
  v_ttl int;
  v_code text;
  v_exp timestamptz;
BEGIN
  SELECT * INTO a FROM public.fuel_authorizations WHERE id = _authorization_id;
  IF a IS NULL THEN RAISE EXCEPTION 'Autorização não encontrada'; END IF;

  IF NOT (
    public.can_manage_fleet(auth.uid(), a.company_id)
    OR a.requested_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = a.driver_id AND d.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF a.status NOT IN ('aprovada','pendente') THEN
    RAISE EXCEPTION 'Autorização não está em estado válido (status=%)', a.status;
  END IF;

  SELECT COALESCE(fuel_auth_code_ttl_minutes,30) INTO v_ttl
    FROM public.companies WHERE id = a.company_id;

  v_code := public.generate_fuel_auth_code();
  v_exp  := now() + make_interval(mins => COALESCE(v_ttl,30));

  UPDATE public.fuel_authorizations
     SET authorization_code = v_code,
         approved_at = COALESCE(approved_at, now()),
         expires_at  = v_exp,
         status = CASE WHEN status = 'pendente' THEN 'aprovada'::fuel_auth_status ELSE status END
   WHERE id = _authorization_id;

  RETURN QUERY SELECT v_code, v_exp;
END;
$function$;

-- 6. RPC usada pelo portal do posto via service-role (mas com validação interna)
CREATE OR REPLACE FUNCTION public.confirm_authorization_by_station(
  _code text,
  _station_id uuid,
  _liters numeric,
  _total_value numeric,
  _receipt_number text,
  _receipt_url text DEFAULT NULL,
  _km_at_fueling integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  a RECORD;
  v_record_id uuid;
  v_anom public.fuel_anomaly[] := '{}';
  v_anom_notes text := NULL;
  v_price numeric;
BEGIN
  IF _code IS NULL OR length(_code) <> 6 THEN
    RAISE EXCEPTION 'Código inválido';
  END IF;
  IF _liters IS NULL OR _liters <= 0 OR _total_value IS NULL OR _total_value <= 0 THEN
    RAISE EXCEPTION 'Litros e valor total são obrigatórios';
  END IF;

  SELECT * INTO a
    FROM public.fuel_authorizations
   WHERE authorization_code = _code
     AND status = 'aprovada'
   ORDER BY approved_at DESC
   LIMIT 1;

  IF a IS NULL THEN RAISE EXCEPTION 'Código não encontrado ou já utilizado'; END IF;
  IF a.expires_at IS NOT NULL AND a.expires_at < now() THEN
    UPDATE public.fuel_authorizations SET status = 'expirada' WHERE id = a.id;
    RAISE EXCEPTION 'Código expirado';
  END IF;
  IF a.fuel_station_id IS NOT NULL AND a.fuel_station_id <> _station_id THEN
    RAISE EXCEPTION 'Código não pertence a este posto';
  END IF;

  v_price := _total_value / _liters;

  IF a.approved_amount IS NOT NULL AND _total_value > a.approved_amount THEN
    v_anom := array_append(v_anom, 'valor_atipico'::public.fuel_anomaly);
    v_anom_notes := format('Valor confirmado R$ %s excede o autorizado R$ %s', _total_value, a.approved_amount);
  END IF;

  INSERT INTO public.fuel_records (
    company_id, vehicle_id, driver_id, fuel_station_id,
    fueled_at, fuel_type, liters, price_per_liter, total_value,
    km_at_fueling, station_name, source_origin, authorization_id,
    anomaly_notes, notes, receipt_url
  )
  SELECT
    a.company_id, a.vehicle_id, a.driver_id, _station_id,
    now(), COALESCE(a.fuel_type,'gasolina')::fuel_type,
    _liters, v_price, _total_value,
    COALESCE(_km_at_fueling, a.km_at_request, 0),
    fs.name, 'posto_portal', a.id,
    v_anom_notes,
    CASE WHEN _receipt_number IS NOT NULL THEN 'Cupom fiscal: ' || _receipt_number ELSE NULL END,
    _receipt_url
  FROM public.fuel_stations fs WHERE fs.id = _station_id
  RETURNING id INTO v_record_id;

  UPDATE public.fuel_authorizations
     SET status = 'utilizada',
         used_at = now(),
         confirmed_at = now(),
         fuel_record_id = v_record_id,
         receipt_total = _total_value
   WHERE id = a.id;

  RETURN v_record_id;
END;
$function$;

-- Permissões: revogar de anon/authenticated; só service role chama
REVOKE ALL ON FUNCTION public.confirm_authorization_by_station(text,uuid,numeric,numeric,text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_authorization_by_station(text,uuid,numeric,numeric,text,text,integer) TO service_role;

-- regenerate é chamado por usuários autenticados (motorista/gestor)
GRANT EXECUTE ON FUNCTION public.regenerate_authorization_code(uuid) TO authenticated;
