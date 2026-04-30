-- 1) Adiciona campos ao driver
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- 2) Tabela de códigos OTP
CREATE TABLE IF NOT EXISTS public.driver_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  company_id uuid NOT NULL,
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driver_otp_active ON public.driver_otp_codes(driver_id, consumed_at, expires_at);

ALTER TABLE public.driver_otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers view otp codes"
ON public.driver_otp_codes FOR SELECT
USING (public.can_manage_fleet(auth.uid(), company_id));

-- (Sem policies de INSERT/UPDATE/DELETE para usuários — apenas service role nas edge functions)

-- 3) Tabela de tentativas de onboarding (CPF + data nasc.)
CREATE TABLE IF NOT EXISTS public.driver_onboarding_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text NOT NULL,
  ip text,
  success boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_attempts_cpf ON public.driver_onboarding_attempts(cpf, attempted_at DESC);

ALTER TABLE public.driver_onboarding_attempts ENABLE ROW LEVEL SECURITY;
-- Sem policies — somente service role acessa.