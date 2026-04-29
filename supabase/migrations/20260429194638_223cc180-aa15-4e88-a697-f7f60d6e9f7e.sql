ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS licensing_year integer,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS crlv_issue_date date,
  ADD COLUMN IF NOT EXISTS crlv_city text;