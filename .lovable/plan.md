## Objetivo
Criar base (tabelas + UI placeholder) para Sinistros, Despesas, Multas e Histórico de Vida. Tudo aditivo, zero breaking change.

---

## ETAPA 1 — Migration SQL (uma migration única, tudo `CREATE`/`ADD COLUMN`)

```sql
-- A) vehicle_incidents
CREATE TABLE public.vehicle_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  driver_id uuid,
  incident_date timestamptz NOT NULL DEFAULT now(),
  incident_type text NOT NULL,         -- colisao|raspao|perda_total|furto|vandalismo|outro
  description text,
  km_at_incident integer,
  location text,
  repair_cost numeric,
  insurance_claimed boolean NOT NULL DEFAULT false,
  police_report_number text,
  photos_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'aberto', -- aberto|em_reparo|resolvido|perda_total
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicle_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view incidents" ON public.vehicle_incidents
  FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write incidents" ON public.vehicle_incidents
  FOR ALL USING (can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (can_manage_fleet(auth.uid(), company_id));
CREATE TRIGGER trg_vehicle_incidents_updated
  BEFORE UPDATE ON public.vehicle_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- B) vehicle_expenses
CREATE TABLE public.vehicle_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  expense_category text NOT NULL,       -- ipva|licenciamento|lavagem|pedagio|estacionamento|adesivacao|multa_paga|outro
  amount numeric NOT NULL DEFAULT 0,
  description text,
  receipt_url text,
  paid boolean NOT NULL DEFAULT true,
  due_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicle_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view expenses" ON public.vehicle_expenses
  FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write expenses" ON public.vehicle_expenses
  FOR ALL USING (can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (can_manage_fleet(auth.uid(), company_id));
CREATE TRIGGER trg_vehicle_expenses_updated
  BEFORE UPDATE ON public.vehicle_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- C) traffic_fines
CREATE TABLE public.traffic_fines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  driver_id uuid,
  fine_date date NOT NULL DEFAULT CURRENT_DATE,
  fine_type text NOT NULL,              -- velocidade|estacionamento|sem_cinto|celular|alcool|outro
  amount numeric NOT NULL DEFAULT 0,
  license_points integer NOT NULL DEFAULT 0,
  description text,
  status text NOT NULL DEFAULT 'pendente', -- pendente|paga|em_recurso|arquivada
  notification_number text,
  due_date date,
  paid_at date,
  photo_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.traffic_fines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view fines" ON public.traffic_fines
  FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "managers write fines" ON public.traffic_fines
  FOR ALL USING (can_manage_fleet(auth.uid(), company_id))
  WITH CHECK (can_manage_fleet(auth.uid(), company_id));
CREATE TRIGGER trg_traffic_fines_updated
  BEFORE UPDATE ON public.traffic_fines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- D) maintenance_records — apenas ADD COLUMN (todas nullable)
ALTER TABLE public.maintenance_records
  ADD COLUMN IF NOT EXISTS maintenance_category text,
  ADD COLUMN IF NOT EXISTS service_provider_rating integer
    CHECK (service_provider_rating IS NULL OR (service_provider_rating BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS warranty_until date;

-- Índices úteis
CREATE INDEX idx_incidents_company_vehicle ON public.vehicle_incidents(company_id, vehicle_id);
CREATE INDEX idx_expenses_company_vehicle  ON public.vehicle_expenses(company_id, vehicle_id);
CREATE INDEX idx_fines_company_vehicle     ON public.traffic_fines(company_id, vehicle_id);
```

**Sem FK explícita** para `companies/vehicles/drivers` — segue padrão do schema atual (que usa RLS via `is_company_member` em vez de FKs declaradas).

---

## ETAPA 2 — UI Placeholder (3 abas novas)

**Componente compartilhado:** `src/components/placeholder/ModulePlaceholder.tsx`
- Props: `icon`, `title`, `subtitle`, `features: string[]`
- Layout: card centralizado, ícone grande em `bg-primary/10`, badge "Disponível em breve", botão ghost "Receber notificação quando lançar" (sem handler).

