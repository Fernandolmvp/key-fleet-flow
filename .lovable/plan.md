## Objetivo

Implementar o módulo de **Viagens Programadas** com controle financeiro completo: adiantamentos em dinheiro, despesas do motorista (cartão empresa, próprio bolso, vale, PIX), reembolsos com aprovação configurável, cartões/meios de pagamento da empresa, recibo PDF de adiantamento e relatórios. Tudo aditivo — zero alteração em colunas existentes.

---

## Etapa 1 — Migrations (5 novas, sequenciais)

**Migration 1 — `company_payment_methods`**
- Identificação: method_type, name, description
- Cartão: card_last_four_digits, card_brand, card_holder_name, card_expiry_month/year, card_limit
- Bancário: bank_name, agency, account, type
- Vínculo: assigned_to_driver_id, assigned_to_vehicle_id
- Voucher: voucher_provider, voucher_card_number, voucher_monthly_credit
- PIX: pix_key, pix_key_type
- is_active, notes, audit
- RLS: SELECT por `is_company_member`, write por `can_manage_fleet`

**Migration 2 — `trips`**
- Todos os campos do brief (programação, datas, KM, orçamento, status, acerto)
- `trip_code` gerado por trigger sequencial por empresa (`VG-YYYY-NNNN`)
- Status enum como text + CHECK
- RLS: gestor (`can_manage_fleet`) full; motorista vê só `driver_id = auth.uid()` (mapeado via `drivers.profile_id`)
- Trigger updated_at

**Migration 3 — `trip_advances`**
- Campos do brief + `gestor_signature_url`, `driver_signature_url`
- Status: aguardando_confirmacao | confirmado | contestado
- RLS: gestor full; motorista SELECT/UPDATE apenas confirmação dos seus

**Migration 4 — `trip_expenses`**
- Todos os campos: despesa, pagamento, NF, comprovante (NOT NULL), reembolso, GPS, aprovação
- Trigger `calculate_expense_approval` (BEFORE INSERT/UPDATE):
  - Define `requires_reimbursement` quando `payment_method` começa com "..._proprio"
  - Lê `companies.expense_auto_approval_limits` JSONB + `require_invoice_for_categories`
  - Auto-aprova se: dentro do limite + tem NF (quando exigida)
  - Atualiza `auto_approved`, `within_budget_limit`, `reimbursement_status`
- Trigger AFTER INSERT/UPDATE/DELETE: recalcula totals em `trips`
- RLS: motorista INSERT só nas suas viagens em andamento; SELECT só suas; gestor full

**Migration 5 — `trip_reimbursements`** + **ADD COLUMN em `companies`**
- Tabela consolidada de reembolsos (status, expense_ids[], approved_by, paid_at)
- ALTER `companies` ADD: `expense_auto_approval_limits jsonb default '{}'`, `require_invoice_for_categories text[] default '{}'`
- ADD COLUMN em `drivers`: `monthly_expense_limit numeric` (apenas se ainda não existir)
- Storage bucket `trip-receipts` (privado) + policies por company_id no path

**Permissions**: adicionar módulos `trips` e `reimbursements` em `permissions.ts` + seed.

---

## Etapa 2 — Edge Functions

- **`generate-advance-receipt`** — gera PDF de recibo (jsPDF via npm:) e faz upload em `trip-receipts/{company_id}/advances/{advance_id}.pdf`. Retorna URL assinada. Salva em `trip_advances.receipt_url`.
- **`generate-trip-report`** — PDF consolidado da viagem (resumo + categorias + comprovantes). Upload no mesmo bucket.
- Ambas com CORS, validação Zod, JWT em código (verify_jwt false em config.toml).

---

## Etapa 3 — UI Gestor (`/app/viagens`)

**Rota nova** + item na sidebar (seção Operação, badge "Novo").

- `src/pages/app/Viagens.tsx` — lista com filtros (status, motorista, veículo, período), cards com KPIs e busca por código/destino.
- `src/components/trips/TripDialog.tsx` — modal 4 abas:
  1. Programação (motorista, veículo, tipo, origem→destino, datas, KM)
  2. Orçamento (total + por categoria via JSON editor amigável)
  3. Adiantamento (valor, método, botão "Gerar recibo PDF")
  4. Cartões disponíveis (multiselect de `company_payment_methods`)
- `src/components/trips/TripDetailDrawer.tsx` — timeline + 4 abas de visão (Carteira, NF, Categoria, Todas as despesas) + botões de ação (acerto, finalizar, cancelar).
- `src/pages/app/aprovacoes/Reembolsos.tsx` — fila de despesas aguardando aprovação, ações Aprovar/Rejeitar/Ajustar valor.
- `src/pages/app/configuracoes/PaymentMethodsTab.tsx` + `PaymentMethodDialog.tsx` — CRUD dos meios de pagamento da empresa.
- `src/pages/app/configuracoes/ExpensePolicyTab.tsx` — editor dos limites de auto-aprovação e categorias que exigem NF.

## Etapa 4 — UI Motorista (`/motorista/viagens`)

- `src/pages/motorista/MotoristaViagens.tsx` — lista de viagens.
- `src/pages/motorista/MotoristaViagemDetalhe.tsx` — card de saldo + botões (confirmar adiantamento, lançar despesa, ver despesas, finalizar).
- `src/components/motorista/ExpenseWizard.tsx` — wizard 6 passos (foto obrigatória, NF sim/não, categoria com ícones grandes, valor, forma pagamento, confirmação com GPS via `navigator.geolocation`).
- `src/components/motorista/AdvanceConfirmDialog.tsx` — confirmação com assinatura (canvas) opcional.

## Etapa 5 — Integração com cadastros existentes

- `DriverDialog`: nova aba "Cartões & Viagens" (cartões atribuídos + limite mensal + histórico viagens).
- `VehicleDialog`: nova seção "Meios de pagamento vinculados".

## Etapa 6 — Relatórios

- Em `/app/viagens` botão "Relatório PDF" por viagem (chama edge function).
- `/app/relatorios` (criar se não existir) — relatório mensal por motorista + relatório fiscal com NF (export CSV).

---

## Detalhes técnicos

- `trip_code`: sequência via tabela auxiliar `trip_code_seq(company_id, year, last_number)` ou função `nextval` por empresa em PL/pgSQL.
- Saldo motorista calculado em view `v_trip_balance` ou no client a partir dos totals da `trips` (atualizados via trigger).
- GPS: `navigator.geolocation.getCurrentPosition` no wizard, opcional (não bloqueia).
- Upload de comprovantes: bucket privado, path `{company_id}/{trip_id}/{expense_id}/{file}`. URL assinada na hora de exibir.
- Auditoria: trigger genérico `tg_audit_trip_*` reaproveitando padrão de `tg_audit_traffic_fines`.
- Motorista identificado via join `drivers.profile_id = auth.uid()` (já existente).
- PDF: usar `jspdf` + `jspdf-autotable` via `npm:` em edge function (não adicionar deps no front).

## Ordem de execução

1. Migration 1 (payment methods) → aprovar
2. Migration 2 (trips) → aprovar
3. Migration 3 (advances) → aprovar
4. Migration 4 (expenses + triggers) → aprovar
5. Migration 5 (reimbursements + companies columns + bucket) → aprovar
6. Edge functions
7. UI Gestor
8. UI Motorista
9. Integrações e relatórios
10. Testes manuais conforme checklist do brief

## Fora de escopo desta entrega

- Emissão de NF-e real (apenas estrutura preparada)
- Assinatura digital com certificado ICP-Brasil (usa canvas simples)
- Push notifications nativas (apenas badge no portal)
