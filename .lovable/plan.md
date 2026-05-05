
# Fluxo de Aquisição de Clientes (Lead-First)

Plano dividido em 5 etapas, conforme solicitado. Nada é executado até sua aprovação.

---

## 1. Migrations a criar (apenas novas, não altero as existentes)

**Migration A — `bootstrap_company` v2 (nova versão da função)**
- Cria `bootstrap_company_v2(_company_name, _full_name, _cnpj, _phone, _contact_name, _email)` mantendo a v1 antiga intacta (NewCompanyDialog continua funcionando).
- Faz tudo que a v1 faz +:
  - Salva `cnpj`, `phone`, `contact_name`, `email` em `companies`
  - Define `companies.status = 'aguardando_pagamento'`
  - Cria linha em `subscriptions` com `status = 'aguardando_pagamento'`, `plan_id` apontando para o menor plano ativo (placeholder até o usuário escolher), `current_period_start = today`, `current_period_end = today + 7d` (trial técnico até pagar)
- `SECURITY DEFINER`, GRANT só para `authenticated`.

**Migration B — RPC helper `get_my_acquisition_state()`**
- Retorna `{ has_company, company_id, subscription_status, needs_plan_choice, just_paid }` para o usuário logado.
- Usado pelos guards de rota sem acoplar a lógica no client.

> Não altero `companies`, `subscriptions`, `plans` ou `profiles` — todas as colunas necessárias já existem (validei: `companies.cnpj/phone/email/contact_name/status` já foram adicionados na migration anterior; `subscriptions.status` já tem `'aguardando_pagamento'` como default).

---

## 2. Arquivos a criar

| Arquivo | Função |
|---|---|
| `src/pages/auth/PlanSelection.tsx` | Tela `/planos` — lista `plans` ativos em cards, botão "Assinar". |
| `src/pages/auth/Welcome.tsx` | Tela `/boas-vindas` — parabéns + checklist de 3 passos + botão "Acessar agora". |
| `src/components/auth/RequireAuth.tsx` | Guard: precisa estar logado, redireciona p/ `/login`. |
| `src/components/auth/RequireActiveSubscription.tsx` | Guard: precisa `subscription.status = 'ativa'`, senão redireciona p/ `/planos`. Usa `get_my_acquisition_state()`. |
| `src/components/auth/RequireJustPaid.tsx` | Guard p/ `/boas-vindas`: só permite acesso se `?checkout=success` ou se a subscription virou ativa há < 5 min. |

## 3. Arquivos a modificar

| Arquivo | O que muda |
|---|---|
| `src/pages/auth/Signup.tsx` | Adicionar campos: CNPJ (com máscara), telefone (com máscara), nome do responsável. Trocar a chamada `bootstrap_company` → `bootstrap_company_v2` passando os novos campos. Após sucesso, navegar para `/planos` (em vez de `/app`). Validação Zod expandida (CNPJ 14 dígitos, telefone 10–11 dígitos). |
| `src/App.tsx` | Adicionar rotas: `/planos` (dentro de `RequireAuth`), `/boas-vindas` (dentro de `RequireAuth + RequireJustPaid`). Envolver `/app` com `RequireAuth + RequireActiveSubscription`. |
| `src/pages/app/Subscription.tsx` | No callback do checkout (`?checkout=success`), em vez de só toast, redirecionar para `/boas-vindas` quando for a primeira ativação (subscription que estava `aguardando_pagamento`). |
| `src/pages/auth/Login.tsx` | Após login bem-sucedido, em vez de ir direto para `/app`, consultar `get_my_acquisition_state` e rotear: sem assinatura ativa → `/planos`; com ativa → `/app`. (Mantém o motorista indo para `/motorista`.) |

> **Não mexo em**: `NewCompanyDialog.tsx` (continua usando `bootstrap_company` v1), `AppLayout.tsx`, `SubscriptionBanner.tsx`, fluxo motorista, RPCs/edge functions de Stripe (`create-checkout`, `payments-webhook`) — já existem e funcionam.

---

## 4. Detalhes por etapa

