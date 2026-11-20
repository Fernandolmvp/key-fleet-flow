import { describe, expect, it } from "vitest";
import { analyzeFuel, rankFuel, type FuelSample } from "./fuel-anomalies";
const sample = (patch: Partial<FuelSample> = {}): FuelSample => ({
  id: "1", vehicle_id: "v1", driver_id: "d1", fueled_at: "2026-01-10T12:00:00", fuel_type: "diesel",
  liters: 100, price_per_liter: 5, km_per_liter: 10, anomalies: [],
  vehicles: { plate: "ABC1D23", expected_consumption_kml: 10, tank_capacity: 300 },
  drivers: { full_name: "Ana" }, ...patch,
});
const alerts = (row: FuelSample, others: FuelSample[] = []) => analyzeFuel([row, ...others]).get(row.id)!;
describe("fuel anomalies (read-only)", () => {
  it("explains liters exceeding tank capacity and preserves input", () => {
    const row = sample({ liters: 320 });
    const before = JSON.stringify(row);
    expect(alerts(row)).toContainEqual({ code: "tanque_excedido", explanation: "Abasteceu 320 L, mas o tanque comporta 300 L." });
    expect(JSON.stringify(row)).toBe(before);
    expect(alerts(sample({ liters: 300 }))).toEqual([]);
  });
  it.each([[7, "consumo_acima_esperado", "abaixo"], [13, "consumo_abaixo_esperado", "acima"]])("explains expected consumption deviation %s", (value, code, direction) => {
    expect(alerts(sample({ km_per_liter: Number(value) }))).toContainEqual({ code, explanation: `Rendimento de ${value} km/L, mais de 25% ${direction} do esperado (10 km/L).` });
  });
  it("uses own vehicle median when no expected value is available", () => {
    const row = sample({ km_per_liter: 4, vehicles: { plate: "ABC", tank_capacity: null, expected_consumption_kml: null } });
    expect(alerts(row, [sample({ id: "2", km_per_liter: 10 }), sample({ id: "3", km_per_liter: 10 }), sample({ id: "4", vehicle_id: "other", km_per_liter: 100 })]))
      .toContainEqual({ code: "consumo_acima_esperado", explanation: "Rendimento de 4 km/L, mais de 25% abaixo da mediana do veículo no período (10 km/L)." });
  });
  it.each([7.5, 12.5])("does not alert at exactly 25%%: %s", km_per_liter => expect(alerts(sample({ km_per_liter }))).toEqual([]));
  it("compares prices only within the same fuel type", () => {
    const row = sample({ price_per_liter: 8 });
    expect(alerts(row, [sample({ id: "2", price_per_liter: 4 }), sample({ id: "3", fuel_type: "gasolina", price_per_liter: 100 })]))
      .toContainEqual({ code: "valor_atipico", explanation: "Preço de R$ 8/L, mais de 15% fora da média de diesel no período (R$ 6/L)." });
  });
  it("does not alert at exactly 15% and ignores invalid prices", () => {
    expect(alerts(sample({ price_per_liter: 11.5 }), [sample({ id: "2", price_per_liter: 8.5 }), sample({ id: "3", price_per_liter: 0 })])).toEqual([]);
  });
  it.each([["00:00:00", true], ["04:59:59", true], ["05:00:00", false], ["23:59:00", false]])("checks local hour %s", (time, suspicious) => {
    const found = alerts(sample({ fueled_at: `2026-01-10T${time}` })).find(a => a.code === "horario_suspeito");
    if (suspicious) expect(found?.explanation).toBe(`Abastecimento às ${time.slice(0, 5)}, entre 00h e 05h (horário local).`);
    else expect(found).toBeUndefined();
  });
  it("includes every stored anomaly with a plain-language explanation and deduplicates", () => {
    const codes = ["km_regressivo", "consumo_alto", "consumo_baixo", "tanque_excedido", "duplicado", "valor_atipico", "horario_suspeito", "cidade_incomum", "consumo_abaixo_esperado", "consumo_acima_esperado"];
    const result = alerts(sample({ anomalies: [...codes, "duplicado"] }));
    expect(result.map(a => a.code)).toEqual(codes);
    for (const alert of result) expect(alert.explanation).toMatch(/[ .]/);
    expect(result.find(a => a.code === "km_regressivo")?.explanation).toBe("A quilometragem informada ficou abaixo da leitura anterior.");
  });
  it("does not infer consumption or capacity from missing data", () => {
    expect(alerts(sample({ vehicles: null, vehicle_id: null, km_per_liter: null, price_per_liter: 0 }))).toEqual([]);
  });
});
describe("efficiency ranking", () => {
  it("averages positive values by stable vehicle and driver IDs", () => {
    const rows = [sample({ km_per_liter: 8 }), sample({ id: "2", km_per_liter: 12 }), sample({ id: "3", vehicle_id: "v2", driver_id: "d2", km_per_liter: 4 }),
      ...[0, -1, null, NaN, Infinity].map((km_per_liter, i) => sample({ id: `invalid${i}`, km_per_liter }))];
    for (const kind of ["vehicle", "driver"] as const) {
      const result = rankFuel(rows, kind);
      expect(result.top.map(r => r.average)).toEqual([10, 4]);
      expect(result.top[0].count).toBe(2);
      expect(result.bottom.map(r => r.average)).toEqual([4, 10]);
    }
  });
  it("limits both ends to five, breaks ties by ID and excludes missing IDs", () => {
    const rows = Array.from({ length: 7 }, (_, i) => sample({ id: `${i}`, vehicle_id: `v${i}`, driver_id: `d${i}`, km_per_liter: 10 }));
    rows.push(sample({ id: "missing", vehicle_id: null, driver_id: null }));
    expect(rankFuel(rows, "vehicle").top.map(r => r.id)).toEqual(["v0", "v1", "v2", "v3", "v4"]);
    expect(rankFuel(rows, "driver").bottom).toHaveLength(5);
    expect(rankFuel([], "vehicle")).toEqual({ top: [], bottom: [] });
  });
});
