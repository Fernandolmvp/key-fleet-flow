
# Refatoração Posto + Infra de Convite para Parceiros

Objetivo: substituir a criação top-down de usuários de parceiros (Posto e futura Oficina) por **convite por email + senha definida pelo parceiro**, sem quebrar o que já funciona.

---

## Estado atual (verificado)

- `posto-jwt.ts` faz HS256 + PBKDF2; usado por `posto-login`, `posto-confirm`, `posto-list`, `posto-admin-user`.
- `posto-admin-user` action `create` recebe senha do gestor (será trocado).
- Não há integração Resend no projeto. Para emails transacionais usaremos a infraestrutura nativa **Lovable Emails** (`send-transactional-email` + queue), que precisa de domínio configurado.
- Não existe tabela `partner_invitations`.
- `fuel_station_users` tem RLS apenas pelo lado do gestor (`is_company_member` / `can_manage_fleet`); o portal do posto opera via JWT próprio (service role).

---

## Etapa 0 — Pré-requisito email

Antes de mandar convite por email é preciso domínio configurado em Lovable Emails.
Se ainda não houver, abrirei o diálogo de setup de domínio e só depois sigo as etapas 3+.
Enquanto isso, etapas 1, 2, 4 (parcial), 7 podem ser feitas — o convite ficará gravado e pode ser exibido como link copiável temporário até o email estar ativo.

---

## Etapa 1 — Helper compartilhado

Novo arquivo: `supabase/functions/_shared/partner-auth.ts`
- Tipo `PartnerType = 'station' | 'workshop'`
- `signPartnerJwt(claims, ttl)` / `verifyPartnerJwt(token)` — assinatura HS256, claim extra `partner_type`, escopo do segredo `"partner::"`.
- `hashPassword` / `verifyPassword` (PBKDF2, idêntico ao atual).
- `corsHeaders` reexportado.

Para **não quebrar tokens já emitidos**, `posto-jwt.ts` é mantido como wrapper:
```ts
export * from "./partner-auth.ts";
// signPostoJwt/verifyPostoJwt continuam, internamente delegam ao novo helper
// usando o mesmo prefixo de segredo "posto::" para não invalidar JWTs antigos.
```
→ Login e confirmação atuais do Posto continuam funcionando inalterados.

---

## Etapa 2 — Migration `partner_invitations`

```sql
create table public.partner_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  partner_type text not null check (partner_type in ('station','workshop')),
  partner_id uuid not null,                 -- fuel_stations.id ou workshops.id
  email text not null,
  name text not null,
  role text not null default 'operador',
  token text not null unique,               -- 32 bytes random base64url
  status text not null default 'pending'    -- pending|accepted|expired|cancelled
    check (status in ('pending','accepted','expired','cancelled')),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  cancelled_at timestamptz,
  resent_count int not null default 0,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.partner_invitations(company_id, status);
create index on public.partner_invitations(partner_type, partner_id);

alter table public.partner_invitations enable row level security;

create policy "members read invitations"
  on public.partner_invitations for select to authenticated
  using (public.is_company_member(auth.uid(), company_id));

create policy "managers write invitations"
  on public.partner_invitations for all to authenticated
  using (public.can_manage_fleet(auth.uid(), company_id))
  with check (public.can_manage_fleet(auth.uid(), company_id));

create trigger trg_partner_inv_upd before update on public.partner_invitations
  for each row execute function public.set_updated_at();
```

---

## Etapa 3 — Edge functions novas

Todas com `verify_jwt = false` (próprio fluxo) e CORS padrão.

### `partner-invite`
- Input: `{ company_id, partner_type, partner_id, email, name, role? }`
- Auth: JWT do gestor (Supabase Auth) + `can_manage_fleet`.
- Valida que `partner_id` existe na tabela do tipo (`fuel_stations`/`workshops`) e pertence à `company_id`.
- Bloqueia se já existe `pending` para esse `(partner_id, email)`; bloqueia se já existe usuário ativo com esse email no parceiro.
- Gera token (`crypto.getRandomValues(32)` → base64url), insere em `partner_invitations`.
- Chama `send-transactional-email` com template `partner_invite` e variáveis `{ companyName, partnerName, partnerType, acceptUrl }`.
- Retorna `{ ok, invitation_id, accept_url }` (URL ajuda durante setup de email).