### Etapa 1 — Signup expandido
Campos adicionais (Zod):
- CNPJ — 14 dígitos, máscara `00.000.000/0000-00`
- Telefone — 10/11 dígitos, máscara `(00) 00000-0000`
- Responsável — string 2–100 chars

Pós-cadastro: `bootstrap_company_v2` cria empresa+membership+role+profile+subscription placeholder; redireciona `nav("/planos")`.

### Etapa 2 — `/planos`
- Carrega `plans` ativos (mesmo código já usado em `Subscription.tsx`).
- Cards visuais reutilizando estilo da página de assinatura.
- Guard: se já tem subscription ativa → `<Navigate to="/app" />`.
- Botão "Assinar" → abre o `StripeEmbeddedCheckout` existente em modal (mesmo componente já usado em `/app/assinatura`), passando `priceId = plan.stripe_price_id`, `companyId`, `userId`, `customerEmail`, e `returnUrl = ${origin}/boas-vindas?checkout=success&session_id={CHECKOUT_SESSION_ID}`.

### Etapa 3 — Checkout Stripe
- **Reuso total**: edge functions `create-checkout` e `payments-webhook` já existem e já fazem upsert na `subscriptions`. Não é preciso criar nada novo.
- O `return_url` agora aponta para `/boas-vindas` em vez de `/app/assinatura`.
- Webhook continua atualizando `subscriptions.status = 'ativa'` quando o pagamento confirma.

### Etapa 4 — `/boas-vindas`
- Lê nome da empresa do `useAuth().companies`.
- Header: "Bem-vindo, {empresa}! Sua assinatura está ativa 🎉"
- Checklist visual (3 cards numerados, cada um com link):
  1. Cadastre seu primeiro veículo → `/app/vehicles`
  2. Cadastre seus motoristas → `/app/drivers`
  3. Registre seu primeiro abastecimento → `/app/fuel`
- Botão CTA grande: "Acessar o sistema agora" → `/app`.
- Faz polling curto (3 tentativas de 1s) na `subscriptions` caso o webhook esteja atrasado, para confirmar `ativa` antes de liberar o botão.

### Etapa 5 — Proteção de rotas
- `RequireAuth`: sem `user` → `/login` (preservando `state.from`).
- `RequireActiveSubscription` (envolve `/app`): chama `get_my_acquisition_state`. Se `subscription_status != 'ativa'` → `<Navigate to="/planos" />`. Exceção: `isSuperAdmin` ou `isDriverOnly` passam livre.
- `RequireJustPaid` (envolve `/boas-vindas`): permite se URL tem `?checkout=success` **ou** se `subscriptions.updated_at` virou `ativa` nos últimos 5 min. Caso contrário, redireciona para `/app`.

---

## 5. Garantias de não-regressão

- `bootstrap_company` v1 **permanece existente** → `NewCompanyDialog` (criação de segunda empresa por usuário já logado) continua funcionando.
- Login existente intacto, só ganha um roteamento condicional pós-auth.
- `/app/assinatura` continua funcionando para upgrades de plano de clientes já ativos (não passa pelo fluxo de aquisição).
- Motorista (`isDriverOnly`) ignora todos os guards de subscription e vai direto para `/motorista`.
- Super admin ignora guard de subscription.
- Fluxo Stripe (edge functions, webhook, env vars) **não é alterado**.

---

## 6. ASCII do fluxo

```text
/signup (lead-first form)
   │  bootstrap_company_v2  → companies(status=aguardando_pagamento)
   │                        → subscriptions(status=aguardando_pagamento)
   ▼
/planos  ── escolhe plano ──► StripeEmbeddedCheckout
                                       │
                                       │ pagamento ok
                                       ▼
                              /boas-vindas?checkout=success
                                       │  webhook seta status=ativa
                                       ▼
                                     /app  (RequireActiveSubscription ✓)
```

---

**Aguardo sua aprovação para executar.** Ao aprovar, eu:
1. Crio as 2 migrations e peço aprovação delas (Lovable abre o diff de SQL).
2. Crio os 5 arquivos novos.
3. Modifico os 4 arquivos listados.
4. Não toco em mais nada.
