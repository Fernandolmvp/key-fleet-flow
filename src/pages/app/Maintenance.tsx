import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Wrench, Pencil, Trash2, AlertTriangle, CalendarClock, DollarSign, Activity, CalendarDays, Settings2, ListChecks, BellRing } from "lucide-react";
import { toast } from "sonner";
import KpiCard from "@/components/dashboard/KpiCard";
import MaintenanceDialog from "@/components/dashboard/MaintenanceDialog";
import ChecklistDialog from "@/components/dashboard/ChecklistDialog";
import SchedulePreventiveDialog from "@/components/dashboard/SchedulePreventiveDialog";
import { STATUS_TONE, TYPE_TONE, SCHEDULE_STATUS_TONE, fmtBRL } from "@/lib/maintenance";
import { ALERT_THRESHOLD_KM, DEFAULT_INTERVAL_KM } from "@/lib/checklist";
import { Label } from "@/components/ui/label";
import { useTabPermissions } from "@/lib/permissions";
import AgendaSection from "./maintenance/AgendaSection";

interface MRec {
  id: string; vehicle_id: string; type: string; status: string; category: string | null;
  service_at: string; km_at_service: number | null; total_value: number;
  workshop_name: string | null; description: string | null;
  next_service_km: number | null; next_service_at: string | null;
}

interface Sched {
  id: string; vehicle_id: string; type: string; category: string;
  description: string | null; target_km: number | null; target_date: string | null; status: string;
}

