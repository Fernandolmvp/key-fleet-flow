
REVOKE EXECUTE ON FUNCTION public.apply_stripe_subscription(uuid,text,text,text,text,timestamptz,timestamptz,boolean,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_stripe_payment(uuid,numeric,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_subscription(uuid,text,text,text,text,timestamptz,timestamptz,boolean,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_stripe_payment(uuid,numeric,text,text,timestamptz) TO service_role;
