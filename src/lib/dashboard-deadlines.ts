import { supabase } from "@/integrations/supabase/client";
import { fineDisplayStatus, isFineOpen, isMaintenanceClosed, isPastDay, overdueMaintenanceVehicles, tripDisplayStatus } from "./automatic-status";

// PostgREST caps each page; dashboard totals must include every accessible company record.
async function readAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export async function loadDashboardDeadlines(companyId: string, today: string) {
  const [schedules, records, workOrders, trips, fines, vehicles] = await Promise.all([
    readAll((from, to) => supabase.from("maintenance_schedules").select("id,vehicle_id,status,target_date,category").eq("company_id", companyId).order("id").range(from, to)),
    readAll((from, to) => supabase.from("maintenance_records").select("id,vehicle_id,status,service_at,category").eq("company_id", companyId).order("id").range(from, to)),
    readAll((from, to) => supabase.from("maintenance_work_orders").select("id,vehicle_id,execution_status,scheduled_date,title").eq("company_id", companyId).order("id").range(from, to)),
    readAll((from, to) => supabase.from("trips").select("id,status,scheduled_end_date,trip_code,title").eq("company_id", companyId).order("id").range(from, to)),
    readAll((from, to) => supabase.from("traffic_fines").select("id,status,due_date,paid_at,description,notification_number,record_type").eq("company_id", companyId).order("id").range(from, to)),
    readAll((from, to) => supabase.from("vehicles").select("id,plate").eq("company_id", companyId).not("status", "in", "(vendido,inativo,leiloado,roubado_furtado,transferido)").order("id").range(from, to)),
  ]);
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v.plate]));
  const deadlines = [
    ...schedules.map((s) => ({ vehicle_id: s.vehicle_id, status: s.status, date: s.target_date, title: s.category })),
    ...records.map((r) => ({ vehicle_id: r.vehicle_id, status: r.status, date: r.service_at, title: r.category })),
    ...workOrders.map((w) => ({ vehicle_id: w.vehicle_id, status: w.execution_status, date: w.scheduled_date, title: w.title })),
  ].filter((d) => vehicleMap.has(d.vehicle_id));
  const overdue = overdueMaintenanceVehicles(deadlines, today);
  const in7 = new Date(today + "T00:00:00");
  in7.setDate(in7.getDate() + 7);
  const upcoming = new Set(deadlines.filter((d) => !isMaintenanceClosed(d.status) && d.date && !isPastDay(d.date, today) && new Date(d.date.slice(0, 10) + "T00:00:00") <= in7).map((d) => d.vehicle_id));
  const pendingTrips = trips.filter((t) => ["aguardando_acerto", "acerto_pendente"].includes(tripDisplayStatus(t, today)));
  const overdueFines = fines.filter((f) => fineDisplayStatus(f, today) === "vencida" && isFineOpen(f));
  const alerts = [
    ...[...overdue].map((vehicleId) => {
      const deadline = deadlines.filter((d) => d.vehicle_id === vehicleId && isPastDay(d.date, today) && !isMaintenanceClosed(d.status)).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))[0];
      return { kind: "maintenance", severity: "high", title: `Manutenção vencida · ${vehicleMap.get(vehicleId)}`, subtitle: deadline?.title ?? "Agendamento vencido", date: deadline?.date ?? today, link: "/app/maintenance" };
    }),
    ...pendingTrips.map((t) => ({ kind: "trip", severity: "high", title: `Acerto pendente · ${t.trip_code ?? t.title ?? "Viagem"}`, subtitle: t.title ?? "Viagem com acerto pendente", date: t.scheduled_end_date ?? today, link: "/app/viagens" })),
    ...overdueFines.map((f) => ({ kind: "fine", severity: "high", title: `Multa vencida${f.notification_number ? ` · ${f.notification_number}` : ""}`, subtitle: f.description ?? "Pagamento pendente", date: f.due_date ?? today, link: "/app/multas" })),
  ];
  return {
    maint_overdue: overdue.size,
    maint_7d: upcoming.size,
    trips_pending: pendingTrips.length,
    fines_overdue: overdueFines.length,
    fines_open: fines.filter(isFineOpen).length,
    alerts,
  };
}