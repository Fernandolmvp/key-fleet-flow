ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address_complement text;
COMMENT ON COLUMN public.companies.address_number IS 'Número do endereço (ex: 123, s/n, 100-A)';
COMMENT ON COLUMN public.companies.address_complement IS 'Complemento (apto, sala, bloco, etc)';

ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS address_complement text;
COMMENT ON COLUMN public.drivers.address_number IS 'Número do endereço (ex: 123, s/n, 100-A)';
COMMENT ON COLUMN public.drivers.address_complement IS 'Complemento (apto, sala, bloco, etc)';

ALTER TABLE public.fuel_stations ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE public.fuel_stations ADD COLUMN IF NOT EXISTS address_complement text;
COMMENT ON COLUMN public.fuel_stations.address_number IS 'Número do endereço (ex: 123, s/n, 100-A)';
COMMENT ON COLUMN public.fuel_stations.address_complement IS 'Complemento (apto, sala, bloco, etc)';

ALTER TABLE public.insurance_brokers ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE public.insurance_brokers ADD COLUMN IF NOT EXISTS address_complement text;
COMMENT ON COLUMN public.insurance_brokers.address_number IS 'Número do endereço (ex: 123, s/n, 100-A)';
COMMENT ON COLUMN public.insurance_brokers.address_complement IS 'Complemento (apto, sala, bloco, etc)';