## Objetivo

Criar 2 cadastros novos (Oficinas e Fornecedores), expandir cadastro de Postos, vincular Oficina em Manutenções e adicionar busca de CNPJ na Receita Federal — tudo preparado para futura emissão de NF, sem alterar nenhuma coluna existente.

## Escopo das migrations (todas novas, aditivas, com RLS)

**Migration 1 — `workshops`** (nova tabela)
- Identificação: name, trade_name, document_type, document_number, state_registration, municipal_registration
- Serviço: workshop_type[], specialties[]
- Contato: contact_name, contact_role, phone, whatsapp, email, website
- Endereço completo + lat/long
- Comercial/Fiscal: payment_terms, PIX, dados bancários, PIS, COFINS, ISS, ICMS, issues_invoice, invoice_type, CNAE, simples_nacional
- Contrato: contract_start/end, preferred, credit_limit, discount_pct, warranty_days
- Avaliação: rating, total_orders, total_amount
- documents_urls jsonb, status, blocked_reason, notes, tags, created_by, updated_by, timestamps
- RLS: SELECT por `is_company_member`, write por `can_manage_fleet`
- Índices: company_id, document_number, status, name (gin_trgm)
- Trigger `update_updated_at_column`

**Migration 2 — `suppliers`** (nova tabela)
- Mesmo molde de workshops trocando workshop_type por supplier_category[]
- Adiciona delivery_days_avg, minimum_order
- Mesma RLS, mesmos índices

**Migration 3 — ADD COLUMN em `fuel_stations`** (todas nullable)
- Fiscais: trade_name, document_type, state_registration, municipal_registration, cnae_code, simples_nacional, issues_invoice, invoice_type
- Endereço extra: latitude, longitude (number/complement já existem)
- Estrutura: has_convenience_store, has_restaurant, has_truck_lane, has_24h_operation, has_lubrification, has_car_wash
- Operação: operating_hours jsonb, accepted_payment_methods[], min_purchase_amount
- Comercial: payment_terms, pix_key, pix_key_type, bank_*, contract_start/end, preferred, credit_limit, discount_pct_gasolina/etanol/diesel
- Cartão Frota: supports_fleet_card, fleet_card_providers[], has_automatic_reading
- Compliance: documents_urls jsonb, anp_register_number
- Avaliação: rating, total_fuelings, total_amount, average_fuel_price_*
- internal_notes, tags[]
- **NÃO mexe** nas colunas existentes (fuel_types, address, etc)

**Migration 4 — ADD COLUMN em `maintenance_records`**
- workshop_id uuid nullable (sem FK rígido para não quebrar dados antigos)
- Mantém service_provider intacto

**Migration 5 — `cnpj_cache`** (nova tabela)
- cnpj (text PK), payload jsonb, fetched_at
- RLS: leitura/escrita autenticada

## Edge Function

**`cnpj-lookup`** — consulta BrasilAPI (`/cnpj/v1/{cnpj}`), grava em `cnpj_cache` com TTL 30 dias, retorna razão social, fantasia, endereço, CNAE, situação. CORS + verify_jwt=false.

## UI nova

**`src/pages/app/Workshops.tsx`** — lista + dialog com 7 abas (Identificação, Contato, Endereço, Comercial, Fiscal, Documentos, Contrato). Filtros por tipo, status, cidade, rating.

**`src/pages/app/Suppliers.tsx`** — mesma estrutura, com aba Comercial incluindo dias de entrega e pedido mínimo.

**Componentes compartilhados**:
- `src/components/forms/CnpjLookupInput.tsx` — input CNPJ + botão "buscar Receita" via edge function
- `src/components/forms/PartnerCommercialFields.tsx` — bloco PIX + bancário (reutilizado)
- `src/components/forms/PartnerFiscalFields.tsx` — bloco fiscal (reutilizado)

**Atualizar `FuelStations.tsx`**: dialog passa a ter abas (Geral, Combustíveis, Estrutura, Operação, Comercial, Fiscal, Cartão Frota, ANP) — **mantém** todos os campos atuais funcionando.

**Atualizar `MaintenanceDialog.tsx`**: combo "Oficina" lendo `workshops`, opção "+ Nova oficina" abre o dialog de Workshops; campo `service_provider` continua como fallback livre.

**Sidebar (`AppLayout.tsx`)**: adicionar "Oficinas" e "Fornecedores" na seção Cadastros, com badge "Novo".

**Rotas (`App.tsx`)**: `/app/workshops` e `/app/suppliers`.

## Validações

- Validação matemática de CNPJ/CPF em util novo `src/lib/document.ts`
- Unicidade por empresa via índice parcial `unique (company_id, document_number) where document_number is not null`

## Fora de escopo (apenas comentário no SQL)

Tabela `invoices` futura — comentário TODO nas migrations indicando os campos já preparados.

## Segurança / compatibilidade

- ZERO ALTER/RENAME/DROP em colunas existentes
- Todas novas colunas nullable
- RLS habilitada em todas as tabelas novas
- Triggers de updated_at via função `update_updated_at_column` já existente
- `service_provider` em maintenance permanece; `fuel_types` em fuel_stations permanece
- Postos antigos abrem normalmente (campos novos vazios)

## Detalhes técnicos

- 5 migrations separadas, sequenciais
- Edge function registrada em `supabase/config.toml` com `verify_jwt = false`
- Após migrations, `src/integrations/supabase/types.ts` é regerado automaticamente
- Permissões: usar `useTabPermissions` se aplicável; chave `workshops` e `suppliers` em `permissions.ts`
- Trigram: criar extensão `pg_trgm` se ainda não existir antes do índice GIN
