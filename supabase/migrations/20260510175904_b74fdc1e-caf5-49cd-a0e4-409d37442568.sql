-- Salva saldo atual em tabela temporária
CREATE TEMP TABLE _bal_backup AS
SELECT company_id, plan_tokens_remaining, extra_tokens_balance
FROM public.ai_token_balance
WHERE company_id = '80dfb573-977c-48f2-bb98-f2f6d8d4044d';

-- Zera para o teste
UPDATE public.ai_token_balance
   SET plan_tokens_remaining = 0, extra_tokens_balance = 0
 WHERE company_id = '80dfb573-977c-48f2-bb98-f2f6d8d4044d';