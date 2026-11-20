import { DEFAULT_INTERVAL_KM } from "./checklist";
import { isMaintenanceClosed } from "./automatic-status";

type PreventiveRecord = {
  type: string; status: string; service_at: string;
  km_at_service: number | null; next_service_km?: number | null;
};
type PreventiveSchedule = { type: string; status: string; target_km: number | null };

/** A future booking never postpones a reached odometer deadline. No data writes. */
export function preventiveKmState(
  odometer: number | null | undefined,
  records: PreventiveRecord[],
  schedules: PreventiveSchedule[],
  intervalKm = DEFAULT_INTERVAL_KM,
) {
  const currentKm = Number(odometer ?? 0);
  const hasOdometer = Number.isFinite(currentKm) && currentKm > 0;
  const lastPrev = records.filter((r) => r.type === "preventiva" && r.status === "concluida" && r.km_at_service != null)
    .sort((a, b) => b.service_at.localeCompare(a.service_at))[0];
  const baseKm = lastPrev?.km_at_service ?? (hasOdometer ? currentKm : 0);
  const interval = Number.isFinite(intervalKm) && intervalKm > 0 ? intervalKm : DEFAULT_INTERVAL_KM;
  const forecast = lastPrev?.next_service_km != null && lastPrev.next_service_km > baseKm
    ? lastPrev.next_service_km : baseKm + interval;
  const targets = schedules.filter((s) => s.type === "preventiva" && !isMaintenanceClosed(s.status) && s.target_km != null && s.target_km > 0)
    .map((s) => Number(s.target_km));
  const nextKm = Math.min(forecast, ...targets);
  const remaining = nextKm - currentKm;
  return { currentKm, hasOdometer, lastPrev, baseKm, nextKm, remaining, overdue: hasOdometer && currentKm >= nextKm };
}