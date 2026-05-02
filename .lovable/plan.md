# FrotaOps — Documentação Técnica da Arquitetura Atual

Análise descritiva do estado real do sistema (`/dev-server`, banco Supabase ref `qvhgivhlgumcxaneizzb`). Sem recomendações — apenas o que existe hoje.

---

## 1. Visão geral da arquitetura

Aplicação SPA (Single Page Application) **client-heavy**: praticamente toda a lógica de negócio roda no navegador, falando direto com o PostgreSQL via PostgREST (Supabase) e usando RLS + triggers como camada de regras. Há um conjunto pequeno de Edge Functions (Deno) para tarefas que exigem chave secreta ou privilégio elevado (IA, criação de usuários auth, Stripe).

```text
┌───────────────────────────────────────────────────────────────────┐
│ Browser (Vite + React 18 SPA, hospedado pela Lovable)             │
│  ├─ React Router (rotas /app, /motorista, /super-admin, /auth/*) │
│  ├─ AuthContext (Supabase Auth JS)                                │
│  ├─ TanStack Query (provider, mas uso direto via supabase-js)    │
│  └─ supabase-js  ──────────► PostgREST  (RLS por empresa)        │
│                  ──────────► Storage (12 buckets)                 │
│                  ──────────► Auth (email/senha)                   │
│                  ──────────► functions.invoke(...)                │
└──────────────────────────┬────────────────────────────────────────┘
                           │
       ┌───────────────────┼─────────────────────────────┐
       ▼                   ▼                             ▼
  Edge Functions    Postgres (public)              Stripe (gateway
  Deno runtime      • 36 tabelas                    Lovable)
  • extract-document  • 22 enums                    • create-checkout
  • driver-onboarding • ~25 triggers                • portal-session
  • create-checkout   • RPCs (has_role,             • payments-webhook
  • portal-session      bootstrap_*, apply_…)       (sandbox/live)
  • payments-webhook  • RLS multi-tenant
  • extract-insurance  └ Lovable AI Gateway (openai/google)
```

---

## 2. FRONT-END

### 2.1 Stack
- **Build**: Vite 5.4 + `@vitejs/plugin-react-swc` 3.11
- **Linguagem**: TypeScript 5.8, React 18.3
- **Roteamento**: `react-router-dom` 6.30 (BrowserRouter)
- **Estilização**: Tailwind CSS 3.4 + `tailwindcss-animate` + `tailwind-merge` + `class-variance-authority`. Design system próprio em `src/index.css` (HSL semânticas: `--background`, `--primary` cyan `#00D4FF`, `--sidebar-*`, gradientes `--gradient-primary/surface/glow/card`, sombras `--shadow-glow/elevated/card`). Tema `dark` fixo (Sonner inicializado com `theme="dark"`).
- **UI**: shadcn/ui completo (todos os Radix primitives — accordion, dialog, dropdown, select, tabs, toast, tooltip, etc.) em `src/components/ui/*`
- **Forms**: `react-hook-form` 7.61 + `@hookform/resolvers` + `zod` 3.25
- **Charts**: `recharts` 2.15
- **Ícones**: `lucide-react` 0.462
- **Notificações**: `sonner` 1.7 (toaster global) + `@/components/ui/toaster` (radix toast) — **ambos** montados em `App.tsx`
- **Datas**: `date-fns` 3.6
- **Server state**: `@tanstack/react-query` 5.83 — `QueryClient` instanciado em `App.tsx` mas **as páginas chamam `supabase` direto** (useState/useEffect); React Query está praticamente ocioso
- **Pagamento**: `@stripe/react-stripe-js` 6.2 + `@stripe/stripe-js` 9.2 (embedded checkout)
- **Tagger Lovable**: `lovable-tagger` em modo dev
- **Test**: vitest 3 + jsdom + Testing Library (somente `src/test/example.test.ts` existe)

### 2.2 Estrutura de pastas (`src/`)