**Páginas novas:**
- `src/pages/app/Sinistros.tsx` (ícone `CarFront` ou `AlertOctagon`)
- `src/pages/app/Despesas.tsx` (ícone `Receipt`)
- `src/pages/app/Multas.tsx` (ícone `AlertTriangle`)

**Rotas em `App.tsx`** (dentro de `/app` protegido):
```
<Route path="sinistros" element={<Sinistros />} />
<Route path="despesas" element={<Despesas />} />
<Route path="multas" element={<Multas />} />
```

**Sidebar (`AppLayout.tsx`):** inserir 3 itens logo após "Manutenção" com mesmo padrão visual dos demais. Cada item leva à respectiva rota.

Funcionalidades planejadas (bullets) por módulo:
- **Sinistros**: registro de ocorrência, fotos, custo de reparo, vínculo com apólice, status do reparo, relatório consolidado.
- **Despesas**: IPVA/licenciamento com vencimentos, pedágio/lavagem/estacionamento, comprovantes, custo total por veículo, alertas de vencimento.
- **Multas**: cadastro com pontos na CNH, vínculo com motorista, status (pendente/paga/recurso), upload da notificação, alerta de vencimento.

---

## ETAPA 3 — Histórico de Vida (placeholder)

- **Botão em `VehicleDialog.tsx`**: aparece só em modo edição (veículo já existente). Texto: "📊 Ver Histórico Completo". Navega para `/app/veiculos/:id/historico`.
- **Página nova**: `src/pages/app/VehicleHistory.tsx` em rota `vehicles/:id/historico`.
  - Cabeçalho com placa do veículo (busca rápida por id).
  - Grid de cards-mockup das abas planejadas (Identificação, Timeline, Manutenções, Combustível, Pneus, Documentos, Sinistros, Checklists, Indicadores Financeiros, Motoristas, Exportar) — apenas título + ícone, todos `disabled` visualmente.
  - Badge "Em desenvolvimento — disponível em breve".

---

## ETAPA 4 — Landing Page

Em `src/pages/Landing.tsx`, no array `features`, adicionar 4 itens novos com flag `comingSoon: true`. Render: badge "Em breve" no canto do card.
- 🚨 Gestão de Sinistros
- 💰 Despesas Operacionais
- 🚓 Controle de Multas
- 📊 Histórico Completo do Veículo

---

## Garantia de não-quebra
- Migrations: 100% aditivas (`CREATE TABLE`, `ADD COLUMN ... nullable`). Nenhum `DROP`/`ALTER COLUMN`/`RENAME`. RLS habilitada já no `CREATE`.
- `maintenance_records`: novas colunas todas nullable → INSERTs/SELECTs existentes seguem funcionando.
- Frontend: só adiciona arquivos e 3 rotas + 3 itens de sidebar + 1 botão no `VehicleDialog`. Nenhuma página/rota existente alterada.
- Tipos do Supabase regeneram automaticamente após migration; código existente não referencia as novas colunas.

## Plano de Rollback
- **DB**: uma migration reversa com:
  ```sql
  DROP TABLE IF EXISTS public.vehicle_incidents;
  DROP TABLE IF EXISTS public.vehicle_expenses;
  DROP TABLE IF EXISTS public.traffic_fines;
  ALTER TABLE public.maintenance_records
    DROP COLUMN IF EXISTS maintenance_category,
    DROP COLUMN IF EXISTS service_provider_rating,
    DROP COLUMN IF EXISTS warranty_until;
  ```
- **Frontend**: remover os 4 arquivos novos (`Sinistros.tsx`, `Despesas.tsx`, `Multas.tsx`, `VehicleHistory.tsx`), o `ModulePlaceholder.tsx`, as 4 rotas em `App.tsx`, os 3 itens no sidebar, o botão "Histórico" no `VehicleDialog`, e os 4 itens novos do array `features` em `Landing.tsx`. Tudo isolado, sem dependências cruzadas.

---

Confirma "OK" para eu rodar a migration (Etapa 1) e na sequência implementar Etapas 2-4 no frontend?
