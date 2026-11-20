import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { insuranceAlerts } from "./alerts";

const today = "2026-11-20";
const policy = { id: "p1", policy_number: "123", insurer_name: "Seguradora", status: "ativa", end_date: today, ai_extracted: null };
const vehicles = [{ id: "v1", plate: "AAA0001", status: "ativo" }, { id: "v2", plate: "BBB0002", status: "ativo" }, { id: "v3", plate: "CCC0003", status: "inativo" }];

describe("alertas de seguros somente na leitura", () => {
  it("apólice anterior a hoje vence; hoje e sem fim ainda cobrem", () => {
    expect(insuranceAlerts([], [{ ...policy, end_date: "2026-11-19" }], [], [], today).filter((a) => a.kind === "policy")).toHaveLength(1);
    expect(insuranceAlerts([], [policy, { ...policy, id: "p2", end_date: null }], [], [], today)).toHaveLength(0);
  });
  it("vínculos válidos cobrem ativos e removidos/revogados não cobrem", () => {
    const result = insuranceAlerts(vehicles, [policy], [{ policy_id: "p1", vehicle_id: "v1" }, { policy_id: "p1", vehicle_id: "v2", removed_at: today }], [{ policy_id: "p1", vehicle_id: "v2", revoked_at: today }], today);
    expect(result.map((a) => a.id)).toEqual(["uninsured:v2"]);
    expect(insuranceAlerts(vehicles, [policy], [], [{ policy_id: "p1", vehicle_id: "v1" }, { policy_id: "p1", vehicle_id: "v2" }], today)).toHaveLength(0);
  });
  it("considera placas da extração e não cobertura de apólice vencida/cancelada", () => {
    const extracted = Object.freeze({ ...policy, ai_extracted: { plates: ["aaa-0001", null, 42] } });
    expect(insuranceAlerts(vehicles, [extracted], [], [], today).map((a) => a.id)).toEqual(["uninsured:v2"]);
    expect(insuranceAlerts(vehicles, [{ ...extracted, end_date: "2026-11-19" }], [], [], today).filter((a) => a.kind === "uninsured")).toHaveLength(2);
    expect(insuranceAlerts(vehicles, [{ ...extracted, status: "cancelada" }], [], [], today).filter((a) => a.kind === "uninsured")).toHaveLength(2);
  });
});