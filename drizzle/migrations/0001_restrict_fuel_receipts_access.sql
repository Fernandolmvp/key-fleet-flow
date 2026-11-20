CREATE OR REPLACE FUNCTION public.can_access_fuel_receipt(_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  caller uuid := auth.uid();
  parts text[] := pg_catalog.string_to_array(_name, '/');
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  company uuid;
  station uuid;
  receipt_authorization uuid;
BEGIN
  IF caller IS NULL OR _name IS NULL OR _name = ''
     OR '' = ANY(parts) OR '.' = ANY(parts) OR '..' = ANY(parts) THEN
    RETURN false;
  END IF;

  IF parts[1] = 'posto' THEN
    IF pg_catalog.array_length(parts, 1) <> 3
       OR parts[2] !~* uuid_pattern
       OR pg_catalog.left(parts[3], 36) !~* uuid_pattern
       OR pg_catalog.substring(parts[3], 37) !~ '^-[0-9]+-.+' THEN
      RETURN false;
    END IF;
    station := parts[2]::uuid;
    receipt_authorization := pg_catalog.left(parts[3], 36)::uuid;
    RETURN EXISTS (
      SELECT 1
      FROM public.fuel_authorizations a
      JOIN public.fuel_stations s ON s.id = station AND s.company_id = a.company_id
      WHERE a.id = receipt_authorization
        AND (a.fuel_station_id = station OR a.fuel_station_id IS NULL)
        AND (
          public.is_company_member(caller, a.company_id)
          OR EXISTS (
            SELECT 1 FROM public.drivers d
            WHERE d.id = a.driver_id AND d.company_id = a.company_id AND d.user_id = caller
          )
          OR EXISTS (
            SELECT 1 FROM public.fuel_station_users u
            WHERE u.id = caller AND u.station_id = station
              AND u.company_id = a.company_id AND u.active
          )
        )
    );
  END IF;

  IF pg_catalog.array_length(parts, 1) < 2 OR parts[1] !~* uuid_pattern THEN
    RETURN false;
  END IF;
  company := parts[1]::uuid;
  RETURN public.is_company_member(caller, company)
    OR EXISTS (
      SELECT 1 FROM public.drivers d WHERE d.user_id = caller AND d.company_id = company
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.can_access_fuel_receipt(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_fuel_receipt(text) TO authenticated, service_role;

ALTER POLICY "fuel receipts read company scoped" ON storage.objects
USING (bucket_id = 'fuel-receipts' AND public.can_access_fuel_receipt(name));

ALTER POLICY "fuel receipts write company scoped" ON storage.objects
WITH CHECK (bucket_id = 'fuel-receipts' AND public.can_access_fuel_receipt(name));

ALTER POLICY "fuel receipts update company scoped" ON storage.objects
USING (bucket_id = 'fuel-receipts' AND public.can_access_fuel_receipt(name))
WITH CHECK (bucket_id = 'fuel-receipts' AND public.can_access_fuel_receipt(name));