```text
src/
├── App.tsx                     # raiz: providers + Routes
├── main.tsx                    # bootstrap
├── index.css                   # design tokens (HSL) + utilitários
├── tailwind.config.lov.json
├── App.css
├── vite-env.d.ts
│
├── contexts/
│   └── AuthContext.tsx         # único contexto global (sessão + empresa + roles)
│
├── integrations/
│   └── supabase/
│       ├── client.ts           # createClient (auto-gerado)
│       └── types.ts            # tipos Database (auto-gerado)
│
├── components/
│   ├── layout/AppLayout.tsx    # shell principal (sidebar + topo)
│   ├── NavLink.tsx
│   ├── SubscriptionBanner.tsx
│   ├── PaymentTestModeBanner.tsx
│   ├── StripeEmbeddedCheckout.tsx
│   ├── dashboard/              # diálogos e widgets de domínio
│   │   ├── VehicleDialog.tsx, DriverHistoryTab.tsx
│   │   ├── FuelDialog.tsx, MaintenanceDialog.tsx
│   │   ├── ChecklistDialog.tsx, ChecklistRunDialog.tsx,
│   │   │   ChecklistTemplateBuilder.tsx
│   │   ├── DocumentDialog.tsx, InsurancePanel.tsx
│   │   ├── TireDialog.tsx, TireMovementDialog.tsx, TireAxleMap.tsx
│   │   └── KpiCard.tsx
│   └── ui/                     # 50+ componentes shadcn
│
├── hooks/  (use-mobile, use-toast)
│
├── lib/                        # helpers puros e wrappers
│   ├── ai-extract.ts           # invoca edge "extract-document" + arquiva no Storage
│   ├── checklist.ts, checklists.ts
│   ├── documents.ts, fuel.ts (rótulos/formatadores)
│   ├── maintenance.ts, tires.ts
│   ├── stripe.ts
│   └── utils.ts (cn = clsx+twMerge)
│
└── pages/
    ├── auth/
    │   ├── Login.tsx           # tabs Empresa (email+senha) | Motorista (CPF+senha)
    │   ├── Signup.tsx
    │   ├── DriverFirstAccess.tsx  # wizard CPF→contato→OTP→criar senha
    │   └── ResetPassword.tsx
    ├── motorista/
    │   └── MotoristaShell.tsx  # wrapper que renderiza <Colaborador/>
    ├── admin/
    │   ├── SuperAdmin.tsx      # painel global (planos, empresas, uso)
    │   └── SuperAdminBootstrap.tsx
    ├── app/                    # 14 páginas do gestor
    │   ├── Dashboard.tsx, Vehicles.tsx, Drivers.tsx
    │   ├── FuelStations.tsx, Fuel.tsx, Approvals.tsx
    │   ├── Maintenance.tsx, Checklists.tsx, Tires.tsx
    │   ├── Documents.tsx, Insurance.tsx, Brokers.tsx
    │   ├── Subscription.tsx, Colaborador.tsx
    └── NotFound.tsx
```

### 2.3 Roteamento (`App.tsx`)

| Rota                          | Componente                  | Acesso                                |
|-------------------------------|-----------------------------|----------------------------------------|
| `/`                           | redirect → `/app`           | público                                |
| `/login`, `/signup`           | Login, Signup               | público                                |
| `/motorista/primeiro-acesso`  | DriverFirstAccess           | público                                |
| `/motorista`                  | MotoristaShell → Colaborador| autenticado com role motorista/admin/gestor |
| `/reset-password`             | ResetPassword               | via deep-link                          |
| `/super-admin[/ativar]`       | SuperAdmin/Bootstrap        | autenticado (gate interno via `is_super_admin`) |
| `/app`                        | AppLayout (Outlet)          | autenticado; `isDriverOnly` ⇒ redireciona p/ `/motorista` |
| `/app/{dashboard,vehicles,drivers,fuel-stations,fuel,approvals,maintenance,checklists,tires,documents,insurance,brokers,assinatura}` | páginas de gestão | autenticado |
| `*`                           | NotFound                    | —                                      |

`AppLayout` faz a guarda: `loading` → spinner; `!user` → `<Navigate to="/login">`; `isDriverOnly` → `<Navigate to="/motorista">`. Marcadas como `soon` (placeholder, sem rota): `/app/fines`, `/app/alerts`, `/app/reports`, `/app/settings`.

### 2.4 Gerenciamento de estado

- **Global**: apenas `AuthContext` (sessão Supabase, lista de empresas, `currentCompanyId`, `roles[]`, derivados `isManager`, `isDriverOnly`, `isSuperAdmin`).
- **Server state**: `QueryClient` do TanStack Query é provider, mas **uso real é direto** via `supabase.from(...)` dentro de `useEffect`/`useState` em cada página (ex.: `Fuel.tsx`, `Dashboard.tsx`).
- **Local**: `useState`/`useEffect` por página/dialog. Não há Redux/Zustand/Jotai.
- **Persistência de sessão**: `localStorage` (configurado em `client.ts` com `persistSession: true`, `autoRefreshToken: true`).
- **Badges/contadores**: `AppLayout` faz polling por mudança de rota (`useEffect` dependente de `loc.pathname`) para `documents` vencendo/vencidos e `fuel_authorizations` pendentes.

### 2.5 Comunicação entre telas

Não há barramento de eventos nem cache compartilhado. Cada tela:
1. Lê `currentCompanyId` do `AuthContext`.
2. Dispara `supabase.from(...).select(...).eq('company_id', currentCompanyId)`.
3. Mantém estado local; após mutação, recarrega chamando uma `load()` própria.

Diálogos (`*Dialog.tsx`) recebem `onSaved` callback; a página pai re-executa `load()`.

