CREATE TABLE public.agent_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_api_keys TO authenticated;
GRANT ALL ON public.agent_api_keys TO service_role;
ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company admins manage agent keys" ON public.agent_api_keys
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'admin'))
  WITH CHECK (public.has_role(auth.uid(), company_id, 'admin'));
CREATE INDEX agent_api_keys_company_idx ON public.agent_api_keys(company_id, created_at DESC);
CREATE INDEX agent_api_keys_active_hash_idx ON public.agent_api_keys(key_hash) WHERE revoked_at IS NULL;

CREATE TABLE public.agent_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  ok boolean NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agent_actions_log TO authenticated;
GRANT ALL ON public.agent_actions_log TO service_role;
ALTER TABLE public.agent_actions_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company admins read agent actions" ON public.agent_actions_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'admin'));
CREATE INDEX agent_actions_log_company_created_idx ON public.agent_actions_log(company_id, created_at DESC);

CREATE TABLE public.agent_runtime_status (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  whatsapp_status text NOT NULL DEFAULT 'desligado' CHECK (whatsapp_status IN ('desligado','instalando','iniciando','aguardando_qr','conectado','reconectando','erro')),
  whatsapp_qr text,
  whatsapp_numero text,
  whatsapp_erro text,
  telegram_bot text,
  claude_ok boolean,
  estatisticas jsonb NOT NULL DEFAULT '{}'::jsonb,
  versao text,
  last_seen_at timestamptz,
  pending_command text CHECK (pending_command IS NULL OR pending_command IN ('ligar','desligar','trocar_numero','reenviar_pendentes')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agent_runtime_status TO authenticated;
GRANT UPDATE (pending_command) ON public.agent_runtime_status TO authenticated;
GRANT ALL ON public.agent_runtime_status TO service_role;
ALTER TABLE public.agent_runtime_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company members read agent runtime" ON public.agent_runtime_status
  FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "company admins send agent commands" ON public.agent_runtime_status
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), company_id, 'admin'))
  WITH CHECK (public.has_role(auth.uid(), company_id, 'admin'));

CREATE TABLE public.agent_rate_limits (
  key_id uuid PRIMARY KEY REFERENCES public.agent_api_keys(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL
);
ALTER TABLE public.agent_rate_limits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.agent_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.agent_api_rate_limit(p_key_id uuid, p_limit integer DEFAULT 120)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.agent_rate_limits (key_id, window_started_at, request_count)
  VALUES (p_key_id, now(), 1)
  ON CONFLICT (key_id) DO UPDATE SET
    window_started_at = CASE
      WHEN public.agent_rate_limits.window_started_at <= now() - interval '1 minute' THEN now()
      ELSE public.agent_rate_limits.window_started_at
    END,
    request_count = CASE
      WHEN public.agent_rate_limits.window_started_at <= now() - interval '1 minute' THEN 1
      ELSE public.agent_rate_limits.request_count + 1
    END
  RETURNING request_count INTO v_count;
  RETURN v_count <= p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_api_rate_limit(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_api_rate_limit(uuid, integer) TO service_role;

ALTER TABLE public.vehicles ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.drivers ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.fuel_records ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.maintenance_requests ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.trip_expenses ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.fuel_authorizations ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.maintenance_schedules ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.maintenance_work_orders ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.maintenance_records ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.traffic_fines ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.vehicle_expenses ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.documents ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.checklist_templates ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.checklist_questions ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.checklist_runs ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.checklist_answers ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.tires ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.tire_movements ADD COLUMN source text NOT NULL DEFAULT 'manual';