### `partner-accept-invite`
- Input: `{ token, password }` (público).
- Busca invite `pending` não expirado; se expirado → marca `expired`, erro.
- Valida senha ≥ 8 chars.
- Em transação lógica (admin client):
  - Se `partner_type='station'` → insere em `fuel_station_users` com `password_hash`.
  - Se `partner_type='workshop'` → insere em `workshop_users` (futuro).
- Marca invite `accepted`, `accepted_at = now()`.
- Emite JWT via `signPartnerJwt` e devolve `{ token, user, partner, redirect: '/posto'|'/oficina' }`.

### `partner-resend-invite`
- Input: `{ invitation_id }`. Auth gestor.
- Se `status in ('pending','expired')`: gera novo token, `expires_at = now()+7d`, `status='pending'`, `resent_count++`, reenvia email. Caso contrário erro.

### `partner-cancel-invite`
- Input: `{ invitation_id }`. Auth gestor. Atualiza para `cancelled`.

### `posto-admin-user` (refator)
- `action='create'` agora **redireciona** internamente para `partner-invite` (mantendo o endpoint para a UI), recebendo apenas `email`/`name`/`role`.
- `reset_password` muda: cria novo `partner_invitations` (com flag interna ou novo `status='reset'`) e envia email — gestor não define senha. (Alternativa: campo `kind in ('invite','reset')` na tabela.)
- `toggle_active` / `delete` inalterados.

> Decisão recomendada: adicionar coluna `kind text not null default 'invite' check (kind in ('invite','reset'))` em `partner_invitations` para reaproveitar o fluxo no reset.

`supabase/config.toml` ganha:
```
[functions.partner-invite]
verify_jwt = false
[functions.partner-accept-invite]
verify_jwt = false
[functions.partner-resend-invite]
verify_jwt = false
[functions.partner-cancel-invite]
verify_jwt = false
```

---

## Etapa 4 — UI em `/app` (FuelStations.tsx + nova subseção “Acessos”)

No card de cada posto, novo botão **"Acessos do parceiro"** abrindo dialog com 2 listas:
- **Usuários ativos** (de `fuel_station_users`): nome, email, último login, ações (desativar / excluir / enviar reset).
- **Convites** (de `partner_invitations` filtrando `partner_type='station'`, `partner_id=...`): email, status, expira em, ações (reenviar / cancelar / copiar link).

Form "Novo acesso":
- Campos: **Nome**, **Email**, **Função** (operador/admin do posto).
- Texto: *"Enviaremos um convite por email. O responsável definirá a própria senha."*
- Submit → `supabase.functions.invoke('partner-invite', ...)`.

Nada da UI antiga é removido até a transição estar validada — o botão antigo "Criar usuário com senha" some, mas usuários já existentes continuam aparecendo.

---

## Etapa 5 — Tela pública `/parceiro/convite`

Rota pública (fora de `RequireAuth`). Componente `PartnerInviteAccept.tsx`:

```text
┌──────────────────────────────────────────────────────┐
│  Convite para acessar o portal de parceiros          │
│                                                      │
│  Empresa: Transportes XYZ Ltda                       │
│  Parceiro: Posto Shell Centro (CNPJ 12.345.678/...)  │
│  Para: joao@postoshell.com                           │
│                                                      │
│  [ Nova senha           ]                            │
│  [ Confirmar senha      ]                            │
│  ☐ Li e aceito os Termos de Uso                      │
│                                                      │
│  [   Criar acesso e entrar   ]                       │
│                                                      │
│  Convite expira em 5 dias.                           │
└──────────────────────────────────────────────────────┘
```

