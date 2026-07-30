## O que eu verifiquei nos dados (empresa Oquei)

- A apólice **39233116** tem **59 veículos extraídos pela IA** e **0 vínculos** gravados em `insurance_policy_vehicles`. A apólice **53.82.2026.0013043** tem 6 e **0 vínculos**. Ou seja: o cruzamento placa↔frota hoje só acontece **em memória, dentro da tela de revisão** — nada é gravado.
- Dos 107 registros de veículos extraídos de apólices vigentes, **84 já existem na frota** por placa, mas só **59 veículos** possuem vínculo ativo gravado. Por isso os demais aparecem como "sem apólice" em outras telas e a revisão parece desatualizada.
- A tela filtra a frota por `status = 'ativo'`. Veículos `vendido`/`manutencao` (ex.: **STJ0G47**) caem na lista de pendências mesmo estando cadastrados.
- Placas realmente pendentes hoje são poucas e têm causas identificadas:
  - **Erro de OCR O↔0 / I↔1**: `STFOH46` (frota: `STF0H46`), `GAV0I25` (frota: `GAV0B25`), `UDV0106`, `UGI0178`, `UGL8198`.
  - `AC0000` e `GAV0I25` já casam por **chassi** com veículos da frota.
  - Restantes (`QSQ7F99`, `UDG5F99`, `UFD5D44`, `UFZ3A44`) não existem na frota — pendência legítima.

## O que vou fazer

### 1. Vinculação automática no banco (a peça que falta)
Criar uma função `public.sync_policy_vehicle_links(p_policy_id)` que, para cada veículo do `ai_extracted` de uma apólice, encontra o veículo da frota da mesma empresa por, nesta ordem:
1. placa normalizada (antiga ↔ Mercosul, já existente em `normalize_plate`);
2. chassi (igual ou 8 últimos dígitos);
3. RENAVAM.

E grava/reativa a linha em `insurance_policy_vehicles` (idempotente, sem duplicar; respeita `removed_at`).

Gatilhos para manter tudo automático:
- `AFTER INSERT/UPDATE OF ai_extracted, status, end_date` em `insurance_policies` → sincroniza aquela apólice;
- `AFTER INSERT/UPDATE OF plate, chassis, renavam` em `vehicles` → sincroniza as apólices vigentes da empresa (aproveitando `match_policies_for_vehicle`);
- Quando uma vinculação manual é criada em `vehicle_policy_manual_matches`, grava também o vínculo real em `insurance_policy_vehicles`.

**Backfill único** rodando a função em todas as apólices vigentes — isso já resolve os ~25 veículos hoje sem vínculo gravado.

### 2. Tela "Revisar vinculações pendentes"
- Passar a considerar **pendente** apenas a placa que não tem vínculo ativo em `insurance_policy_vehicles`, nem match manual, nem marcação de externa — a fonte da verdade vira o banco, não o cálculo local.
- Buscar veículos de **todos os status** para detectar "já cadastrado" (o filtro de status continua valendo só para a lista de candidatos à direita, com aviso quando o veículo está vendido/inativo).
- Adicionar **sugestão tolerante a OCR** (O↔0, I↔1, S↔5, B↔8) com badge "provável mesmo veículo" e o veículo já pré-selecionado à direita — sem vincular sozinho, o usuário confirma em 1 clique.
- Botão **"Revincular tudo automaticamente"** que chama a função de sincronização e recarrega.
- Atualização automática via `useAutoRefresh` nas tabelas `insurance_policies`, `insurance_policy_vehicles`, `vehicles`, `vehicle_policy_manual_matches`, `policy_external_plates`.

### 3. Consistência
Após o backfill, os campos de seguro do veículo (`insurer`, `insurance_policy`, `insurance_expires_at`) ficam coerentes pelo trigger `sync_vehicle_insurance_fields` já existente, refletindo no relatório "Veículos — Dados Completos" e na aba Seguros.

## Detalhes técnicos
- Migração com a função (`SECURITY DEFINER`, `search_path = public`), triggers e backfill; nenhuma tabela nova.
- Sem alteração de RLS: a escrita ocorre por trigger no contexto da empresa dona da apólice.
- Arquivo de frontend afetado: `src/pages/app/insurance/ReviewMatches.tsx`.
