import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, CircleDot, Pencil, Trash2, ArrowRightLeft, AlertTriangle, Map,
  PackageCheck, RefreshCw, Activity,
} from "lucide-react";
import { toast } from "sonner";
import KpiCard from "@/components/dashboard/KpiCard";
import TireDialog from "@/components/dashboard/TireDialog";
import TireMovementDialog from "@/components/dashboard/TireMovementDialog";
import TireAxleMap from "@/components/dashboard/TireAxleMap";
import {
  AXLE_LAYOUTS, AxleLayout, STATUS_TONE, KIND_TONE, getLayoutPositions,
  tireAlertLevel, treadHealth, fmtBRL,
} from "@/lib/tires";
import { useTabPermissions } from "@/lib/permissions";

export default function Tires() {
  const { currentCompanyId } = useAuth();
  const [tires, setTires] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [layouts, setLayouts] = useState<Record<string, { id?: string; layout: AxleLayout; positions: string[] }>>({});
  const [movements, setMovements] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTire, setMoveTire] = useState<any | null>(null);
  const [defaultMove, setDefaultMove] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [mapVehicleId, setMapVehicleId] = useState<string>("");
  const [tab, setTab] = useState<string>("list");
  const { canViewTab, isVisible, fallback } = useTabPermissions(
    "tires", ["list", "map", "movements", "alerts"], tab,
  );
  useEffect(() => {
    if (!isVisible && fallback) setTab(fallback);
  }, [isVisible, fallback]);

  const load = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    const [{ data: t }, { data: v }, { data: l }, { data: m }] = await Promise.all([
      supabase.from("tires").select("*").eq("company_id", currentCompanyId).order("created_at", { ascending: false }),
      supabase.from("vehicles").select("id,plate,brand,model,current_km").eq("company_id", currentCompanyId).order("plate"),
      supabase.from("vehicle_axle_layouts").select("*").eq("company_id", currentCompanyId),
      supabase.from("tire_movements").select("*").eq("company_id", currentCompanyId).order("occurred_at", { ascending: false }).limit(200),
    ]);
    setTires(t ?? []);
    setVehicles(v ?? []);
    const map: Record<string, any> = {};
    (l ?? []).forEach((row: any) => { map[row.vehicle_id] = { id: row.id, layout: row.layout, positions: row.positions ?? [] }; });
    setLayouts(map);
    setMovements(m ?? []);
    setLoading(false);
    if (!mapVehicleId && v?.length) setMapVehicleId(v[0].id);
  };

  useEffect(() => { load(); }, [currentCompanyId]);

  const remove = async (id: string) => {
    if (!confirm("Excluir este pneu? As movimentações serão mantidas no histórico.")) return;
    const { error } = await supabase.from("tires").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido"); load();
  };

  const openMove = (t: any, type?: string) => {
    setMoveTire(t); setDefaultMove(type); setMoveOpen(true);
  };

  const setLayoutFor = async (vehicleId: string, layout: AxleLayout, positions?: string[]) => {
    if (!currentCompanyId) return;
    const pos = positions ?? getLayoutPositions(layout);
    const existing = layouts[vehicleId];
    if (existing?.id) {
      const { error } = await supabase.from("vehicle_axle_layouts")
        .update({ layout, positions: pos }).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("vehicle_axle_layouts")
        .insert({ company_id: currentCompanyId, vehicle_id: vehicleId, layout, positions: pos });
      if (error) return toast.error(error.message);
    }
    toast.success("Layout salvo"); load();
  };

  // KPIs
  const inStock = tires.filter((t) => t.status === "estoque").length;
  const installed = tires.filter((t) => t.status === "instalado").length;
  const inRecap = tires.filter((t) => t.status === "recapagem").length;
  const alerts = tires.filter((t) => tireAlertLevel(t).level !== "ok").length;

  const filtered = tires.filter((t) =>
    [t.brand, t.model, t.size, t.dot, t.serial, t.supplier].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase())
  );

  // Map of installed tires per vehicle position
  const installedByVehicle = useMemo(() => {
    const m: Record<string, Record<string, any>> = {};
    tires.filter((t) => t.status === "instalado" && t.current_vehicle_id && t.current_position).forEach((t) => {
      (m[t.current_vehicle_id] ||= {})[t.current_position] = {
        id: t.id, brand: t.brand, size: t.size, tread: t.current_tread_mm,
      };
    });
    return m;
  }, [tires]);

  const currentMapLayout = mapVehicleId ? layouts[mapVehicleId] : null;
  const currentMapPositions = currentMapLayout
    ? getLayoutPositions(currentMapLayout.layout, currentMapLayout.positions) : [];

  const vehiclesById = useMemo(() => {
    const m: Record<string, any> = {};
    vehicles.forEach((v) => { m[v.id] = v; });
    return m;
  }, [vehicles]);
  const tiresById = useMemo(() => {
    const m: Record<string, any> = {};
    tires.forEach((t) => { m[t.id] = t; });
    return m;
  }, [tires]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Pneus</h1>
          <p className="text-muted-foreground">{tires.length} pneu(s) cadastrado(s)</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
          <Plus className="h-4 w-4 mr-2" /> Novo pneu
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Em estoque" value={String(inStock)} icon={PackageCheck} tone="primary" />
        <KpiCard label="Instalados" value={String(installed)} icon={CircleDot} tone="success" />
        <KpiCard label="Em recapagem" value={String(inRecap)} icon={RefreshCw} tone="warning" />
        <KpiCard label="Alertas" value={String(alerts)} icon={AlertTriangle} tone="destructive" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {canViewTab("list") && <TabsTrigger value="list">Pneus</TabsTrigger>}
          {canViewTab("map") && <TabsTrigger value="map">Mapa do veículo</TabsTrigger>}
          {canViewTab("movements") && <TabsTrigger value="movements">Movimentações</TabsTrigger>}
          {canViewTab("alerts") && <TabsTrigger value="alerts">Alertas {alerts > 0 && <Badge className="ml-2 bg-destructive/30 text-destructive">{alerts}</Badge>}</TabsTrigger>}
        </TabsList>

        {/* LIST */}
        <TabsContent value="list" className="mt-4 space-y-4">
          <div className="surface-card rounded-xl p-4">
            <div className="relative max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar marca, medida, DOT, fornecedor..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          {loading ? (
            <div className="text-center text-muted-foreground py-12">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="surface-card rounded-xl p-12 text-center">
              <CircleDot className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-display font-semibold">Nenhum pneu cadastrado</h3>
              <p className="text-sm text-muted-foreground mt-1">Cadastre o primeiro pneu ou envie a NF para a IA preencher.</p>
            </div>
          ) : (
            <div className="surface-card rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marca / Medida</TableHead>
                    <TableHead>DOT / Serial</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Veículo / Pos.</TableHead>
                    <TableHead className="text-right">Sulco</TableHead>
                    <TableHead className="text-right">KM rodado</TableHead>
                    <TableHead className="text-right">Vida</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => {
                    const veh = t.current_vehicle_id ? vehiclesById[t.current_vehicle_id] : null;
                    const health = treadHealth(t.initial_tread_mm, t.current_tread_mm, t.min_tread_mm);
                    const alert = tireAlertLevel(t);
                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          <div className="font-medium">{t.brand} {t.model ?? ""}</div>
                          <div className="text-xs text-muted-foreground font-mono">{t.size}</div>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {t.dot ?? "—"}{t.serial && <div className="text-muted-foreground">{t.serial}</div>}
                        </TableCell>
                        <TableCell><Badge className={`capitalize border ${KIND_TONE[t.kind] ?? ""}`}>{t.kind}{t.recap_count > 0 && ` ×${t.recap_count}`}</Badge></TableCell>
                        <TableCell><Badge className={`capitalize border ${STATUS_TONE[t.status] ?? ""}`}>{t.status}</Badge></TableCell>
                        <TableCell className="text-xs">
                          {veh ? <><span className="font-mono text-primary">{veh.plate}</span> · {t.current_position}</> : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{t.current_tread_mm != null ? `${t.current_tread_mm}mm` : "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {(t.km_accumulated ?? 0).toLocaleString("pt-BR")}
                          {t.km_target && <div className="text-[10px] text-muted-foreground">/ {t.km_target.toLocaleString("pt-BR")}</div>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="w-16 inline-block">
                            <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                              <div className={`h-full ${alert.level === "critico" ? "bg-destructive" : alert.level === "atencao" ? "bg-warning" : "bg-success"}`} style={{ width: `${health}%` }} />
                            </div>
                            <div className="text-[10px] font-mono mt-0.5">{health}%</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => openMove(t)} title="Movimentar">
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => remove(t.id)} className="text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* MAP */}
        <TabsContent value="map" className="mt-4 space-y-4">
          <div className="surface-card rounded-xl p-4 grid md:grid-cols-2 gap-4">
            <div>
              <Label>Veículo</Label>
              <Select value={mapVehicleId} onValueChange={setMapVehicleId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Layout de eixos</Label>
              <Select
                value={mapVehicleId ? (layouts[mapVehicleId]?.layout ?? "") : ""}
                onValueChange={(v) => mapVehicleId && setLayoutFor(mapVehicleId, v as AxleLayout)}
                disabled={!mapVehicleId}
              >
                <SelectTrigger><SelectValue placeholder="Definir layout" /></SelectTrigger>
                <SelectContent>
                  {AXLE_LAYOUTS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!mapVehicleId ? (
            <div className="surface-card rounded-xl p-12 text-center">
              <Map className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Selecione um veículo para ver o mapa de pneus.</p>
            </div>
          ) : (
            <TireAxleMap
              positions={currentMapPositions}
              installed={installedByVehicle[mapVehicleId] ?? {}}
              onSelect={(pos) => {
                const installedTire = (installedByVehicle[mapVehicleId] ?? {})[pos];
                if (installedTire) {
                  openMove(tiresById[installedTire.id], "remocao");
                } else {
                  // Choose a stock tire to install
                  const stock = tires.filter((t) => t.status === "estoque");
                  if (!stock.length) return toast.error("Nenhum pneu em estoque para instalar");
                  // Prompt simple: install the first in stock
                  const t = stock[0];
                  if (confirm(`Instalar pneu ${t.brand} ${t.size} na posição ${pos}?`)) {
                    setMoveTire(t);
                    setDefaultMove("instalacao");
                    // Pre-fill via state in dialog: vehicle + position
                    setMoveOpen(true);
                    // Position selection will happen in dialog (the user can confirm/change).
                    toast.info(`Selecione a posição ${pos} no diálogo`);
                  }
                }
              }}
            />
          )}
        </TabsContent>

        {/* MOVEMENTS */}
        <TabsContent value="movements" className="mt-4">
          {movements.length === 0 ? (
            <div className="surface-card rounded-xl p-12 text-center">
              <Activity className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
            </div>
          ) : (
            <div className="surface-card rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Pneu</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>De → Para</TableHead>
                    <TableHead className="text-right">KM veículo</TableHead>
                    <TableHead className="text-right">Sulco</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => {
                    const t = tiresById[m.tire_id];
                    const v = m.vehicle_id ? vehiclesById[m.vehicle_id] : null;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{new Date(m.occurred_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-xs">{t ? `${t.brand} ${t.size}` : "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{m.movement_type}</Badge></TableCell>
                        <TableCell className="font-mono text-primary text-xs">{v?.plate ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {(m.from_position ?? "—")} → {(m.to_position ?? "—")}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{m.vehicle_km?.toLocaleString("pt-BR") ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{m.tread_mm != null ? `${m.tread_mm}mm` : "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{m.cost != null ? fmtBRL(Number(m.cost)) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ALERTS */}
        <TabsContent value="alerts" className="mt-4">
          {(() => {
            const list = tires.map((t) => ({ t, a: tireAlertLevel(t) })).filter((x) => x.a.level !== "ok");
            if (!list.length) return (
              <div className="surface-card rounded-xl p-12 text-center">
                <AlertTriangle className="h-10 w-10 mx-auto text-success mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum alerta. Todos os pneus dentro dos limites.</p>
              </div>
            );
            return (
              <div className="surface-card rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pneu</TableHead>
                      <TableHead>Veículo / Pos.</TableHead>
                      <TableHead>Sulco</TableHead>
                      <TableHead>KM</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map(({ t, a }) => {
                      const veh = t.current_vehicle_id ? vehiclesById[t.current_vehicle_id] : null;
                      return (
                        <TableRow key={t.id}>
                          <TableCell><div className="font-medium">{t.brand} {t.size}</div><div className="text-xs text-muted-foreground font-mono">{t.dot ?? ""}</div></TableCell>
                          <TableCell className="text-xs">{veh ? <><span className="font-mono text-primary">{veh.plate}</span> · {t.current_position}</> : "Estoque"}</TableCell>
                          <TableCell className="font-mono text-xs">{t.current_tread_mm != null ? `${t.current_tread_mm}mm` : "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{(t.km_accumulated ?? 0).toLocaleString("pt-BR")} / {t.km_target?.toLocaleString("pt-BR") ?? "—"}</TableCell>
                          <TableCell><Badge className={a.level === "critico" ? "bg-destructive/20 text-destructive border-destructive/30 border" : "bg-warning/20 text-warning border-warning/30 border"}>{a.reason}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => openMove(t, "remocao")}>Remover</Button>
                            <Button size="sm" variant="ghost" onClick={() => openMove(t, "recapagem")}>Recapar</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>

      <TireDialog open={open} onOpenChange={setOpen} tire={editing} onSaved={load} />
      <TireMovementDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        tire={moveTire}
        vehicles={vehicles}
        layouts={layouts}
        defaultMovement={defaultMove}
        onSaved={load}
      />
    </div>
  );
}