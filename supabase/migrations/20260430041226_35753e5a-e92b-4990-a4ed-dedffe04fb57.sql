-- =========================================================
-- MÓDULO CHECKLIST PROFISSIONAL
-- =========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.checklist_question_type AS ENUM (
    'sim_nao','multipla_escolha','numero','texto','foto','assinatura'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.checklist_frequency AS ENUM (
    'unico','diario','semanal','mensal','trimestral','semestral','anual'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.checklist_run_status AS ENUM (
    'pendente','em_andamento','concluido','reprovado','cancelado'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.checklist_answer_status AS ENUM (
    'conforme','nao_conforme','nao_aplicavel','pendente'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Templates
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  frequency public.checklist_frequency NOT NULL DEFAULT 'mensal',
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  auto_open_os boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view checklist templates" ON public.checklist_templates
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write checklist templates" ON public.checklist_templates
  FOR ALL USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE TRIGGER tg_checklist_templates_updated
  BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Perguntas dos templates
CREATE TABLE IF NOT EXISTS public.checklist_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  category text,
  label text NOT NULL,
  help_text text,
  question_type public.checklist_question_type NOT NULL DEFAULT 'sim_nao',
  options jsonb NOT NULL DEFAULT '[]'::jsonb, -- p/ múltipla escolha
  required boolean NOT NULL DEFAULT true,
  require_photo_when_fail boolean NOT NULL DEFAULT true,
  require_note_when_fail boolean NOT NULL DEFAULT true,
  min_value numeric,
  max_value numeric,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checklist_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view checklist questions" ON public.checklist_questions
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write checklist questions" ON public.checklist_questions
  FOR ALL USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE INDEX IF NOT EXISTS idx_checklist_questions_template ON public.checklist_questions(template_id, sort_order);

CREATE TRIGGER tg_checklist_questions_updated
  BEFORE UPDATE ON public.checklist_questions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Execuções (runs)
CREATE TABLE IF NOT EXISTS public.checklist_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL,
  driver_id uuid,
  reference_month date, -- 1º dia do mês de referência
  due_date date,
  status public.checklist_run_status NOT NULL DEFAULT 'pendente',
  km_at_check integer,
  total_items integer NOT NULL DEFAULT 0,
  conform_items integer NOT NULL DEFAULT 0,
  non_conform_items integer NOT NULL DEFAULT 0,
  na_items integer NOT NULL DEFAULT 0,
  score numeric, -- 0..100
  signature_url text,
  signed_by_name text,
  notes text,
  generated_maintenance_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checklist_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view checklist runs" ON public.checklist_runs
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write checklist runs" ON public.checklist_runs
  FOR ALL USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE INDEX IF NOT EXISTS idx_checklist_runs_company ON public.checklist_runs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_checklist_runs_vehicle ON public.checklist_runs(vehicle_id, reference_month);

CREATE TRIGGER tg_checklist_runs_updated
  BEFORE UPDATE ON public.checklist_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Respostas
CREATE TABLE IF NOT EXISTS public.checklist_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.checklist_runs(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.checklist_questions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  -- snapshot da pergunta (para histórico imutável)
  question_label text NOT NULL,
  question_category text,
  question_type public.checklist_question_type NOT NULL,
  -- valores
  value_text text,
  value_number numeric,
  value_bool boolean,
  value_choice text,
  photo_urls text[] NOT NULL DEFAULT '{}',
  signature_url text,
  status public.checklist_answer_status NOT NULL DEFAULT 'pendente',
  notes text,
  answered_at timestamptz,
  answered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checklist_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view checklist answers" ON public.checklist_answers
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write checklist answers" ON public.checklist_answers
  FOR ALL USING (public.can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (public.can_manage_fleet(auth.uid(), company_id));

CREATE INDEX IF NOT EXISTS idx_checklist_answers_run ON public.checklist_answers(run_id);

CREATE TRIGGER tg_checklist_answers_updated
  BEFORE UPDATE ON public.checklist_answers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Função: recalcular totais do run
CREATE OR REPLACE FUNCTION public.tg_checklist_recalc_run()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r_id uuid;
  v_total int; v_ok int; v_nok int; v_na int;
BEGIN
  r_id := COALESCE(NEW.run_id, OLD.run_id);
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status='conforme'),
         COUNT(*) FILTER (WHERE status='nao_conforme'),
         COUNT(*) FILTER (WHERE status='nao_aplicavel')
    INTO v_total, v_ok, v_nok, v_na
    FROM public.checklist_answers WHERE run_id = r_id;
  UPDATE public.checklist_runs SET
    total_items = v_total,
    conform_items = v_ok,
    non_conform_items = v_nok,
    na_items = v_na,
    score = CASE WHEN (v_total - v_na) > 0
                 THEN ROUND((v_ok::numeric / (v_total - v_na)) * 100, 2)
                 ELSE NULL END
  WHERE id = r_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_recalc_run_ai ON public.checklist_answers;
CREATE TRIGGER tg_recalc_run_ai
  AFTER INSERT OR UPDATE OR DELETE ON public.checklist_answers
  FOR EACH ROW EXECUTE FUNCTION public.tg_checklist_recalc_run();

-- Função: ao concluir run reprovado, abre OS de manutenção corretiva
CREATE OR REPLACE FUNCTION public.tg_checklist_open_os_on_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_template RECORD;
  v_desc text;
  v_os_id uuid;
BEGIN
  IF NEW.status IN ('concluido','reprovado')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.non_conform_items > 0
     AND NEW.generated_maintenance_id IS NULL THEN
    SELECT * INTO v_template FROM public.checklist_templates WHERE id = NEW.template_id;
    IF v_template.auto_open_os THEN
      SELECT string_agg('• ' || question_label || COALESCE(' — ' || notes, ''), E'\n')
        INTO v_desc
        FROM public.checklist_answers
        WHERE run_id = NEW.id AND status = 'nao_conforme';
      INSERT INTO public.maintenance_records (
        company_id, vehicle_id, driver_id, type, category, status,
        service_at, km_at_service, description, notes, created_by
      ) VALUES (
        NEW.company_id, NEW.vehicle_id, NEW.driver_id,
        'corretiva'::maintenance_type, 'Outros', 'agendada'::maintenance_status,
        now(), NEW.km_at_check,
        'OS aberta automaticamente pelo Checklist: ' || v_template.name,
        COALESCE(v_desc, 'Itens não conformes detectados no checklist.'),
        NEW.created_by
      ) RETURNING id INTO v_os_id;
      NEW.generated_maintenance_id := v_os_id;
      IF NEW.status = 'concluido' AND NEW.non_conform_items > 0 THEN
        NEW.status := 'reprovado';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_open_os_bu ON public.checklist_runs;
CREATE TRIGGER tg_open_os_bu
  BEFORE UPDATE ON public.checklist_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_checklist_open_os_on_complete();

-- Storage bucket para fotos/assinaturas do checklist
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklist-media', 'checklist-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "checklist media public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'checklist-media');
CREATE POLICY "auth upload checklist media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'checklist-media' AND auth.uid() IS NOT NULL);
CREATE POLICY "auth update checklist media" ON storage.objects
  FOR UPDATE USING (bucket_id = 'checklist-media' AND auth.uid() IS NOT NULL);
CREATE POLICY "auth delete checklist media" ON storage.objects
  FOR DELETE USING (bucket_id = 'checklist-media' AND auth.uid() IS NOT NULL);