### 2.6 Autenticação no front

- `AuthProvider` registra `supabase.auth.onAuthStateChange` + `getSession()` no mount.
- Após sessão ativa: carrega super_admin flag, `company_members` (com embed `companies`), `profiles.current_company_id`, e `user_roles` da empresa atual.
- Trocar empresa = `UPDATE profiles.current_company_id` + recarregar `user_roles`.
- `Login.tsx` tem dois fluxos:
  - **Empresa**: `signInWithPassword(email,password)`.
  - **Motorista**: chama edge `driver-onboarding` action `lookup-by-cpf` para resolver email a partir do CPF, depois `signInWithPassword(email, pwd6digitos)`.

---

## 3. BACK-END

### 3.1 Modelo

Não existe servidor de aplicação próprio. O backend é a combinação:
- **PostgREST** do Supabase (CRUD direto sobre `public.*`)
- **PostgreSQL** (regras de negócio em triggers + funções `SECURITY DEFINER`)
- **Edge Functions** (Deno) para o que precisa de service role, segredos ou IA.

### 3.2 Edge Functions (`supabase/functions/`)

| Função                  | `verify_jwt` | Propósito                                                                 |
|-------------------------|--------------|---------------------------------------------------------------------------|
| `extract-document`      | false        | OCR/extração estruturada via Lovable AI Gateway (`google/gemini-*`, `openai/gpt-*`) com tool calling. Tipos: `vehicle` (CRLV), `driver` (CNH), `plate`, `odometer`, `maintenance_invoice`, `tire_invoice`, `document`, `fuel_receipt`. Usa `LOVABLE_API_KEY`. |
| `extract-insurance-policy` | (default) | Extração específica de apólices de seguro                                |
| `driver-onboarding`     | false        | Funções administrativas com `SUPABASE_SERVICE_ROLE_KEY`: `lookup-by-cpf`, criação/atualização de auth user para motorista, vínculo em `company_members` + `user_roles`+`profiles`, reset de senha por email, controle anti-abuso em `driver_onboarding_attempts` e OTP em `driver_otp_codes`. |
| `create-checkout`       | false        | Cria Stripe Checkout Session embedded (`ui_mode: embedded_page`) com `proration_behavior: create_prorations`. Usa Stripe via gateway Lovable (`https://connector-gateway.lovable.dev/stripe`) com `STRIPE_SANDBOX_API_KEY` ou `STRIPE_LIVE_API_KEY`. |
| `create-portal-session` | false        | Stripe Billing Portal                                                     |
| `payments-webhook`      | false        | Recebe webhooks Stripe (`?env=sandbox|live`). Verifica HMAC SHA-256 com `PAYMENTS_SANDBOX_WEBHOOK_SECRET`/`PAYMENTS_LIVE_WEBHOOK_SECRET` (janela 5 min). Trata `customer.subscription.{created,updated,deleted}`, `invoice.payment_{succeeded,failed}`, `checkout.session.completed`. Aplica via RPC `apply_stripe_subscription` e `record_stripe_payment`. |

Helper compartilhado: `_shared/stripe.ts` (`createStripeClient`, `verifyWebhook`).

### 3.3 Onde ficam as regras de negócio

Predominantemente **no banco**, em ~25 triggers (todas `SECURITY DEFINER`, `search_path=public`). Lista real (do `pg_trigger`):

