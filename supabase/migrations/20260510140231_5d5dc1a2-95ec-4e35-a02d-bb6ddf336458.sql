DROP INDEX IF EXISTS public.ai_usage_logs_request_id_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_logs_request_id_uniq
ON public.ai_usage_logs (request_id);

CREATE OR REPLACE FUNCTION public.consume_ai_tokens(
  _company_id uuid,
  _user_id uuid,
  _tokens_used integer,
  _feature text,
  _model text DEFAULT NULL::text,
  _tokens_input integer DEFAULT 0,
  _tokens_output integer DEFAULT 0,
  _success boolean DEFAULT true,
  _error text DEFAULT NULL::text,
  _request_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  b RECORD;
  from_plan int := 0;
  from_extra int := 0;
  src text;
  existing RECORD;
BEGIN
  IF _tokens_used IS NULL OR _tokens_used < 0 THEN _tokens_used := 0; END IF;

  IF _request_id IS NOT NULL THEN
    SELECT * INTO existing FROM public.ai_usage_logs WHERE request_id = _request_id LIMIT 1;
    IF existing.id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'idempotent', true, 'source', existing.source);
    END IF;
  END IF;

  INSERT INTO public.ai_token_balance (company_id) VALUES (_company_id)
    ON CONFLICT (company_id) DO NOTHING;

  SELECT * INTO b FROM public.ai_token_balance WHERE company_id = _company_id FOR UPDATE;

  IF (COALESCE(b.plan_tokens_remaining, 0) + COALESCE(b.extra_tokens_balance, 0)) < _tokens_used THEN
    INSERT INTO public.ai_usage_logs(
      company_id, user_id, feature, model, tokens_input, tokens_output, tokens_total, source, success, error_message, request_id
    )
    VALUES (
      _company_id, _user_id, _feature, _model, _tokens_input, _tokens_output, _tokens_used, 'blocked', false, 'insufficient_tokens', _request_id
    )
    ON CONFLICT (request_id) DO NOTHING;

    RAISE EXCEPTION 'insufficient_tokens';
  END IF;

  IF COALESCE(b.plan_tokens_remaining, 0) >= _tokens_used THEN
    from_plan := _tokens_used;
    src := 'plan';
  ELSE
    from_plan := COALESCE(b.plan_tokens_remaining, 0);
    from_extra := _tokens_used - from_plan;
    src := CASE WHEN from_plan > 0 THEN 'mixed' ELSE 'extra' END;
  END IF;

  UPDATE public.ai_token_balance
     SET plan_tokens_remaining = plan_tokens_remaining - from_plan,
         extra_tokens_balance  = extra_tokens_balance  - from_extra,
         updated_at = now()
   WHERE company_id = _company_id;

  INSERT INTO public.ai_usage_logs(
    company_id, user_id, feature, model, tokens_input, tokens_output, tokens_total, source, success, error_message, request_id
  )
  VALUES (
    _company_id, _user_id, _feature, _model, _tokens_input, _tokens_output, _tokens_used, src, _success, _error, _request_id
  )
  ON CONFLICT (request_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'from_plan', from_plan, 'from_extra', from_extra, 'source', src);
END
$function$;