## Objetivo

Melhorar a busca por placa/chassi na aba "Visão Geral" de `/app/insurance` para cobrir 4 cenários (cadastrado+coberto, cadastrado sem cobertura, **placa em apólice mas não cadastrada**, e nada encontrado), expor "placas órfãs" como KPI/alerta e criar uma tela dedicada para cadastrá-las (em lote ou individual).

## Mockups

### Cards do resultado de busca (4 cenários)

```text
┌─ CENÁRIO 1 — verde ────────────────────────────────────────┐
│ ✅ ABC1D23 — Honda Civic 2020                              │
│    Coberto por: Porto Seguro · Apólice 12345               │
│    Vigência: 01/01/2026 → 31/12/2026 · Cobertura: Compreensivo│
│    [Ver detalhes da apólice]                               │
└────────────────────────────────────────────────────────────┘

┌─ CENÁRIO 2 — âmbar ────────────────────────────────────────┐
│ ⚠️ ABC1D23 — Honda Civic 2020                              │
│    SEM COBERTURA ATIVA                                     │
│    [Adicionar a uma apólice]   [Importar nova apólice]     │
└────────────────────────────────────────────────────────────┘

┌─ CENÁRIO 3 — azul informativo (NOVO) ──────────────────────┐
│ 💡 Veículo NÃO cadastrado no sistema                       │
│    Placa identificada na apólice: ABC1D23                  │
│    Modelo (apólice): Honda Civic                           │
│    Apólice: Porto Seguro 12345 · Vigência 01/01–31/12/2026 │
│    [★ Cadastrar este veículo na frota]   [Ver apólice]     │
│    (se houver mais de uma apólice cobrindo a placa, lista) │
└────────────────────────────────────────────────────────────┘

┌─ CENÁRIO 4 — vermelho ─────────────────────────────────────┐
│ ❌ Nenhum veículo nem apólice para "XXX"                   │
│    [Cadastrar veículo novo]   [Importar nova apólice]      │
└────────────────────────────────────────────────────────────┘
```

### Card "Cobertura da Frota" atualizado

```text
┌─ Cobertura da Frota ───────────────────────────────────────┐
│  ✅ 47   COM apólice (verde)                               │
│  ❌ 52   SEM apólice (vermelho)                            │
│  💡  X   Em apólice mas SEM cadastro  →  [Ver placas órfãs]│
└────────────────────────────────────────────────────────────┘
```

### "Alertas Críticos" — novo item

```text
• X placa(s) coberta(s) por apólice mas SEM cadastro no sistema
  [Abrir lista]
```

### Tela `/app/insurance/orphans`

```text
☐ Placa     Modelo (apólice)   Apólice   Seguradora    Vigência              Ação
☐ ABC1D23   Honda Civic        12345     Porto Seguro  01/01/26 → 31/12/26   [Cadastrar]
☐ DEF4G56   Fiat Strada        12345     Porto Seguro  01/01/26 → 31/12/26   [Cadastrar]

[Cadastrar selecionados em lote]
```

## Detalhes técnicos

### Busca paralela (frontend, sem migration)

Toda a busca acontece no cliente sobre dados que já são carregados em `InsurancePanel.load()` (`policies`, `vehicles`, `links`). Para o Cenário 3, o lookup usa as placas/veículos extraídos pela IA na apólice (`ai_extracted.plates`, `ai_extracted.vehicles`) — fonte de verdade já presente.

Pseudo-código do hook de busca:

```ts
const term = normId(input);                     // upper, sem hífen, A-Z0-9
const last8 = term.slice(-8);

// 1. veículos cadastrados
const vehiclesHit = vehicles.filter(v =>
  normId(v.plate).includes(term) ||
  (v.chassis && normId(v.chassis).includes(last8))
);

// 2. placas presentes em apólices (independe de vehicles)
const today = new Date().toISOString().slice(0,10);
const policyHits: { policy: Policy; aiVehicle: AiVehicle }[] = [];
for (const p of policies) {
  if (p.status !== "ativa") continue;
  if (p.end_date && p.end_date < today) continue;
  const ex = p.ai_extracted || {};
  const list: AiVehicle[] = ex.vehicles?.length
     ? ex.vehicles
     : (ex.plates || []).map((pl: string) => ({ plate: pl }));
  for (const a of list) {
    const ap = normId(a.plate);
    const ac = normId(a.chassis);
    if (ap.includes(term) || (ac && ac.includes(last8))) {
      policyHits.push({ policy: p, aiVehicle: a });
    }
  }
}

// 3. correlação → 4 cenários
//    - vehiclesHit.length>0 && coberto(v.id) → Cenário 1
//    - vehiclesHit.length>0 && !coberto       → Cenário 2
//    - !vehiclesHit.length && policyHits      → Cenário 3 (lista todas)
//    - nada                                   → Cenário 4
```

