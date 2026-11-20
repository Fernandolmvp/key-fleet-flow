export type ChecklistVehicleType = "carro" | "moto" | "caminhao";
export const CHECKLIST_VEHICLE_LABELS = { todos: "Todos", carro: "Carro", moto: "Moto", caminhao: "Caminhão" } as const;

export function mapChecklistVehicleType(value?: string | null): ChecklistVehicleType {
  const text = (value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (text.startsWith("moto")) return "moto";
  if (text.startsWith("caminh") || /truck|pesado/.test(text)) return "caminhao";
  return "carro";
}

export function matchesChecklistVehicleType(templateType: string | null | undefined, vehicleType: string | null | undefined) {
  return templateType == null || templateType === mapChecklistVehicleType(vehicleType);
}

export function classifyChecklistRun(run: { due_date?: string | null; status: string }, today: string): "hoje" | "atrasado" | null {
  if (!run.due_date) return null;
  if (run.due_date === today && ["pendente", "em_andamento"].includes(run.status)) return "hoje";
  if (run.due_date < today && !["concluido", "cancelado", "reprovado"].includes(run.status)) return "atrasado";
  return null;
}

export function isVehicleRestricted(vehicleId: string, requests: ReadonlyArray<{ vehicle_id: string | null; checklist_run_id: string | null; status: string }>): boolean {
  return requests.some((request) => request.vehicle_id === vehicleId && request.checklist_run_id != null && !["concluida", "rejeitada", "cancelada"].includes(request.status));
}

/** Finalized runs completed in the last 30 local calendar days, including today. N/A is excluded. */
export function checklistConformity(runs: ReadonlyArray<{
  vehicle_id: string; status: string; completed_at?: string | null;
  conform_items?: number | null; non_conform_items?: number | null;
}>, today: string, vehicleId?: string): number | null {
  const [year, month, day] = today.split("-").map(Number);
  const start = new Date(year, month - 1, day - 29).getTime();
  const end = new Date(year, month - 1, day + 1).getTime();
  let conform = 0;
  let answered = 0;
  for (const run of runs) {
    if (vehicleId && run.vehicle_id !== vehicleId) continue;
    if (!["concluido", "reprovado"].includes(run.status) || !run.completed_at) continue;
    const date = new Date(run.completed_at).getTime();
    if (!Number.isFinite(date) || date < start || date >= end) continue;
    const ok = Math.max(0, Number(run.conform_items) || 0);
    const failed = Math.max(0, Number(run.non_conform_items) || 0);
    conform += ok;
    answered += ok + failed;
  }
  return answered ? Math.round(conform / answered * 100) : null;
}
