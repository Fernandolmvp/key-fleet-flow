# Plano: Manutenção Corretiva — Motorista → Gestor → Oficina + Portal Oficina

Módulo grande. Divido em **6 fases** conforme sua sugestão. Cada fase entrego, testo e só avanço com seu OK.

---

## FASE 1 — Backend completo (esta entrega)

Tudo aditivo, sem alterar colunas existentes. Reaproveita o padrão já usado em `fuel_station_users` / `posto-login` / `partner-invite`.

### 1.1 Migrations (4 arquivos novos, sequenciais)

**Migration A — `workshop_users`** (espelho de `fuel_station_users`)
- `id`, `workshop_id` (FK workshops), `company_id` (FK), `email`, `name`
- `role` text default `'operator'` (CHECK in `'admin','operator'`)
- `password_hash` text (mesmo padrão SHA-256 + salt do posto)
- `invite_token`, `invite_sent_at`, `invite_accepted_at`, `password_set_at`
- `last_login_at`, `is_active` bool default true
- `created_by`, audit timestamps
- UNIQUE (workshop_id, email)
- RLS: SELECT/UPDATE pelo gestor (`can_manage_fleet`); o portal usa service-role via JWT próprio

**Migration B — `maintenance_work_orders`** (todos os campos do brief)
- Identificação, origem, agendamento, orçamento, aprovação, execução, resultado, pagamento, avaliação
- `os_number` gerado via trigger `generate_os_number()` (sequência por empresa/ano: `OS-2026-0001`)
- CHECKs em `origin_type`, `priority`, `quote_status`, `execution_status`, `payment_status`, `rating 1..5`
- FK opcionais: `maintenance_request_id`, `maintenance_schedule_id`, `maintenance_record_id`
- Triggers:
  - `tg_wo_set_os_number` BEFORE INSERT
  - `tg_wo_updated_at`
  - `tg_wo_on_complete` (cria `maintenance_records` automaticamente, atualiza `maintenance_request.status`, soma `workshops.total_orders`, recalcula `workshops.rating` na avaliação)
- Índices em (company_id, execution_status), (workshop_id, scheduled_date), (vehicle_id)

**Migration C — `work_order_messages`**
- Chat OS ↔ gestor: `work_order_id`, `sender_id`, `sender_role` ('gestor'|'oficina'), `message`, `attachments_urls[]`, `is_read`
- Realtime habilitado (`ALTER PUBLICATION supabase_realtime ADD TABLE`)

**Migration D — ADD COLUMN em `workshops`**
- `has_portal_access bool default false`
- `portal_activated_at timestamptz`
- `portal_settings jsonb default '{}'`
- (Se ainda não existir) `total_orders int default 0`, `rating numeric`, `total_amount numeric`

### 1.2 RLS

**Função SECURITY DEFINER** `is_workshop_user(_workshop_id uuid)` — checa `auth.uid()` em `workshop_users` ativos. (Inicialmente o portal usa JWT próprio, mas a função fica pronta caso migremos para auth nativa.)

**Policies em `maintenance_work_orders`:**
- Gestor (membro da empresa + `can_manage_fleet`): ALL
- Motorista (`drivers.profile_id = auth.uid()` e `driver_id` corresponde): SELECT
- Acesso da oficina é via edge functions com service-role (mesmo padrão do posto), filtrando por `workshop_id` extraído do JWT do portal

**Policies em `work_order_messages`:** mesmo padrão (gestor full; oficina via edge functions)

**Policies em `workshop_users`:** apenas gestor da empresa lê/escreve; oficina nunca lê direto.

**Bucket storage** `work-orders` (privado) com policies por `company_id` no path:
`{company_id}/{work_order_id}/{antes|depois|nf|orcamento}/{file}`

### 1.3 Edge Functions (4 novas, padrão idêntico ao Posto)

