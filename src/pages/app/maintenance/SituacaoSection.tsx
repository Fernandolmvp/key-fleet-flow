import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Wrench, AlertTriangle, CheckCircle2, Clock, Search, CalendarDays,
  FileText, ClipboardList, ArrowRight, ExternalLink,
} from "lucide-react";
import { EXEC_STATUS } from "@/lib/work-orders";
import { MR_STATUS } from "@/lib/maintenance-requests";
import { STATUS_TONE, fmtBRL } from "@/lib/maintenance";
import { ALERT_THRESHOLD_KM, DEFAULT_INTERVAL_KM } from "@/lib/checklist";

const IN_PROGRESS_EXEC = new Set([
  "em_execucao", "em_andamento", "iniciado", "iniciada", "aguardando_pecas",
]);
const OPEN_EXEC = new Set([
  "rascunho", "aguardando_aprovacao", "aprovado_aguardando_inicio",
  "em_execucao", "aguardando_pecas", "problema_relatado",
]);

type SitVehicle = {
  id: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  current_km: number | null;
  status: string;
};

type WO = {
  id: string; vehicle_id: string; os_number?: string | null; title?: string | null;
  description?: string | null; scheduled_date?: string | null;
  execution_status: string; workshop_id?: string | null;
  actual_amount_total?: number | null; quote_amount_total?: number | null;
  execution_started_at?: string | null;
};
type Rec = {
  id: string; vehicle_id: string; type: string; status: string;
  service_at: string; km_at_service: number | null; total_value: number | null;
  description: string | null; category: string | null;
  workshop_id: string | null; workshop_name: string | null;
  next_service_at: string | null; next_service_km: number | null;
};
type Sch = {
  id: string; vehicle_id: string; type: string; category: string | null;
  description: string | null; target_date: string | null; target_km: number | null;
  status: string;
};
type Req = {
  id: string; vehicle_id: string; problem_category: string | null;
  problem_description: string | null; status: string; severity_self_assessment?: string | null;
  requested_at: string | null; scheduled_date: string | null;
};

type VehicleState = {
  v: SitVehicle;
  activeWO?: WO;
  inProgressRec?: Rec;
  nextWO?: WO;
  nextSch?: Sch;
  nextRec?: Rec; // record agendada futura
  openRequests: Req[];
  lastDoneRec?: Rec;
  // preventive forecast
  baseKm: number;
  nextPrevKm: number;
  remainingKm: number;
  // ranking
  bucket: "in_maint" | "overdue" | "due_soon" | "scheduled" | "ok";
  bucketLabel: string;
  bucketTone: string;
  rank: number;
};

const isDoneStr = (s?: string | null) =>
  ["concluida", "concluido", "finalizada", "cancelada", "cancelado"].includes(
    String(s ?? "").toLowerCase(),
  );

