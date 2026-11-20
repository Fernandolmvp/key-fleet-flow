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
  PackageCheck, RefreshCw, Activity, Layers, Ban, MoreVertical, Wrench,
} from "lucide-react";
import { toast } from "sonner";
import KpiCard from "@/components/dashboard/KpiCard";
import TireDialog from "@/components/dashboard/TireDialog";
import TireMovementDialog from "@/components/dashboard/TireMovementDialog";
import TireAxleMap from "@/components/dashboard/TireAxleMap";
import TreadMeasurementTab from "@/components/tires/TreadMeasurementTab";
import TireActionDialog, { TireAction, positionsForVehicle } from "@/components/tires/TireActionDialog";
import TireBatchDialog from "@/components/tires/TireBatchDialog";
import { KIND_LABEL } from "@/lib/tire-ops";
import { positionLabel } from "@/lib/tread-measurement";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AXLE_LAYOUTS, AxleLayout, STATUS_TONE, KIND_TONE, getLayoutPositions,
  treadHealth, fmtBRL,
} from "@/lib/tires";
import { tireAlerts, tireStatus as tireAlertLevel, tireCostPerKm } from "@/lib/tire-status";
import { useTabPermissions } from "@/lib/permissions";

export default function Tires() {
  const { currentCompanyId } = useAuth();
  const [tires, setTires] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [layouts, setLayouts] = useState<Record<string, { id?: string; layout: AxleLayout; positions: string[] }>>({});
  const [movements, setMovements] = useState<any[]>([]);
  const [costMovements, setCostMovements] = useState<{ tire_id: string; cost: number | null }[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTire, setMoveTire] = useState<any | null>(null);
  const [defaultMove, setDefaultMove] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [mapVehicleId, setMapVehicleId] = useState<string>("");
  const [tab, setTab] = useState<string>("stock");
  const [act, setAct] = useState<{ action: TireAction; tire?: any; vehicleId?: string; position?: string } | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [posMenu, setPosMenu] = useState<string | null>(null);
  const [mapPlate, setMapPlate] = useState("");
  const [fBrand, setFBrand] = useState("all");
  const [fSize, setFSize] = useState("all");
  const [fKind, setFKind] = useState("all");
  const [fStatus, setFStatus] = useState("estoque");
  const { canViewTab, isVisible, fallback } = useTabPermissions(
    "tires", ["stock", "list", "map", "tread", "movements", "alerts"], tab,
  );
  useEffect(() => {
    if (!isVisible && fallback) setTab(fallback);
  }, [isVisible, fallback]);

  const load = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    const [{ data: t }, { data: v }, { data: l }, { data: m }] = await Promise.all([
      supabase.from("tires").select("*").eq("company_id", currentCompanyId).order("created_at", { ascending: false }),
      supabase.from("vehicles").select("id,plate,brand,model,current_km,vehicle_type").eq("company_id", currentCompanyId).order("plate"),
      supabase.from("vehicle_axle_layouts").select("*").eq("company_id", currentCompanyId),
      supabase.from("tire_movements").select("*").eq("company_id", currentCompanyId).order("occurred_at", { ascending: false }).limit(200),
    ]);
    // Separate, paginated history: the 200-row display is NOT the cost basis.
    const costs: { tire_id: string; cost: number | null }[] = [];
    let costsFailed = false;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from("tire_movements")
        .select("tire_id,cost").eq("company_id", currentCompanyId)
        .order("id").range(offset, offset + 999);
      if (error) { toast.error("Não foi possível carregar os custos dos pneus"); costsFailed = true; break; }
      costs.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    setCostMovements(costsFailed ? null : costs);
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
  const discarded = tires.filter((t) => t.status === "descartado").length;
  const brands = useMemo(() => [...new Set(tires.map((t) => t.brand).filter(Boolean))].sort(), [tires]);
  const sizes = useMemo(() => [...new Set(tires.map((t) => t.size).filter(Boolean))].sort(), [tires]);
  const stockList = tires.filter((t) =>
    (fStatus === "all" || t.status === fStatus) && (fBrand === "all" || t.brand === fBrand) &&
    (fSize === "all" || t.size === fSize) && (fKind === "all" || t.kind === fKind) &&
    [t.brand, t.model, t.size, t.dot, t.serial, t.supplier].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase()));
  const alerts = tires.filter((t) => tireAlertLevel(t).level !== "ok").length;

  const costByTire = useMemo(() => {
    const grouped: Record<string, { cost: number | null }[]> = {};
    costMovements?.forEach(m => { (grouped[m.tire_id] ||= []).push(m); });
    return Object.fromEntries(tires.map(t => [t.id,
      costMovements === null ? null : tireCostPerKm(t, grouped[t.id] ?? [])]));
  }, [tires, costMovements]);

  const filtered = tires.filter((t) =>
    [t.brand, t.model, t.size, t.dot, t.serial, t.supplier].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase())
  );

  // Map of installed tires per vehicle position
  const installedByVehicle = useMemo(() => {
    const m: Record<string, Record<string, any>> = {};
    tires.filter((t) => t.status === "instalado" && t.current_vehicle_id && t.current_position).forEach((t) => {
      (m[t.current_vehicle_id] ||= {})[t.current_position] = {
        ...t, tread: t.current_tread_mm,
      };
    });
    return m;
  }, [tires]);

  const currentMapLayout = mapVehicleId ? layouts[mapVehicleId] : null;
  const currentMapPositions = currentMapLayout
    ? getLayoutPositions(currentMapLayout.layout, currentMapLayout.positions)
    : positionsForVehicle(vehicles.find((v) => v.id === mapVehicleId), layouts);

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
        <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setBatchOpen(true)}><Layers className="h-4 w-4 mr-2" /> Cadastro em lote</Button>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
          <Plus className="h-4 w-4 mr-2" /> Novo pneu
        </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <KpiCard label="Em estoque" value={String(inStock)} icon={PackageCheck} tone="primary" />
        <KpiCard label="Instalados" value={String(installed)} icon={CircleDot} tone="success" />
        <KpiCard label="Em recapagem" value={String(inRecap)} icon={RefreshCw} tone="warning" />
        <KpiCard label="Descartados" value={String(discarded)} icon={Ban} tone="primary" />
        <KpiCard label="Alertas" value={String(alerts)} icon={AlertTriangle} tone="destructive" />
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Resumo de alertas">
        {["Sulco no limite", "Sulco próximo do limite", "Medição vencida"].map(reason => (
          <Badge key={reason} variant="outline" className={reason === "Sulco no limite" ? "text-destructive" : "text-warning"}>
            {reason}: {tires.filter(t => tireAlerts(t).some(a => a.reason === reason)).length}
          </Badge>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="max-w-full overflow-x-auto justify-start">
          {canViewTab("stock") && <TabsTrigger value="stock">Estoque</TabsTrigger>}
          {canViewTab("list") && <TabsTrigger value="list">Todos os pneus</TabsTrigger>}
          {canViewTab("map") && <TabsTrigger value="map">Mapa do veículo</TabsTrigger>}
          {canViewTab("tread") && <TabsTrigger value="tread">Medição de sulco</TabsTrigger>}
          {canViewTab("movements") && <TabsTrigger value="movements">Movimentações</TabsTrigger>}
          {canViewTab("alerts") && <TabsTrigger value="alerts">Alertas {alerts > 0 && <Badge className="ml-2 bg-destructive/30 text-destructive">{alerts}</Badge>}</TabsTrigger>}
        </TabsList>

        {/* STOCK */}
        <TabsContent value="stock" className="mt-4 space-y-4">
          <div className="surface-card rounded-xl p-4 grid gap-2 grid-cols-2 md:grid-cols-5">
            <div className="relative col-span-2 md:col-span-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={fStatus} onValueChange={setFStatus}><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos os status</SelectItem><SelectItem value="estoque">Em estoque</SelectItem><SelectItem value="instalado">Instalados</SelectItem><SelectItem value="recapagem">Em recapagem</SelectItem><SelectItem value="descartado">Descartados</SelectItem></SelectContent></Select>
            <Select value={fBrand} onValueChange={setFBrand}><SelectTrigger aria-label="Marca"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas as marcas</SelectItem>{brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
            <Select value={fSize} onValueChange={setFSize}><SelectTrigger aria-label="Medida"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas as medidas</SelectItem>{sizes.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
            <Select value={fKind} onValueChange={setFKind}><SelectTrigger aria-label="Tipo"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos os tipos</SelectItem>{Object.entries(KIND_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
          </div>
          {loading ? <div className="text-center text-muted-foreground py-12">Carregando...</div> : stockList.length === 0 ? (
            <div className="surface-card rounded-xl p-12 text-center">
              <PackageCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum pneu encontrado. Use "Cadastro em lote" ou envie a NF para a IA preencher.</p>
            </div>
          ) : (
            <div className="surface-card rounded-xl overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Marca / Modelo</TableHead><TableHead>Medida</TableHead><TableHead>DOT / Serial</TableHead><TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Sulco</TableHead><TableHead className="text-right">Preço</TableHead><TableHead>Fornecedor</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {stockList.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell><div className="font-medium">{t.brand}</div><div className="text-xs text-muted-foreground">{t.model ?? ""}</div></TableCell>
                      <TableCell className="font-mono text-xs">{t.size}</TableCell>
                      <TableCell className="font-mono text-xs">{t.dot ?? "—"}{t.serial && <div className="text-muted-foreground">{t.serial}</div>}</TableCell>
                      <TableCell><Badge className={`border ${KIND_TONE[t.kind] ?? ""}`}>{KIND_LABEL[t.kind] ?? t.kind}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-xs">{t.current_tread_mm != null ? `${t.current_tread_mm} mm` : "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{t.purchase_price != null ? fmtBRL(Number(t.purchase_price)) : "—"}</TableCell>
                      <TableCell className="text-xs">{t.supplier ?? "—"}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {t.status === "estoque" && <Button size="sm" onClick={() => setAct({ action: "instalacao", tire: t })}>Instalar</Button>}
                        {t.status === "instalado" && <TireQuickMenu t={t} onPick={(a) => setAct({ action: a, tire: t })} />}
                        {t.status === "recapagem" && <Button size="sm" variant="outline" onClick={() => setAct({ action: "instalacao", tire: t })}>Instalar</Button>}
                        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tread" className="mt-4">
          <TreadMeasurementTab tires={tires} vehicles={vehicles} layouts={layouts} onSaved={load} />
        </TabsContent>

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
                    <TableHead className="text-right">R$/km</TableHead>
                    <TableHead>Alertas</TableHead>
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
                        <TableCell className="text-right font-mono text-xs">{costByTire[t.id] == null ? "—" : costByTire[t.id].toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 })}</TableCell>
                        <TableCell><div className="flex flex-wrap gap-1">{tireAlerts(t).map(a => <Badge key={a.code} variant="outline" className={a.level === "critico" ? "text-destructive" : "text-warning"}>{a.reason}</Badge>)}</div></TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => openMove(t, "inspecao")} title="Registrar medição" aria-label="Registrar medição"><Activity className="h-3.5 w-3.5" /></Button>
                            {t.status === "instalado" && <TireQuickMenu t={t} onPick={(a) => setAct({ action: a, tire: t })} />}
                            {t.status === "estoque" && <Button size="sm" variant="outline" onClick={() => setAct({ action: "instalacao", tire: t })}>Instalar</Button>}
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
              <Label htmlFor="map-plate">Placa</Label>
              <Input id="map-plate" list="map-plates" placeholder="Digite a placa" value={mapPlate || (vehiclesById[mapVehicleId]?.plate ?? "")}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase(); setMapPlate(val);
                  const norm = (x: string) => x.replace(/[^A-Z0-9]/gi, "").toUpperCase();
                  const v = vehicles.find((x) => norm(x.plate) === norm(val));
                  if (v) { setMapVehicleId(v.id); setMapPlate(""); }
                }} />
              <datalist id="map-plates">{vehicles.map((v) => <option key={v.id} value={v.plate}>{v.brand} {v.model}</option>)}</datalist>
              {mapPlate && <p className="text-xs text-muted-foreground mt-1">Continue digitando até a placa completa.</p>}
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
              onSelect={(pos) => setPosMenu(pos)}
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

      <TireBatchDialog open={batchOpen} onOpenChange={setBatchOpen} onSaved={load} />
      {act && (
        <TireActionDialog open={!!act} onOpenChange={(b) => !b && setAct(null)} action={act.action} tire={act.tire}
          vehicleId={act.vehicleId} position={act.position} tires={tires} vehicles={vehicles} layouts={layouts} onSaved={load} />
      )}
      <Dialog open={!!posMenu} onOpenChange={(b) => !b && setPosMenu(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{posMenu ? `${positionLabel(posMenu)} (${posMenu})` : ""}</DialogTitle></DialogHeader>
          {posMenu && (() => {
            const t = (installedByVehicle[mapVehicleId] ?? {})[posMenu];
            const pick = (a: TireAction) => { const full = t ? tiresById[t.id] : undefined; setPosMenu(null); setAct({ action: a, tire: full, vehicleId: mapVehicleId, position: a === "instalacao" ? posMenu : undefined }); };
            if (!t) return (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Posição vazia.</p>
                <Button className="w-full" onClick={() => pick("instalacao")}>Instalar do estoque</Button>
              </div>
            );
            return (
              <div className="space-y-2">
                <p className="text-sm">{t.brand} · <span className="font-mono">{t.size}</span> {t.serial ? `· ${t.serial}` : ""} · Sulco {t.tread ?? "—"} mm</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => pick("rodizio")}><ArrowRightLeft className="h-4 w-4 mr-1" />Rodízio</Button>
                  <Button variant="outline" onClick={() => pick("remocao")}><PackageCheck className="h-4 w-4 mr-1" />Remover</Button>
                  <Button variant="outline" onClick={() => pick("recapagem")}><RefreshCw className="h-4 w-4 mr-1" />Recapagem</Button>
                  <Button variant="outline" className="text-destructive" onClick={() => pick("descarte")}><Ban className="h-4 w-4 mr-1" />Descartar</Button>
                  <Button variant="ghost" className="col-span-2" onClick={() => { setPosMenu(null); openMove(tiresById[t.id], "inspecao"); }}><Activity className="h-4 w-4 mr-1" />Registrar medição</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
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
function TireQuickMenu({ t, onPick }: { t: any; onPick: (a: TireAction) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" aria-label={`Ações do pneu ${t.serial ?? t.brand}`}><Wrench className="h-3.5 w-3.5 mr-1" />Ações<MoreVertical className="h-3.5 w-3.5 ml-1" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onPick("rodizio")}>Rodízio</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick("remocao")}>Remover para estoque</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick("recapagem")}>Enviar para recapagem</DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onClick={() => onPick("descarte")}>Descartar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
