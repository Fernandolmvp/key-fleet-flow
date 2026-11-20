import { describe, expect, it } from "vitest";
import { preventiveKmState } from "./preventive-status";

const done = { type: "preventiva", status: "concluida", service_at: "2026-01-10", km_at_service: 10000 };
const future = { type: "preventiva", status: "pendente", target_km: 25000, target_date: "2027-01-10" };

describe("preventiva por KM na leitura", () => {
  it("vence ao atingir e ultrapassar o alvo mesmo com agendamento futuro", () => {
    expect(preventiveKmState(19999, [done], [future]).overdue).toBe(false);
    expect(preventiveKmState(20000, [done], [future]).overdue).toBe(true);
    expect(preventiveKmState(20001, [done], [future]).overdue).toBe(true);
    expect(preventiveKmState(20000, [done], [future]).nextKm).toBe(20000);
  });
  it("KM zero indica ausência de hodômetro e não presume vencimento por KM", () => {
    const result = preventiveKmState(0, [done], [future]);
    expect(result.hasOdometer).toBe(false);
    expect(result.overdue).toBe(false);
  });
  it("usa alvo aberto e próximo KM explícito sem tratar agendamento como serviço executado", () => {
    expect(preventiveKmState(15000, [], [{ ...future, target_km: 15000 }]).overdue).toBe(true);
    expect(preventiveKmState(18000, [{ ...done, next_service_km: 18000 }], [future]).overdue).toBe(true);
    expect(preventiveKmState(20000, [done, { ...done, status: "agendada", service_at: "2027-01-10", km_at_service: 20000 }], [future]).nextKm).toBe(20000);
  });
  it("ignora alvos cancelados/concluídos e usa apenas a última preventiva concluída", () => {
    expect(preventiveKmState(20000, [done, { ...done, service_at: "2026-11-10", km_at_service: 20000 }], [{ ...future, status: "concluida", target_km: 15000 }, { ...future, status: "cancelada", target_km: 14000 }]).nextKm).toBe(30000);
  });
  it("preserva entradas congeladas e respeita o intervalo da empresa", () => {
    const rec = Object.freeze({ ...done });
    const sch = Object.freeze({ ...future });
    expect(preventiveKmState(15000, [rec], [sch], 5000).overdue).toBe(true);
    expect(rec.km_at_service).toBe(10000);
    expect(sch.target_km).toBe(25000);
  });
});