| Tabela                    | Trigger                                | Função                                | Efeito                                                                 |
|---------------------------|----------------------------------------|---------------------------------------|------------------------------------------------------------------------|
| companies                 | `trg_company_subscription`             | `tg_company_create_subscription`      | Cria assinatura starter `aguardando_pagamento` ao criar empresa        |
| documents                 | `tg_documents_status`                  | `tg_documents_compute_status`         | Calcula `valido/vencendo/vencido/sem_validade` por `expires_at`        |
| drivers                   | `drivers_status_history`               | `tg_driver_log_status_change`         | Loga em `driver_status_history`                                        |
| drivers                   | `trg_drivers_block_delete`             | `tg_drivers_block_delete_with_movements` | Bloqueia DELETE se houver fuel/maint/checklist/auth                  |
| vehicles                  | `trg_vehicles_block_delete`            | `tg_vehicles_block_delete_with_movements` | Bloqueia DELETE com movimentos/pneus/checklists                     |
| vehicles                  | `trg_vehicles_plan_check`              | `tg_vehicles_enforce_plan`            | Limita por `plans.vehicle_limit`/`subscriptions.custom_vehicle_limit` e bloqueia se assinatura `suspensa`/`cancelada` |
| fuel_records              | `t_fuel_compute`                       | `tg_fuel_compute`                     | Calcula `km_driven`, `km_per_liter`, `cost_per_km`; popula `anomalies[]`+`anomaly_severity` (`km_regressivo`, `consumo_alto/baixo`, `tanque_excedido`, `duplicado`, `valor_atipico`, `horario_suspeito`); atualiza `vehicles.current_km` |
| fuel_records              | `trg_audit_fuel_records`               | `tg_audit_fuel`                       | Insere em `audit_logs`                                                 |
| fuel_records              | `trg_fuel_record_sync_auth`            | `tg_fuel_record_sync_auth`            | Atualiza autorização para `utilizada` + vincula `fuel_record_id`       |
| fuel_authorizations       | `trg_fuel_auth_auto_approve`           | `tg_fuel_auth_auto_approve`           | Auto-aprova se `drivers.auto_fuel_authorized=true`                     |
| fuel_authorizations       | `trg_fuel_auth_approve` + `_on_approve`| `tg_fuel_auth_on_approve`             | Gera `authorization_code` 6 dígitos único, `approved_at`, `expires_at = +24h` |
| fuel_authorizations       | `trg_fuel_auth_require_record`         | `tg_fuel_auth_require_record_on_use`  | Bloqueia transição → `utilizada` sem `fuel_record_id`                  |
| fuel_authorizations       | `trg_audit_fuel_auth`                  | `tg_audit_fuel`                       | Audit log                                                              |
| tire_movements            | `tire_movement_apply`                  | `tg_tire_movement_apply`              | Aplica efeito do movimento em `tires` (instalação/remoção/rodízio/recapagem/descarte/calibragem) |
| checklist_answers         | `tg_recalc_run_ai`                     | `tg_checklist_recalc_run`             | Recalcula totais e `score` no `checklist_runs`                         |
| checklist_runs            | `tg_open_os_bu`                        | `tg_checklist_open_os_on_complete`    | Se template `auto_open_os` e há `non_conform_items`, abre OS em `maintenance_records` |
| (várias)                  | `t_*_updated`                          | `tg_set_updated_at`                   | Atualiza `updated_at`                                                  |

**Funções RPC relevantes** (`public.*`, `SECURITY DEFINER` exceto onde indicado):
- `has_role(uid, company_id, role)`, `can_manage_fleet(uid, company_id)`, `is_company_member(uid, company_id)`, `is_super_admin(uid)` — usadas nas RLS.
- `handle_new_user()` — cria profile (não está como trigger ativo no `pg_trigger` listado, mas é usada por hook auth.users do Supabase).
- `bootstrap_company(name, full_name)` — cria empresa, vincula como `admin`.
- `bootstrap_super_admin(email)` — primeiro super admin auto-promove se tabela vazia.
- `generate_fuel_auth_code()` — código 6 dígitos único.
- `apply_stripe_subscription(...)` e `record_stripe_payment(...)` — chamadas pelo webhook.
- `get_company_vehicle_limit(company_id)` — usada em `tg_vehicles_enforce_plan`.

### 3.4 Onde ficam as validações

- **Banco**: triggers (acima) + RLS + checks em RPCs.
- **Front**: `zod` + `react-hook-form` em diálogos; máscaras manuais (CPF, telefone, data) em `Login.tsx`/`DriverFirstAccess.tsx`.
- **Edge**: `driver-onboarding` valida email/CPF/senha (≥6 dígitos numéricos), idempotência em onboarding, retry de signin.

### 3.5 Comunicação com banco

