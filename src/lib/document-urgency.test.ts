import { describe, it, expect } from "vitest";
import { entityUrgency, sortByUrgency, overdueText, compareAlerts, countByBucket } from "./document-urgency";

describe("document urgency", () => {
  it("classifica atrasado, a vencer, pendente e em dia", () => {
    expect(entityUrgency([-3, 10], false).bucket).toBe("atrasado");
    expect(entityUrgency([10, 200], false).bucket).toBe("a_vencer");
    expect(entityUrgency([200], true).bucket).toBe("pendente");
    expect(entityUrgency([], false).bucket).toBe("pendente");
    expect(entityUrgency([200], false).bucket).toBe("em_dia");
  });
  it("ordena atrasados do mais atrasado, depois a vencer do mais próximo, pendentes e em dia", () => {
    const rows = [
      { k: "emdia", d: [100], m: false }, { k: "pend", d: [], m: true },
      { k: "late2", d: [-2], m: false }, { k: "soon20", d: [20], m: false },
      { k: "late30", d: [-30], m: false }, { k: "soon5", d: [5], m: false },
    ];
    const out = sortByUrgency(rows, (r) => entityUrgency(r.d, r.m), (r) => r.k).map((r) => r.k);
    expect(out).toEqual(["late30", "late2", "soon5", "soon20", "pend", "emdia"]);
  });
  it("conta por grupo", () => {
    expect(countByBucket([entityUrgency([-1], false), entityUrgency([-5], false), entityUrgency([], true)]))
      .toEqual({ atrasado: 2, a_vencer: 0, pendente: 1, em_dia: 0 });
  });
  it("mostra dias de atraso", () => {
    expect(overdueText(-1)).toBe("Vencido há 1 dia");
    expect(overdueText(-12)).toBe("Vencido há 12 dias");
    expect(overdueText(3)).toBeNull();
  });
  it("alertas vencidos mais antigos primeiro", () => {
    const a = [
      { severity: "medium", date: "2026-11-25", title: "b" },
      { severity: "high", date: "2026-11-10", title: "c" },
      { severity: "high", date: "2026-10-01", title: "a" },
    ].sort(compareAlerts).map((x) => x.title);
    expect(a).toEqual(["a", "c", "b"]);
  });
});
