
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_exempt_from_trial boolean NOT NULL DEFAULT false;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_plan_snapshot text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='trial' AND enumtypid='subscription_status'::regtype) THEN
    ALTER TYPE subscription_status ADD VALUE 'trial';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='expirada' AND enumtypid='subscription_status'::regtype) THEN
    ALTER TYPE subscription_status ADD VALUE 'expirada';
  END IF;
END $$;

UPDATE public.companies
   SET is_exempt_from_trial = true
 WHERE regexp_replace(coalesce(cnpj,''),'[^0-9]','','g') = '05902512000102';