- **Cliente**: `@supabase/supabase-js` 2.105 (`src/integrations/supabase/client.ts`, **gerado**, não editar). URL e anon key vêm de `import.meta.env.VITE_SUPABASE_*` (`.env` gerenciado).
- **Edge**: cria seu próprio client com `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS).
- Tipos do banco: `src/integrations/supabase/types.ts` (gerado).

---

## 4. BANCO DE DADOS

### 4.1 Plataforma
PostgreSQL gerenciado pela Lovable Cloud (Supabase). Project ref: `qvhgivhlgumcxaneizzb`. 37 migrations versionadas em `supabase/migrations/`. Schema único em `public`. 22 enums tipados.

### 4.2 Tabelas (36 totais)

Agrupamento por domínio:

**Identidade/tenant** — `companies`, `company_members`, `profiles`, `user_roles`, `super_admins`, `branches`, `cost_centers`

**Frota** — `vehicles`, `vehicle_movements`, `vehicle_axle_layouts`, `drivers`, `driver_status_history`, `driver_otp_codes`, `driver_onboarding_attempts`

**Combustível** — `fuel_stations`, `fuel_authorizations`, `fuel_authorization_items`, `fuel_records`

**Manutenção** — `maintenance_records`, `maintenance_checklist_items`, `maintenance_schedules`

**Checklists** — `checklist_templates`, `checklist_questions`, `checklist_runs`, `checklist_answers`

**Pneus** — `tires`, `tire_movements`

**Documentação/Seguros** — `documents`, `insurance_brokers`, `insurance_policies`, `insurance_policy_vehicles`

**Faturamento** — `plans`, `subscriptions`, `subscription_payments`

**Auditoria/visões** — `audit_logs`, `company_usage` (view materializada com KPIs por empresa)

### 4.3 Enums (22)

`app_role` {admin, gestor_frota, manutencao, financeiro, motorista, auditor} · `vehicle_status` {ativo, manutencao, vendido, parado, sinistrado, inativo, transferido, roubado_furtado, leiloado} · `driver_status` {ativo, inativo, ferias, afastado, desligado, licenca_medica, suspenso} · `axle_layout` (moto_2 → carreta_18 + custom) · `fuel_type` (gasolina/etanol/diesel/diesel_s10/flex/gnv/eletrico/hibrido) · `payment_method` (cartao_frota, pix, etc.) · `fuel_anomaly` (8 tipos) · `fuel_auth_status` (pendente, aprovada, recusada, utilizada, expirada, cancelada) · `tire_kind`, `tire_status`, `tire_movement_type` · `maintenance_type/status`, `schedule_status` · `checklist_*` (frequency, question_type, answer_status, run_status) · `document_type/status/entity` · `subscription_status`, `sub_payment_method`.

### 4.4 Relacionamentos (FKs principais)

Tudo gravita em `companies`:

```text
companies ──┬─ branches ──┐
            ├─ cost_centers ─┐
            ├─ company_members → auth.users
            ├─ user_roles → auth.users  (com role enum)
            ├─ vehicles ──┬─ vehicle_axle_layouts
            │             ├─ vehicle_movements
            │             ├─ fuel_records (RESTRICT)
            │             ├─ maintenance_records / _schedules
            │             ├─ tire_movements / tires.current_vehicle_id
            │             ├─ checklist_runs
            │             └─ insurance_policy_vehicles
            ├─ drivers ──┬─ driver_status_history
            │            ├─ assigned_vehicle_id → vehicles
            │            ├─ user_id → auth.users
            │            └─ usado em fuel_records/fuel_authorizations/...
            ├─ fuel_stations ─┐
            ├─ fuel_authorizations ──┬─ fuel_authorization_items
            │                        └─ fuel_record_id → fuel_records (sync via trigger)
            ├─ fuel_records ─→ authorization_id (autorização que originou)
            ├─ documents (entity_type=vehicle|driver, entity_id polimórfico)
            ├─ insurance_brokers ─→ insurance_policies ─→ insurance_policy_vehicles
            ├─ checklist_templates ─→ checklist_questions
            │                       └─→ checklist_runs ─→ checklist_answers
            ├─ tires ←→ tire_movements
            ├─ subscriptions ─→ plans / subscription_payments
            └─ audit_logs (todas as ações marcadas)

