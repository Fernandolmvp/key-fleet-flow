
# Sistema de autorização de abastecimento + Portal do Posto

Antes de executar — observação importante: já existem na base hoje campos e função muito próximos do que você pediu. Vou **reaproveitar** o que existe em vez de duplicar (pra não quebrar o fluxo atual de aprovações). Onde você pediu campo novo, eu mapeio pro existente:

| Pedido | Já existe / Ação |
|---|---|
| `authorization_code` | já existe em `fuel_authorizations` |
| `code_generated_at` | usar `approved_at` (já existe) |
| `code_expires_at` | usar `expires_at` (já existe, default +24h — vou ajustar pra 2h) |
| `code_used_at` | usar `used_at` / `confirmed_at` (já existem) |
| `approved_amount` | **novo** — adicionar |
| `status_authorization` | usar enum `fuel_auth_status` existente (`pendente / aprovada / utilizada / expirada / cancelada`). "em_uso" = `aprovada`, "concluida" = `utilizada` |
| `generate_authorization_code` RPC | já existe `generate_fuel_auth_code()` + trigger `tg_fuel_auth_on_approve` |

---

## Etapa 1 — Banco (1 migration nova)

**Tabela `fuel_authorizations`** — adicionar:
- `approved_amount numeric` (valor máximo autorizado)
- ajustar default de `expires_at` para `now() + 2h` ao aprovar (alterar `tg_fuel_auth_on_approve`)

**Nova tabela `fuel_station_users`**:
- `id, station_id (FK fuel_stations), email unique, password_hash, name, role text, active bool, created_at, updated_at`
- Senha **não** armazenada em texto puro — `password_hash` (bcrypt feito pela edge function)
- RLS: bloqueado pra `anon`/`authenticated` no client. Acesso só via edge function com `service_role` (o portal do posto NÃO usa Supabase Auth do app — login próprio via edge function que emite JWT curto)

**RPC `confirm_authorization_by_station(code, station_id, liters, total_value, receipt_number, receipt_url)`**:
- security definer, validações: código existe, status='aprovada', `expires_at > now()`, `fuel_station_id = station_id`
- Se `approved_amount` definido e `total_value > approved_amount` → erro
- Insere `fuel_records` (origem `posto_portal`)
- Atualiza autorização: `status='utilizada'`, `used_at=now()`, `confirmed_at=now()`, vincula `fuel_record_id`
- Retorna o id do fuel_record criado

**RPC `generate_authorization_code(authorization_id)`** — wrapper público (chama a função interna existente, retorna o code).

---

## Etapa 2 — App do motorista (Colaborador)

Em `src/pages/app/Colaborador.tsx` (ou componente filho de "Solicitar Abastecimento" que já existe):
- Adicionar seleção de posto (`fuel_stations`)
- Foto do hodômetro + foto da placa → upload no bucket `driver-uploads`
- Chamar edge function `extract-document` (já existe) pra validar placa e km via IA
- Após aprovação, exibir tela cheia com **código de 6 dígitos**, contador regressivo até `expires_at`, e botão "Atualizar status"

---

## Etapa 3 — Portal do posto `/posto`

**Rotas novas em `App.tsx`** (fora de `RequireAuth` e `AppLayout`):
- `/posto/login` — `PostoLogin.tsx`
- `/posto` — `PostoShell.tsx` (protegido por contexto próprio)
  - Aba **Confirmar** — `PostoConfirmar.tsx`
  - Aba **Histórico** — `PostoHistorico.tsx`

**Edge functions novas**:
- `posto-login` — recebe email+senha, valida bcrypt em `fuel_station_users`, retorna JWT assinado (HS256, secret `POSTO_JWT_SECRET`) com `station_id` e expiração 12h
- `posto-confirm` — recebe JWT + payload, chama `confirm_authorization_by_station` com service role, dispara email
- `posto-list` — recebe JWT, retorna histórico filtrado (período, placa, motorista) pro `station_id` do token

**Fluxo confirmar**: digitar código → preview placa/motorista/valor autorizado → preencher litros, total, nº cupom, foto do cupom → confirmar → toast sucesso.

**Histórico**: filtros (data início/fim, placa, motorista). Botões **Exportar PDF** (jsPDF + autoTable) e **Excel** (xlsx) gerando arquivo no client.

**Contexto de auth do posto**: `PostoAuthContext` salva JWT em `localStorage` (`posto_token`), `RequirePosto` redireciona pra `/posto/login` se ausente/expirado.

---

## Etapa 4 — Email automático

Edge function `posto-confirm` chama, após sucesso, função `send-fuel-confirmation-email` (nova) que usa **Lovable Emails** (infra já configurada — verificar se há domain). Template:
- Empresa do veículo (busca pelo `company_id` da autorização)
- Dados veículo, motorista, posto, data, litros, valor, nº cupom
- Anexo: foto do cupom (URL do storage assinada)
- Código usado pra rastreabilidade

⚠️ Se o domínio de email Lovable ainda não estiver configurado, vou avisar e o email fica como TODO até você configurar — o resto do fluxo funciona normalmente.

---

## Arquivos modificados / criados

**Migrations** (1 nova):
- `supabase/migrations/<ts>_posto_portal.sql`

**Edge functions** (novas):
- `supabase/functions/posto-login/index.ts`
- `supabase/functions/posto-confirm/index.ts`
- `supabase/functions/posto-list/index.ts`
- `supabase/functions/send-fuel-confirmation-email/index.ts`
- `supabase/config.toml` — registrar com `verify_jwt = false` (auth própria)

**Frontend novo**:
- `src/contexts/PostoAuthContext.tsx`
- `src/components/auth/RequirePosto.tsx`
- `src/pages/posto/PostoLogin.tsx`
- `src/pages/posto/PostoShell.tsx`
- `src/pages/posto/PostoConfirmar.tsx`
- `src/pages/posto/PostoHistorico.tsx`

**Frontend editado**:
- `src/App.tsx` — adicionar rotas `/posto/*`
- `src/pages/app/Colaborador.tsx` (ou componente da tela "Solicitar Abastecimento") — fluxo de foto + código

**Dependências novas**: `bcryptjs` (edge), `jspdf`, `jspdf-autotable`, `xlsx` (frontend portal)

**Secret novo**: `POSTO_JWT_SECRET` (vou pedir via add_secret)

---

## Garantias de não-quebra

- Trigger `tg_fuel_record_sync_auth` continua válido — `fuel_records` criado pela RPC carrega `authorization_id`
- Enum `fuel_auth_status` é reaproveitado, nada removido
- `tg_fuel_auth_require_record_on_use` continua barrando "utilizada" sem fuel_record (a RPC cria o record antes)
- Fluxo manual atual de aprovação no app continua funcionando — código de 6 dígitos passa a expirar em 2h em vez de 24h (esse é um comportamento intencional do pedido — confirme se OK)

---

## Pontos pra você confirmar antes de executar

1. **Expiração 2h**: troco o default de 24h pra 2h em **toda** autorização, ou só pras que vêm do app do motorista?
2. **Email**: posso seguir e deixar TODO se não houver domain configurado? Ou prefere configurar Lovable Emails primeiro?
3. **`approved_amount`**: bloquear estritamente se `total_value > approved_amount`, ou só avisar?
4. **Cadastro de usuários do posto**: crio uma tela de admin (super admin) pra cadastrar `fuel_station_users`, ou por enquanto inserção manual via SQL?

Posso executar?
