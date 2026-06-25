import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, IdCard, Activity, Wrench, Fuel as FuelIcon, CircleDot, FileText,
  AlertOctagon, ClipboardCheck, BarChart3, Users, Download,
} from "lucide-react";

const fmtBRL = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (n: number, d = 0) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

type Vehicle = any;

export default function VehicleHistory() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [fuel, setFuel] = useState<any[]>([]);
  const [tires, setTires] = useState<any[]>([]);
  const [tireMoves, setTireMoves] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [fines, setFines] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [driversMap, setDriversMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: v } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle();
      setVehicle(v);
      const companyId = v?.company_id;
      if (!companyId) { setLoading(false); return; }

      const [m, f, t, tm, d, fn, ch, mv] = await Promise.all([
        supabase.from("maintenance_records").select("*").eq("vehicle_id", id).order("service_at", { ascending: false }),
        supabase.from("fuel_records").select("*").eq("vehicle_id", id).order("fueled_at", { ascending: false }),
        supabase.from("tires").select("*").eq("current_vehicle_id", id).order("current_position", { ascending: true }),
        supabase.from("tire_movements").select("*").eq("vehicle_id", id).order("occurred_at", { ascending: false }).limit(100),
        supabase.from("documents").select("*").eq("entity_type", "vehicle").eq("entity_id", id).order("expires_at", { ascending: true, nullsFirst: false }),
        supabase.from("traffic_fines").select("*").eq("vehicle_id", id).order("infraction_date", { ascending: false }),
        supabase.from("checklist_runs").select("*").eq("vehicle_id", id).order("created_at", { ascending: false }),
        supabase.from("vehicle_movements").select("*").eq("vehicle_id", id).order("occurred_at", { ascending: false }).limit(50),
      ]);
      setMaintenance(m.data ?? []);
      setFuel(f.data ?? []);
      setTires(t.data ?? []);
      setTireMoves(tm.data ?? []);
      setDocs(d.data ?? []);
      setFines(fn.data ?? []);
      setChecklists(ch.data ?? []);
      setMovements(mv.data ?? []);

      const driverIds = Array.from(new Set([
        ...(f.data ?? []).map((x: any) => x.driver_id),
        ...(m.data ?? []).map((x: any) => x.driver_id),
        ...(ch.data ?? []).map((x: any) => x.driver_id),
        ...(fn.data ?? []).map((x: any) => x.driver_id),
      ].filter(Boolean)));
      if (driverIds.length) {
        const { data: drs } = await supabase.from("drivers").select("id,full_name").in("id", driverIds as string[]);
        const map: Record<string, string> = {};
        (drs ?? []).forEach((x: any) => { map[x.id] = x.full_name; });
        setDriversMap(map);
      }
      setLoading(false);
    })();
  }, [id]);

  const kpis = useMemo(() => {
    const totalFuel = fuel.reduce((s, x) => s + Number(x.total_value || 0), 0);
    const totalLiters = fuel.reduce((s, x) => s + Number(x.liters || 0), 0);
    const totalMaint = maintenance.reduce((s, x) => s + Number(x.total_value || 0), 0);
    const totalFines = fines.reduce((s, x) => s + Number(x.amount || 0), 0);
    const kmList = fuel.map((x) => Number(x.km_at_fueling || 0)).filter((n) => n > 0);
    const kmMin = kmList.length ? Math.min(...kmList) : 0;
    const kmMax = kmList.length ? Math.max(...kmList) : Number(vehicle?.current_km || 0);
    const kmDriven = Math.max(0, kmMax - kmMin);
    const consumption = totalLiters > 0 && kmDriven > 0 ? kmDriven / totalLiters : 0;
    const totalCost = totalFuel + totalMaint + totalFines;
    const costPerKm = kmDriven > 0 ? totalCost / kmDriven : 0;
    const fipe = Number(vehicle?.fipe_value || 0);
    return { totalFuel, totalLiters, totalMaint, totalFines, kmDriven, consumption, totalCost, costPerKm, fipe };
  }, [fuel, maintenance, fines, vehicle]);

  const driverNames = useMemo(() => {
    const counts: Record<string, number> = {};
    [...fuel, ...maintenance, ...checklists, ...fines].forEach((x: any) => {
      if (x.driver_id) counts[x.driver_id] = (counts[x.driver_id] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([id, c]) => ({ id, name: driversMap[id] || "—", count: c }))
      .sort((a, b) => b.count - a.count);
  }, [fuel, maintenance, checklists, fines, driversMap]);

  const timeline = useMemo(() => {
    const items: { date: string; kind: string; label: string; meta?: string }[] = [];
    fuel.forEach((x) => items.push({ date: x.fueled_at, kind: "Abastecimento", label: `${fmtNum(Number(x.liters || 0), 1)} L • ${fmtBRL(Number(x.total_value || 0))}`, meta: x.station_name || "" }));
    maintenance.forEach((x) => items.push({ date: x.service_at, kind: "Manutenção", label: `${x.type} • ${fmtBRL(Number(x.total_value || 0))}`, meta: x.workshop_name || x.description || "" }));
    fines.forEach((x) => items.push({ date: x.infraction_date, kind: "Multa", label: `${x.fine_code || "—"} • ${fmtBRL(Number(x.amount || 0))}`, meta: x.location || "" }));
    checklists.forEach((x) => items.push({ date: x.created_at, kind: "Checklist", label: `${x.status} • ${x.conform_items}/${x.total_items} OK`, meta: "" }));
    movements.forEach((x) => items.push({ date: x.occurred_at || x.created_at, kind: "Movimentação", label: x.movement_type, meta: x.reason || x.notes || "" }));
    return items
      .filter((i) => !!i.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 100);
  }, [fuel, maintenance, fines, checklists, movements]);

  if (loading) {
    return <div className="p-8 text-muted-foreground">Carregando histórico…</div>;
  }
  if (!vehicle) {
    return <div className="p-8 text-muted-foreground">Veículo não encontrado.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap print:hidden">
        <div className="space-y-1">
          <Link to="/app/vehicles" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para veículos
          </Link>
          <h1 className="font-display text-3xl font-bold">
            Histórico de Vida: {vehicle.plate}
          </h1>
          <div className="text-sm text-muted-foreground">
            {vehicle.brand} {vehicle.model} {vehicle.year_model ? `• ${vehicle.year_model}` : ""} {vehicle.color ? `• ${vehicle.color}` : ""}
          </div>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Download className="h-4 w-4 mr-2" /> Exportar PDF
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="KM atual" value={fmtNum(Number(vehicle.current_km || 0))} />
        <Kpi label="KM rodado (hist.)" value={fmtNum(kpis.kmDriven)} />
        <Kpi label="Consumo médio" value={`${fmtNum(kpis.consumption, 2)} km/L`} />
        <Kpi label="Custo total" value={fmtBRL(kpis.totalCost)} />
        <Kpi label="Custo/km" value={fmtBRL(kpis.costPerKm)} />
        <Kpi label="FIPE" value={kpis.fipe ? fmtBRL(kpis.fipe) : "—"} sub={vehicle.fipe_reference_month || undefined} />
      </div>

      <Tabs defaultValue="timeline" className="print:hidden">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="identificacao"><IdCard className="h-4 w-4 mr-1" />Identificação</TabsTrigger>
          <TabsTrigger value="timeline"><Activity className="h-4 w-4 mr-1" />Timeline</TabsTrigger>
          <TabsTrigger value="manutencoes"><Wrench className="h-4 w-4 mr-1" />Manutenções ({maintenance.length})</TabsTrigger>
          <TabsTrigger value="combustivel"><FuelIcon className="h-4 w-4 mr-1" />Combustível ({fuel.length})</TabsTrigger>
          <TabsTrigger value="pneus"><CircleDot className="h-4 w-4 mr-1" />Pneus ({tires.length})</TabsTrigger>
          <TabsTrigger value="documentos"><FileText className="h-4 w-4 mr-1" />Documentos ({docs.length})</TabsTrigger>
          <TabsTrigger value="multas"><AlertOctagon className="h-4 w-4 mr-1" />Multas ({fines.length})</TabsTrigger>
          <TabsTrigger value="checklists"><ClipboardCheck className="h-4 w-4 mr-1" />Checklists ({checklists.length})</TabsTrigger>
          <TabsTrigger value="financeiro"><BarChart3 className="h-4 w-4 mr-1" />Financeiro</TabsTrigger>
          <TabsTrigger value="motoristas"><Users className="h-4 w-4 mr-1" />Motoristas ({driverNames.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="identificacao" className="surface-card rounded-xl p-5 mt-4">
          <Grid>
            <Field k="Placa" v={vehicle.plate} />
            <Field k="Marca/Modelo" v={`${vehicle.brand} ${vehicle.model}`} />
            <Field k="Ano modelo" v={vehicle.year_model} />
            <Field k="Ano fabricação" v={vehicle.year_manufacture} />
            <Field k="Cor" v={vehicle.color} />
            <Field k="Chassi" v={vehicle.chassis} />
            <Field k="RENAVAM" v={vehicle.renavam} />
            <Field k="Combustível" v={vehicle.fuel_type} />
            <Field k="Tipo" v={vehicle.vehicle_type} />
            <Field k="UF licenciamento" v={vehicle.licensing_uf} />
            <Field k="Ano licenciamento" v={vehicle.licensing_year} />
            <Field k="Tanque" v={vehicle.tank_capacity ? `${vehicle.tank_capacity} L` : "—"} />
            <Field k="Consumo esperado" v={vehicle.expected_consumption_kml ? `${vehicle.expected_consumption_kml} km/L` : "—"} />
            <Field k="Rastreador" v={vehicle.has_tracker ? "Sim" : "Não"} />
            <Field k="Status" v={vehicle.status} />
            <Field k="Responsável" v={vehicle.responsible} />
            <Field k="Proprietário" v={vehicle.owner_name} />
            <Field k="FIPE" v={vehicle.fipe_value ? fmtBRL(Number(vehicle.fipe_value)) : "—"} />
          </Grid>
        </TabsContent>

        <TabsContent value="timeline" className="surface-card rounded-xl p-5 mt-4">
          {timeline.length === 0 ? <Empty /> : (
            <div className="space-y-2">
              {timeline.map((t, i) => (
                <div key={i} className="flex items-start gap-3 border-l-2 border-primary/30 pl-3 py-1.5">
                  <div className="text-xs text-muted-foreground w-24 shrink-0">{fmtDate(t.date)}</div>
                  <Badge variant="outline" className="shrink-0">{t.kind}</Badge>
                  <div className="text-sm">
                    <div>{t.label}</div>
                    {t.meta && <div className="text-xs text-muted-foreground">{t.meta}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="manutencoes" className="surface-card rounded-xl p-5 mt-4">
          {maintenance.length === 0 ? <Empty /> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>KM</TableHead>
                <TableHead>Oficina</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {maintenance.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{fmtDate(m.service_at)}</TableCell>
                    <TableCell>{m.type}</TableCell>
                    <TableCell>{m.km_at_service ? fmtNum(m.km_at_service) : "—"}</TableCell>
                    <TableCell>{m.workshop_name || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{m.status}</Badge></TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(m.total_value || 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="combustivel" className="surface-card rounded-xl p-5 mt-4">
          {fuel.length === 0 ? <Empty /> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Posto</TableHead><TableHead>Motorista</TableHead>
                <TableHead>KM</TableHead><TableHead>Litros</TableHead><TableHead>R$/L</TableHead>
                <TableHead>km/L</TableHead><TableHead className="text-right">Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fuel.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{fmtDate(f.fueled_at)}</TableCell>
                    <TableCell>{f.station_name || "—"}</TableCell>
                    <TableCell>{f.driver_id ? (driversMap[f.driver_id] || "—") : "—"}</TableCell>
                    <TableCell>{fmtNum(Number(f.km_at_fueling || 0))}</TableCell>
                    <TableCell>{fmtNum(Number(f.liters || 0), 2)}</TableCell>
                    <TableCell>{fmtBRL(Number(f.price_per_liter || 0))}</TableCell>
                    <TableCell>{f.km_per_liter ? fmtNum(Number(f.km_per_liter), 2) : "—"}</TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(f.total_value || 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="pneus" className="surface-card rounded-xl p-5 mt-4">
          {tires.length === 0 ? <Empty /> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Posição</TableHead><TableHead>Marca/Modelo</TableHead><TableHead>Medida</TableHead>
                <TableHead>DOT</TableHead><TableHead>Sulco atual</TableHead><TableHead>KM acumulado</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {tires.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.current_position || "—"}</TableCell>
                    <TableCell>{t.brand} {t.model || ""}</TableCell>
                    <TableCell>{t.size}</TableCell>
                    <TableCell>{t.dot || "—"}</TableCell>
                    <TableCell>{t.current_tread_mm ? `${t.current_tread_mm} mm` : "—"}</TableCell>
                    <TableCell>{fmtNum(Number(t.km_accumulated || 0))}</TableCell>
                    <TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {tireMoves.length > 0 && (
            <div className="mt-6">
              <h3 className="font-display font-semibold mb-2">Movimentações de pneu</h3>
              <div className="text-sm space-y-1">
                {tireMoves.slice(0, 20).map((m) => (
                  <div key={m.id} className="flex gap-3 text-muted-foreground">
                    <span className="w-24">{fmtDate(m.occurred_at)}</span>
                    <span>{m.movement_type}</span>
                    <span>{m.from_position || "—"} → {m.to_position || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="documentos" className="surface-card rounded-xl p-5 mt-4">
          {docs.length === 0 ? <Empty /> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Tipo</TableHead><TableHead>Título</TableHead><TableHead>Emissão</TableHead>
                <TableHead>Vencimento</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.doc_type}</TableCell>
                    <TableCell>{d.title || d.document_number || "—"}</TableCell>
                    <TableCell>{fmtDate(d.issue_date)}</TableCell>
                    <TableCell>{fmtDate(d.expires_at)}</TableCell>
                    <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="multas" className="surface-card rounded-xl p-5 mt-4">
          {fines.length === 0 ? <Empty /> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Código</TableHead><TableHead>Local</TableHead>
                <TableHead>Motorista</TableHead><TableHead>Pontos</TableHead>
                <TableHead>Vencimento</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fines.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{fmtDate(f.infraction_date)}</TableCell>
                    <TableCell>{f.fine_code || "—"}</TableCell>
                    <TableCell>{f.location || "—"}</TableCell>
                    <TableCell>{f.driver_id ? (driversMap[f.driver_id] || "—") : "—"}</TableCell>
                    <TableCell>{f.license_points}</TableCell>
                    <TableCell>{fmtDate(f.due_date)}</TableCell>
                    <TableCell><Badge variant="outline">{f.status}</Badge></TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(f.amount || 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="checklists" className="surface-card rounded-xl p-5 mt-4">
          {checklists.length === 0 ? <Empty /> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Motorista</TableHead><TableHead>KM</TableHead>
                <TableHead>Conformidade</TableHead><TableHead>Score</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {checklists.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{fmtDate(c.completed_at || c.created_at)}</TableCell>
                    <TableCell>{c.driver_id ? (driversMap[c.driver_id] || "—") : "—"}</TableCell>
                    <TableCell>{c.km_at_check ? fmtNum(c.km_at_check) : "—"}</TableCell>
                    <TableCell>{c.conform_items}/{c.total_items} • {c.non_conform_items} NC</TableCell>
                    <TableCell>{c.score ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="financeiro" className="surface-card rounded-xl p-5 mt-4">
          <Grid>
            <Field k="Combustível (total)" v={fmtBRL(kpis.totalFuel)} />
            <Field k="Litros consumidos" v={`${fmtNum(kpis.totalLiters, 2)} L`} />
            <Field k="Manutenções (total)" v={fmtBRL(kpis.totalMaint)} />
            <Field k="Multas (total)" v={fmtBRL(kpis.totalFines)} />
            <Field k="Custo total acumulado" v={fmtBRL(kpis.totalCost)} />
            <Field k="KM rodado no histórico" v={fmtNum(kpis.kmDriven)} />
            <Field k="Custo por km" v={fmtBRL(kpis.costPerKm)} />
            <Field k="Consumo médio" v={`${fmtNum(kpis.consumption, 2)} km/L`} />
            <Field k="Valor FIPE atual" v={kpis.fipe ? fmtBRL(kpis.fipe) : "—"} />
            <Field
              k="Depreciação vs custo"
              v={kpis.fipe ? `${fmtNum((kpis.totalCost / kpis.fipe) * 100, 1)}% do valor FIPE` : "—"}
            />
          </Grid>
        </TabsContent>

        <TabsContent value="motoristas" className="surface-card rounded-xl p-5 mt-4">
          {driverNames.length === 0 ? <Empty /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Motorista</TableHead><TableHead className="text-right">Eventos</TableHead></TableRow></TableHeader>
              <TableBody>
                {driverNames.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.name}</TableCell>
                    <TableCell className="text-right">{d.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="surface-card rounded-xl p-4">
      <div className="text-[10px] uppercase font-mono text-muted-foreground">{label}</div>
      <div className="font-display font-semibold text-lg mt-1">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">{children}</div>;
}

function Field({ k, v }: { k: string; v: any }) {
  return (
    <div className="text-sm">
      <div className="text-[10px] uppercase font-mono text-muted-foreground">{k}</div>
      <div>{v ?? "—"}</div>
    </div>
  );
}

function Empty() {
  return <div className="text-sm text-muted-foreground py-6 text-center">Sem registros para este veículo.</div>;
}