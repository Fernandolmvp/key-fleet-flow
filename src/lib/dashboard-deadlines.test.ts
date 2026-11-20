import { beforeEach, describe, expect, it, vi } from "vitest";

const { tables, scopes, writes } = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  scopes: [] as string[],
  writes: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: (column: string, value: string) => { scopes.push(`${column}:${value}`); return query; },
        not: () => query,
        order: () => query,
        range: async (from: number, to: number) => ({ data: (tables[table] ?? []).slice(from, to + 1), error: null }),
        maybeSingle: async () => ({ data: (tables[table] ?? [])[0] ?? null, error: null }),
        update: writes,
        delete: writes,
        insert: writes,
      };
      return query;
    },
  },
}));

import { loadDashboardDeadlines } from "./dashboard-deadlines";

describe("Dashboard com status calculados", () => {
  beforeEach(() => { Object.keys(tables).forEach((key) => delete tables[key]); scopes.length = 0; writes.mockClear(); });

  it("inclui manutenção vencida uma vez por veículo, separando os próximos sete dias", async () => {
    tables.vehicles = [{ id: "A", plate: "AAA0001" }, { id: "B", plate: "BBB0002" }];
    tables.maintenance_schedules = [{ vehicle_id: "A", status: "pendente", target_date: "2026-11-19" }];
    tables.maintenance_records = [
      { vehicle_id: "A", status: "em_andamento", service_at: "2026-11-18" },
      { vehicle_id: "B", status: "agendada", service_at: "2026-11-20" },
      { vehicle_id: "B", status: "concluida", service_at: "2026-11-18" },
    ];
    const result = await loadDashboardDeadlines("company-A", "2026-11-20");
    expect(result.maint_overdue).toBe(1);
    expect(result.maint_7d).toBe(1);
    expect(result.alerts.filter((a) => a.kind === "maintenance")).toHaveLength(1);
    expect(scopes).toHaveLength(7);
    expect(scopes.slice(0, 6).every((scope) => scope === "company_id:company-A")).toBe(true);
    expect(scopes[6]).toBe("id:company-A");
    expect(writes).not.toHaveBeenCalled();
  });

  it("inclui viagens planejadas/em andamento vencidas nos alertas de acerto", async () => {
    tables.trips = [
      { status: "programada", scheduled_end_date: "2026-11-19" },
      { status: "em_andamento", scheduled_end_date: "2026-11-19" },
      { status: "em_andamento", scheduled_end_date: "2026-11-20" },
      { status: "finalizada", scheduled_end_date: "2026-11-19" },
      { status: "cancelada", scheduled_end_date: "2026-11-19" },
    ];
    const result = await loadDashboardDeadlines("company-A", "2026-11-20");
    expect(result.trips_pending).toBe(2);
    expect(result.alerts.filter((a) => a.kind === "trip")).toHaveLength(2);
    expect(writes).not.toHaveBeenCalled();
  });

  it("conta KM no alvo mesmo com preventiva futura e não conta KM zero como vencido", async () => {
    tables.vehicles = [{ id: "A", plate: "AAA0001", current_km: 20000 }, { id: "B", plate: "BBB0002", current_km: 0 }];
    tables.companies = [{ maintenance_default_interval_km: 10000 }];
    tables.maintenance_records = [{ vehicle_id: "A", type: "preventiva", status: "concluida", service_at: "2026-01-10", km_at_service: 10000 }];
    tables.maintenance_schedules = [
      { vehicle_id: "A", type: "preventiva", status: "pendente", target_date: "2027-01-10", target_km: 25000 },
      { vehicle_id: "B", type: "preventiva", status: "pendente", target_date: "2027-01-10", target_km: 10000 },
    ];
    const result = await loadDashboardDeadlines("company-A", "2026-11-20");
    expect(result.maint_overdue).toBe(1);
    expect(result.alerts.filter((a) => a.kind === "maintenance")).toHaveLength(1);
    expect(result.alerts[0].subtitle).toContain("20.000 km");
    expect(writes).not.toHaveBeenCalled();
  });

  it("conta multas vencidas não pagas em atenção sem incluir multas pagas", async () => {
    tables.traffic_fines = [
      { status: "multa_autuada", due_date: "2026-11-19", paid_at: null },
      { status: "multa_autuada", due_date: "2026-11-20", paid_at: null },
      { status: "paga_integral", due_date: "2026-11-19", paid_at: null },
      { status: "multa_autuada", due_date: "2026-11-19", paid_at: "2026-11-18" },
    ];
    const result = await loadDashboardDeadlines("company-A", "2026-11-20");
    expect(result.fines_open).toBe(2);
    expect(result.fines_overdue).toBe(1);
    expect(result.alerts.filter((a) => a.kind === "fine")).toHaveLength(1);
    expect(writes).not.toHaveBeenCalled();
  });
});