profiles.id  = auth.users.id  (1-1; ON DELETE CASCADE)
profiles.current_company_id → companies (SET NULL)
```

Detalhe importante: **há FKs duplicadas** em `fuel_records` (`fk_fuel_records_vehicle` + `fuel_records_vehicle_id_fkey` apontam ambas para `vehicles.id`; idem para `driver_id`). Isso obriga embeds PostgREST a desambiguar (`vehicles!fuel_records_vehicle_id_fkey(...)`), como no `Fuel.tsx`.

### 4.5 Multi-tenant / multiempresa

- **Coluna de tenant**: `company_id uuid` em **todas** as tabelas de domínio (33 das 36; exceções são `plans`, `super_admins`, `driver_onboarding_attempts`).
- **Pertencimento**: `company_members(user_id, company_id)`.
- **Empresa atual do usuário**: `profiles.current_company_id`. Trocar = `UPDATE`.
- **Mesmo usuário pode pertencer a várias empresas** (lista carregada no `AuthContext.companies`).
- **Roles por empresa**: `user_roles(user_id, company_id, role)` — `app_role` é por empresa, não global.

### 4.6 Políticas RLS (padrão observado)

Todas as tabelas de domínio têm RLS habilitada. O padrão repetido é:

| Padrão                              | SELECT                                   | INSERT/UPDATE/DELETE                   |
|-------------------------------------|------------------------------------------|----------------------------------------|
| Domínio operacional                  | `is_company_member(auth.uid(), company_id)` | `can_manage_fleet(auth.uid(), company_id)` (admin/gestor_frota) |
| `companies`                          | `is_company_member`                      | UPDATE: `has_role(...,'admin')`; INSERT aberto a autenticado |
| `audit_logs`                         | `has_role(...,'admin')`                  | INSERT por membro; UPDATE/DELETE bloqueados |
| `fuel_authorizations`                | `requested_by=auth.uid() OR can_manage_fleet` | INSERT por membro com `requested_by=auth.uid()`; `requester marks used` permite o solicitante atualizar; managers update/delete |
| `fuel_authorization_items`           | membro                                   | managers OU `requester insert items on confirm` |
| `profiles`                           | `auth.uid()=id`                          | Apenas próprio                         |
| `user_roles`                         | próprio ou admin da empresa              | `self bootstrap admin role` (1ª role na empresa); admin gerencia demais |
| `plans` / `subscriptions` / `subscription_payments` | leitura ampla (plans=ativos a todos); demais por membro/super_admin | só super_admin |
| `super_admins`                       | si próprio ou super_admin                | só super_admin                         |
| `driver_onboarding_attempts`         | sem políticas (acessada via service role no edge) | idem                              |

### 4.7 Organização dos dados

- Identificadores: todas as PKs são `uuid` com `gen_random_uuid()`.
- Timestamps: `created_at`/`updated_at TIMESTAMPTZ DEFAULT now()`; `tg_set_updated_at` mantém o segundo.
- Soft-delete: não há `deleted_at`. Em vez disso, triggers bloqueiam DELETE quando há dependências (veículos/motoristas) e o campo `status` carrega `inativo`.
- Auditoria centralizada em `audit_logs(table_name, record_id, action, company_id, user_id, changes jsonb)` — preenchida via `tg_audit_fuel` para fuel_records e fuel_authorizations.

---

## 5. AUTENTICAÇÃO E SEGURANÇA

### 5.1 Login
- **Provedor**: Supabase Auth (apenas email/senha hoje; sem Google/Apple/SAML/SMS habilitados no código observado).
- **Empresa**: email + senha → `signInWithPassword`.
- **Motorista**: CPF + senha numérica de 6 dígitos. Edge `driver-onboarding` resolve `email` por CPF e o cliente faz `signInWithPassword`.
- **Primeiro acesso motorista**: wizard em 4 etapas (`identity → contact → otp → done`); OTP gravado em `driver_otp_codes`; tentativas em `driver_onboarding_attempts`; cria/atualiza usuário em `auth.users` com `email_confirm: true`.
- **Reset senha motorista**: edge `reset-password-send-email` envia link para email mascarado.

### 5.2 Sessão
- Armazenada em `localStorage` (`persistSession: true`), `autoRefreshToken: true`.
- `AuthProvider` escuta `onAuthStateChange` e recarrega empresas/roles após cada mudança.
- Token JWT do Supabase Auth (ES256, kid presente); usado em todas as chamadas REST/Edge.

### 5.3 Permissões
- **Roles** por empresa em `user_roles`: `admin`, `gestor_frota`, `manutencao`, `financeiro`, `motorista`, `auditor`. Helpers SQL: `has_role`, `can_manage_fleet`.
- **Derivações no front** (`AuthContext`): `isManager = admin || gestor_frota`; `isDriverOnly = motorista && !manager`; `isSuperAdmin` consultando `super_admins`.
- **Roteamento**: `AppLayout` redireciona `isDriverOnly` → `/motorista`. `MotoristaShell` aceita motorista/admin/gestor.

### 5.4 Segurança implementada
- **RLS** em todas as tabelas de domínio (ver §4.6) — defesa primária.
- **Triggers de bloqueio** (delete restrito; transição de autorização exige fuel_record).
- **Funções `SECURITY DEFINER` com `search_path=public`** (mitiga search_path injection).
- **Webhook Stripe**: HMAC-SHA-256 + janela de 5 min.
- **Senhas motorista**: validação `^\d{6,}$`.
- **Throttling**: `driver_onboarding_attempts` registra IP + sucesso.
- **CORS** liberado (`*`) nas edges.
- **Não há**: Google sign-in, MFA, password HIBP check, captcha, rate-limit explícito além do registro em tabela.

### 5.5 Multitenant — isolamento
1. JWT do usuário identifica `auth.uid()`.
2. RLS valida pertencimento via `is_company_member(auth.uid(), <linha>.company_id)`.
3. Front filtra explicitamente `eq('company_id', currentCompanyId)` em toda query (defesa em profundidade).
4. Edge functions usam **service role** (bypass RLS) e validam manualmente `company_id` antes de gravar.

---

## 6. INFRAESTRUTURA

- **Hospedagem front**: plataforma Lovable. Preview: `https://id-preview--8ac4e048-5cc0-439e-b1d1-4e6308ca4b8c.lovable.app`. Publicado: `https://key-fleet-flow.lovable.app`. Sem custom domain.
- **Banco + Auth + Storage + Edge**: Lovable Cloud (Supabase) — `qvhgivhlgumcxaneizzb.supabase.co`.
- **Build**: Vite (`vite build`); modo dev usa `lovable-tagger`; HMR overlay desativado.
- **Runtime das edges**: Deno; deploy automático via Lovable. Funções com `verify_jwt = false` em `supabase/config.toml`.
- **Storage buckets** (12):
  - Públicos: `vehicle-photos`, `driver-photos`, `company-logos`, `vehicle-docs`, `documents`, `fuel-photos`, `checklist-media`.
  - Privados: `fuel-receipts`, `maintenance-docs`, `tire-docs`, `driver-uploads`, `insurance-policies`.
