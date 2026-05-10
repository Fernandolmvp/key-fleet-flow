CREATE UNIQUE INDEX IF NOT EXISTS insurance_policies_unique_manual
  ON public.insurance_policies (company_id, policy_number, insurer_name)
  WHERE ai_extracted = '{}'::jsonb;