export default function SituacaoSection() {
  const { currentCompanyId } = useAuth();
  const [vehicles, setVehicles] = useState<SitVehicle[]>([]);
  const [wos, setWos] = useState<WO[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [schs, setSchs] = useState<Sch[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [workshops, setWorkshops] = useState<Record<string, string>>({});
  const [intervalKm, setIntervalKm] = useState<number>(DEFAULT_INTERVAL_KM);
  const [q, setQ] = useState("");
  const [bucketFilter, setBucketFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    const [
      { data: v }, { data: w }, { data: r }, { data: s }, { data: rq }, { data: ws }, { data: comp },
    ] = await Promise.all([
      supabase.from("vehicles")
        .select("id,plate,brand,model,current_km,status")
        .eq("company_id", currentCompanyId)
        .not("status", "in", "(vendido,inativo,leiloado,roubado_furtado,transferido)"),
      supabase.from("maintenance_work_orders")
        .select("id,vehicle_id,os_number,title,description,scheduled_date,execution_status,workshop_id,actual_amount_total,quote_amount_total,execution_started_at")
        .eq("company_id", currentCompanyId),
      supabase.from("maintenance_records")
        .select("id,vehicle_id,type,status,service_at,km_at_service,total_value,description,category,workshop_id,workshop_name,next_service_at,next_service_km")
        .eq("company_id", currentCompanyId)
        .order("service_at", { ascending: false }),
      supabase.from("maintenance_schedules")
        .select("id,vehicle_id,type,category,description,target_date,target_km,status")
        .eq("company_id", currentCompanyId)
        .neq("status", "concluida"),
      supabase.from("maintenance_requests")
        .select("id,vehicle_id,problem_category,problem_description,status,severity_self_assessment,requested_at,scheduled_date")
        .eq("company_id", currentCompanyId)
        .not("status", "in", "(concluida,cancelada,rejeitada)"),
      supabase.from("workshops").select("id,name,trade_name").eq("company_id", currentCompanyId),
      supabase.from("companies").select("maintenance_default_interval_km").eq("id", currentCompanyId).maybeSingle(),
    ]);
    setVehicles((v ?? []) as any);
    setWos((w ?? []) as any);
    setRecs((r ?? []) as any);
    setSchs((s ?? []) as any);
    setReqs((rq ?? []) as any);
    const wm: Record<string, string> = {};
    ((ws ?? []) as any[]).forEach((x: any) => (wm[x.id] = x.trade_name || x.name));
    setWorkshops(wm);
    const dbVal = (comp as any)?.maintenance_default_interval_km as number | null | undefined;
    if (dbVal && dbVal > 0) setIntervalKm(Number(dbVal));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentCompanyId]);
  useAutoRefresh(load, [
    "vehicles", "maintenance_work_orders", "maintenance_records",
    "maintenance_schedules", "maintenance_requests",
  ]);

  const states: VehicleState[] = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return vehicles.map((v) => {
      const vWos = wos.filter((x) => x.vehicle_id === v.id);
      const vRecs = recs.filter((x) => x.vehicle_id === v.id);
      const vSchs = schs.filter((x) => x.vehicle_id === v.id);
      const vReqs = reqs.filter((x) => x.vehicle_id === v.id);

      const activeWO = vWos.find((x) => IN_PROGRESS_EXEC.has(String(x.execution_status).toLowerCase()));
      const inProgressRec = vRecs.find((x) => x.status === "em_andamento");

      const futureWOs = vWos
        .filter((x) => !isDoneStr(x.execution_status) && OPEN_EXEC.has(String(x.execution_status).toLowerCase()))
        .filter((x) => x !== activeWO)
        .sort((a, b) => String(a.scheduled_date ?? "9999").localeCompare(String(b.scheduled_date ?? "9999")));
      const nextWO = futureWOs[0];

      const futureSchs = vSchs
        .filter((x) => x.target_date)
        .sort((a, b) => String(a.target_date).localeCompare(String(b.target_date)));
      const nextSch = futureSchs[0];

      const futureRecs = vRecs
        .filter((x) => x.status === "agendada" && x.service_at)
        .sort((a, b) => String(a.service_at).localeCompare(String(b.service_at)));
      const nextRec = futureRecs[0];

      const lastDoneRec = vRecs.find((x) => x.status === "concluida");

      // Preventive forecast
      const lastPrev = vRecs.find((x) => x.type === "preventiva" && x.status === "concluida" && x.km_at_service != null);
      const baseKm = lastPrev?.km_at_service ?? (v.current_km ?? 0);
      const nextPrevKm = baseKm + intervalKm;
      const currentKm = v.current_km ?? 0;
      const remainingKm = nextPrevKm - currentKm;

      const hasPrevScheduled = vSchs.some((x) => x.type === "preventiva") ||
        vRecs.some((x) => x.type === "preventiva" && x.status === "agendada");

      // Bucket
      let bucket: VehicleState["bucket"] = "ok";
      let bucketLabel = "Em dia";
      let bucketTone = "bg-success/15 text-success border-success/30";
      let rank = 5;

      if (activeWO || inProgressRec || v.status === "manutencao") {
        bucket = "in_maint"; bucketLabel = "Em manutenção";
        bucketTone = "bg-blue-500/15 text-blue-300 border-blue-500/30"; rank = 1;
      } else if (!hasPrevScheduled && remainingKm < 0) {
        bucket = "overdue"; bucketLabel = "Preventiva vencida";
        bucketTone = "bg-destructive/15 text-destructive border-destructive/30"; rank = 2;
      } else if (!hasPrevScheduled && remainingKm <= ALERT_THRESHOLD_KM) {
        bucket = "due_soon"; bucketLabel = "Vence em breve";
        bucketTone = "bg-warning/15 text-warning border-warning/30"; rank = 3;
      } else if (nextWO || nextSch || nextRec) {
        bucket = "scheduled"; bucketLabel = "Agendado";
        bucketTone = "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"; rank = 4;
      }

      return {
        v, activeWO, inProgressRec, nextWO, nextSch, nextRec,
        openRequests: vReqs, lastDoneRec,
        baseKm, nextPrevKm, remainingKm,
        bucket, bucketLabel, bucketTone, rank,
      };
    }).sort((a, b) => a.rank - b.rank || a.remainingKm - b.remainingKm);
  }, [vehicles, wos, recs, schs, reqs, intervalKm]);

  const filtered = states.filter((s) => {
    if (bucketFilter !== "all" && s.bucket !== bucketFilter) return false;
    if (!q.trim()) return true;
    const blob = `${s.v.plate} ${s.v.brand ?? ""} ${s.v.model ?? ""}`.toLowerCase();
    return blob.includes(q.toLowerCase());
  });

  const counts = {
    in_maint: states.filter((s) => s.bucket === "in_maint").length,
    overdue: states.filter((s) => s.bucket === "overdue").length,
    due_soon: states.filter((s) => s.bucket === "due_soon").length,
    scheduled: states.filter((s) => s.bucket === "scheduled").length,
    ok: states.filter((s) => s.bucket === "ok").length,
  };

  const selectedState = selected ? states.find((s) => s.v.id === selected) ?? null : null;

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="surface-card rounded-xl p-3 flex flex-wrap items-center gap-2">
        {([
          ["all", `Todos · ${states.length}`, "bg-muted/40 text-foreground border-border"],
          ["in_maint", `🔧 Em manutenção · ${counts.in_maint}`, "bg-blue-500/15 text-blue-300 border-blue-500/30"],
          ["overdue", `⚠ Vencidas · ${counts.overdue}`, "bg-destructive/15 text-destructive border-destructive/30"],
          ["due_soon", `⏰ Em breve · ${counts.due_soon}`, "bg-warning/15 text-warning border-warning/30"],
          ["scheduled", `📅 Agendadas · ${counts.scheduled}`, "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"],
          ["ok", `✅ Em dia · ${counts.ok}`, "bg-success/15 text-success border-success/30"],
        ] as const).map(([k, label, cls]) => (
          <button key={k}
            onClick={() => setBucketFilter(k)}
            className={`text-xs px-2.5 py-1 rounded-md border transition ${cls} ${
              bucketFilter === k ? "ring-2 ring-primary/50" : "opacity-80 hover:opacity-100"
            }`}>
            {label}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Buscar placa/modelo..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando situação da frota...</div>
      ) : filtered.length === 0 ? (
        <div className="surface-card rounded-xl p-12 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display font-semibold">Nenhum veículo nesse filtro</h3>
        </div>
      ) : (
        <div className="surface-card rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Veículo</TableHead>
                <TableHead>Situação agora</TableHead>
                <TableHead>Próxima ação</TableHead>
                <TableHead className="text-right">KM atual / alvo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow
                  key={s.v.id}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => setSelected(s.v.id)}
                >
                  <TableCell>
                    <div className="font-mono text-primary font-semibold">{s.v.plate}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {[s.v.brand, s.v.model].filter(Boolean).join(" ") || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`border ${s.bucketTone}`}>{s.bucketLabel}</Badge>
                    {s.activeWO && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        OS {s.activeWO.os_number ?? "—"} · {EXEC_STATUS[s.activeWO.execution_status]?.label ?? s.activeWO.execution_status}
                        {s.activeWO.workshop_id && workshops[s.activeWO.workshop_id]
                          ? ` · ${workshops[s.activeWO.workshop_id]}` : ""}
                      </div>
                    )}
                    {!s.activeWO && s.inProgressRec && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Registro em andamento · {s.inProgressRec.category ?? s.inProgressRec.description ?? "manutenção"}
                      </div>
                    )}
                    {s.openRequests.length > 0 && (
                      <div className="text-[10px] text-warning mt-1 flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {s.openRequests.length} solicitação(ões) pendentes
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.bucket === "in_maint" ? (
                      <span className="text-xs text-muted-foreground">Aguardando conclusão</span>
                    ) : s.bucket === "overdue" ? (
                      <span className="text-xs text-destructive">Agendar preventiva agora</span>
                    ) : s.bucket === "due_soon" ? (
                      <span className="text-xs text-warning">Agendar preventiva</span>
                    ) : s.nextWO ? (
                      <div className="text-xs">
                        <div>OS {s.nextWO.os_number ?? ""} {s.nextWO.scheduled_date ? `· ${new Date(s.nextWO.scheduled_date + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[220px]">{s.nextWO.title ?? s.nextWO.description ?? ""}</div>
                      </div>
                    ) : s.nextSch ? (
                      <div className="text-xs">
                        {s.nextSch.type} {s.nextSch.target_date ? `· ${new Date(s.nextSch.target_date + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}
                        <div className="text-[10px] text-muted-foreground">{s.nextSch.description ?? s.nextSch.category ?? ""}</div>
                      </div>
                    ) : s.nextRec ? (
                      <div className="text-xs">
                        {s.nextRec.type} · {new Date(String(s.nextRec.service_at).slice(0,10) + "T00:00:00").toLocaleDateString("pt-BR")}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Próx. preventiva ~{s.nextPrevKm.toLocaleString("pt-BR")} km</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {(s.v.current_km ?? 0).toLocaleString("pt-BR")}
                    <div className="text-[10px] text-muted-foreground">
                      alvo {s.nextPrevKm.toLocaleString("pt-BR")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedState && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Badge className={`border ${selectedState.bucketTone}`}>{selectedState.bucketLabel}</Badge>
                </div>
                <SheetTitle className="font-display font-mono text-primary">
                  {selectedState.v.plate}
                </SheetTitle>
                <SheetDescription>
                  {[selectedState.v.brand, selectedState.v.model].filter(Boolean).join(" ") || "—"}
                  {" · "}{(selectedState.v.current_km ?? 0).toLocaleString("pt-BR")} km
                </SheetDescription>
              </SheetHeader>

              <Timeline state={selectedState} workshops={workshops} />

              <div className="mt-6 flex flex-col gap-2">
                <Button asChild variant="outline" className="w-full justify-between">
                  <Link to={`/app/vehicles/${selectedState.v.id}/historico`}>
                    Histórico completo do veículo
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Step({
  done, active, label, detail, icon: Icon,
}: { done: boolean; active: boolean; label: string; detail?: React.ReactNode; icon: any }) {
  const cls = done
    ? "bg-success/15 text-success border-success/40"
    : active
    ? "bg-primary/15 text-primary border-primary/40 ring-2 ring-primary/30"
    : "bg-muted/20 text-muted-foreground border-border";
  return (
    <li className="flex gap-3">
      <div className={`h-8 w-8 rounded-full border grid place-items-center shrink-0 ${cls}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 pb-4 border-l-0">
        <div className={`text-sm font-medium ${active ? "text-primary" : done ? "text-success" : "text-muted-foreground"}`}>{label}</div>
        {detail && <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>}
      </div>
    </li>
  );
}

function Timeline({ state, workshops }: { state: VehicleState; workshops: Record<string, string> }) {
  const hasRequest = state.openRequests.length > 0;
  const hasApproval = !!state.nextSch || !!state.nextRec || !!state.nextWO || !!state.activeWO || state.openRequests.some((r) => r.status === "aprovada");
  const hasSchedule = !!state.nextSch || !!state.nextRec || !!state.activeWO || !!state.nextWO;
  const hasWO = !!state.activeWO || !!state.nextWO;
  const inExec = !!state.activeWO || !!state.inProgressRec;
  const done = !inExec && !!state.lastDoneRec;

  const stepDone = {
    request: hasRequest || hasApproval || hasSchedule || hasWO || inExec || done,
    approval: hasApproval || hasSchedule || hasWO || inExec || done,
    schedule: hasSchedule || hasWO || inExec || done,
    wo: hasWO || inExec || done,
    exec: inExec || done,
    done: done,
  };
  const stepActive = {
    request: hasRequest && !hasApproval,
    approval: hasApproval && !hasSchedule,
    schedule: hasSchedule && !hasWO,
    wo: hasWO && !inExec,
    exec: inExec,
    done: done,
  };

  return (
    <ol className="mt-6 space-y-1">
      <Step icon={FileText} done={stepDone.request} active={stepActive.request}
        label="Solicitação"
        detail={state.openRequests[0] ? (
          <>
            {state.openRequests[0].problem_description ?? state.openRequests[0].problem_category ?? "Reportado"}
            {" · "}{(MR_STATUS as any)[state.openRequests[0].status]?.label ?? state.openRequests[0].status}
          </>
        ) : "Sem solicitação pendente"}
      />
      <Step icon={CheckCircle2} done={stepDone.approval} active={stepActive.approval}
        label="Aprovação" />
      <Step icon={CalendarDays} done={stepDone.schedule} active={stepActive.schedule}
        label="Agendamento"
        detail={
          state.nextWO?.scheduled_date
            ? `OS ${state.nextWO.os_number ?? ""} em ${new Date(state.nextWO.scheduled_date + "T00:00:00").toLocaleDateString("pt-BR")}`
            : state.nextSch?.target_date
            ? `${state.nextSch.type} em ${new Date(state.nextSch.target_date + "T00:00:00").toLocaleDateString("pt-BR")}`
            : state.nextRec?.service_at
            ? `${state.nextRec.type} em ${new Date(String(state.nextRec.service_at).slice(0,10) + "T00:00:00").toLocaleDateString("pt-BR")}`
            : undefined
        }
      />
      <Step icon={ClipboardList} done={stepDone.wo} active={stepActive.wo}
        label="Ordem de Serviço"
        detail={state.activeWO || state.nextWO ? (() => {
          const wo = state.activeWO ?? state.nextWO!;
          const ws = wo.workshop_id ? workshops[wo.workshop_id] : null;
          return (
            <>
              {wo.title ?? wo.description ?? `OS ${wo.os_number ?? ""}`}
              {ws ? ` · ${ws}` : ""}
              {" · "}{EXEC_STATUS[wo.execution_status]?.label ?? wo.execution_status}
            </>
          );
        })() : "—"}
      />
      <Step icon={Wrench} done={stepDone.exec} active={stepActive.exec}
        label="Em execução"
        detail={state.activeWO?.execution_started_at
          ? `Iniciada em ${new Date(state.activeWO.execution_started_at).toLocaleDateString("pt-BR")}`
          : state.inProgressRec
          ? `Registro em andamento · ${state.inProgressRec.category ?? ""}`
          : undefined}
      />
      <Step icon={CheckCircle2} done={stepDone.done} active={stepActive.done}
        label="Concluída"
        detail={state.lastDoneRec ? (
          <>
            Última: {new Date(state.lastDoneRec.service_at).toLocaleDateString("pt-BR")}
            {" · "}{fmtBRL(Number(state.lastDoneRec.total_value || 0))}
          </>
        ) : "—"}
      />
    </ol>
  );
}