- **Variáveis ambiente front** (`.env` gerenciado): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.
- **Secrets das edges**: `LOVABLE_API_KEY`, `STRIPE_SANDBOX_API_KEY`, `PAYMENTS_SANDBOX_WEBHOOK_SECRET`, `SUPABASE_*` (URL, ANON_KEY, SERVICE_ROLE_KEY, JWKS, PUBLISHABLE_KEY[S], SECRET_KEYS, DB_URL).

---

## 7. APIs E INTEGRAÇÕES

| Integração          | Como                                                                     | Onde                                       |
|---------------------|--------------------------------------------------------------------------|--------------------------------------------|
| **Lovable AI Gateway** | Modelos `google/gemini-2.5-*`, `openai/gpt-5*` via `LOVABLE_API_KEY`. Tool calling para extração estruturada. | `extract-document`, `extract-insurance-policy` |
| **Stripe**          | Cliente via gateway Lovable (`connector-gateway.lovable.dev/stripe`) com `X-Connection-Api-Key` + `Lovable-API-Key`. Embedded checkout, billing portal, webhook assinado. | `_shared/stripe.ts`, `create-checkout`, `create-portal-session`, `payments-webhook` |
| **Supabase Storage**| Upload via `supabase.storage.from(bucket).upload(path, file)`. Path padrão: `{companyId}/{type}/{uuid}-{filename}`. | `lib/ai-extract.ts`, diálogos de upload |
| **Supabase Auth Admin** | `admin.auth.admin.createUser/updateUserById/listUsers` com service role. | `driver-onboarding` |

**Webhooks recebidos**: somente Stripe (`/payments-webhook?env=sandbox|live`). Eventos `customer.subscription.*`, `invoice.payment_*`, `checkout.session.completed`.

**Comunicação inter-módulos**: indireta, via tabelas + triggers.
Exemplos:
- Checklist concluído com não-conformes → trigger abre `maintenance_records` (OS).
- `fuel_records` insert → trigger atualiza `fuel_authorizations.status='utilizada'` e `vehicles.current_km`.
- `tire_movements` insert → trigger ajusta `tires.status/current_position/recap_count`.
- `companies` insert → trigger cria `subscriptions` starter.
- Stripe webhook → RPC atualiza `subscriptions` + grava em `subscription_payments`.

---

## 8. FLUXO DO SISTEMA

### Fluxo síncrono típico (gestor cria abastecimento manual)
```text
UI dialog → useState → supabase.from('fuel_records').insert(...)
   │
   ▼ PostgREST verifica RLS (can_manage_fleet)
   ▼ Trigger BEFORE INSERT tg_fuel_compute (km/L, anomalias, atualiza vehicles.current_km)
   ▼ Linha gravada
   ▼ Trigger AFTER INSERT tg_audit_fuel (audit_logs)
   ▼ Trigger AFTER INSERT trg_fuel_record_sync_auth (se authorization_id ≠ null, marca utilizada)
   ▼ Resposta JSON → onSaved() → load() recarrega tabela na tela
```

### Fluxo motorista — abastecimento autorizado
```text
Colaborador.tsx → INSERT fuel_authorizations(status='pendente', requested_by=uid)
   │ trigger tg_fuel_auth_auto_approve  (se driver.auto_fuel_authorized → 'aprovada')
   │ trigger tg_fuel_auth_on_approve (gera authorization_code 6 dígitos, expires_at +24h)
   ▼
Aprovador (Approvals.tsx) UPDATE status='aprovada'  ──► mesmo trigger gera code
   ▼
Motorista finaliza no app:
   1) UPDATE fuel_authorizations (cupom: foto, cnpj, total, extracted) — sem mudar status
   2) INSERT fuel_records(authorization_id, liters, total_value, ...)
        → tg_fuel_compute calcula
        → trg_fuel_record_sync_auth seta status='utilizada' + vincula fuel_record_id
        → trg_fuel_auth_require_record_on_use valida (não bloqueia pois agora há fuel_record_id)
   3) INSERT fuel_authorization_items (auditoria de cupom)
   Caso CNPJ divergente: status='pendente' + nota de anomalia, sem fuel_record.
```

### Fluxo Stripe → assinatura
```text
Browser → supabase.functions.invoke('create-checkout') → Stripe Checkout Session embedded
   ▼ usuário paga
Stripe → POST /payments-webhook?env=sandbox
   ▼ verifyWebhook (HMAC + janela 5 min)
   ▼ event.type:
        customer.subscription.* → applySubscription → RPC apply_stripe_subscription
            → UPDATE public.subscriptions (status mapeado, periodo, customer_id)
        invoice.payment_succeeded → recordPayment → RPC record_stripe_payment
            → INSERT public.subscription_payments
```

