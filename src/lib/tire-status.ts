export interface TireStatusInput {
  current_tread_mm?: number | null;
  min_tread_mm?: number | null;
  last_measured_at?: string | null;
  measurement_interval_days?: number | null;
}
export interface TireAlert {
  code: "tread_limit" | "tread_near" | "measurement_overdue";
  level: "atencao" | "critico";
  reason: string;
}
export function tireAlerts(tire: TireStatusInput, now = new Date()): TireAlert[] {
  const alerts: TireAlert[] = [];
  const min = tire.min_tread_mm ?? 1.6;
  const tread = tire.current_tread_mm;
  if (tread != null && tread <= min) {
    alerts.push({ code: "tread_limit", level: "critico", reason: "Sulco no limite" });
  } else if (tread != null && tread <= min + 1) {
    alerts.push({ code: "tread_near", level: "atencao", reason: "Sulco próximo do limite" });
  }
  const measured = tire.last_measured_at ? Date.parse(tire.last_measured_at) : NaN;
  const days = tire.measurement_interval_days ?? 30;
  if (!Number.isFinite(measured) || now.getTime() - measured > days * 86_400_000) {
    alerts.push({ code: "measurement_overdue", level: "atencao", reason: "Medição vencida" });
  }
  return alerts;
}
export function tireStatus(tire: TireStatusInput, now = new Date()): {
  level: "ok" | "atencao" | "critico"; reason?: string;
} {
  const alerts = tireAlerts(tire, now);
  return alerts.length
    ? { level: alerts.some(a => a.level === "critico") ? "critico" : "atencao", reason: alerts.map(a => a.reason).join(" · ") }
    : { level: "ok" };
}
export function tireCostPerKm(
  tire: { purchase_price?: number | null; km_accumulated?: number | null },
  movements: readonly { cost?: number | null }[],
): number | null {
  const km = tire.km_accumulated ?? 0;
  if (km <= 0) return null;
  return ((tire.purchase_price ?? 0) + movements.reduce((sum, m) => sum + (m.cost ?? 0), 0)) / km;
}