Fluxo:
1. `GET ?token=...` → chama `partner-invite-info` (ou `partner-accept-invite` em modo `peek`) para mostrar dados sem aceitar.
2. Submit → `partner-accept-invite` → grava JWT em `PostoAuthContext` (ou `OficinaAuthContext`) e redireciona para `/posto` ou `/oficina`.
3. Tratamento de erros: token inválido / expirado / já usado / cancelado.

---

## Etapa 6 — Email de convite

Template `partner_invite` em `supabase/functions/_shared/email-templates/`:

Assunto: `Você foi convidado para o portal de parceiros — {{companyName}}`

Corpo (resumo):
> Olá {{partnerName}},
> A empresa **{{companyName}}** convidou você para acessar o portal de **{{partnerTypeLabel}}** ({{partnerName}}).
> Clique no botão abaixo para definir sua senha e ativar o acesso. O convite expira em 7 dias.
>
> [ Aceitar convite ] → `{{acceptUrl}}`
>
> Se não esperava este convite, ignore este email.

Branding herdado dos tokens do app (background branco, cores via CSS vars).

---

## Etapa 7 — RLS reforçado

Migration adicional:
- `fuel_station_users`: políticas atuais (gestor) ficam; nada do lado portal precisa mudar (continua via service role com filtro por `station_id` do JWT).
- Confirmar que `fuel_stations` tem SELECT restrito (já tem via `is_company_member`).
- `partner_invitations` já vem com RLS (etapa 2).
- Adicionar índice único parcial: `create unique index on partner_invitations(partner_id, lower(email)) where status='pending';` para evitar convites duplicados simultâneos.

---

## Backwards compatibility

- `posto-jwt.ts` continua exportando `signPostoJwt` / `verifyPostoJwt` com **mesmo segredo derivado** (`"posto::"`), portanto JWTs já emitidos seguem válidos.
- `fuel_station_users` criados antes da refatoração continuam logando normalmente em `posto-login`.
- `posto-admin-user` mantém endpoint e payload — só muda o efeito do `create`.
- Nada é deletado; apenas adicionado.

---

## Plano de rollback

| Mudança | Como reverter |
|---|---|
| Migration `partner_invitations` | `drop table public.partner_invitations;` (não referenciada por FKs externas) |
| Edge functions novas | `supabase--delete_edge_functions(['partner-invite','partner-accept-invite','partner-resend-invite','partner-cancel-invite'])` |
| `posto-admin-user` refator | Reverter o arquivo para versão anterior (mantida no git) — payload é o mesmo |
| `partner-auth.ts` | Remover; `posto-jwt.ts` original já segue funcional |
| UI FuelStations | Reverter componente; usuários antigos seguem inalterados |
| Rota `/parceiro/convite` | Remover do `App.tsx` |

Como nada destrói dados existentes, rollback é seguro a qualquer momento.

---

## Detalhes técnicos para implementação

- Token de convite: 32 bytes random → base64url (43 chars). URL: `${SITE_URL}/parceiro/convite?token=...`.
- `SITE_URL` derivado de `VITE_SUPABASE_URL` não — usar variável `PUBLIC_APP_URL` ou `req.headers.get('origin')` no `partner-invite`.
- Rate limit simples no `partner-accept-invite`: máx 5 tentativas por token (coluna `attempts`).
- Logging em `audit_logs` para `partner_invitations` (insert/accept/cancel) opcional.
- Nenhuma alteração em `posto-confirm`, `posto-list`, `posto-login`.

---

## Ordem de execução proposta

1. Verificar status de domínio de email (Lovable Emails) — bloqueante para email real, não para o resto.
2. Migration `partner_invitations` (Etapa 2 + índice parcial da 7).
3. `_shared/partner-auth.ts` + wrapper em `posto-jwt.ts` (Etapa 1).
4. Edge functions `partner-invite/accept/resend/cancel` + entradas em `config.toml` (Etapa 3).
5. Refator `posto-admin-user` (Etapa 3 final).
6. UI em `FuelStations.tsx` + dialog de acessos (Etapa 4).
7. Rota pública `/parceiro/convite` (Etapa 5).
8. Template de email + deploy (Etapa 6).
9. Teste end-to-end com um posto real.

Aguardo sua aprovação para executar.
