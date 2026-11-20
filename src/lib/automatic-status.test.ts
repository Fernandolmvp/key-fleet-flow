import { describe, expect, it } from "vitest";
import { fineDisplayStatus, isFineOpen, isMaintenanceOverdue, isPastDay, overdueMaintenanceVehicles, tripDisplayStatus } from "./automatic-status";

const today = "2026-11-20";

describe("status automáticos na leitura", () => {
  it("manutenção anterior a hoje vence, exceto concluída ou cancelada", () => {
    expect(isMaintenanceOverdue("pendente", "2026-11-19", today)).toBe(true);
    expect(isMaintenanceOverdue("em_andamento", "2026-11-19T23:59:00Z", today)).toBe(true);
    for (const status of ["concluida", "concluido", "cancelada", "cancelado"]) {
      expect(isMaintenanceOverdue(status, "2026-11-19", today)).toBe(false);
    }
    expect(isMaintenanceOverdue("agendada", today, today)).toBe(false);
    expect(isMaintenanceOverdue("agendada", "2026-11-21", today)).toBe(false);
  });

  it("planejada ou em andamento com término anterior a hoje exige acerto sem mudar o registro", () => {
    for (const status of ["programada", "planejada", "em_andamento"]) {
      const trip = Object.freeze({ status, scheduled_end_date: "2026-11-19" });
      expect(tripDisplayStatus(trip, today)).toBe("acerto_pendente");
      expect(trip.status).toBe(status);
      expect(tripDisplayStatus({ ...trip, scheduled_end_date: today }, today)).toBe(status);
    }
    for (const status of ["finalizada", "cancelada", "aguardando_acerto"]) {
      expect(tripDisplayStatus({ status, scheduled_end_date: "2026-11-19" }, today)).toBe(status);
    }
  });

  it("multa não paga com vencimento passado vence, sem reabrir pagamentos ou encerramentos", () => {
    const fine = Object.freeze({ status: "multa_autuada", due_date: "2026-11-19", paid_at: null });
    expect(fineDisplayStatus(fine, today)).toBe("vencida");
    expect(fine.status).toBe("multa_autuada");
    expect(fineDisplayStatus({ ...fine, due_date: today }, today)).toBe("multa_autuada");
    expect(fineDisplayStatus({ ...fine, paid_at: "2026-11-18" }, today)).toBe("multa_autuada");
    for (const status of ["paga_com_desconto", "paga_integral", "cancelada", "arquivada", "recurso_deferido"]) {
      expect(fineDisplayStatus({ ...fine, status }, today)).toBe(status);
      expect(isFineOpen({ ...fine, status })).toBe(false);
    }
  });

  it("conta cada veículo vencido uma vez mesmo com vários agendamentos", () => {
    expect([...overdueMaintenanceVehicles([
      { vehicle_id: "A", status: "pendente", date: "2026-11-19" },
      { vehicle_id: "A", status: "agendada", date: "2026-11-18" },
      { vehicle_id: "B", status: "concluida", date: "2026-11-19" },
      { vehicle_id: "C", status: "agendada", date: today },
    ], today)]).toEqual(["A"]);
  });

  it("não vence datas ausentes ou inválidas", () => {
    for (const date of [null, "", "inválida", "2026-02-30"]) expect(isPastDay(date, today)).toBe(false);
  });
});