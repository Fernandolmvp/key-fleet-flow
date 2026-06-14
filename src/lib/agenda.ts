import { supabase } from "@/integrations/supabase/client";

export type AgendaEventType =
  | "preventiva"
  | "corretiva"
  | "vistoria"
  | "licenciamento"
  | "lavagem"
  | "pneu"
  | "outros";

export interface AgendaEvent {
  id: string;
  source:
    | "work_order"
    | "request"
    | "schedule"
    | "record"
    | "expense";
  type: AgendaEventType;
  date: string; // ISO yyyy-mm-dd
  time?: string | null; // HH:MM
  vehicle_id: string | null;
  vehicle_plate: string;
  vehicle_model?: string;
  description: string;
  workshop_id?: string | null;
  local_name?: string | null;
  local_address?: string | null;
  status: string;
  status_done: boolean;
  estimated_value?: number | null;
  url: string;
}

export const TYPE_META: Record<
  AgendaEventType,
  { label: string; chipClass: string; dotClass: string }
> = {
  preventiva: {
    label: "Preventiva",
    chipClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  corretiva: {
    label: "Corretiva",
    chipClass: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    dotClass: "bg-orange-400",
  },
  vistoria: {
    label: "Vistoria",
    chipClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    dotClass: "bg-sky-400",
  },
  licenciamento: {
    label: "Licenciamento",
    chipClass: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    dotClass: "bg-purple-400",
  },
  lavagem: {
    label: "Lavagem",
    chipClass: "bg-slate-400/15 text-slate-300 border-slate-400/30",
    dotClass: "bg-slate-300",
  },
  pneu: {
    label: "Troca de pneu",
    chipClass: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    dotClass: "bg-yellow-400",
  },
  outros: {
    label: "Outros",
    chipClass: "bg-muted text-foreground/80 border-border",
    dotClass: "bg-muted-foreground",
  },
};

const expenseCategoryToType = (cat: string | null | undefined): AgendaEventType | null => {
  if (!cat) return null;
  const c = cat.toLowerCase();
  if (c.includes("vistoria")) return "vistoria";
  if (c.includes("licenc") || c === "ipva") return "licenciamento";
  if (c.includes("lavag")) return "lavagem";
  if (c.includes("pneu")) return "pneu";
  return null;
};

const fmtAddress = (w: any): string | null => {
  if (!w) return null;
  const parts = [w.street, w.address_number, w.neighborhood, w.city, w.state].filter(Boolean);
  return parts.join(", ") || null;
};

export async function loadAgendaEvents(
  companyId: string,
  fromISO: string,
  toISO: string,
): Promise<AgendaEvent[]> {
  const [
    { data: vehs },
    { data: shops },
    { data: wos },
    { data: reqs },
    { data: scheds },
    { data: recs },
    { data: exps },
  ] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id,plate,brand,model")
      .eq("company_id", companyId),
    supabase
      .from("workshops")
      .select("id,name,trade_name,street,address_number,neighborhood,city,state")
      .eq("company_id", companyId),
    supabase
      .from("maintenance_work_orders")
      .select(
        "id,vehicle_id,workshop_id,scheduled_date,scheduled_time,title,description,problem_category,execution_status,quote_amount_total,actual_amount_total",
      )
      .eq("company_id", companyId)
      .gte("scheduled_date", fromISO)
      .lte("scheduled_date", toISO),
    supabase
      .from("maintenance_requests")
      .select(
        "id,vehicle_id,scheduled_date,scheduled_workshop_id,problem_category,problem_description,status,estimated_cost",
      )
      .eq("company_id", companyId)
      .gte("scheduled_date", fromISO)
      .lte("scheduled_date", toISO)
      .not("scheduled_date", "is", null),
    supabase
      .from("maintenance_schedules")
      .select("id,vehicle_id,type,category,description,target_date,status,scheduled_time,scheduled_workshop_id,target_km")
      .eq("company_id", companyId)
      .gte("target_date", fromISO)
      .lte("target_date", toISO)
      .not("target_date", "is", null),
    supabase
      .from("maintenance_records")
      .select(
        "id,vehicle_id,type,category,description,next_service_at,workshop_id,workshop_name,status,total_value",
      )
      .eq("company_id", companyId)
      .gte("next_service_at", fromISO)
      .lte("next_service_at", toISO)
      .not("next_service_at", "is", null),
    supabase
      .from("vehicle_expenses")
      .select(
        "id,vehicle_id,expense_date,due_date,expense_category,amount,description,paid",
      )
      .eq("company_id", companyId)
      .or(
        `and(due_date.gte.${fromISO},due_date.lte.${toISO}),and(expense_date.gte.${fromISO},expense_date.lte.${toISO})`,
      ),
  ]);

  const vMap = new Map<string, any>();
  (vehs ?? []).forEach((v: any) => vMap.set(v.id, v));
  const sMap = new Map<string, any>();
  (shops ?? []).forEach((s: any) => sMap.set(s.id, s));

  const events: AgendaEvent[] = [];

  const veh = (id: string | null) => {
    if (!id) return { plate: "—", model: "" };
    const v = vMap.get(id);
    if (!v) return { plate: "—", model: "" };
    return { plate: v.plate, model: [v.brand, v.model].filter(Boolean).join(" ") };
  };
  const wsh = (id: string | null | undefined) => sMap.get(id ?? "");

  (wos ?? []).forEach((o: any) => {
    const v = veh(o.vehicle_id);
    const w = wsh(o.workshop_id);
    const cats: string[] = Array.isArray(o.problem_category) ? o.problem_category : [];
    const lc = cats.join(" ").toLowerCase();
    let type: AgendaEventType = "corretiva";
    if (lc.includes("preventiv")) type = "preventiva";
    else if (lc.includes("pneu")) type = "pneu";
    events.push({
      id: `wo-${o.id}`,
      source: "work_order",
      type,
      date: o.scheduled_date,
      time: o.scheduled_time ? String(o.scheduled_time).slice(0, 5) : null,
      vehicle_id: o.vehicle_id,
      vehicle_plate: v.plate,
      vehicle_model: v.model,
      description: o.title || o.description || "Ordem de serviço",
      workshop_id: o.workshop_id,
      local_name: w?.trade_name || w?.name || null,
      local_address: fmtAddress(w),
      status: o.execution_status || "agendada",
      status_done: ["concluida", "concluido", "finalizada"].includes(
        String(o.execution_status ?? "").toLowerCase(),
      ),
      estimated_value: o.actual_amount_total ?? o.quote_amount_total ?? null,
      url: `/app/oficinas`,
    });
  });

  (reqs ?? []).forEach((r: any) => {
    const v = veh(r.vehicle_id);
    const w = wsh(r.scheduled_workshop_id);
    const cat = (r.problem_category ?? "").toLowerCase();
    let type: AgendaEventType = "corretiva";
    if (cat.includes("preventiv")) type = "preventiva";
    else if (cat.includes("pneu")) type = "pneu";
    events.push({
      id: `req-${r.id}`,
      source: "request",
      type,
      date: r.scheduled_date,
      time: null,
      vehicle_id: r.vehicle_id,
      vehicle_plate: v.plate,
      vehicle_model: v.model,
      description: r.problem_description || r.problem_category || "Solicitação de manutenção",
      workshop_id: r.scheduled_workshop_id,
      local_name: w?.trade_name || w?.name || null,
      local_address: fmtAddress(w),
      status: r.status,
      status_done: ["concluida", "executada", "finalizada"].includes(String(r.status ?? "").toLowerCase()),
      estimated_value: r.estimated_cost ?? null,
      url: `/app/approvals`,
    });
  });

  (scheds ?? []).forEach((s: any) => {
    const v = veh(s.vehicle_id);
    const w = wsh(s.scheduled_workshop_id);
    const type: AgendaEventType =
      s.type === "preventiva" ? "preventiva" : s.type === "pneus" ? "pneu" : "corretiva";
    events.push({
      id: `sch-${s.id}`,
      source: "schedule",
      type,
      date: s.target_date,
      time: s.scheduled_time ? String(s.scheduled_time).slice(0, 5) : null,
      vehicle_id: s.vehicle_id,
      vehicle_plate: v.plate,
      vehicle_model: v.model,
      description: s.description || s.category || "Manutenção planejada",
      workshop_id: s.scheduled_workshop_id ?? null,
      local_name: w?.trade_name || w?.name || null,
      local_address: fmtAddress(w),
      status: s.status,
      status_done: s.status === "concluida",
      estimated_value: null,
      url: `/app/maintenance`,
    });
  });

  (recs ?? []).forEach((r: any) => {
    const v = veh(r.vehicle_id);
    const w = wsh(r.workshop_id);
    const type: AgendaEventType =
      r.type === "preventiva" ? "preventiva" : r.type === "pneus" ? "pneu" : "corretiva";
    events.push({
      id: `rec-${r.id}`,
      source: "record",
      type,
      date: r.next_service_at,
      time: null,
      vehicle_id: r.vehicle_id,
      vehicle_plate: v.plate,
      vehicle_model: v.model,
      description: r.description || r.category || "Próxima manutenção",
      workshop_id: r.workshop_id,
      local_name: w?.trade_name || w?.name || r.workshop_name || null,
      local_address: fmtAddress(w),
      status: r.status,
      status_done: r.status === "concluida",
      estimated_value: r.total_value ?? null,
      url: `/app/maintenance`,
    });
  });

  (exps ?? []).forEach((e: any) => {
    const t = expenseCategoryToType(e.expense_category);
    if (!t) return;
    const v = veh(e.vehicle_id);
    const date = e.due_date || e.expense_date;
    if (!date) return;
    events.push({
      id: `exp-${e.id}`,
      source: "expense",
      type: t,
      date,
      time: null,
      vehicle_id: e.vehicle_id,
      vehicle_plate: v.plate,
      vehicle_model: v.model,
      description: e.description || TYPE_META[t].label,
      local_name: null,
      local_address: null,
      status: e.paid ? "concluida" : "agendada",
      status_done: !!e.paid,
      estimated_value: e.amount ?? null,
      url: `/app/despesas`,
    });
  });

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export const ALL_AGENDA_TYPES: AgendaEventType[] = [
  "preventiva",
  "corretiva",
  "vistoria",
  "licenciamento",
  "lavagem",
  "pneu",
  "outros",
];