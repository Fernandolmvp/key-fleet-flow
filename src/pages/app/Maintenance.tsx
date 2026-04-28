import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Wrench, Pencil, Trash2, AlertTriangle, CalendarClock, DollarSign, Activity, CalendarDays, Settings2 } from "lucide-react";
import { toast } from "sonner";
import KpiCard from "@/components/dashboard/KpiCard";
import MaintenanceDialog from "@/components/dashboard/MaintenanceDialog";
import { STATUS_TONE, TYPE_TONE, SCHEDULE_STATUS_TONE, fmtBRL } from "@/lib/maintenance";
import { Label } from "@/components/ui/label";

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
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MRec | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalKey = `maint_interval_km:${currentCompanyId ?? "_"}`;
  const [intervalKm, setIntervalKm] = useState<number>(10000);

  useEffect(() => {
    if (!currentCompanyId) return;
    const saved = localStorage.getItem(intervalKey);
    setIntervalKm(saved ? Number(saved) || 10000 : 10000);
  }, [currentCompanyId]);

  const saveInterval = (n: number) => {
    setIntervalKm(n);
    localStorage.setItem(intervalKey, String(n));
  };

  const load = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    const [{ data: r }, { data: s }, { data: v }, { data: f }] = await Promise.all([
      supabase.from("maintenance_records").select("*").eq("company_id", currentCompanyId).order("service_at", { ascending: false }),
      supabase.from("maintenance_schedules").select("*").eq("company_id", currentCompanyId).neq("status", "concluida"),
      supabase.from("vehicles").select("id,plate,current_km").eq("company_id", currentCompanyId),
      supabase.from("fuel_records").select("vehicle_id,km_at_fueling,fueled_at").eq("company_id", currentCompanyId).order("fueled_at", { ascending: false }),
    ]);
    setRecords((r ?? []) as MRec[]);
    setSchedules((s ?? []) as Sched[]);
    const map: Record<string, any> = {};
    (v ?? []).forEach((x: any) => { map[x.id] = { plate: x.plate, current_km: x.current_km }; });
    setVehicles(map);
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
      const baseKm = lastPrev?.km_at_service ?? 0;
      const nextKm = baseKm + intervalKm;
      const remaining = nextKm - currentKm;
      let tone = "bg-success/20 text-success border-success/30";
      let label = "Em dia";
      if (remaining < 0) { tone = "bg-destructive/20 text-destructive border-destructive/30"; label = "Vencida"; }
      else if (remaining <= 1000) { tone = "bg-warning/20 text-warning border-warning/30"; label = "Próxima"; }
      return {
        id, plate: v.plate, currentKm, fuelKm: fuel?.km ?? null, fuelAt: fuel?.at ?? null,
        lastPrevKm: lastPrev?.km_at_service ?? null,
        lastPrevAt: lastPrev?.service_at ?? null,
        nextKm, remaining, tone, label,
      };
    }).sort((a, b) => a.remaining - b.remaining);
  }, [vehicles, records, lastFuelKm, intervalKm]);

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
        <KpiCard label="Próximas" value={String(upcoming)} icon={CalendarClock} tone="warning" />
        <KpiCard label="Vencidas" value={String(overdue)} icon={AlertTriangle} tone="destructive" />
      </div>

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">Histórico</TabsTrigger>
          <TabsTrigger value="schedules">Agendamentos {overdue + upcoming > 0 && <Badge className="ml-2 bg-warning/30 text-warning">{overdue + upcoming}</Badge>}</TabsTrigger>
          <TabsTrigger value="calendar">Calendário Preventivo</TabsTrigger>
          <TabsTrigger value="costs">Custos por veículo</TabsTrigger>
        </TabsList>

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
            <p className="text-xs text-muted-foreground max-w-md">
              O cálculo usa a última manutenção preventiva registrada + intervalo, comparando com o KM atual do veículo cruzado com o último abastecimento.
            </p>
          </div>

          {calendar.length === 0 ? (
            <div className="surface-card rounded-xl p-12 text-center">
              <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-display font-semibold">Nenhum veículo cadastrado</h3>
            </div>
          ) : (
            <div className="surface-card rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Veículo</TableHead>
                    <TableHead className="text-right">KM atual</TableHead>
                    <TableHead className="text-right">Último abast. (KM)</TableHead>
                    <TableHead className="text-right">Última preventiva</TableHead>
                    <TableHead className="text-right">Próxima em (KM)</TableHead>
                    <TableHead className="text-right">Restante</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calendar.map((c) => (
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
                        ) : <span className="text-muted-foreground">nunca</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{c.nextKm.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {c.remaining.toLocaleString("pt-BR")} km
                      </TableCell>
                      <TableCell><Badge className={`border ${c.tone}`}>{c.label}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <MaintenanceDialog open={open} onOpenChange={setOpen} record={editing} onSaved={load} />
    </div>
  );
}