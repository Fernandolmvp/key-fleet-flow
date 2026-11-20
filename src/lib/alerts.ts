import { supabase } from "@/integrations/supabase/client";
import { readAll, loadDashboardDeadlines } from "./dashboard-deadlines";
import { dashboardDocumentMetrics } from "./dashboard-metrics";
import { loadDetranCalendar } from "./licensing";
import { cnhStatus, isActiveDriver, DOC_TYPE_LABELS } from "./documents";
import { isPastDay } from "./automatic-status";

export type FleetAlert = { id: string; kind: string; severity: string; title: string; subtitle: string; date: string | null; link: string };
type Policy = { id: string; policy_number: string; insurer_name: string; status: string; end_date: string | null; ai_extracted: unknown };
type Vehicle = { id: string; plate: string; status: string };
type PolicyLink = { policy_id: string; vehicle_id: string; removed_at?: string | null; revoked_at?: string | null };

export function insuranceAlerts(vehicles: Vehicle[], policies: Policy[], links: PolicyLink[], manual: PolicyLink[], today: string): FleetAlert[] {
  const active = policies.filter((p) => p.status === "ativa" && !isPastDay(p.end_date, today));
  const activeIds = new Set(active.map((p) => p.id));
  const covered = new Set(links.filter((l) => !l.removed_at && activeIds.has(l.policy_id)).map((l) => l.vehicle_id));
  manual.filter((m) => !m.revoked_at && activeIds.has(m.policy_id)).forEach((m) => covered.add(m.vehicle_id));
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const plateMap = new Map(vehicles.map((v) => [norm(v.plate), v.id]));
  active.forEach((p) => {
    const ex = p.ai_extracted && typeof p.ai_extracted === "object" ? p.ai_extracted as Record<string, unknown> : {};
    const plates = Array.isArray(ex.plates) ? ex.plates : Array.isArray(ex.vehicles) ? ex.vehicles.map((v) => v && typeof v === "object" ? v.plate : null) : [];
    plates.forEach((plate) => {
      if (typeof plate !== "string") return;
      const vehicleId = plateMap.get(norm(plate));
      if (vehicleId) covered.add(vehicleId);
    });
  });
  return [
    ...policies.filter((p) => p.status === "ativa" && isPastDay(p.end_date, today)).map((p) => ({ id: `policy:${p.id}`, kind: "policy", severity: "high", title: `Apólice vencida · ${p.policy_number}`, subtitle: p.insurer_name, date: p.end_date, link: "/app/insurance" })),
    ...vehicles.filter((v) => v.status === "ativo" && !covered.has(v.id)).map((v) => ({ id: `uninsured:${v.id}`, kind: "uninsured", severity: "high", title: `Veículo sem seguro · ${v.plate}`, subtitle: "Sem cobertura em apólice vigente", date: null, link: "/app/insurance" })),
  ];
}

export async function loadFleetAlerts(companyId: string, today: string): Promise<FleetAlert[]> {
  const [deadlines, vehicles, drivers, docs, policies, links, manual, calendar] = await Promise.all([
    loadDashboardDeadlines(companyId, today),
    readAll((from, to) => supabase.from("vehicles").select("id,plate,status,licensing_year,licensing_uf,vehicle_type").eq("company_id", companyId).order("id").range(from, to)),
    readAll((from, to) => supabase.from("drivers").select("id,status,full_name,cnh_expires_at").eq("company_id", companyId).order("id").range(from, to)),
    readAll((from, to) => supabase.from("documents").select("id,entity_type,entity_id,doc_type,title,expires_at").eq("company_id", companyId).order("expires_at", { ascending: true, nullsFirst: false }).order("id").range(from, to)),
    readAll((from, to) => supabase.from("insurance_policies").select("id,policy_number,insurer_name,status,end_date,ai_extracted").eq("company_id", companyId).order("id").range(from, to)),
    readAll((from, to) => supabase.from("insurance_policy_vehicles").select("id,policy_id,vehicle_id,removed_at").eq("company_id", companyId).order("id").range(from, to)),
    readAll((from, to) => supabase.from("vehicle_policy_manual_matches").select("id,policy_id,vehicle_id,revoked_at").eq("company_id", companyId).order("id").range(from, to)),
    loadDetranCalendar(),
  ]);
  const now = new Date(today + "T00:00:00");
  const documentMetrics = dashboardDocumentMetrics(vehicles, drivers, docs, calendar, today);
  const alerts: FleetAlert[] = deadlines.alerts.map((a, i) => ({ ...a, id: `deadline:${i}` }));
  alerts.push(...documentMetrics.alerts.filter((a) => !a.title.startsWith("CNH · ")).map((a, i) => ({ ...a, id: `licensing:${i}` })));
  // CNH in this unified view uses the same active scope and registered date as Drivers.
  drivers.filter((d) => isActiveDriver(d.status)).forEach((driver) => {
    const state = cnhStatus(driver.cnh_expires_at, now);
    if (!["vencida", "vencendo"].includes(state.kind)) return;
    alerts.push({ id: `cnh:${driver.id}`, kind: "cnh", severity: state.kind === "vencida" ? "high" : "medium", title: `CNH · ${driver.full_name}`, subtitle: state.label, date: driver.cnh_expires_at, link: "/app/drivers" });
  });
  const names = new Map([...vehicles.filter((v) => v.status === "ativo").map((v) => [`vehicle:${v.id}`, v.plate] as const), ...drivers.filter((d) => d.status === "ativo").map((d) => [`driver:${d.id}`, d.full_name] as const)]);
  docs.filter((d) => !["crlv", "licenciamento", "cnh"].includes(d.doc_type)).forEach((doc) => {
    const name = names.get(`${doc.entity_type}:${doc.entity_id}`);
    const state = cnhStatus(doc.expires_at, now);
    if (!name || !["vencida", "vencendo"].includes(state.kind)) return;
    alerts.push({ id: `document:${doc.id}`, kind: "document", severity: state.kind === "vencida" ? "high" : "medium", title: `${doc.title || DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type} · ${name}`, subtitle: state.label, date: doc.expires_at, link: "/app/documents" });
  });
  alerts.push(...insuranceAlerts(vehicles, policies, links, manual, today));
  return alerts.sort((a, b) => Number(b.severity === "high") - Number(a.severity === "high") || (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.title.localeCompare(b.title));
}