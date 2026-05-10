## Reestruturação da tela de Seguros — 3 abas

Atualmente `InsurancePanel.tsx` tem ~2.043 linhas com tudo numa única página: KPIs, busca de veículo, lista de apólices expandidas, quadrantes de cobertos / não cadastrados, painel "Sem cobertura" e dialogs (revisão IA, exclusão, criação manual). Vou reorganizar **sem reescrever a lógica de dados** — apenas distribuindo o JSX existente em 3 abas.

---

### Mockup visual

**Cabeçalho fixo (acima das abas)**
```
Seguros                                            [+ Nova apólice]
Apólices, vínculos com veículos e vencimentos.
─────────────────────────────────────────────────────────────
[ Visão Geral ]  [ Apólices (3) ]  [ Sem Cobertura (58) ]
```

**ABA 1 — Visão Geral** (default)
```
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│  37               │ │  58               │ │  1                │
│  Veículos         │ │  Sem cobertura    │ │  Apólice vigente  │
│  cobertos  ✅     │ │  ⚠️                │ │  🛡️               │
│  → ver apólices   │ │  → ver lista      │ │  → ver apólices   │
└───────────────────┘ └───────────────────┘ └───────────────────┘

┌─ Cobertura da frota ──────┐  ┌─ Alertas críticos ─────────────┐
│   ◐ 39% cobertos          │  │ • 0 apólices vencendo em 30d   │
│     (donut chart)         │  │ • 58 veículos sem cobertura    │
│   61% sem seguro          │  │   há mais de 30 dias           │
└───────────────────────────┘  └────────────────────────────────┘

Próximas a vencer
─────────────────
• ALFA · 31/07/2026 (77d) · 37 veículos
```
Os 3 KPIs são clicáveis e navegam para a aba correspondente (com filtro pré-aplicado quando fizer sentido).

**ABA 2 — Apólices**
```
🔍 Buscar veículo por placa/chassi nas apólices...

┌────────────────────────────────────────────────────────────┐
│ ALFA SEGURADORA      [Vigente · 77d]    [IA 🔒]      [▼]  │
│ Apólice 12345 · 37 cobertos · 12 s/cadastro · 0 vencidos   │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ YELLOM               [Vigente]          [Manual]     [▼]   │
│ Apólice N Crded · 0 cobertos · 0 s/cadastro                │
└────────────────────────────────────────────────────────────┘
```
Ao clicar em `▼` abre o card completo que existe hoje (KPIs vigência/prêmio/franquia/IS, cobertura, quadrante de veículos cobertos, quadrante de não cadastrados, aviso IA, botões Revisar / Excluir). Default = todos colapsados; quando há resultado de busca, o card que contém o veículo abre automaticamente.

**ABA 3 — Sem Cobertura**
```
58 veículos sem cobertura ativa                             🔴
──────────────────────────────────────────────────────────────
[Tipo ▾] [Ano ▾] [Valor FIPE ▾]              ⇅ Maior FIPE ▾

┌────────────────────────────────────────────────────────────┐
│ ABC1D23 · Volvo FH 540 · 2022                              │
│ FIPE R$ 620.000 · sem cobertura há 142 dias                │
│                                       [Vincular a apólice] │
└────────────────────────────────────────────────────────────┘
```
"Vincular a apólice" abre um pequeno dialog com select das apólices manuais (apólices IA continuam bloqueadas pelo trigger atual).

---

### Arquivos modificados / criados

**Modificados**
- `src/components/dashboard/InsurancePanel.tsx` — vira shell com `<Tabs>` (Visão Geral / Apólices / Sem Cobertura). Toda a lógica de fetch, mutations, dialogs e regras existentes (IA bloqueada, soft delete, unique, dedupe de save) **fica intacta** e é passada via props/contexto local para os 3 sub-componentes.

**Novos** (puramente apresentacionais, dentro de `src/components/dashboard/insurance/`)
- `InsuranceOverviewTab.tsx` — 3 KPIs grandes, donut de cobertura (recharts já está instalado), bloco "Alertas críticos" e "Próximas a vencer".
- `InsurancePoliciesTab.tsx` — busca de veículo + lista de cards colapsáveis (Radix `Collapsible`). Reaproveita os blocos JSX de KPIs/cobertura/quadrantes do arquivo atual extraídos como `<PolicyCardBody />`.
- `InsuranceUncoveredTab.tsx` — lista filtrável e ordenável por FIPE dos veículos sem vínculo ativo + dialog "Vincular a apólice manual".
- `PolicyCardBody.tsx` — extração 1:1 do conteúdo expandido de cada apólice (sem mudança de comportamento).

**Não criados / não alterados**
- Nenhum hook novo, nenhuma migration, nenhuma edge function tocada.
- Dialogs existentes (revisar IA, excluir apólice, criar manual) continuam idênticos — só são chamados de dentro das novas abas.

---

### Garantias de preservação

1. Trigger `tg_ipv_block_ai_changes`, UNIQUE index, soft delete (`removed_at`), trava `savingPolicy`, validação pre-insert por `policy_number` — **nenhum desses pontos é tocado**.
2. Todos os fluxos atuais (upload PDF → extract → review → link, criação manual, exclusão, busca por placa) continuam funcionando — apenas mudam de aba.
3. Tema dark + cores semânticas (`success`/`destructive`/`warning`/`primary`) já existentes no design system.
4. Sem novas dependências.

Posso aplicar?
