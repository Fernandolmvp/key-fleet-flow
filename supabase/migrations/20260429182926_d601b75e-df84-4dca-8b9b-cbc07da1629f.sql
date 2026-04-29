-- 1) Novos campos no cadastro do motorista
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS auto_fuel_authorized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manager_user_id uuid;

-- 2) Trigger BEFORE INSERT em fuel_authorizations: auto-aprova se o driver vinculado
--    ao usuário solicitante tiver auto_fuel_authorized = true.
CREATE OR REPLACE FUNCTION public.tg_fuel_auth_auto_approve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d RECORD;
BEGIN
  -- Resolve driver: o passado, ou o vinculado ao usuário solicitante na empresa
  IF NEW.driver_id IS NOT NULL THEN
    SELECT * INTO d FROM public.drivers WHERE id = NEW.driver_id;
  ELSE
    SELECT * INTO d
      FROM public.drivers
     WHERE company_id = NEW.company_id
       AND user_id = NEW.requested_by
     LIMIT 1;
    IF d.id IS NOT NULL THEN
      NEW.driver_id := d.id;
    END IF;
  END IF;

  IF NEW.status = 'pendente' AND d.id IS NOT NULL AND COALESCE(d.auto_fuel_authorized, false) = true THEN
    NEW.status := 'aprovada';
    NEW.approved_by := COALESCE(NEW.approved_by, NEW.requested_by);
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    NEW.expires_at := COALESCE(NEW.expires_at, now() + interval '24 hours');
    NEW.authorization_code := COALESCE(NEW.authorization_code, public.generate_fuel_auth_code());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fuel_auth_auto_approve ON public.fuel_authorizations;
CREATE TRIGGER trg_fuel_auth_auto_approve
BEFORE INSERT ON public.fuel_authorizations
FOR EACH ROW EXECUTE FUNCTION public.tg_fuel_auth_auto_approve();

-- 3) Garante que o trigger de approve (já existente) também roda em INSERT (caso status='aprovada' venha já no insert)
DROP TRIGGER IF EXISTS trg_fuel_auth_on_approve ON public.fuel_authorizations;
CREATE TRIGGER trg_fuel_auth_on_approve
BEFORE INSERT OR UPDATE ON public.fuel_authorizations
FOR EACH ROW EXECUTE FUNCTION public.tg_fuel_auth_on_approve();