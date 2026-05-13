UPDATE public.ai_feature_routing
SET primary_model_id='bfc3760b-27f5-4682-998d-e7346dc0fa4f',
    fallback_model_id='fd46d44e-1234-4c0b-beef-980085fd5b3e',
    updated_at=now()
WHERE feature='extract_insurance_policy';