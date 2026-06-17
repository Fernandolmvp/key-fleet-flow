## Objetivo

Hoje a Manutenção tem 5 abas paralelas (Agenda, Preventivo, Corretivo, Custos, Histórico) e os dados moram em 4 tabelas distintas (`maintenance_requests`, `maintenance_schedules`, `maintenance_work_orders`, `maintenance_records`). Isso obriga o usuário a pular de tela em tela para entender "o que está acontecendo com cada carro". Vamos transformar isso em uma visão única, sequencial e por veículo, e fazer o status do veículo (`ativo` ↔ `manutencao`) acompanhar essa realidade automaticamente.

## O que muda na tela `/app/maintenance`

Nova estrutura de abas (na ordem do fluxo real):

```
[ Situação da frota ]  [ Agenda ]  [ Histórico & Custos ]  [ Configurações ]
       ↑ NOVA              ↑ unifica preventivo+corretivo+OS+solicitações
```

### Aba 1 — Situação da frota (default)
Lista 1 linha por veículo, ordenada por urgência. Cada linha mostra o **estado atual + próximo passo**:

```
PLACA  Modelo            Status agora        Próxima ação                 KM atual / alvo
ABC1D23 Fiat Strada      🔧 Em manutenção    OS #123 na Oficina X         85.412 km
                                              (em execução desde 14/06)
DEF4G56 VW Delivery      ⚠ Preventiva venc.  Sem agendamento — agendar     91.000 / 90.000
GHI7J89 Renault Master   ✅ Em dia            Próx. preventiva ~120k km     108.300 / 120.000
```

Cada linha é clicável → abre um drawer com a **timeline sequencial** do veículo:
`Solicitação → Aprovada → Agendada → OS aberta → Em execução → Concluída`, marcando onde está agora.

### Aba 2 — Agenda
Mantém a `AgendaSection` atual (calendário/lista) — já está boa. Removemos as abas separadas "Preventivo" e "Corretivo" da página principal e movemos os botões "Lançar corretiva / Agendar preventiva" para dentro da Agenda e do drawer do veículo, no contexto certo.

### Aba 3 — Histórico & Custos
Funde a aba "Histórico" + "Custos por veículo" de hoje. Tabela de registros concluídos + ranking de gasto por veículo + KPIs (gasto total, últimos 30 dias).

### Aba 4 — Configurações
Intervalo padrão de preventiva (já existe), default de oficina, etc.

## Status automático do veículo

Hoje `vehicles.status` é editado manualmente. Vamos sincronizar automaticamente:

| Evento                                                                                 | Vira         |
| -------------------------------------------------------------------------------------- | ------------ |
| OS muda para `em_execucao` **ou** registro `em_andamento` é criado/atualizado          | `manutencao` |
| Toda OS e todo registro do veículo estão `concluido`/`concluida`/`cancelada`           | `ativo`      |

Implementado via trigger em `maintenance_work_orders` e `maintenance_records` (AFTER INSERT/UPDATE), que recalcula `vehicles.status` olhando se existe algo em execução para aquele veículo. Não mexe em veículos `inativo` / `vendido` / `baixado`.

Toda transição automática gera linha em `vehicle_movements` com motivo `"auto: manutenção iniciada"` / `"auto: manutenção concluída"` para auditoria.

## Detalhes técnicos

- **Migration**: 1 função `public.recompute_vehicle_maintenance_status(uuid)` SECURITY DEFINER + 2 triggers (`maintenance_work_orders`, `maintenance_records`). Função ignora veículos com status terminal (`inativo`, `vendido`, `baixado`). Registra `vehicle_movements` apenas quando o status realmente muda.
- **Frontend**:
  - Novo componente `src/pages/app/maintenance/SituacaoSection.tsx` — busca em paralelo `vehicles` + `maintenance_work_orders` (não concluído) + `maintenance_records` (em_andamento/agendada) + `maintenance_schedules` (não concluída) + último `maintenance_record` concluído por veículo. Monta a linha + drawer com timeline.
  - `src/pages/app/Maintenance.tsx`: reorganiza `<Tabs>` para as 4 abas novas; remove "calendar" e "corretivo" como abas top-level (a lógica vai pra dentro do drawer/agenda). Mantém compatibilidade da chave de permissões expandindo para `["situacao","agenda","historico","config"]` com fallback para `agenda` se a permissão de `situacao` não existir ainda.
  - Drawer `VehicleMaintenanceTimeline.tsx` com 6 passos visuais e ações contextuais ("Abrir OS", "Marcar como concluída", "Agendar próxima preventiva").
- **Sem alteração** em `frota-api`, em RLS existente, em schemas das tabelas (só nova função + triggers) e em telas fora de `/app/maintenance`.

## Critérios de aceite

1. Abrir `/app/maintenance` cai em "Situação da frota" e mostra todos os veículos ordenados por urgência, com o status real.
2. Criar/iniciar uma OS muda o veículo para `manutencao` sozinho (visível na lista de Veículos sem reload manual graças ao `useAutoRefresh` já instalado).
3. Concluir a última OS/registro em aberto devolve o veículo para `ativo` automaticamente.
4. A Agenda continua funcionando igual (mesmo `AgendaSection`, mesmos eventos).
5. Histórico e Custos seguem mostrando os mesmos números de hoje, só fundidos em uma aba.
6. Nenhuma mudança em `supabase/functions/frota-api/index.ts`.
