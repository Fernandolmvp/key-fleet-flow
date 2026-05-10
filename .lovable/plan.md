
# Painel Super Admin — Inteligência Artificial

Construir uma área nova dentro de `/super-admin` para o super admin gerenciar **provedores**, **modelos**, **roteamento por feature** e visualizar **estatísticas/logs** de uso de IA, sem precisar tocar no banco. **Esta etapa é só de interface** — nada de mudanças em edge functions.

## Estrutura de navegação

Hoje `/super-admin` é uma página única (gestão de empresas/planos). Vou transformá-la em um shell com **sidebar interna** preservando 100% do comportamento atual:

```
/super-admin                          ← shell com sidebar lateral
  ├─ index (Empresas — conteúdo atual movido p/ aba)
  └─ Inteligência Artificial
       ├─ /super-admin/ai/providers   ← Provedores
       ├─ /super-admin/ai/models      ← Modelos
       ├─ /super-admin/ai/routing     ← Roteamento por Feature
       └─ /super-admin/ai/usage       ← Estatísticas e Logs
```

A sidebar usa shadcn `Sidebar` com itens: **Empresas**, **IA › Provedores / Modelos / Roteamento / Uso**. Tudo dark, alinhado ao visual do `/app`.

## Arquivos novos

```
src/pages/admin/
  SuperAdminShell.tsx              ← shell com sidebar + Outlet
  SuperAdminSidebar.tsx
  CompaniesPanel.tsx               ← move conteúdo atual de SuperAdmin.tsx
  ai/
    AIAlertsBanner.tsx             ← banner topo (vermelho/amarelo/verde)
    ProvidersPage.tsx
    ProviderDialog.tsx             ← criar/editar provedor
    ModelsPage.tsx
    ModelDialog.tsx
    RoutingPage.tsx
    RoutingDialog.tsx              ← editar primary/fallback/estimate
    UsagePage.tsx
    UsageFilters.tsx
    UsageCharts.tsx                ← pizza, barras, linha (recharts)
    UsageLogsTable.tsx
src/lib/
  ai-admin.ts                      ← queries + types + helpers
```

`src/App.tsx`: trocar a rota única `/super-admin` por rotas aninhadas em `SuperAdminShell` com children: `index → CompaniesPanel`, `ai/providers`, `ai/models`, `ai/routing`, `ai/usage`.

## Mockup das telas

**Provedores** — grid de cards (1–3 colunas):
```
┌── Lovable AI Gateway ─────────────┐
│ code: lovable      [Ativo ●○]     │
│ priority: 10       [— +]          │
│ endpoint: ai.gateway.lovable.dev/ │
│ secret: LOVABLE_API_KEY ✓         │
│ último uso: há 2 min              │
│ [Testar conexão]   [Editar]       │
└───────────────────────────────────┘
```
Banner vermelho se `active && secret ausente`.

**Modelos** — tabela com filtro por provedor, colunas: Provedor · Model ID · Display · Tipo · Custo in/1k · Custo out/1k · Max tokens · Ativo · Ações. "Adicionar Modelo" / "Editar" via `ModelDialog`.

**Roteamento** — lista de cards por feature:
```
extract_insurance_policy        [Ativo ●○]
  Primário:  gemini-2.5-pro (Gemini)
  Fallback:  google/gemini-2.5-pro (Lovable)
  Estimativa: 8000 tok    Média real: 7240 tok ✓
  [Editar]
```
Sugestão automática quando `|média - estimativa| > 30%`.

**Uso** — dashboard:
- KPIs: chamadas hoje, chamadas mês, tokens mês, custo estimado, receita mês, margem
- Charts (recharts): pizza por provedor, barras chamadas/dia (30d), barras tokens por feature (top 10), linha % fallback/dia
- Tabela de logs com filtros (empresa, feature, provedor, status, período) — colunas: data · empresa · user · feature · provedor · modelo · tokens · fallback · sucesso · ms

## Banner de alertas (em todas as 4 telas IA)

Calculado no client a partir de `ai_usage_logs` últimas 24h + `ai_providers`:
- 🔴 provedor primário com >20% erro 24h
- 🟡 provedor ativo sem secret cadastrado (verificado via edge function `check-ai-secrets`)
- 🟡 fallback >30% das chamadas
- 🟢 tudo ok

## Detalhes técnicos

- **Queries**: Supabase client direto (RLS já força `is_super_admin`). Nenhum endpoint novo necessário, exceto:
  - `supabase/functions/check-ai-secrets/index.ts` — recebe lista de `secret_name`, devolve `{ name: boolean }` consultando `Deno.env`. Verifica `is_super_admin` do caller.
  - `supabase/functions/test-ai-provider/index.ts` — ping mínimo no endpoint do provedor com o secret correspondente; devolve status/latência. (Não consome tokens reais — usa um prompt mínimo `"ping"`.)
- **Audit logs**: cada UPDATE/INSERT/DELETE em `ai_providers`, `ai_models`, `ai_feature_routing` cria entrada em `audit_logs` (action `ai_provider_update` etc., changes JSON com before/after) — feito via wrapper em `ai-admin.ts`.
- **Confirmações**: AlertDialog antes de desativar provedor primário ativo ou desativar única rota ativa de uma feature.
- **Validação**: zod nos dialogs (code único, número não-negativo nos custos, model_id não vazio).
- **Charts**: usa `recharts` (já no projeto).
- **Responsivo**: sidebar colapsa em mobile, cards/tabela com scroll horizontal.
- **Sem mudança em IA atual**: edge functions de IA permanecem intocadas. Próximo prompt do usuário fará o helper genérico.

## Aprovação

Aprovo para executar?
