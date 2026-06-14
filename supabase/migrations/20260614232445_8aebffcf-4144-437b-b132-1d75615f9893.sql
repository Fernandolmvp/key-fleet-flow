
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'vehicles','drivers','fuel_stations','fuel_records','workshops','suppliers',
    'maintenance_records','maintenance_schedules','maintenance_requests','maintenance_work_orders',
    'work_order_messages','trips','trip_expenses','trip_advances','trip_reimbursements',
    'traffic_fines','documents','insurance_policies','insurance_policy_vehicles',
    'checklist_runs','vehicle_incidents','vehicle_movements','tires','tire_movements',
    'fuel_authorizations','fuel_authorization_items','driver_notifications'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
             WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
