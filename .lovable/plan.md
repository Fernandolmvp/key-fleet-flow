## Módulo Completo de Multas — Plano de Implementação

Vou implementar o sistema completo de gestão de multas em 10 etapas sequenciais conforme especificado, em uma única execução.

### ETAPA 1 — Migration `traffic_fines` (recriar tabela)

A tabela atual `traffic_fines` é mínima (do placeholder). Como ainda não tem dados em produção, vou:
- `DROP TABLE IF EXISTS public.traffic_fines CASCADE`
- Criar novamente com TODOS os campos do escopo (record_type, status expandido, dados infração, notificação, indicação, recurso, pagamento, anexos, IA, audit)
- RLS: `is_company_member` SELECT, `can_manage_fleet` ALL
- Trigger `update_updated_at_column`
- Trigger de audit log para todas mudanças
- Índices em (company_id, vehicle_id), (status), (driver_id)

### ETAPA 2 — Edge Function `extract-traffic-fine`

- Nova função em `supabase/functions/extract-traffic-fine/index.ts`
- Recebe `{ fileBase64, mimeType }`
- Chama Lovable AI (`google/gemini-2.5-flash` via gateway)
- Tool calling para JSON estruturado: tipo (aviso/notificacao), placa, datas, local, infração, AIT, valor, pontos, prazos, confiança
- Trata 429/402
- `verify_jwt = false` em config.toml (segue padrão das outras extract-*)

### ETAPA 3 — UI principal `/app/multas`

Substitui placeholder por:
- **Header KPIs (5 cards)**: Avisos aguardando notif (azul), Multas a vencer 7d (vermelho), Em recurso (laranja), Total pendente R$, Pontos em risco
- **Filtros**: tipo registro, status, motorista, veículo, período (Select + DatePicker)
- **Botões**: 🤖 "Cadastrar via Foto" (primary), ✏️ "Cadastrar Manualmente"
- **Lista de cards**: visual diferenciado AVISO (azul claro) vs MULTA (cor por status), ações contextuais

Arquivo principal: `src/pages/app/Multas.tsx` (rewrite completo).

Componentes:
- `src/components/fines/FinesKpis.tsx`
- `src/components/fines/FineCard.tsx`
- `src/components/fines/FineFiltersBar.tsx`
- `src/components/fines/FinePhotoUploadDialog.tsx` (etapa principal IA)
- `src/components/fines/FineFormDialog.tsx` (manual + edição, abas Aviso/Notificação)
- `src/components/fines/FineDetailsDialog.tsx` (timeline + ações)
- `src/components/fines/ConvertAvisoDialog.tsx` (etapa 4)
- `src/components/fines/IndicateDriverDialog.tsx` (etapa 5)
- `src/components/fines/RecourseDialog.tsx` (etapa 6 — abrir + atualizar resultado)
- `src/components/fines/PaymentDialog.tsx` (etapa 7)

Helper: `src/lib/fines.ts` — tipos, status labels/cores, severity labels, fluxo de transição.

### ETAPA 4 — Conversão AVISO → MULTA

Botão "Converter em Multa" no card de aviso → abre `ConvertAvisoDialog`:
1. Mantém dados da infração já preenchidos
2. Solicita upload da notificação oficial (chama `extract-traffic-fine`)
3. Preenche campos da notificação
4. Update: `record_type='multa'`, `status='multa_autuada'`, dados de notificação
5. Audit log automático via trigger

### ETAPA 5 — Indicação de Motorista

`IndicateDriverDialog`:
- Select de motorista (lista de `drivers` da empresa)
- Mostra dados (CNH, validade)
- Radio: "Indicação manual" vs "Solicitar confirmação no app" (placeholder)
- Update: `driver_id`, `driver_indicated_at`, `driver_indication_method`, `status='motorista_indicado'`

### ETAPA 6 — Recurso

`RecourseDialog` (modo "abrir"):
- Tipo defesa (defesa_previa/jari/cetran) → salvo em `recourse_notes`
- Argumentos (textarea)
- Upload documento (storage `fines-attachments`)
- Data protocolo
- Update: `recourse_filed_at`, `recourse_document_url`, `status='em_recurso'`

`RecourseDialog` (modo "resultado"):
- Radio deferido/indeferido
- Data resultado
- Notas
- Update: `recourse_result`, `recourse_result_date`, status condicional

### ETAPA 7 — Pagamento

`PaymentDialog`:
- Data, valor, método, upload comprovante
- Detecção automática: `paid_amount === discount_amount` → `paga_com_desconto`, senão `paga_integral`
- Update: `paid_at`, `paid_amount`, `payment_method`, `payment_receipt_url`, `status`

### ETAPA 8 — Alertas Automáticos

Função SQL `update_fines_auto_status()`:
- Avisos com >60 dias sem `notification_received_date` → `arquivada` + nota
- Multas com `due_date < CURRENT_DATE` e não pagas → `vencida`

Cron schedule diário via `pg_cron` + edge function `fines-daily-check` (ou só SQL function se for tudo no banco). Vou usar SQL function + pg_cron direto.

Alertas visuais (vencimento 7d, prazo recurso, pontos CNH) calculados no frontend em tempo real (já refletidos nos KPIs + badges nos cards).

### ETAPA 9 — Relatórios

Aba "Relatórios" dentro de `/app/multas` (Tabs no topo: Lista | Relatórios):
- **Por motorista**: tabela com qtd, pontos, valor total, ranking, badge "próximo de 20 pontos"
- **Por veículo**: tabela com histórico, custo total, locais mais comuns
- **Por período**: gráfico mensal (recharts), top infrações, top locais

Componente: `src/components/fines/FinesReports.tsx`.

### ETAPA 10 — Landing Page

`src/pages/Landing.tsx`: localizar feature card "Controle de Multas" e atualizar descrição com bullets do escopo. Remover badge "Em breve" deste item.

### Storage

Bucket `fines-attachments` (privado, scoped por company_id). Migration cria bucket + policies.

### Sidebar

`AppLayout.tsx`: remover badge "Soon" do item "Multas".

### Garantias
- Migration aditiva (DROP só da tabela placeholder vazia + recriação)
- Outras tabelas/fluxos intocados
- IA opcional (botão manual sempre disponível)
- PT-BR em toda UI
- Audit log via trigger genérico

### Plano de Rollback
- DROP TABLE traffic_fines + recriar versão simples do placeholder
- Restaurar `Multas.tsx` para `ModulePlaceholder`
- Remover componentes em `src/components/fines/`
- Remover edge function `extract-traffic-fine`
- Remover bucket `fines-attachments`

Confirma para eu executar tudo de uma vez?