- **`workshop-login`** — POST {email, password} → valida hash, atualiza `last_login_at`, devolve JWT assinado com `{ sub, partner_type:'workshop', workshop_id, company_id }` (reusa `_shared/partner-auth.ts`)
- **`workshop-invite`** — gestor convida (cria/atualiza `partner_invitations` com `partner_type='workshop'`), gera token, dispara email via fila Lovable (`send-partner-email`)
- **`workshop-accept-invite`** — peek + accept (mesma lógica do `partner-accept-invite`, criando linha em `workshop_users`)
- **`workshop-list`** — GET com JWT do portal: lista OS da oficina, com filtros (status, período). Padrão idêntico a `posto-list`.

(**`generate-os-number`** não vira edge function — é trigger SQL, mais robusto.)

### 1.4 Permissões

Adicionar em `src/lib/permissions.ts`: módulo `work_orders` (visualizar/aprovar_orcamento/aprovar_pagamento/avaliar) e seed via migration.

### Entregáveis Fase 1

- 4 migrations (mostradas para aprovação antes de executar)
- 4 edge functions deployadas
- Bucket criado
- **Sem UI ainda** — testo via `curl_edge_functions` e devolvo um relatório de validação

---

## FASES seguintes (resumo — detalho cada uma na hora)

**FASE 2 — Portal Oficina `/oficina`**
- `OficinaAuthContext` (cópia de `PostoAuthContext`)
- Login `/oficina/login`
- Shell com header + menu lateral (Dashboard, OS, Agenda, Mensagens, Histórico, Avaliações, Config)
- Dashboard com KPIs e agenda do dia
- Lista de OS com filtros e detalhes (read-only nesta fase)

**FASE 3 — Fluxo de Orçamento**
- Modal "Criar OS" no painel gestor (a partir da `maintenance_request` aprovada)
- No portal oficina: editor de orçamento (peças/MO/outros) + envio
- No painel gestor: revisão, aprovar/rejeitar/solicitar revisão
- Notificações dos dois lados

**FASE 4 — Execução e Conclusão**
- Oficina: iniciar/aguardando peças/finalizar com fotos antes/depois e NF
- Gestor: validar, marcar pagamento, anexar comprovante, avaliar (1-5★)
- Triggers automáticos (criar `maintenance_record`, atualizar `maintenance_request`, recalcular rating)

**FASE 5 — Calendário Unificado + Chat Realtime**
- Aba "Agenda" em `/app/manutencao` mesclando preventivas + corretivas (cores diferentes)
- Mesma agenda dentro do portal oficina
- Chat realtime via Supabase Realtime nas duas pontas
- Sistema de notificações (sino) consolidando os 3 papéis

**FASE 6 — Avaliações & Relatórios**
- Aba avaliações no portal oficina (com resposta)
- Relatório de OS por empresa/oficina/período + export Excel
- Histórico de garantias rastreáveis (warranty_until)

---

## Arquivos previstos na FASE 1

**Novos**
- `supabase/migrations/<ts>_workshop_users.sql`
- `supabase/migrations/<ts>_maintenance_work_orders.sql`
- `supabase/migrations/<ts>_work_order_messages.sql`
- `supabase/migrations/<ts>_workshops_portal_columns.sql`
- `supabase/functions/workshop-login/index.ts`
- `supabase/functions/workshop-invite/index.ts`
- `supabase/functions/workshop-accept-invite/index.ts`
- `supabase/functions/workshop-list/index.ts`

**Modificados**
- `src/lib/permissions.ts` (novo módulo `work_orders`)

## Rollback

Cada migration cria objetos novos — rollback = `DROP TABLE` na ordem inversa + `ALTER TABLE workshops DROP COLUMN`. Nenhuma coluna/tabela existente é tocada, então um rollback parcial não quebra nada do que já está no ar.

---

## Próximo passo

Se aprovar este plano, executo a **FASE 1 inteira** (migrations + edge functions + bucket + permissões), valido com chamadas de teste e te devolvo o relatório antes de começar a FASE 2 (UI).

Quer que eu siga assim, ou prefere ajustar algo na Fase 1 antes?