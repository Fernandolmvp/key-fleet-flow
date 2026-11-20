import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./licensing", async (importOriginal) => {
  const original = await importOriginal<typeof import("./licensing")>();
  return { ...original, loadDetranCalendar: async () => new Map() };
});
const { tables, scopes, writes } = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]>, scopes: [] as string[], writes: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const query = {
    select: () => query, eq: (column: string, value: string) => { scopes.push(`${table}:${column}:${value}`); return query; },
    gte: () => query, lt: () => query, order: () => query,
    range: async (from: number, to: number) => ({ data: (tables[table] ?? []).slice(from, to + 1), error: null }),
    update: writes, insert: writes, delete: writes,
  };
  return query;
} } }));

import { dashboardDocumentMetrics, loadDashboardMetrics, monthCost } from "./dashboard-metrics";
import { cnhStatus, isActiveDriver } from "./documents";

const today = "2026-11-20";
const vehicle = { id: "v1", status: "ativo", plate: "AAA0009", licensing_year: 2025, licensing_uf: "SP", vehicle_type: "carro" };
const driver = { id: "d1", status: "ativo", full_name: "Motorista teste", cnh_expires_at: "2026-12-20" };

describe("Dashboard com os mesmos critérios das telas", () => {
  beforeEach(() => { Object.keys(tables).forEach((key) => delete tables[key]); scopes.length = 0; writes.mockClear(); });

  it("documentos soma vencidos e a vencer em 30 dias sem duplicar CRLV/licenciamento e CNH", () => {
    const docs = [
      { entity_type: "vehicle", entity_id: "v1", doc_type: "crlv", expires_at: "2025-01-01" },
      { entity_type: "vehicle", entity_id: "v1", doc_type: "licenciamento", expires_at: "2025-01-01" },
      { entity_type: "driver", entity_id: "d1", doc_type: "cnh", expires_at: "2026-11-19" },
    ];
    const result = dashboardDocumentMetrics([vehicle, { ...vehicle, id: "v2", plate: "AAA0001" }, { ...vehicle, id: "v3", status: "inativo" }], [driver], docs, new Map(), today);
    expect(result.docs_expiring).toBe(3); // Novembro próximo, julho vencido, uma CNH vencida.
    expect(result.alerts.filter((a) => a.title.startsWith("CNH"))).toHaveLength(1);
    expect(result.alerts.filter((a) => a.title === "Licenciamento · AAA0009")).toHaveLength(1);
  });

  it("licenciamento segue categoria e exercício do calendário usado em Documentação", () => {
    const result = dashboardDocumentMetrics([{ ...vehicle, plate: "AAA0001", vehicle_type: "caminhão" }, { ...vehicle, id: "v2", licensing_year: 2026 }, { ...vehicle, id: "v3", licensing_year: null }], [], [], new Map(), today);
    expect(result.docs_expiring).toBe(1);
    expect(result.alerts[0].date).toBe("2026-09-30");
  });

  it("motoristas ativos inclui férias e CNH usa cadastro, não a data do anexo", () => {
    const drivers = [driver, { ...driver, id: "d2", status: "ferias", cnh_expires_at: "2026-11-19" }, { ...driver, id: "d3", status: "inativo" }, { ...driver, id: "d4", cnh_expires_at: "2026-12-21" }];
    const result = dashboardDocumentMetrics([], drivers, [{ entity_type: "driver", entity_id: "d1", doc_type: "cnh", expires_at: "2027-01-01" }], new Map(), today);
    expect(result.drivers_active).toBe(3);
    expect(result.cnh_expiring).toBe(2);
    expect(result.docs_expiring).toBe(0); // Documentação tem só ativo, anexo de d1 válido, d4 >30 dias.
    expect(drivers.filter((d) => isActiveDriver(d.status))).toHaveLength(3);
  });

  it("CNH inclui vencida, hoje e exatamente 30 dias, excluindo 31 dias e sem data", () => {
    const now = new Date(today + "T00:00:00");
    expect(cnhStatus("2026-11-19", now).kind).toBe("vencida");
    expect(cnhStatus(today, now).kind).toBe("vencendo");
    expect(cnhStatus("2026-12-20", now).kind).toBe("vencendo");
    expect(cnhStatus("2026-12-21", now).kind).toBe("valida");
    expect(cnhStatus(null, now).kind).toBe("sem_data");
  });

  it("custo inclui manutenção, combustível e multas somente do mês corrente e compara mesmo escopo", async () => {
    tables.maintenance_records = [{ service_at: "2026-11-01", total_value: 100 }, { service_at: "2026-10-31", total_value: 50 }, { service_at: "2026-12-01", total_value: 999 }];
    tables.fuel_records = [{ fueled_at: "2026-11-20", total_value: 200 }];
    tables.traffic_fines = [{ infraction_date: "2026-11-30", amount: 300, paid_amount: null }, { infraction_date: "2026-11-10", amount: 100, paid_amount: 80 }];
    const result = await loadDashboardMetrics("company-A", today);
    expect(result.total).toBe(680);
    expect(result.breakdown).toEqual({ maintenance: 100, fuel: 200, fines: 380, expenses: 0, trip_expenses: 0 });
    expect(result.prev_total).toBe(50);
    expect(scopes.filter((s) => s.endsWith("company_id:company-A"))).toHaveLength(8);
    expect(writes).not.toHaveBeenCalled();
  });

  it("soma valores sem duplicar linhas e exclui outros meses", () => {
    expect(monthCost([{ date: "2026-11-01", amount: 10 }, { date: "2026-11-30", amount: 20 }, { date: "2026-12-01", amount: 100 }, { date: null, amount: 100 }], "2026-11")).toBe(30);
  });
});