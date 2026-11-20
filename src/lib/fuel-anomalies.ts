export interface FuelSample {
  id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  fueled_at: string;
  fuel_type: string;
  liters: number;
  price_per_liter: number;
  km_per_liter: number | null;
  anomalies: string[] | null;
  vehicles: { plate: string; tank_capacity: number | null; expected_consumption_kml: number | null } | null;
  drivers: { full_name: string } | null;
}
export interface FuelAlert { code: string; explanation: string }
const n = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const positive = (value: number | null): value is number => value != null && Number.isFinite(value) && value > 0;
const storedText: Record<string, string> = {
  km_regressivo: "A quilometragem informada ficou abaixo da leitura anterior.",
  consumo_alto: "O registro possui um alerta de consumo elevado.",
  consumo_baixo: "O registro possui um alerta de consumo muito baixo.",
  tanque_excedido: "O registro possui um alerta de volume acima da capacidade do tanque.",
  duplicado: "O registro foi sinalizado como possível abastecimento duplicado.",
  valor_atipico: "O registro possui um alerta de preço por litro fora do padrão.",
  horario_suspeito: "O registro possui um alerta de abastecimento entre 00h e 05h.",
  cidade_incomum: "O abastecimento ocorreu em uma cidade sinalizada como incomum.",
  consumo_abaixo_esperado: "O registro possui um alerta de consumo abaixo do esperado.",
  consumo_acima_esperado: "O registro possui um alerta de consumo acima do esperado.",
};
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length ? (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : null;
};
/** Read-only analysis; periodRows is the complete date-filtered company dataset. */
export function analyzeFuel(periodRows: readonly FuelSample[]): Map<string, FuelAlert[]> {
  const vehicleValues = new Map<string, number[]>();
  const prices = new Map<string, { sum: number; count: number }>();
  for (const row of periodRows) {
    if (row.vehicle_id && positive(row.km_per_liter)) {
      const values = vehicleValues.get(row.vehicle_id) ?? [];
      values.push(row.km_per_liter);
      vehicleValues.set(row.vehicle_id, values);
    }
    if (positive(row.price_per_liter)) {
      const value = prices.get(row.fuel_type) ?? { sum: 0, count: 0 };
      value.sum += row.price_per_liter;
      value.count++;
      prices.set(row.fuel_type, value);
    }
  }
  const medians = new Map([...vehicleValues].map(([id, values]) => [id, median(values)]));
  return new Map(periodRows.map(row => {
    const alerts = new Map<string, string>();
    for (const code of row.anomalies ?? []) alerts.set(code, storedText[code] ?? `Alerta registrado: ${code}.`);
    const expected = row.vehicles?.expected_consumption_kml;
    const baseline = positive(expected) ? expected : medians.get(row.vehicle_id);
    if (positive(row.km_per_liter) && positive(baseline) && Math.abs(row.km_per_liter - baseline) / baseline > 0.25 + 1e-10) {
      const code = row.km_per_liter < baseline ? "consumo_acima_esperado" : "consumo_abaixo_esperado";
      alerts.set(code, `Rendimento de ${n(row.km_per_liter)} km/L, mais de 25% ${row.km_per_liter < baseline ? "abaixo" : "acima"} ${positive(expected) ? "do esperado" : "da mediana do veículo no período"} (${n(baseline)} km/L).`);
    }
    const capacity = row.vehicles?.tank_capacity;
    if (positive(capacity) && row.liters > capacity) alerts.set("tanque_excedido", `Abasteceu ${n(row.liters)} L, mas o tanque comporta ${n(capacity)} L.`);
    const price = prices.get(row.fuel_type);
    const average = price ? price.sum / price.count : 0;
    if (positive(row.price_per_liter) && average > 0 && Math.abs(row.price_per_liter - average) / average > 0.15 + 1e-10) {
      alerts.set("valor_atipico", `Preço de R$ ${n(row.price_per_liter)}/L, mais de 15% fora da média de ${row.fuel_type} no período (R$ ${n(average)}/L).`);
    }
    const date = new Date(row.fueled_at);
    // Browser-local time, inclusive 00:00 and exclusive 05:00.
    if (!Number.isNaN(date.getTime()) && date.getHours() < 5) alerts.set("horario_suspeito", `Abastecimento às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}, entre 00h e 05h (horário local).`);
    return [row.id, [...alerts].map(([code, explanation]) => ({ code, explanation }))];
  }));
}
export function rankFuel(rows: readonly FuelSample[], kind: "vehicle" | "driver") {
  const groups = new Map<string, { id: string; name: string; sum: number; count: number }>();
  for (const row of rows) {
    const id = kind === "vehicle" ? row.vehicle_id : row.driver_id;
    if (!id || !positive(row.km_per_liter)) continue;
    const name = (kind === "vehicle" ? row.vehicles?.plate : row.drivers?.full_name) ?? id;
    const group = groups.get(id) ?? { id, name, sum: 0, count: 0 };
    group.sum += row.km_per_liter;
    group.count++;
    groups.set(id, group);
  }
  const all = [...groups.values()].map(({ sum, ...group }) => ({ ...group, average: sum / group.count }))
    .sort((a, b) => b.average - a.average || a.id.localeCompare(b.id));
  return { top: all.slice(0, 5), bottom: [...all].sort((a, b) => a.average - b.average || a.id.localeCompare(b.id)).slice(0, 5) };
}
