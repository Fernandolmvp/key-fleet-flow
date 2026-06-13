-- Revoga a chave de teste antiga (Mais Via Fibra) e cria chave para Oquei Telecom
UPDATE public.api_keys SET ativa = false, updated_at = now()
 WHERE company_id = '4f5520f7-0460-461b-a795-3f16b3bd28a6' AND ativa = true;

INSERT INTO public.api_keys (company_id, key_hash, key_prefix, nome, ativa)
VALUES (
  '80dfb573-977c-48f2-bb98-f2f6d8d4044d',
  '2aca78ecb9dadb598b436816753357979a9b5bd321aa51605f37a04d8b04a534',
  'fops_live_7MJL',
  'Central Agentes IA',
  true
);