
# Prompt 2 — Tela de Saldo + Histórico de Uso de Tokens IA

## Objetivo
Adicionar uma nova aba **"Créditos IA"** dentro de `/app/configuracoes` para o cliente visualizar saldo de tokens (plano + extras), histórico de consumo, gráfico dos últimos 30 dias e top features. Apenas leitura — botão de compra é placeholder ("Em breve") até o Prompt 3.

## Análise do que já existe
- **Tabelas**: `ai_token_balance` (1:1 por empresa, `plan_tokens_remaining`, `extra_tokens_balance`, `last_plan_reset_at`), `ai_usage_logs` (`feature`, `model`, `tokens_total`, `source`, `success`, `user_id`, `created_at`).
- **RPC**: `check_ai_token_balance(_company_id)` retorna `total_available, plan_remaining, extra_balance`.
- **RLS**: já permite membros lerem o balance e os logs da própria empresa. Nenhuma policy nova necessária.
- **Plano**: `plans.tokens_monthly` (total mensal). Reset = `last_plan_reset_at + 1 mês`.
- **Configurações**: `src/pages/app/Configuracoes.tsx` usa `Tabs` com 3 abas (Membros, Permissões, Empresa). Vou adicionar a 4ª.
- **Padrão visual**: `surface-card`, `font-display`, `KpiCard` (`src/components/dashboard/KpiCard.tsx`) para os cards do topo (com `tone` primary/success/warning).

## Layout da aba (mockup textual)

```text
┌───────────────────────────────────────────────────────────────────────┐
│  [Saldo Plano]   [Tokens Extras]   [Total Disponível]   [Comprar ▸]  │
│   45.000          12.500             57.500              Em breve     │
│   Renova 10/06    Sem validade       tokens prontos                   │
│   ▓▓▓▓░░░ 60%                                                         │
├───────────────────────────────────────────────────────────────────────┤
│  Consumo últimos 30 dias — 18.420 tokens                              │
│   ▁▂▃▅▂▁▃▅█▇▃▂▁ ...                                                   │
├───────────────────────────────────────┬───────────────────────────────┤
│  Histórico de Uso                     │  Top 5 funcionalidades (mês)  │
│  [periodo▾] [feature▾] [usuário▾]     │  1. Importação Apólice 8.2k   │
│  Data | Funcionalidade | Usuário |    │  2. Cupom Fiscal       4.1k   │
│  Tokens | Origem | Status             │  3. CRLV               2.3k   │
│  ...20 linhas + paginação             │  ...                          │
└───────────────────────────────────────┴───────────────────────────────┘
```

## Arquivos a criar / editar

### Novos
- `src/pages/app/configuracoes/CreditosIATab.tsx` — componente principal da aba.
- `src/pages/app/configuracoes/credits/BalanceCards.tsx` — 4 cards do topo.
- `src/pages/app/configuracoes/credits/UsageChart.tsx` — gráfico recharts (já no projeto) de barras 30 dias.
- `src/pages/app/configuracoes/credits/UsageHistory.tsx` — tabela + filtros + paginação.
- `src/pages/app/configuracoes/credits/TopFeatures.tsx` — ranking lateral.
- `src/lib/ai-credits.ts` — mapa `FEATURE_LABELS` (apolice_pdf → "Importação de Apólice", etc.) + helper `formatFeature()`.

### Editar
- `src/pages/app/Configuracoes.tsx` — adicionar `<TabsTrigger value="credits">` com ícone `Sparkles` e `<TabsContent>` carregando `CreditosIATab`.

## Detalhes técnicos

**Fetch de dados** (todos client-side via `supabase`):
- `supabase.rpc("check_ai_token_balance", { _company_id })` — saldo.
- `supabase.from("ai_token_balance").select("last_plan_reset_at, plan_tokens_remaining, extra_tokens_balance").eq("company_id", id).maybeSingle()` — para `last_plan_reset_at` e cálculo da próxima renovação (`last_plan_reset_at + 1 month`).
- Total mensal do plano: `subscriptions` → `plans.tokens_monthly` (já carregado via join) para a barra de progresso "usado vs total".
- Histórico: `supabase.from("ai_usage_logs").select("*, profiles:user_id(full_name)", { count: "exact" }).eq("company_id", id)` com filtros e `range()`.
- Top features: agregação no cliente sobre logs do mês atual (ou view simples).
- Gráfico: agrupa logs últimos 30 dias por `date_trunc('day')` no cliente.

**Filtros do histórico**: período (preset + custom via `date-fns`), feature (`select` populado a partir das features distintas dos logs), usuário (membros da empresa).

**Estados vazios**: se `ai_usage_logs` vier vazio mostrar `EmptyState` com `Sparkles` + "Nenhum uso registrado ainda".

**Botão "Comprar"**: `onClick` abre um `Dialog` simples com "Em breve" — sem rota nova.

**Visual**: tokens semânticos do design system (`bg-primary/10`, `text-success`, `text-warning`, `text-primary` etc.), `surface-card`, sem cores hardcoded. Responsivo: cards em `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`; histórico + top features em `lg:grid-cols-3` (tabela ocupa 2, ranking 1).

## Fora de escopo (deixar para próximos prompts)
- Stripe / fluxo real de compra de tokens.
- Interceptar/bloquear chamadas de IA quando saldo zero.
- Painel super admin global de tokens.
- Alterar policies RLS ou criar novas tabelas.

Posso executar?