### Fluxo IA — leitura de cupom/CRLV/CNH
```text
File → base64 → supabase.functions.invoke('extract-document', {type, fileBase64, mimeType})
   ▼ Edge chama Lovable AI Gateway com tool específico (extract_vehicle/extract_driver/etc.)
   ▼ Retorna JSON estruturado
   ▼ ai-extract.ts arquiva opcionalmente em Storage e devolve {data, archivedUrl}
```

---

## 9. LOGS E AUDITORIA

- **`audit_logs`**: capturada por `tg_audit_fuel` em `fuel_records` e `fuel_authorizations` (INSERT/UPDATE/DELETE com `changes jsonb` contendo `old`/`new`). Visível só para `admin` da empresa (RLS).
- **`driver_status_history`**: trigger `tg_driver_log_status_change` registra cada mudança de status do motorista.
- **`driver_onboarding_attempts`**: tentativas de cadastro com IP e sucesso/falha.
- **`driver_otp_codes`**: códigos OTP, `attempts`, `consumed_at`.
- **`vehicle_movements`**: histórico de mudanças do veículo (movement_type, reason, metadata jsonb).
- **`subscription_payments`**: trilha de cobranças Stripe.
- **Edge logs**: `console.log/error` capturados pela plataforma Lovable Cloud (acessíveis pela ferramenta de logs).
- **Sem rastreamento de PII fora isso**: não há Sentry, PostHog, OpenTelemetry, Datadog, etc.

---

## 10. ESTRUTURA GERAL — como tudo se conecta

**Camadas e dependências reais:**

```text
                ┌──── design tokens (index.css) ────┐
                │                                    │
   shadcn/ui ──┴─ pages/* ─── lib/* helpers ── supabase-js ──► PostgREST (public.*)
                  │           (ai-extract, stripe,            │
                  │            checklist, tires...)           │   RLS  +  Triggers
                  │                                            │   (regras de negócio)
                  ├─ contexts/AuthContext (única fonte de      │
                  │   sessão, empresa atual, roles)            │
                  │                                            │
                  └─ functions.invoke ──► Edge Functions ──────┤
                                          (service role,       │
                                           Stripe, Lovable AI) │
                                                                │
                                                  Storage buckets
                                                  Auth (auth.users)
```

**Dependências entre módulos (lado banco)**:

- `companies` é a raiz; sua exclusão cascateia para quase tudo (`ON DELETE CASCADE`).
- `vehicles` e `drivers` são hubs operacionais; protegidos por triggers anti-DELETE.
- `fuel_authorizations` ↔ `fuel_records`: relação cruzada bidirecional (`fuel_record_id` na autorização e `authorization_id` no registro), mantida sincronizada por trigger.
- `checklist_runs` → `maintenance_records` via trigger `tg_checklist_open_os_on_complete`.
- `subscriptions` ↔ `plans` ↔ `subscription_payments`; alterado por webhook Stripe via RPCs.
- `documents` é genérica (polimórfica via `entity_type/entity_id`) — sem FK formal para vehicle/driver.
- `audit_logs` é write-only para a aplicação (UPDATE/DELETE bloqueados por RLS).

**Dependências entre módulos (lado front)**:

- `AppLayout` é dono da navegação e dos badges (lê `documents` e `fuel_authorizations` para contadores).
- Todas as páginas dependem de `AuthContext.currentCompanyId`; sem ele, `useEffect` retorna cedo (skeleton/loading).
- `Colaborador.tsx` é compartilhado por `MotoristaShell` (rota `/motorista`) e potencialmente por `/app/colaborador` (não roteado mas referenciado no `visibleNav` do shell de motorista).
- `Approvals.tsx` complementa o ciclo iniciado no `Colaborador.tsx`/`Fuel.tsx` operando sobre `fuel_authorizations`.
- `SuperAdmin.tsx` lê a view `company_usage` (KPIs cross-tenant) e gerencia `plans`/`subscriptions`/`subscription_payments` com RLS específica de super_admin.

**Resumo executivo da forma**: é um *Backend-as-a-Service* clássico (Supabase) com a UI inteira em React/Vite consumindo PostgREST diretamente; a "lógica de negócio" vive no banco (triggers + funções `SECURITY DEFINER`), enquanto Edge Functions cobrem só os casos que exigem segredo (Stripe, IA, criação de auth users). O isolamento entre empresas é feito por `company_id` em todas as tabelas, RLS baseada em `is_company_member`/`can_manage_fleet`, e seleção de empresa atual em `profiles.current_company_id`.