`coberto(v.id)` = existe `link` ativo apontando para uma `policy` `ativa` com `end_date >= hoje`.

Normalização aceita: `ABC-1234`, `ABC1234`, `ABC1D23` (Mercosul), chassi parcial (últimos 8), case insensitive.

### Cálculo de "placas órfãs" (KPI + alerta + tela)

```ts
const registeredPlates = new Set(vehicles.map(v => normId(v.plate)));
const orphanMap = new Map<string, OrphanRow>();      // chave = placa normalizada
for (const p of activeAiPolicies) {
  for (const a of aiVehiclesOf(p)) {
    const key = normId(a.plate);
    if (!key || registeredPlates.has(key)) continue;
    if (!orphanMap.has(key)) orphanMap.set(key, { plate: a.plate, entries: [] });
    orphanMap.get(key)!.entries.push({ policy: p, ai: a });
  }
}
```

`orphanMap.size` alimenta:
- terceiro número do card "Cobertura da Frota"
- novo item de "Alertas Críticos" (se > 0)
- tela `/app/insurance/orphans`

### Cadastro a partir do Cenário 3 / tela órfãs

Reutiliza `VehicleDialog` com props pré-preenchidas:

```ts
{
  plate: ai.plate,
  brand: ai.brand,
  model: ai.model,
  year: ai.year,
  chassis: ai.chassis,
}
```

Após salvar:
1. Não toca na apólice (regra IA imutável preservada).
2. Dispara `autoLinkAiPolicies(...)` (já existente em `InsurancePanel`) → cria `insurance_policy_vehicles` com `inclusion_type='apolice'` e roda `sync_vehicle_insurance_fields`.
3. Toast "Veículo cadastrado e vinculado à apólice X".

Cadastro em lote: itera sobre seleção, chama o mesmo fluxo, e ao final um único `autoLinkAiPolicies`.

### Arquivos afetados

- `src/components/dashboard/InsurancePanel.tsx`
  - Novo componente interno `<SmartSearchResults/>` para os 4 cards.
  - Novo helper `useOrphanPlates(policies, vehicles)`.
  - Card "Cobertura da Frota" atualizado com 3ª métrica.
  - "Alertas Críticos" recebe novo item.
- `src/pages/app/insurance/Orphans.tsx` *(novo)* — tabela com seleção múltipla, integração com `VehicleDialog`.
- `src/App.tsx` — nova rota `/app/insurance/orphans` dentro de `RequireActiveSubscription`.
- `src/components/dashboard/VehicleDialog.tsx` — aceitar prop opcional `prefill?: Partial<Vehicle>` (se ainda não existir).
- Sem migrations: nenhuma mudança de schema.

### Regras críticas respeitadas

1. Sem duplicação: vínculos só via `insurance_policy_vehicles`.
2. Apólices `ai_extracted` continuam imutáveis (trigger `tg_ip_block_ai_field_changes`).
3. Nenhum INSERT/UPDATE/DELETE direto em `insurance_policy_vehicles` para apólices IA fora do fluxo `autoLinkAiPolicies` (já valida placa via `tg_ipv_block_ai_changes`).
4. Veículo cadastrado no Cenário 3 só passa a "Coberto" pela auto-vinculação, sem alterar a apólice.

## Plano de rollback

- Mudanças são só frontend e adição de uma rota. Reverter = remover:
  - novo componente `<SmartSearchResults/>` e novo bloco do card de cobertura em `InsurancePanel.tsx` (substituir pelo bloco atual);
  - `src/pages/app/insurance/Orphans.tsx`;
  - rota `/app/insurance/orphans` em `App.tsx`;
  - prop `prefill` em `VehicleDialog`.
- Nenhum dado do banco é tocado por essas mudanças, então rollback é puramente de código (revert do commit).
