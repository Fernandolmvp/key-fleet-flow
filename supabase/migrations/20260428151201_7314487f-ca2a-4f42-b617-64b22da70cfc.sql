-- Backfill km_driven, km_per_liter and cost_per_km using window over previous fueling per vehicle
WITH ordered AS (
  SELECT id, vehicle_id, fueled_at, km_at_fueling, liters, total_value,
         LAG(km_at_fueling) OVER (PARTITION BY vehicle_id ORDER BY fueled_at) AS prev_km
  FROM public.fuel_records
)
UPDATE public.fuel_records f
SET
  km_driven = CASE WHEN o.prev_km IS NOT NULL AND o.km_at_fueling > o.prev_km THEN o.km_at_fueling - o.prev_km ELSE NULL END,
  km_per_liter = CASE WHEN o.prev_km IS NOT NULL AND o.km_at_fueling > o.prev_km AND f.liters > 0
                      THEN ROUND(((o.km_at_fueling - o.prev_km)::numeric / f.liters), 2) ELSE NULL END,
  cost_per_km = CASE WHEN o.prev_km IS NOT NULL AND o.km_at_fueling > o.prev_km AND (o.km_at_fueling - o.prev_km) > 0
                     THEN ROUND((f.total_value / (o.km_at_fueling - o.prev_km)), 3) ELSE NULL END
FROM ordered o
WHERE o.id = f.id;