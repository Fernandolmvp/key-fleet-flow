import { describe, it, expect } from "vitest";
import { kmSinceBaseline, freePositions, buildBatchTires } from "./tire-ops";

const mv = (t: string, type: string, km: number, at: string, v = "v1") => ({ tire_id: t, movement_type: type, vehicle_id: v, vehicle_km: km, occurred_at: at });

describe("tire-ops", () => {
  it("km since last install or rotation", () => {
    const m = [mv("t1", "instalacao", 10000, "2026-01-01"), mv("t1", "rodizio", 15000, "2026-03-01"), mv("t1", "inspecao", 18000, "2026-04-01")];
    expect(kmSinceBaseline(m, "t1", "v1", 20000)).toBe(5000);
    expect(kmSinceBaseline(m, "t1", "v2", 20000)).toBe(0);
    expect(kmSinceBaseline(m, "t1", "v1", 9000)).toBe(0);
  });
  it("free positions", () => {
    expect(freePositions(["DD", "DE", "TD"], { DE: {} })).toEqual(["DD", "TD"]);
  });
  it("batch of 4 with optional serials", () => {
    const r = buildBatchTires("c", 4, { brand: "Pirelli", size: "295/80 R22.5", kind: "novo", tread_mm: 18 }, "A1, A2");
    expect(r).toHaveLength(4);
    expect(r.map((t) => t.serial)).toEqual(["A1", "A2", null, null]);
    expect(r.every((t) => t.status === "estoque" && t.current_tread_mm === 18)).toBe(true);
  });
});
