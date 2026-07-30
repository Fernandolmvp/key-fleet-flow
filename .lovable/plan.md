## Plano: corrigir créditos de IA insuficientes para Oquei Telecom

### Causa identificada
A empresa **Oquei Telecom Ltda** (`80dfb573-977c-48f2-bb98-f2f6d8d4044d`) tem assinatura Enterprise ativa com direito a 1.000.000 tokens/mês, mas o saldo atual do plano está em **1.022 tokens**. A feature `extract_insurance_policy` faz um pré-bloqueio conservador de **8.000 tokens**, então `has_enough_ai_tokens` retorna `false` e a edge function devolve HTTP 402. O `last_plan_reset_at` é `2026-05-10 12:41:51`, indicando que o reset mensal de créditos nunca ocorreu — a função `reset_monthly_plan_tokens` existe, mas não há cron job automático a invocando.

### Passos

1. **Recarga imediata dos tokens da empresa afetada**
   - Chamar a função existente `public.reset_monthly_plan_tokens()` ou, se preferirmos controle fino, atualizar a linha de `ai_token_balance` para `plan_tokens_remaining = 1.000.000` e `last_plan_reset_at = now()` para a empresa `80dfb573-977c-48f2-bb98-f2f6d8d4044d`.
   - Verificar na tela Configurações > Créditos IA que o saldo do plano aparece correto e que a extração de apólice deixa de retornar 402.

2. **Criação de rotina automática de reset mensal**
   - Criar um job recorrente (pg_cron ou edge function agendada) que execute `public.reset_monthly_plan_tokens()` no primeiro dia de cada período de faturamento.
   - Alternativa: trigger `AFTER UPDATE` em `subscriptions` que recarrega o saldo quando o status muda para `ativa` ou quando `current_period_start` é renovado.

3. **Melhoria da UX de erro e observabilidade**
   - No `extract-insurance-policy` (e demais funções que usam `guardAiCall`), incluir na resposta 402 o saldo atual e o valor necessário, para a UI explicar melhor ao usuário.
   - Garantir que o `InsurancePanel` mostre uma mensagem clara quando faltar crédito, com link para Configurações > Créditos IA.

4. **Ferramenta de admin para reset manual (super-admin)**
   - Adicionar no painel de admin ou em Configurações > Créditos IA um botão “Recarregar créditos do plano agora” visível apenas para super-admins, que chame `reset_monthly_plan_tokens` para a empresa selecionada.

### Resultado esperado
- Oquei Telecom volta a ter 1.000.000 tokens de plano disponíveis e a extração de apólice por IA funciona normalmente.
- O reset passa a ser automático, evitando que outras empresas ativas caiam para saldo zero ao longo do tempo.
- O usuário passa a receber mensagem informativa (saldo vs. necessário) em vez de erro genérico de créditos.

### Riscos / observações
- Alteração de dados (não de schema): a recarga imediata será feita via ferramenta de insert/update do banco, não via migration.
- A função `reset_monthly_plan_tokens` já existe e recarrega para todas as empresas ativas; se quisermos ações mais granulares, usamos UPDATE direto na tabela.
- O job agendado depende de `pg_cron` estar habilitado no projeto; caso contrário, usaremos uma edge function com scheduler externo ou trigger em `subscriptions`.