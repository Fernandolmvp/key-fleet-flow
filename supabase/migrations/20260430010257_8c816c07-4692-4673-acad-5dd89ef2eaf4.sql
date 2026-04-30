ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS sale_notary text,
  ADD COLUMN IF NOT EXISTS sale_city text,
  ADD COLUMN IF NOT EXISTS sale_state text,
  ADD COLUMN IF NOT EXISTS sale_payment_method text,
  ADD COLUMN IF NOT EXISTS sale_notes text,
  ADD COLUMN IF NOT EXISTS sale_contract_url text,
  ADD COLUMN IF NOT EXISTS buyer_phone text,
  ADD COLUMN IF NOT EXISTS buyer_email text,
  ADD COLUMN IF NOT EXISTS buyer_address text,
  ADD COLUMN IF NOT EXISTS inactive_notes text;