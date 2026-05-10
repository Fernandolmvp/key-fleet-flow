## Diagnóstico

Investiguei o banco e o código. A causa raiz está clara:

- **96 veículos cadastrados** (95 com `status='ativo'`, 1 inativo/vendido) → por isso o badge lateral mostra **95** e não 96 (filtra por ativos).
- **1 apólice IA ativa** com **49 placas extraídas**, mas **0 vínculos em `insurance_policy_vehicles`** → daí todos os veículos aparecem como "Sem seg" e os contadores divergem.
- A função `autoLinkAiPolicies` que adicionei na sessão anterior **nunca conseguiu inserir** porque o trigger `tg_ipv_block_ai_changes` bloqueia QUALQUER insert em apólice IA com `RAISE EXCEPTION 'Apólice importada via IA — não é permitido adicionar vínculos manualmente'`. Por isso nada se propaga.
- A divergência 58 vs 59 também desaparece quando alinhamos tudo na mesma regra: contar apenas veículos `status='ativo'` (95 ativos − cobertos = sem cobertura).

## Mudanças

### 1. Migration — destravar auto-link e fazer backfill

**Trigger `tg_ipv_block_ai_changes` (substituir):** continua bloqueando inserts/updates/deletes manuais em apólice IA, **mas permite INSERT** quando a placa do veículo está em `ai_extracted.plates` da apólice (auto-link de sistema, derivado do PDF). Soft-remove (`removed_at`) continua proibido em apólice IA.

**Backfill:**
```sql
INSERT INTO insurance_policy_vehicles (company_id, policy_id, vehicle_id, inclusion_type, included_at)
SELECT v.company_id, p.id, v.id, 'apolice', CURRENT_DATE
  FROM insurance_policies p
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.ai_extracted->'plates','[]'::jsonb)) AS plate
  JOIN vehicles v
    ON v.company_id = p.company_id
   AND regexp_replace(upper(v.plate),'[^A-Z0-9]','','g') = regexp_replace(upper(plate),'[^A-Z0-9]','','g')
 WHERE p.status = 'ativa'
   AND NOT EXISTS (
     SELECT 1 FROM insurance_policy_vehicles ipv
     WHERE ipv.policy_id = p.id AND ipv.vehicle_id = v.id AND ipv.removed_at IS NULL
   );

SELECT public.sync_vehicle_insurance_fields(array_agg(id)) FROM vehicles;
```

Isso vai criar ~37 vínculos (placas que casam) e popular `vehicles.insurer / insurance_policy / insurance_expires_at` via trigger `tg_ipv_sync_vehicles`.

### 2. `src/pages/app/Vehicles.tsx` — badge com 3 estados

Adicionar lógica `insuranceStatus`: **`ativo`** (vinculado a apólice vigente, >30d), **`vencendo`** (apólice vence em ≤30d) ou **`sem`** (sem vínculo ativo). Substituir o badge atual de 2 estados pelos 3:
- 🟢 `Seg. ATIVO`
- 🟡 `Vence 30d`
- 🔴 `Sem seg.`

### 3. `src/components/layout/AppLayout.tsx` — consistência do badge lateral

Já filtra `status='ativo'` (correto). Manter como está. Após o backfill, o número cai para `(vencendo + vencidas + sem cobertura ativos)` e bate com o painel de Seguros.

### 4. `src/components/dashboard/InsurancePanel.tsx` — sem mudança funcional

A `autoLinkAiPolicies` que já existe vai funcionar daqui pra frente (trigger destravado). Apenas vou garantir que não bloqueia o load se alguma placa específica falhar (try/catch por placa já existe).

## O que NÃO muda

- Migrations antigas intactas.
- `sync_vehicle_insurance_fields`, `tg_ip_block_ai_field_changes` e `tg_ipv_sync_vehicles` continuam iguais.
- Edição/exclusão manual de vínculos em apólice IA continua bloqueada.
- Telas de Motoristas, Documentos, etc. não tocadas.

## Resultado esperado

- Tela de Veículos: ~37 com 🟢 Seg. ATIVO, demais 🔴 Sem seg.
- Painel de Seguros "Sem cobertura": **58** (95 ativos − 37 cobertos).
- Badge lateral: `vencendo + vencidas + 58`.
- Os 3 lugares passam a usar a mesma fonte (`insurance_policy_vehicles` + `vehicles.status='ativo'`).

Posso aplicar?