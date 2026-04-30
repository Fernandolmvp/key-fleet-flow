UPDATE public.vehicles v
SET
  insurer = sub.insurer_name,
  insurance_policy = sub.policy_number,
  insurance_expires_at = sub.end_date,
  insurance_responsible = sub.broker_name
FROM (
  SELECT DISTINCT ON (ipv.vehicle_id)
    ipv.vehicle_id,
    p.insurer_name,
    p.policy_number,
    p.end_date,
    b.name AS broker_name
  FROM public.insurance_policy_vehicles ipv
  JOIN public.insurance_policies p ON p.id = ipv.policy_id
  LEFT JOIN public.insurance_brokers b ON b.id = p.broker_id
  WHERE ipv.removed_at IS NULL AND p.status = 'ativa'
  ORDER BY ipv.vehicle_id, p.end_date DESC NULLS LAST
) sub
WHERE v.id = sub.vehicle_id;