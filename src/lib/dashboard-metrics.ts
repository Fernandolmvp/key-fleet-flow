import { supabase } from "@/integrations/supabase/client";
import { readAll } from "./dashboard-deadlines";
import { cnhStatus, documentationCnhExpiry, isActiveDriver } from "./documents";
import { computeLicensingStatus, loadDetranCalendar, type DetranCalendar } from "./licensing";
import { localToday } from "./automatic-status";

type Driver = { id: string; status: string; full_name: string; cnh_expires_at: string | null };
type Vehicle = { id: string; status: string; plate: string; licensing_year: number | null; licensing_uf: string | null; vehicle_type: string | null };
type Doc = { entity_type: string; entity_id: string; doc_type: string; expires_at: string | null };

export function dashboardDocumentMetrics(vehicles: Vehicle[], drivers: Driver[], docs: Doc[], calendar: DetranCalendar, today: string) {
  const now = new Date(today + "T00:00:00");
  const alerts: { kind: string; severity: string; title: string; subtitle: string; date: string; link: string }[] = [];
  for (const v of vehicles.filter((v) => v.status === "ativo")) {
    const lic = computeLicensingStatus({ licensing_year: v.licensing_year, plate: v.plate, uf: v.licensing_uf, vehicle_type: v.vehicle_type, calendar, today: new Date(now) });
    if ((lic.status === "vencido" || lic.status === "vencendo") && lic.vencimento) {
      alerts.push({ kind: "document", severity: lic.status === "vencido" ? "high" : "medium", title: `Licenciamento · ${v.plate}`, subtitle: lic.status === "vencido" ? "Licenciamento vencido" : "Licenciamento vence em breve", date: localToday(lic.vencimento), link: "/app/documents" });
    }
  }
  const driverDocs = docs.filter((d) => d.entity_type === "driver");
  // Documentação lists status=ativo and prefers the CNH attachment's expiration.
  for (const driver of drivers.filter((d) => d.status === "ativo")) {
    const date = documentationCnhExpiry(driver, driverDocs);
    const status = cnhStatus(date, now);
    if ((status.kind === "vencida" || status.kind === "vencendo") && date) {
      alerts.push({ kind: "document", severity: status.kind === "vencida" ? "high" : "medium", title: `CNH · ${driver.full_name}`, subtitle: status.label, date, link: "/app/documents" });
    }
  }
  // Motoristas' active tab includes holidays and uses the registered CNH expiration.
  const activeDrivers = drivers.filter((d) => isActiveDriver(d.status));
  return {
    docs_expiring: alerts.length,
    drivers_active: activeDrivers.length,
    cnh_expiring: activeDrivers.filter((d) => ["vencida", "vencendo"].includes(cnhStatus(d.cnh_expires_at, now).kind)).length,
    alerts,
  };
}

type DatedCost = { date: string | null; amount: number | null };
export function monthCost(rows: DatedCost[], month: string): number {
  return rows.filter((r) => r.date?.slice(0, 7) === month).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

export async function loadDashboardMetrics(companyId: string, today: string) {
  const month = today.slice(0, 7);
  const now = new Date(today + "T00:00:00");
  const previous = localToday(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const next = localToday(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  const [vehicles, drivers, docs, calendar, maintenance, fuel, fines, expenses, tripExpenses] = await Promise.all([
    readAll((from, to) => supabase.from("vehicles").select("id,status,plate,licensing_year,licensing_uf,vehicle_type").eq("company_id", companyId).eq("status", "ativo").order("id").range(from, to)),
    readAll((from, to) => supabase.from("drivers").select("id,status,full_name,cnh_expires_at").eq("company_id", companyId).order("id").range(from, to)),
    readAll((from, to) => supabase.from("documents").select("id,entity_type,entity_id,doc_type,expires_at").eq("company_id", companyId).order("expires_at", { ascending: true, nullsFirst: false }).order("id").range(from, to)),
    loadDetranCalendar(),
    readAll((from, to) => supabase.from("maintenance_records").select("id,service_at,total_value").eq("company_id", companyId).gte("service_at", previous).lt("service_at", next).order("id").range(from, to)),
    readAll((from, to) => supabase.from("fuel_records").select("id,fueled_at,total_value").eq("company_id", companyId).gte("fueled_at", previous).lt("fueled_at", next).order("id").range(from, to)),
    readAll((from, to) => supabase.from("traffic_fines").select("id,infraction_date,paid_amount,amount").eq("company_id", companyId).gte("infraction_date", previous).lt("infraction_date", next).order("id").range(from, to)),
    readAll((from, to) => supabase.from("vehicle_expenses").select("id,expense_date,amount").eq("company_id", companyId).gte("expense_date", previous).lt("expense_date", next).order("id").range(from, to)),
    readAll((from, to) => supabase.from("trip_expenses").select("id,expense_date,amount").eq("company_id", companyId).gte("expense_date", previous).lt("expense_date", next).order("id").range(from, to)),
  ]);
  const costs = {
    maintenance: maintenance.map((r) => ({ date: r.service_at, amount: r.total_value })),
    fuel: fuel.map((r) => ({ date: r.fueled_at, amount: r.total_value })),
    fines: fines.map((r) => ({ date: r.infraction_date, amount: r.paid_amount ?? r.amount })),
    expenses: expenses.map((r) => ({ date: r.expense_date, amount: r.amount })),
    trip_expenses: tripExpenses.map((r) => ({ date: r.expense_date, amount: r.amount })),
  };
  const breakdown = {
    maintenance: monthCost(costs.maintenance, month), fuel: monthCost(costs.fuel, month), fines: monthCost(costs.fines, month),
    expenses: monthCost(costs.expenses, month), trip_expenses: monthCost(costs.trip_expenses, month),
  };
  return {
    ...dashboardDocumentMetrics(vehicles, drivers, docs, calendar, today),
    breakdown,
    total: Object.values(breakdown).reduce((sum, amount) => sum + amount, 0),
    prev_total: Object.values(costs).reduce((sum, rows) => sum + monthCost(rows, previous.slice(0, 7)), 0),
  };
}