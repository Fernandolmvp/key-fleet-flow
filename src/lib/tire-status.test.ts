import { describe, expect, it } from "vitest";
import { tireAlerts, tireStatus, tireCostPerKm } from "./tire-status";
const now = new Date("2026-06-01T12:00:00Z");
const recent = { last_measured_at: now.toISOString() };
describe("tire status", () => {
  it.each([0, 1.5, 1.6])("flags tread %s at/below the default limit", tread => {
    expect(tireAlerts({ ...recent, current_tread_mm: tread }, now)[0].reason).toBe("Sulco no limite");
  });
  it.each([1.61, 2.6])("warns within 1 mm: %s", tread => {
    expect(tireAlerts({ ...recent, current_tread_mm: tread }, now)[0].reason).toBe("Sulco próximo do limite");
  });
  it("uses the custom limit and excludes values above the warning band", () => {
    expect(tireStatus({ ...recent, current_tread_mm: 2.61 }, now).level).toBe("ok");
    expect(tireStatus({ ...recent, min_tread_mm: 3, current_tread_mm: 3 }, now).level).toBe("critico");
    expect(tireAlerts({ ...recent, current_tread_mm: null }, now)).toEqual([]);
  });
  it("requires a measurement, treats invalid dates as overdue, and uses an exact elapsed-time boundary", () => {
    expect(tireAlerts({}, now)[0].reason).toBe("Medição vencida");
    expect(tireAlerts({ last_measured_at: "invalid" }, now)).toHaveLength(1);
    const atBoundary = new Date(now.getTime() - 30 * 86400000).toISOString();
    expect(tireAlerts({ last_measured_at: atBoundary }, now)).toEqual([]);
    expect(tireAlerts({ last_measured_at: new Date(Date.parse(atBoundary) - 1).toISOString() }, now)).toHaveLength(1);
    expect(tireAlerts({ last_measured_at: atBoundary, measurement_interval_days: 31 }, now)).toEqual([]);
  });
  it("keeps simultaneous tread and measurement alerts", () => {
    expect(tireAlerts({ current_tread_mm: 1 }, now)).toHaveLength(2);
    expect(tireStatus({ current_tread_mm: 1 }, now).level).toBe("critico");
  });
});
describe("tire cost/km", () => {
  it("sums every movement cost and purchase price", () => {
    expect(tireCostPerKm({ purchase_price: 1000, km_accumulated: 10000 }, [{ cost: 100 }, { cost: 200 }, { cost: null }])).toBe(0.13);
  });
  it("returns null for zero/missing mileage and handles null purchase price", () => {
    expect(tireCostPerKm({ km_accumulated: 0 }, [])).toBeNull();
    expect(tireCostPerKm({}, [])).toBeNull();
    expect(tireCostPerKm({ purchase_price: null, km_accumulated: 100 }, [{ cost: 20 }])).toBe(0.2);
  });
});
