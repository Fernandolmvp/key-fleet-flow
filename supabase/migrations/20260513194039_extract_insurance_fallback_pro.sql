-- Use Gemini 2.5 Pro como fallback para extração de apólice (PDFs grandes/complexos)
UPDATE public.ai_feature_routing
SET fallback_provider_id = '8e62c147-2d08-4bab-bd0e-d76b0dd18919',
    fallback_model_id    = '380659c3-d32d-4317-bf4c-47e8dc794685',
    updated_at = now()
WHERE feature = 'extract_insurance_policy';
