## Análise do código atual

**Causa do Problema 1 (badge "IA" em apólice manual):**
Em `savePolicy` (linha 363) toda apólice salva grava
`ai_extracted: { ...(form.ai_extracted || {}), plates: aiPlates, vehicles: aiVehicles }`.
Mesmo numa apólice manual isso deixa `ai_extracted = { plates: [], vehicles: [] }`, então `Object.keys(...).length > 0` é verdadeiro e o sistema classifica como IA. Erradamente bloqueia edição, esconde "Veículos sem cobertura" (Problema 2) e mostra badge IA.

**Origem dos dois problemas é a mesma** — basta um helper `isAiPolicy()` correto e parar de gravar `ai_extracted` vazio em apólices manuais.

---

## Arquivos modificados

Apenas **`src/components/dashboard/InsurancePanel.tsx`** (frontend, sem migrations).

---

## Mudanças

### 1. Novo helper `isAiPolicy(policy)` (substitui as 5 verificações inline)
Retorna `true` apenas quando `ai_extracted` tiver conteúdo significativo — campos extraídos pela IA (`policy_number`, `insurer_name`, `broker_name`, `start_date`, `end_date`, `coverage_summary`) **ou** `plates`/`vehicles` com itens. Arrays vazios não contam.

Aplicado em: `linkVehicle`, `unlinkVehicle`, `autoLinkAi`, `policyIsAi`, badge na lista, todos os checks `aiLocked` no diálogo.

### 2. `savePolicy` — não poluir `ai_extracted` em apólice manual
Só grava `ai_extracted` quando `aiPlates`/`aiVehicles` ou `form.ai_extracted` realmente têm conteúdo. Apólice 100% manual fica com `ai_extracted: {}`.

### 3. **Ajuste 1** — Badge correto na lista de apólices (linhas 737-758)
- IA (vermelho com cadeado): só quando `isAiPolicy(p)`.
- **Novo badge "Manual"** (azul/`bg-primary/15`) quando não for IA.
- Botões Editar/Excluir continuam aparecendo só para manuais.

### 4. **Ajuste 2** — "Veículos sem cobertura" em apólices manuais
Hoje o painel `validation` só renderiza quando `validation.hasAi` (linha 823). Vou:
- Sempre mostrar o trio de contadores (cobertos / na apólice s/ cadastro / sem cobertura) — apólice manual terá "na apólice s/ cadastro" sempre 0.
- Sempre renderizar o bloco "Veículos sem cobertura" quando `companyUncovered.length > 0`, com botão "Adicionar cobertura" habilitado para apólices manuais (já está condicionado a `!policyIsAi`, que vai funcionar corretamente após o fix do helper).

### 5. **Ajuste 3** — Painel de resumo geral no topo
Novo `<Card>` acima do grid (entre a busca global e o grid de apólices), com 6 KPIs calculados via `useMemo` sobre `policies`/`links`/`vehicles`:

```
┌─ Resumo da frota ────────────────────────────────────────────┐
│ Veículos cobertos │ Na apólice s/ │ Sem cobertura │ Vigentes │ Vencendo 30d │ Vencidas │
│  (verde)          │  cadastro     │  (vermelho)   │ (azul)   │  (amarelo)   │  (verm.) │
└──────────────────────────────────────────────────────────────┘
```

- **Cobertos**: veículos com pelo menos 1 link em apólice ativa não vencida.
- **Na apólice s/ cadastro**: união de placas em `ai_extracted.plates` de apólices ativas que não existem em `vehicles`.
- **Sem cobertura**: igual ao `companyUncovered` atual.
- **Vigentes / Vencendo 30d / Vencidas**: derivado de `end_date` + `status`.

### 6. **Ajuste 4** — Mini-resumo dentro de cada card da lista
Nas linhas 718-724, adicionar uma linha extra de chips compactos:
- 🟢 `{covered}` cobertos & cadastrados
- 🟡 `{onlyInPolicy}` na apólice s/ cadastro (oculto se 0 ou se for manual)
- 🔴 `{notCoveredForThisPolicy}` — aqui usei a contagem global `companyUncovered.length` como hoje, mas no contexto do card faz mais sentido a quantidade total da empresa sem cobertura nenhuma — confirmo abaixo.

> Para o item vermelho do card: vou usar a mesma lógica do painel de resumo geral (`companyUncovered`), que é "veículos da empresa sem nenhuma apólice", já que "sem cobertura" não é por apólice e sim global. Mantém consistência com o resumo no topo.

---

## Garantias

1. Nenhuma migration, nenhum trigger novo. Os triggers de bloqueio para apólices IA continuam protegendo o banco.
2. `linkVehicle/unlinkVehicle/autoLinkAi` continuam bloqueando IA — agora com o helper correto.
3. Apólices IA existentes continuam classificadas como IA (têm `insurer_name`/`policy_number` em `ai_extracted`).
4. Apólices manuais antigas que ficaram com `ai_extracted = {plates:[],vehicles:[]}` passarão a ser tratadas como manuais automaticamente (sem precisar atualizar o banco). Posso opcionalmente rodar um UPDATE limpando esses registros — me avise se quiser.

Posso aplicar?