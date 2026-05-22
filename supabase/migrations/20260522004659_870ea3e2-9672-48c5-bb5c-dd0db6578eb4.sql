CREATE TABLE public.first_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_first_access_tokens_token ON public.first_access_tokens(token);
CREATE INDEX idx_first_access_tokens_user ON public.first_access_tokens(user_id);

ALTER TABLE public.first_access_tokens ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write; no policies for anon/authenticated.
CREATE POLICY "Service role manages first_access_tokens"
  ON public.first_access_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');