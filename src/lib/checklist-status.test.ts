import { describe, expect, it } from "vitest";
import { classifyChecklistRun, mapChecklistVehicleType, matchesChecklistVehicleType, checklistConformity, isVehicleRestricted } from "./checklist-status";

describe("classifyChecklistRun", () => {
  const today = "2026-03-01";
  it.each(["pendente", "em_andamento"])("classifies %s due today", (status) => {
    expect(classifyChecklistRun({ status, due_date: today }, today)).toBe("hoje");
    expect(classifyChecklistRun({ status, due_date: "2026-02-28" }, today)).toBe("atrasado");
  });
  it.each(["concluido", "cancelado", "reprovado"])("excludes terminal %s", (status) => {
    expect(classifyChecklistRun({ status, due_date: today }, today)).toBeNull();
    expect(classifyChecklistRun({ status, due_date: "2026-02-28" }, today)).toBeNull();
  });
  it("excludes missing and future dates, but includes other overdue nonterminal statuses", () => {
    expect(classifyChecklistRun({ status: "pendente" }, today)).toBeNull();
    expect(classifyChecklistRun({ status: "pendente", due_date: "2026-03-02" }, today)).toBeNull();
    expect(classifyChecklistRun({ status: "outro", due_date: "2025-12-31" }, today)).toBe("atrasado");
  });
});
describe("vehicle types", () => {
  it.each([[null, "carro"], ["", "carro"], ["SUV", "carro"], [" Motocicleta ", "moto"], ["MOTO", "moto"], ["Caminhão", "caminhao"], ["caminhonete", "caminhao"], ["truck", "caminhao"], ["Veículo pesado", "caminhao"]])("maps %s", (input, expected) => expect(mapChecklistVehicleType(input)).toBe(expected));
  it("accepts universal templates and rejects mismatches", () => {
    expect(matchesChecklistVehicleType(null, "moto")).toBe(true);
    expect(matchesChecklistVehicleType("moto", "motocicleta")).toBe(true);
    expect(matchesChecklistVehicleType("carro", "truck")).toBe(false);
  });
});
describe("restriction", () => {
  const request = { vehicle_id: "v1", checklist_run_id: "r1", status: "pendente_aprovacao" };
  it("requires same vehicle and a linked checklist", () => {
    expect(isVehicleRestricted("v1", [request])).toBe(true);
    expect(isVehicleRestricted("v2", [request])).toBe(false);
    expect(isVehicleRestricted("v1", [{ ...request, checklist_run_id: null }])).toBe(false);
    expect(isVehicleRestricted("v1", [])).toBe(false);
  });
  it.each(["concluida", "rejeitada", "cancelada"])("does not restrict for %s", (status) => expect(isVehicleRestricted("v1", [{ ...request, status }])).toBe(false));
  it("remains restricted while any linked request is open", () => expect(isVehicleRestricted("v1", [{ ...request, status: "concluida" }, request])).toBe(true));
});
describe("conformity", () => {
  const run = { vehicle_id: "v1", status: "concluido", completed_at: "2026-03-01T12:00:00", conform_items: 3, non_conform_items: 1 };
  it("weights answered items, not run scores", () => {
    expect(checklistConformity([run, { ...run, status: "reprovado", conform_items: 1, non_conform_items: 5 }], "2026-03-01")).toBe(40);
  });
  it("uses inclusive local start and exclusive tomorrow across month boundaries", () => {
    const at = (completed_at: string) => ({ ...run, completed_at });
    expect(checklistConformity([at("2026-01-31T00:00:00"), at("2026-03-01T23:59:59")], "2026-03-01")).toBe(75);
    expect(checklistConformity([at("2026-01-30T23:59:59"), at("2026-03-02T00:00:00")], "2026-03-01")).toBeNull();
  });
  it("excludes drafts, cancelled, invalid dates and other vehicles", () => {
    expect(checklistConformity([run, { ...run, vehicle_id: "v2", conform_items: 0 }, { ...run, status: "pendente" }, { ...run, status: "cancelado" }, { ...run, completed_at: "invalid" }], "2026-03-01", "v1")).toBe(75);
  });
  it("returns null when no conform/nonconform answers exist", () => {
    expect(checklistConformity([], "2026-03-01")).toBeNull();
    expect(checklistConformity([{ ...run, conform_items: 0, non_conform_items: 0 }], "2026-03-01")).toBeNull();
  });
});
