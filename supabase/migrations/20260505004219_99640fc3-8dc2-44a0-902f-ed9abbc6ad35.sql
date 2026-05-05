ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS email        text,
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS address      text,
  ADD COLUMN IF NOT EXISTS city         text,
  ADD COLUMN IF NOT EXISTS state        text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS status       text NOT NULL DEFAULT 'ativa';

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_status_check;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_status_check
  CHECK (status IN ('ativa','suspensa','cancelada'));

DROP VIEW IF EXISTS public.company_usage;
CREATE VIEW public.company_usage AS
SELECT
  c.id            AS company_id,
  c.name          AS company_name,
  c.cnpj,
  c.email,
  c.contact_name,
  c.created_at    AS company_created_at,
  s.id            AS subscription_id,
  s.status        AS subscription_status,
  s.current_period_end,
  s.monthly_amount,
  s.suspended_at,
  s.cancelled_at,
  p.id            AS plan_id,
  p.slug          AS plan_slug,
  p.name          AS plan_name,
  COALESCE(s.custom_vehicle_limit, p.vehicle_limit) AS vehicle_limit,
  (SELECT count(*) FROM public.vehicles v        WHERE v.company_id  = c.id) AS vehicles_used,
  (SELECT count(*) FROM public.drivers d         WHERE d.company_id  = c.id) AS drivers_count,
  (SELECT count(*) FROM public.company_members m WHERE m.company_id  = c.id) AS members_count,
  (SELECT max(sp.paid_at) FROM public.subscription_payments sp WHERE sp.company_id = c.id) AS last_payment_at
FROM public.companies c
LEFT JOIN public.subscriptions s ON s.company_id = c.id
LEFT JOIN public.plans p ON p.id = s.plan_id;