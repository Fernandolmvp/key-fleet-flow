/** Read-only presentation rules. Never persist these statuses over workflow data. */
export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isPastDay(date: string | null | undefined, today = localToday()): boolean {
  if (!date) return false;
  const day = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && localToday(parsed) === day && day < today;
}

export function isMaintenanceClosed(status: string): boolean {
  return ["concluida", "concluido", "finalizada", "finalizado", "cancelada", "cancelado"].includes(status);
}

export function isMaintenanceOverdue(status: string, date: string | null | undefined, today = localToday()): boolean {
  return !isMaintenanceClosed(status) && isPastDay(date, today);
}

export function tripDisplayStatus(trip: { status: string; scheduled_end_date?: string | null }, today = localToday()): string {
  return ["programada", "planejada", "em_andamento"].includes(trip.status) && isPastDay(trip.scheduled_end_date, today)
    ? "acerto_pendente" : trip.status;
}

type FineState = { status: string; due_date?: string | null; paid_at?: string | null };

export function isFineOpen(fine: FineState): boolean {
  return !fine.paid_at && !["paga", "paga_com_desconto", "paga_integral", "cancelada", "arquivada", "recurso_deferido"].includes(fine.status);
}

export function fineDisplayStatus<T extends FineState>(fine: T, today = localToday()): T["status"] {
  return isFineOpen(fine) && isPastDay(fine.due_date, today) ? "vencida" : fine.status;
}

export type MaintenanceDeadline = { vehicle_id: string; status: string; date: string | null };

export function overdueMaintenanceVehicles(deadlines: MaintenanceDeadline[], today = localToday()): Set<string> {
  return new Set(deadlines.filter((d) => isMaintenanceOverdue(d.status, d.date, today)).map((d) => d.vehicle_id));
}