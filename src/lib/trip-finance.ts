export interface TripFinanceInput {
  total_advance_cash?: number | string | null;
  total_spent_cash?: number | string | null;
  total_spent_card?: number | string | null;
  total_spent_other?: number | string | null;
  total_reimbursable?: number | string | null;
  actual_km?: number | string | null;
  km_at_start?: number | string | null;
  km_at_end?: number | string | null;
  freight_value?: number | string | null;
}

const n = (v: unknown) => { const x = Number(v ?? 0); return Number.isFinite(x) ? x : 0; };

export function tripTotalCost(t: TripFinanceInput): number {
  return n(t.total_spent_cash) + n(t.total_spent_card) + n(t.total_spent_other) + n(t.total_reimbursable);
}

/** Positive: driver returns cash. Negative: company owes the driver. */
export function tripSettlementBalance(t: TripFinanceInput): number {
  return Math.round((n(t.total_advance_cash) - n(t.total_spent_cash) - n(t.total_reimbursable)) * 100) / 100;
}

export function settlementLabel(balance: number, fmt: (v: number) => string): string {
  if (balance > 0) return `Motorista devolve ${fmt(balance)}`;
  if (balance < 0) return `Empresa reembolsa ${fmt(-balance)}`;
  return "Sem saldo pendente";
}

/** Driven km from the real odometer only; estimated km is never used. */
export function tripDrivenKm(t: TripFinanceInput): number | null {
  const actual = Number(t.actual_km);
  if (t.actual_km != null && Number.isFinite(actual) && actual > 0) return actual;
  const s = Number(t.km_at_start), e = Number(t.km_at_end);
  if (t.km_at_start != null && t.km_at_end != null && Number.isFinite(s) && Number.isFinite(e) && e > s) return e - s;
  return null;
}

export function tripCostPerKm(t: TripFinanceInput): number | null {
  const km = tripDrivenKm(t);
  return km ? Math.round((tripTotalCost(t) / km) * 100) / 100 : null;
}

export function tripResult(t: TripFinanceInput): number | null {
  if (t.freight_value == null || t.freight_value === "") return null;
  const f = Number(t.freight_value);
  if (!Number.isFinite(f)) return null;
  return Math.round((f - tripTotalCost(t)) * 100) / 100;
}

export type TripTab = "planejada" | "em_andamento" | "concluida" | "acerto_pendente" | "outras";
/** Groups the stored/derived status into the list tabs. */
export function tripTab(displayStatus: string): TripTab {
  if (displayStatus === "programada" || displayStatus === "planejada") return "planejada";
  if (displayStatus === "em_andamento") return "em_andamento";
  if (displayStatus === "finalizada" || displayStatus === "concluida") return "concluida";
  if (displayStatus === "aguardando_acerto" || displayStatus === "acerto_pendente") return "acerto_pendente";
  return "outras";
}