export default function Maintenance() {
  const { currentCompanyId } = useAuth();
  const [records, setRecords] = useState<MRec[]>([]);
  const [schedules, setSchedules] = useState<Sched[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, { plate: string; current_km: number }>>({});
  const [lastFuelKm, setLastFuelKm] = useState<Record<string, { km: number; at: string }>>({});
  const [q, setQ] = useState("");
  const [calQ, setCalQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MRec | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistRecord, setChecklistRecord] = useState<{ id: string; plate?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalKey = `maint_interval_km:${currentCompanyId ?? "_"}`;
  const [intervalKm, setIntervalKm] = useState<number>(DEFAULT_INTERVAL_KM);
  const [scheduleDlg, setScheduleDlg] = useState<{ open: boolean; vehicleId: string | null; plate?: string; targetKm?: number | null }>({ open: false, vehicleId: null });
  const [quickMaintFromUrgent, setQuickMaintFromUrgent] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("agenda");
  const { canViewTab, isVisible, fallback } = useTabPermissions(
    "maintenance", ["agenda", "records", "schedules", "calendar", "costs"], tab,
  );
  useEffect(() => {
    if (!isVisible && fallback) setTab(fallback);
  }, [isVisible, fallback]);

  useEffect(() => {
    if (!currentCompanyId) return;
    (async () => {
      const { data } = await supabase.from("companies").select("maintenance_default_interval_km").eq("id", currentCompanyId).maybeSingle();
      const dbVal = (data as any)?.maintenance_default_interval_km as number | null | undefined;
      if (dbVal && dbVal > 0) {
        setIntervalKm(Number(dbVal));
        return;
      }
      const saved = localStorage.getItem(intervalKey);
      setIntervalKm(saved ? Number(saved) || DEFAULT_INTERVAL_KM : DEFAULT_INTERVAL_KM);
    })();
  }, [currentCompanyId]);

  const saveInterval = (n: number) => {
    setIntervalKm(n);
    localStorage.setItem(intervalKey, String(n));
    if (currentCompanyId && n > 0) {
      supabase.from("companies").update({ maintenance_default_interval_km: n }).eq("id", currentCompanyId);
    }
  };

  const load = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    const [{ data: r }, { data: s }, { data: v }, { data: f }] = await Promise.all([
      supabase.from("maintenance_records").select("*").eq("company_id", currentCompanyId).order("service_at", { ascending: false }),
      supabase.from("maintenance_schedules").select("*").eq("company_id", currentCompanyId).neq("status", "concluida"),
      supabase.from("vehicles").select("id,plate,current_km").eq("company_id", currentCompanyId).eq("status", "ativo"),
      supabase.from("fuel_records").select("vehicle_id,km_at_fueling,fueled_at").eq("company_id", currentCompanyId).order("fueled_at", { ascending: false }),
    ]);
    const map: Record<string, any> = {};
    (v ?? []).forEach((x: any) => { map[x.id] = { plate: x.plate, current_km: x.current_km }; });
    setVehicles(map);
    setRecords(((r ?? []) as MRec[]).filter((x) => map[x.vehicle_id]));
    const sList = ((s ?? []) as Sched[]).filter((x) => map[x.vehicle_id]);
    setSchedules(sList);
    // Reconcile: close open preventive schedules when a completed preventive record fulfills them
    try {
      const prevRecs = ((r ?? []) as MRec[]).filter((x) => x.type === "preventiva" && x.status === "concluida");
      const toClose: string[] = [];
      sList.filter((sc) => sc.type === "preventiva").forEach((sc) => {
        const match = prevRecs.find((rec) => {
          if (rec.vehicle_id !== sc.vehicle_id) return false;
          if (sc.target_km != null && rec.km_at_service != null && rec.km_at_service >= sc.target_km) return true;
          if (sc.target_date && rec.service_at && new Date(rec.service_at) >= new Date(sc.target_date)) return true;
          return false;
        });
        if (match) toClose.push(sc.id);
      });
      if (toClose.length) {
        await supabase.from("maintenance_schedules").update({ status: "concluida" } as any).in("id", toClose);
      }
    } catch {/* noop */}
    const fuelMap: Record<string, { km: number; at: string }> = {};
    (f ?? []).forEach((row: any) => {
      if (!fuelMap[row.vehicle_id]) fuelMap[row.vehicle_id] = { km: row.km_at_fueling, at: row.fueled_at };
    });
    setLastFuelKm(fuelMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentCompanyId]);

  const remove = async (id: string) => {
    if (!confirm("Excluir este registro?")) return;
    const { error } = await supabase.from("maintenance_records").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    load();
  };

  // Compute schedule status dynamically
  const enrichedSchedules = useMemo(() => {
    const today = new Date();
    return schedules.map((s) => {
      const veh = vehicles[s.vehicle_id];
      let status: string = s.status;
      let progress = "";
      const remainingKm = s.target_km != null && veh ? s.target_km - veh.current_km : null;
      const remainingDays = s.target_date ? Math.floor((new Date(s.target_date).getTime() - today.getTime()) / 86400000) : null;
      if ((remainingKm !== null && remainingKm < 0) || (remainingDays !== null && remainingDays < 0)) status = "vencida";
      else if ((remainingKm !== null && remainingKm <= 1000) || (remainingDays !== null && remainingDays <= 15)) status = "proxima";
      if (remainingKm !== null) progress = `${remainingKm.toLocaleString("pt-BR")} km`;
      else if (remainingDays !== null) progress = `${remainingDays} dia(s)`;
      return { ...s, status, progress };
    });
  }, [schedules, vehicles]);

  const overdue = enrichedSchedules.filter((s) => s.status === "vencida").length;
  const upcoming = enrichedSchedules.filter((s) => s.status === "proxima").length;
  const totalSpent = records.reduce((a, r) => a + Number(r.total_value || 0), 0);
  const last30 = records.filter((r) => new Date(r.service_at).getTime() > Date.now() - 30 * 86400000)
    .reduce((a, r) => a + Number(r.total_value || 0), 0);

  const filtered = records.filter((r) => {
    const v = vehicles[r.vehicle_id]?.plate ?? "";
    return [v, r.workshop_name ?? "", r.category ?? "", r.description ?? ""].join(" ").toLowerCase().includes(q.toLowerCase());
  });

  // Cost by vehicle
  const byVehicle = useMemo(() => {
    const m: Record<string, number> = {};
    records.forEach((r) => { m[r.vehicle_id] = (m[r.vehicle_id] ?? 0) + Number(r.total_value || 0); });
    return Object.entries(m)
      .map(([id, total]) => ({ id, plate: vehicles[id]?.plate ?? "—", total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [records, vehicles]);

  // Preventive maintenance forecast per vehicle
  const calendar = useMemo(() => {
    return Object.entries(vehicles).map(([id, v]) => {
      // last preventive service for this vehicle
      const lastPrev = records
        .filter((r) => r.vehicle_id === id && r.type === "preventiva" && r.km_at_service != null)
        .sort((a, b) => new Date(b.service_at).getTime() - new Date(a.service_at).getTime())[0];
      const fuel = lastFuelKm[id];
      const currentKm = Math.max(v.current_km ?? 0, fuel?.km ?? 0);
      // Se nunca houve preventiva, usa o KM cadastrado no veículo como base inicial.
      const baseKm = lastPrev?.km_at_service ?? (v.current_km ?? 0);
      const nextKm = baseKm + intervalKm;
      const remaining = nextKm - currentKm;
      let tone = "bg-success/20 text-success border-success/30";
      let label = "Em dia";
      if (remaining < 0) { tone = "bg-destructive/20 text-destructive border-destructive/30"; label = "Vencida"; }
      else if (remaining <= ALERT_THRESHOLD_KM) { tone = "bg-warning/20 text-warning border-warning/30"; label = "Fazer agora"; }
      return {
        id, plate: v.plate, currentKm, fuelKm: fuel?.km ?? null, fuelAt: fuel?.at ?? null,
        lastPrevKm: lastPrev?.km_at_service ?? null,
        lastPrevAt: lastPrev?.service_at ?? null,
        baseKm,
        nextKm, remaining, tone, label,
      };
    }).sort((a, b) => a.remaining - b.remaining);
  }, [vehicles, records, lastFuelKm, intervalKm]);

  const filteredCalendar = useMemo(
    () => calendar.filter((c) => c.plate.toLowerCase().includes(calQ.toLowerCase())),
    [calendar, calQ],
  );
  // Vehicles with an open preventive schedule already
  const hasOpenPreventive = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach((s) => { if (s.type === "preventiva" && s.status !== "concluida") set.add(s.vehicle_id); });
    return set;
  }, [schedules]);
  const toDoNow = filteredCalendar.filter((c) => (c.label === "Fazer agora" || c.label === "Vencida") && !hasOpenPreventive.has(c.id));

  // Urgent pendencies for the Agenda tab (unscheduled near/over due preventives)
  const urgentPendencies = useMemo(() => {
    return calendar
      .filter((c) => (c.label === "Fazer agora" || c.label === "Vencida") && !hasOpenPreventive.has(c.id))
      .map((c) => ({
        vehicle_id: c.id,
        plate: c.plate,
        nextKm: c.nextKm,
        remaining: c.remaining,
        overdue: c.remaining < 0,
      }))
      .sort((a, b) => a.remaining - b.remaining);
  }, [calendar, hasOpenPreventive]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Manutenção</h1>
          <p className="text-muted-foreground">{records.length} registro(s) · {enrichedSchedules.length} agendamento(s)</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
          <Plus className="h-4 w-4 mr-2" /> Nova manutenção
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Gasto total" value={fmtBRL(totalSpent)} icon={DollarSign} tone="primary" />
        <KpiCard label="Últimos 30 dias" value={fmtBRL(last30)} icon={Activity} tone="success" />
        <KpiCard label="Validar urgente" value={String(urgentPendencies.length)} icon={BellRing} tone="warning" hint="sem agendamento aberto" />
        <KpiCard label="Vencidas" value={String(calendar.filter((c)=>c.label==="Vencida" && !hasOpenPreventive.has(c.id)).length)} icon={AlertTriangle} tone="destructive" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {canViewTab("agenda") && <TabsTrigger value="agenda">Agenda</TabsTrigger>}
          {canViewTab("records") && <TabsTrigger value="records">Histórico</TabsTrigger>}
          {canViewTab("schedules") && <TabsTrigger value="schedules">Agendamentos {overdue + upcoming > 0 && <Badge className="ml-2 bg-warning/30 text-warning">{overdue + upcoming}</Badge>}</TabsTrigger>}
          {canViewTab("calendar") && <TabsTrigger value="calendar">Calendário Preventivo</TabsTrigger>}
          {canViewTab("costs") && <TabsTrigger value="costs">Custos por veículo</TabsTrigger>}
        </TabsList>

        <TabsContent value="agenda" className="mt-4">
          <AgendaSection
            urgentPendencies={urgentPendencies}
            onSchedule={(p) => setScheduleDlg({ open: true, vehicleId: p.vehicle_id, plate: p.plate, targetKm: p.nextKm })}
            onQuickRegister={(p) => { setEditing(null); setQuickMaintFromUrgent(p.vehicle_id); setOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="records" className="space-y-4 mt-4">
          <div className="surface-card rounded-xl p-4">
            <div className="relative max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por placa, oficina, categoria..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-12">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="surface-card rounded-xl p-12 text-center">
              <Wrench className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-display font-semibold">Nenhuma manutenção</h3>
              <p className="text-sm text-muted-foreground mt-1">Registre a primeira manutenção da frota.</p>
            </div>
          ) : (
            <div className="surface-card rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Oficina</TableHead>
                    <TableHead className="text-right">KM</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{new Date(r.service_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="font-mono text-primary">{vehicles[r.vehicle_id]?.plate ?? "—"}</TableCell>
                      <TableCell><Badge className={`capitalize border ${TYPE_TONE[r.type] ?? ""}`}>{r.type}</Badge></TableCell>
                      <TableCell className="text-sm">{r.category ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.workshop_name ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{r.km_at_service?.toLocaleString("pt-BR") ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{fmtBRL(Number(r.total_value || 0))}</TableCell>
                      <TableCell><Badge className={`capitalize border ${STATUS_TONE[r.status] ?? ""}`}>{r.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {r.type === "preventiva" && (
                            <Button size="icon" variant="ghost" title="Checklist preventivo"
                              onClick={() => { setChecklistRecord({ id: r.id, plate: vehicles[r.vehicle_id]?.plate }); setChecklistOpen(true); }}>
                              <ListChecks className="h-3.5 w-3.5 text-primary" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(r.id)} className="text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="schedules" className="mt-4">
          {enrichedSchedules.length === 0 ? (
            <div className="surface-card rounded-xl p-12 text-center">
              <CalendarClock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-display font-semibold">Nenhum agendamento</h3>
              <p className="text-sm text-muted-foreground mt-1">Ao registrar uma manutenção, defina a próxima troca por KM ou data para criar um alerta automático.</p>
            </div>
          ) : (
            <div className="surface-card rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Alvo KM</TableHead>
                    <TableHead>Alvo data</TableHead>
                    <TableHead>Restante</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrichedSchedules.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-primary">{vehicles[s.vehicle_id]?.plate ?? "—"}</TableCell>
                      <TableCell><Badge className={`capitalize border ${TYPE_TONE[s.type] ?? ""}`}>{s.type}</Badge></TableCell>
                      <TableCell className="text-sm">{s.category}</TableCell>
                      <TableCell className="font-mono text-xs">{s.target_km?.toLocaleString("pt-BR") ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{s.target_date ? new Date(s.target_date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{(s as any).progress ?? "—"}</TableCell>
                      <TableCell><Badge className={`capitalize border ${SCHEDULE_STATUS_TONE[s.status] ?? ""}`}>{s.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="costs" className="mt-4">
          {byVehicle.length === 0 ? (
            <div className="surface-card rounded-xl p-12 text-center text-muted-foreground">Sem dados</div>
          ) : (
            <div className="surface-card rounded-xl p-6 space-y-3">
              <h3 className="font-display font-semibold">Top 5 veículos com maior custo</h3>
              {byVehicle.map((v, i) => {
                const max = byVehicle[0].total;
                const pct = max > 0 ? (v.total / max) * 100 : 0;
                return (
                  <div key={v.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-mono text-primary">#{i + 1} · {v.plate}</span>
                      <span className="font-mono font-semibold">{fmtBRL(v.total)}</span>
                    </div>
                    <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4 space-y-4">
          <div className="surface-card rounded-xl p-4 flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              <div>
                <Label className="text-xs">Intervalo padrão preventiva (KM)</Label>
                <Input
                  type="number"
                  min={1000}
                  step={500}
                  className="w-40 mt-1"
                  value={intervalKm}
                  onChange={(e) => saveInterval(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Buscar veículo</Label>
              <div className="relative mt-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Placa..." value={calQ} onChange={(e) => setCalQ(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground max-w-md">
              KM base: última preventiva registrada OU o KM cadastrado no veículo. Cruzamos com o último abastecimento e alertamos a {ALERT_THRESHOLD_KM.toLocaleString("pt-BR")} km da próxima.
            </p>
          </div>

          {toDoNow.length > 0 && (
            <div className="surface-card rounded-xl p-4 border border-warning/30 bg-warning/5">
              <h3 className="font-display font-semibold text-sm flex items-center gap-2 text-warning">
                <BellRing className="h-4 w-4" /> Fazer preventivo agora ({toDoNow.length})
              </h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {toDoNow.map((c) => (
                  <div key={c.id} className="surface-card rounded-lg p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-primary font-semibold">{c.plate}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.remaining < 0
                          ? `${Math.abs(c.remaining).toLocaleString("pt-BR")} km vencidos`
                          : `Faltam ${c.remaining.toLocaleString("pt-BR")} km`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`border ${c.tone}`}>{c.label}</Badge>
                      <Button size="sm" variant="outline" onClick={() => setScheduleDlg({ open: true, vehicleId: c.id, plate: c.plate, targetKm: c.nextKm })}>
                        <CalendarClock className="h-3 w-3 mr-1" /> Agendar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredCalendar.length === 0 ? (
            <div className="surface-card rounded-xl p-12 text-center">
              <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-display font-semibold">Nenhum veículo encontrado</h3>
            </div>
          ) : (
            <div className="surface-card rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Veículo</TableHead>
                    <TableHead className="text-right">KM atual</TableHead>
                    <TableHead className="text-right">Último abast. (KM)</TableHead>
                    <TableHead className="text-right">Base (última prev. ou cadastro)</TableHead>
                    <TableHead className="text-right">Próxima em (KM)</TableHead>
                    <TableHead className="text-right">Restante</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCalendar.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-primary">{c.plate}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{c.currentKm.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {c.fuelKm != null ? (
                          <>
                            {c.fuelKm.toLocaleString("pt-BR")}
                            <div className="text-[10px] text-muted-foreground">{c.fuelAt ? new Date(c.fuelAt).toLocaleDateString("pt-BR") : ""}</div>
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {c.lastPrevKm != null ? (
                          <>
                            {c.lastPrevKm.toLocaleString("pt-BR")}
                            <div className="text-[10px] text-muted-foreground">{c.lastPrevAt ? new Date(c.lastPrevAt).toLocaleDateString("pt-BR") : ""}</div>
                          </>
                        ) : (
                          <>
                            {c.baseKm.toLocaleString("pt-BR")}
                            <div className="text-[10px] text-muted-foreground">do cadastro</div>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{c.nextKm.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {c.remaining.toLocaleString("pt-BR")} km
                      </TableCell>
                      <TableCell>
                        <Badge className={`border ${c.tone}`}>{c.label}</Badge>
                        {hasOpenPreventive.has(c.id) && (
                          <div className="text-[10px] text-success mt-1">Agendado</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setScheduleDlg({ open: true, vehicleId: c.id, plate: c.plate, targetKm: c.nextKm })}>
                          <CalendarClock className="h-3 w-3 mr-1" /> Agendar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <MaintenanceDialog
        open={open}
        onOpenChange={(b) => { setOpen(b); if (!b) setQuickMaintFromUrgent(null); }}
        record={editing ?? (quickMaintFromUrgent ? { vehicle_id: quickMaintFromUrgent, type: "preventiva" } as any : null)}
        onSaved={load}
      />
      <SchedulePreventiveDialog
        open={scheduleDlg.open}
        onOpenChange={(b) => setScheduleDlg((s) => ({ ...s, open: b }))}
        vehicleId={scheduleDlg.vehicleId}
        vehiclePlate={scheduleDlg.plate}
        targetKm={scheduleDlg.targetKm ?? null}
        onSaved={load}
      />
      <ChecklistDialog
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        maintenanceRecordId={checklistRecord?.id ?? null}
        vehiclePlate={checklistRecord?.plate}
      />
    </div>
  );
}