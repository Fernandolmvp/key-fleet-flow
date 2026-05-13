UPDATE public.ai_feature_routing
SET fallback_model_id = '380659c3-d32d-4317-bf4c-47e8dc794685',
    updated_at = now()
WHERE feature = 'extract_insurance_policy';