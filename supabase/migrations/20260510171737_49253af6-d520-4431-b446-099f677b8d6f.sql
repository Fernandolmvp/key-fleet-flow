
-- ============== ai_providers ==============
CREATE TABLE public.ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  api_endpoint text,
  secret_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin manages ai_providers" ON public.ai_providers
  FOR ALL USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_ai_providers_updated_at
  BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.ai_providers (name, code, description, api_endpoint, secret_name, active, priority) VALUES
  ('Lovable AI Gateway', 'lovable', 'Gateway interno via Lovable Cloud', 'https://ai.gateway.lovable.dev/v1', 'LOVABLE_API_KEY', true, 10),
  ('Google Gemini', 'gemini', 'Google Generative Language API direta', 'https://generativelanguage.googleapis.com/v1beta', 'GEMINI_API_KEY', true, 20),
  ('Anthropic Claude', 'claude', 'API direta da Anthropic', 'https://api.anthropic.com/v1', 'ANTHROPIC_API_KEY', false, 30),
  ('OpenAI GPT', 'openai', 'API direta da OpenAI', 'https://api.openai.com/v1', 'OPENAI_API_KEY', false, 40);

-- ============== ai_models ==============
CREATE TABLE public.ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  model_id text NOT NULL,
  display_name text NOT NULL,
  type text NOT NULL CHECK (type IN ('vision','text','multimodal')),
  input_cost_per_1k_tokens numeric(10,6) NOT NULL DEFAULT 0,
  output_cost_per_1k_tokens numeric(10,6) NOT NULL DEFAULT 0,
  max_tokens integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, model_id)
);
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin manages ai_models" ON public.ai_models
  FOR ALL USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_ai_models_updated_at
  BEFORE UPDATE ON public.ai_models
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.ai_models (provider_id, model_id, display_name, type, input_cost_per_1k_tokens, output_cost_per_1k_tokens, max_tokens, active)
SELECT p.id, m.model_id, m.display_name, m.type, m.in_cost, m.out_cost, m.max_tok, true
FROM public.ai_providers p
JOIN (VALUES
  ('gemini',  'gemini-2.5-flash',         'Gemini 2.5 Flash (direto)', 'multimodal', 0.000075, 0.000300, 8192),
  ('gemini',  'gemini-2.5-pro',           'Gemini 2.5 Pro (direto)',   'multimodal', 0.001250, 0.005000, 8192),
  ('lovable', 'google/gemini-2.5-flash',  'Gemini 2.5 Flash (Lovable)','multimodal', 0.000000, 0.000000, 8192),
  ('lovable', 'google/gemini-2.5-pro',    'Gemini 2.5 Pro (Lovable)',  'multimodal', 0.000000, 0.000000, 8192)
) AS m(provider_code, model_id, display_name, type, in_cost, out_cost, max_tok)
ON p.code = m.provider_code;

-- ============== ai_feature_routing ==============
CREATE TABLE public.ai_feature_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature text NOT NULL UNIQUE,
  primary_model_id uuid NOT NULL REFERENCES public.ai_models(id),
  fallback_model_id uuid REFERENCES public.ai_models(id),
  estimated_tokens integer NOT NULL DEFAULT 1000,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_feature_routing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin manages ai_feature_routing" ON public.ai_feature_routing
  FOR ALL USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_ai_feature_routing_updated_at
  BEFORE UPDATE ON public.ai_feature_routing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

WITH
  gem_flash AS (SELECT m.id FROM public.ai_models m JOIN public.ai_providers p ON p.id=m.provider_id WHERE p.code='gemini'  AND m.model_id='gemini-2.5-flash'),
  gem_pro   AS (SELECT m.id FROM public.ai_models m JOIN public.ai_providers p ON p.id=m.provider_id WHERE p.code='gemini'  AND m.model_id='gemini-2.5-pro'),
  lov_flash AS (SELECT m.id FROM public.ai_models m JOIN public.ai_providers p ON p.id=m.provider_id WHERE p.code='lovable' AND m.model_id='google/gemini-2.5-flash'),
  lov_pro   AS (SELECT m.id FROM public.ai_models m JOIN public.ai_providers p ON p.id=m.provider_id WHERE p.code='lovable' AND m.model_id='google/gemini-2.5-pro')
INSERT INTO public.ai_feature_routing (feature, primary_model_id, fallback_model_id, estimated_tokens)
VALUES
  ('extract_insurance_policy', (SELECT id FROM gem_pro),   (SELECT id FROM lov_pro),   8000),
  ('review_insurance_policy',  (SELECT id FROM gem_pro),   (SELECT id FROM lov_pro),   8000),
  ('crlv',                     (SELECT id FROM gem_flash), (SELECT id FROM lov_flash), 1500),
  ('cnh',                      (SELECT id FROM gem_flash), (SELECT id FROM lov_flash), 1500),
  ('leitura_placa',            (SELECT id FROM gem_flash), (SELECT id FROM lov_flash),  800),
  ('leitura_hodometro',        (SELECT id FROM gem_flash), (SELECT id FROM lov_flash),  800),
  ('nota_manutencao',          (SELECT id FROM gem_flash), (SELECT id FROM lov_flash), 2500),
  ('nota_pneu',                (SELECT id FROM gem_flash), (SELECT id FROM lov_flash), 2500),
  ('cupom_fiscal',             (SELECT id FROM gem_flash), (SELECT id FROM lov_flash), 2500),
  ('documento_generico',       (SELECT id FROM gem_flash), (SELECT id FROM lov_flash), 2000),
  ('extract_document',         (SELECT id FROM gem_flash), (SELECT id FROM lov_flash), 2000);

-- ============== ai_usage_logs: novas colunas opcionais ==============
ALTER TABLE public.ai_usage_logs
  ADD COLUMN provider_id uuid REFERENCES public.ai_providers(id),
  ADD COLUMN model_id_used uuid REFERENCES public.ai_models(id),
  ADD COLUMN was_fallback boolean NOT NULL DEFAULT false,
  ADD COLUMN response_time_ms integer;

-- ============== RPC get_routing_for_feature ==============
CREATE OR REPLACE FUNCTION public.get_routing_for_feature(_feature text)
RETURNS TABLE (
  feature text,
  estimated_tokens integer,
  primary_provider_id uuid,
  primary_provider_code text,
  primary_provider_secret text,
  primary_provider_endpoint text,
  primary_model_id uuid,
  primary_model_code text,
  primary_model_type text,
  fallback_provider_id uuid,
  fallback_provider_code text,
  fallback_provider_secret text,
  fallback_provider_endpoint text,
  fallback_model_id uuid,
  fallback_model_code text,
  fallback_model_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.feature,
    r.estimated_tokens,
    pp.id, pp.code, pp.secret_name, pp.api_endpoint,
    pm.id, pm.model_id, pm.type,
    fp.id, fp.code, fp.secret_name, fp.api_endpoint,
    fm.id, fm.model_id, fm.type
  FROM public.ai_feature_routing r
  JOIN public.ai_models pm    ON pm.id = r.primary_model_id
  JOIN public.ai_providers pp ON pp.id = pm.provider_id AND pp.active = true
  LEFT JOIN public.ai_models fm    ON fm.id = r.fallback_model_id AND fm.active = true
  LEFT JOIN public.ai_providers fp ON fp.id = fm.provider_id      AND fp.active = true
  WHERE r.feature = _feature
    AND r.active = true
    AND pm.active = true
  LIMIT 1;
$$;
