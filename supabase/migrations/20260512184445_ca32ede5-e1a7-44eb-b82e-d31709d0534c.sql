CREATE OR REPLACE FUNCTION public.trg_sync_current_km()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _km integer;
  _row jsonb := to_jsonb(NEW);
  _vehicle_id uuid := (_row->>'vehicle_id')::uuid;
BEGIN
  IF TG_TABLE_NAME = 'fuel_records' THEN
    _km := NULLIF(_row->>'km_at_fueling','')::int;
  ELSIF TG_TABLE_NAME = 'checklist_runs' THEN
    _km := NULLIF(_row->>'km_at_check','')::int;
  ELSIF TG_TABLE_NAME = 'maintenance_records' THEN
    _km := NULLIF(_row->>'km_at_service','')::int;
  END IF;

  IF _km IS NOT NULL AND _vehicle_id IS NOT NULL THEN
    UPDATE public.vehicles
       SET current_km = GREATEST(COALESCE(current_km, 0), _km)
     WHERE id = _vehicle_id;
  END IF;
  RETURN NEW;
END $function$;