-- Helper: detecta se uma apólice é "extraída por IA"
CREATE OR REPLACE FUNCTION public.is_ai_policy(_policy_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.insurance_policies
    WHERE id = _policy_id
      AND ai_extracted IS NOT NULL
      AND ai_extracted <> '{}'::jsonb
  )
$$;

-- Trigger 1: bloqueia INSERT/UPDATE/DELETE em insurance_policy_vehicles para apólices da IA
CREATE OR REPLACE FUNCTION public.tg_ipv_block_ai_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_policy := NEW.policy_id;
    IF public.is_ai_policy(v_policy) THEN
      RAISE EXCEPTION 'Apólice importada via IA — não é permitido adicionar vínculos manualmente.';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Permite somente o sync interno (sem mudança de policy_id/vehicle_id/inclusion_type),
    -- mas bloqueia "ressuscitar" um vínculo (removed_at IS NULL após estar setado) em apólice da IA.
    IF public.is_ai_policy(NEW.policy_id) THEN
      IF NEW.policy_id IS DISTINCT FROM OLD.policy_id
         OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
         OR NEW.inclusion_type IS DISTINCT FROM OLD.inclusion_type THEN
        RAISE EXCEPTION 'Apólice importada via IA — não é permitido alterar vínculos.';
      END IF;
      IF OLD.removed_at IS NOT NULL AND NEW.removed_at IS NULL THEN
        RAISE EXCEPTION 'Apólice importada via IA — não é permitido reativar vínculos removidos.';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF public.is_ai_policy(OLD.policy_id) THEN
      RAISE EXCEPTION 'Apólice importada via IA — não é permitido excluir vínculos. Use remoção lógica somente em apólices manuais.';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tg_ipv_block_ai_changes ON public.insurance_policy_vehicles;
CREATE TRIGGER tg_ipv_block_ai_changes
BEFORE INSERT OR UPDATE OR DELETE ON public.insurance_policy_vehicles
FOR EACH ROW EXECUTE FUNCTION public.tg_ipv_block_ai_changes();

-- Trigger 2: bloqueia alteração dos campos extraídos da apólice quando ai_extracted está preenchido
CREATE OR REPLACE FUNCTION public.tg_ip_block_ai_field_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só protege quando a apólice é da IA (campo ai_extracted preenchido em OLD)
  IF OLD.ai_extracted IS NULL OR OLD.ai_extracted = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  IF NEW.policy_number IS DISTINCT FROM OLD.policy_number
     OR NEW.insurer_name IS DISTINCT FROM OLD.insurer_name
     OR NEW.insurer_phone IS DISTINCT FROM OLD.insurer_phone
     OR NEW.insurer_email IS DISTINCT FROM OLD.insurer_email
     OR NEW.start_date IS DISTINCT FROM OLD.start_date
     OR NEW.end_date IS DISTINCT FROM OLD.end_date
     OR NEW.total_value IS DISTINCT FROM OLD.total_value
     OR NEW.deductible IS DISTINCT FROM OLD.deductible
     OR NEW.coverage_summary IS DISTINCT FROM OLD.coverage_summary
     OR NEW.coverage_type IS DISTINCT FROM OLD.coverage_type
     OR NEW.ai_extracted IS DISTINCT FROM OLD.ai_extracted
     OR NEW.file_url IS DISTINCT FROM OLD.file_url
     OR NEW.file_name IS DISTINCT FROM OLD.file_name THEN
    RAISE EXCEPTION 'Apólice importada via IA — campos extraídos do PDF são somente leitura.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_ip_block_ai_field_changes ON public.insurance_policies;
CREATE TRIGGER tg_ip_block_ai_field_changes
BEFORE UPDATE ON public.insurance_policies
FOR EACH ROW EXECUTE FUNCTION public.tg_ip_block_ai_field_changes();