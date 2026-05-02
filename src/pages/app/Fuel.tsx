import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Fuel as FuelIcon, Pencil, Trash2, AlertTriangle, TrendingDown, TrendingUp, DollarSign } from "lucide-react";
import { toast } from "sonner";
import FuelDialog from "@/components/dashboard/FuelDialog";
import KpiCard from "@/components/dashboard/KpiCard";
import { Badge } from "@/components/ui/badge";
import { ANOMALY_LABEL, SEVERITY_TONE, fmtMoney, fmtNum } from "@/lib/fuel";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, ShieldCheck, Clock, FileWarning } from "lucide-react";

interface Row {
  id: string; fueled_at: string; station_name: string | null; city: string | null;
  fuel_type: string; liters: number; price_per_liter: number; total_value: number;
  km_at_fueling: number; km_per_liter: number | null; cost_per_km: number | null;
  anomalies: string[]; anomaly_severity: string | null;
  vehicles: { plate: string; brand: string; model: string } | null;
  drivers: { full_name: string } | null;
}

export default function Fuel() {
  const { currentCompanyId, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [auths, setAuths] = useState<any[]>([]);
  const [authBusy, setAuthBusy] = useState<string | null>(null);

  const load = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("fuel_records")
      .select("*, vehicles:vehicle_id(plate,brand,model), drivers:driver_id(full_name)")
      .eq("company_id", currentCompanyId)
      .order("fueled_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentCompanyId]);

  const loadAuths = async () => {
    if (!currentCompanyId) return;
    const { data } = await supabase
      .from("fuel_authorizations")
      .select("*, vehicles:vehicle_id(plate,brand,model,current_km,fuel_type), drivers:driver_id(id,full_name), fuel_stations:fuel_station_id(id,name,cnpj,city,state)")
      .eq("company_id", currentCompanyId)
      .order("requested_at", { ascending: false })
      .limit(100);
    setAuths(data ?? []);
  };
  useEffect(() => { loadAuths(); }, [currentCompanyId]);

  const updateAuth = async (id: string, status: "aprovada" | "recusada" | "cancelada") => {
    setAuthBusy(id);
    const { error } = await supabase.from("fuel_authorizations").update({
      status, approved_by: user?.id ?? null,
    }).eq("id", id);
    setAuthBusy(null);
    if (error) return toast.error(error.message);
    toast.success(status === "aprovada" ? "Autorização aprovada com código gerado" : "Solicitação atualizada");
    loadAuths();
  };

  const pendingAuths = useMemo(() => auths.filter((a) => a.status === "pendente"), [auths]);

  const remove = async (id: string) => {
    if (!confirm("Excluir este abastecimento?")) return;
    const { error } = await supabase.from("fuel_records").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido"); load();
  };

  const filtered = useMemo(() => rows.filter((r) => {
    const t = q.toLowerCase();
    return [r.vehicles?.plate, r.vehicles?.model, r.drivers?.full_name, r.station_name, r.city]
      .filter(Boolean).join(" ").toLowerCase().includes(t);
  }), [rows, q]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthRows = rows.filter((r) => {
      const d = new Date(r.fueled_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalCost = monthRows.reduce((s, r) => s + Number(r.total_value), 0);
    const totalLiters = monthRows.reduce((s, r) => s + Number(r.liters), 0);
    // Consumo médio ponderado por litros, ignorando outliers/anomalias de KM
    const valid = rows.filter(
      (r) =>
        r.km_per_liter != null &&
        Number(r.km_per_liter) > 0 &&
        Number(r.km_per_liter) < 30 && // limite físico realista (km/L)
        !(r.anomalies?.includes("km_regressivo")),
    );
    const sumKm = valid.reduce((s, r) => s + Number(r.km_per_liter) * Number(r.liters), 0);
    const sumL = valid.reduce((s, r) => s + Number(r.liters), 0);
    const avgKml = sumL > 0 ? sumKm / sumL : 0;
    const anomalies = rows.filter((r) => (r.anomalies?.length ?? 0) > 0).length;
    return { totalCost, totalLiters, avgKml, anomalies, monthCount: monthRows.length, validCount: valid.length };
  }, [rows]);

  // gráfico: custo por mês (últimos 6)
  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const d = new Date(r.fueled_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + Number(r.total_value));
    });
    const arr = Array.from(map.entries()).sort().slice(-6).map(([k, v]) => ({
      mes: new Date(k + "-01").toLocaleDateString("pt-BR", { month: "short" }),
      custo: Math.round(v),
    }));
    return arr;
  }, [rows]);

  // gráfico: top 5 veículos por consumo
  const topVehicles = useMemo(() => {
    const map = new Map<string, { kml: number[]; plate: string }>();
    rows.forEach((r) => {
      if (r.km_per_liter && r.vehicles?.plate) {
        const cur = map.get(r.vehicles.plate) ?? { kml: [], plate: r.vehicles.plate };
        cur.kml.push(Number(r.km_per_liter)); map.set(r.vehicles.plate, cur);
      }
    });
    return Array.from(map.values())
      .map((x) => ({ placa: x.plate, kmL: +(x.kml.reduce((a, b) => a + b, 0) / x.kml.length).toFixed(1) }))
      .sort((a, b) => b.kmL - a.kmL).slice(0, 6);
  }, [rows]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Abastecimentos</h1>
          <p className="text-muted-foreground">Controle inteligente com detecção de anomalias</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
          <Plus className="h-4 w-4 mr-2" /> Novo abastecimento
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Custo do mês" value={fmtMoney(stats.totalCost)} icon={DollarSign} tone="primary" hint={`${stats.monthCount} abastecimentos`} />
        <KpiCard label="Litros do mês" value={fmtNum(stats.totalLiters, { maximumFractionDigits: 1 })} icon={FuelIcon} hint="L" />
        <KpiCard
          label="Consumo médio"
          value={stats.avgKml > 0 ? `${stats.avgKml.toFixed(1)} km/L` : "—"}
          icon={stats.avgKml >= 8 ? TrendingUp : TrendingDown}
          tone={stats.avgKml >= 8 ? "success" : "warning"}
          hint={stats.validCount > 0 ? `${stats.validCount} lançamento(s) válidos` : "Precisa de 2+ abastecimentos sequenciais"}
        />
        <KpiCard label="Anomalias detectadas" value={stats.anomalies} icon={AlertTriangle} tone={stats.anomalies > 0 ? "warning" : "success"} hint="lançamentos com alerta" />
      </div>

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">Histórico</TabsTrigger>
          <TabsTrigger value="auths">
            Autorizações
            {pendingAuths.length > 0 && <Badge className="ml-2 bg-warning/30 text-warning">{pendingAuths.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-6 mt-4">
      {monthly.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="surface-card rounded-xl p-6 lg:col-span-2">
            <h3 className="font-display font-semibold mb-4">Custo mensal — últimos 6 meses</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly}>
                  <defs><linearGradient id="gf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(190 100% 50%)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(190 100% 50%)" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 30% 18%)" />
                  <XAxis dataKey="mes" stroke="hsl(215 15% 65%)" fontSize={12} />
                  <YAxis stroke="hsl(215 15% 65%)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(215 38% 11%)", border: "1px solid hsl(215 30% 18%)", borderRadius: 8 }} formatter={(v: any) => fmtMoney(v)} />
                  <Area type="monotone" dataKey="custo" stroke="hsl(190 100% 50%)" strokeWidth={2} fill="url(#gf)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="surface-card rounded-xl p-6">
            <h3 className="font-display font-semibold mb-4">Eficiência (km/L)</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topVehicles} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 30% 18%)" />
                  <XAxis type="number" stroke="hsl(215 15% 65%)" fontSize={12} />
                  <YAxis type="category" dataKey="placa" stroke="hsl(215 15% 65%)" fontSize={11} width={70} />
                  <Tooltip contentStyle={{ background: "hsl(215 38% 11%)", border: "1px solid hsl(215 30% 18%)", borderRadius: 8 }} />
                  <Bar dataKey="kmL" fill="hsl(190 100% 50%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="surface-card rounded-xl p-4">
        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por placa, motorista, posto..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="surface-card rounded-xl p-12 text-center">
          <FuelIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display font-semibold">Nenhum abastecimento</h3>
          <p className="text-sm text-muted-foreground mt-1">Registre o primeiro abastecimento da frota.</p>
        </div>
      ) : (
        <div className="surface-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-left px-4 py-3">Veículo</th>
                  <th className="text-left px-4 py-3">Motorista</th>
                  <th className="text-left px-4 py-3">Posto</th>
                  <th className="text-right px-4 py-3">Litros</th>
                  <th className="text-right px-4 py-3">R$/L</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3">km/L</th>
                  <th className="text-left px-4 py-3">Alertas</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                      {new Date(r.fueled_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-primary">{r.vehicles?.plate}</div>
                      <div className="text-xs text-muted-foreground">{r.vehicles?.brand} {r.vehicles?.model}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.drivers?.full_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div>{r.station_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.city}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{fmtNum(r.liters, { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtMoney(r.price_per_liter)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{fmtMoney(r.total_value)}</td>
                    <td className="px-4 py-3 text-right font-mono">{r.km_per_liter ? `${r.km_per_liter}` : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.anomalies?.map((a) => (
                          <Badge key={a} className={`text-[10px] border ${SEVERITY_TONE[r.anomaly_severity ?? "baixa"]}`}>
                            {ANOMALY_LABEL[a] ?? a}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

        </TabsContent>

        <TabsContent value="auths" className="mt-4 space-y-3">
          {auths.length === 0 ? (
            <div className="surface-card rounded-xl p-12 text-center">
              <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-display font-semibold">Nenhuma solicitação</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Os motoristas usam a Área do Colaborador para solicitar autorização de abastecimento.
              </p>
            </div>
          ) : (
            auths.map((a: any) => (
              <div key={a.id} className="surface-card rounded-xl p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-primary font-semibold">{a.vehicles?.plate ?? "—"}</span>
                    <span className="text-xs text-muted-foreground">{a.vehicles?.brand} {a.vehicles?.model}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    {new Date(a.requested_at).toLocaleString("pt-BR")}
                    {a.estimated_liters && <span>· {a.estimated_liters} L</span>}
                    {a.estimated_value && <span>· R$ {Number(a.estimated_value).toFixed(2)}</span>}
                    {a.station_name && <span>· {a.station_name}</span>}
                  </div>
                </div>
                {a.authorization_code && (
                  <div className="font-mono text-lg font-bold text-success tracking-widest px-3 py-1 rounded bg-success/10 border border-success/30">
                    {a.authorization_code}
                  </div>
                )}
                <Badge className={`capitalize border ${
                  a.status === "pendente" ? "bg-warning/20 text-warning border-warning/30" :
                  a.status === "aprovada" ? "bg-success/20 text-success border-success/30" :
                  a.status === "utilizada" ? "bg-primary/20 text-primary border-primary/30" :
                  a.status === "recusada" ? "bg-destructive/20 text-destructive border-destructive/30" :
                  "bg-muted text-muted-foreground"
                }`}>{a.status}</Badge>
                {a.status === "pendente" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateAuth(a.id, "aprovada")} disabled={authBusy === a.id} className="bg-success/20 text-success hover:bg-success/30 border border-success/30">
                      <Check className="h-4 w-4 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateAuth(a.id, "recusada")} disabled={authBusy === a.id} className="text-destructive">
                      <X className="h-4 w-4 mr-1" /> Recusar
                    </Button>
                  </div>
                )}
                {a.status === "utilizada" && !a.fuel_record_id && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const stn = a.fuel_stations;
                      setEditing({
                        vehicle_id: a.vehicle_id,
                        driver_id: a.drivers?.id ?? a.driver_id ?? "",
                        fuel_station_id: a.fuel_station_id ?? "",
                        authorization_id: a.id,
                        source_origin: "autorizacao",
                        station_name: stn?.name ?? a.station_name ?? "",
                        station_cnpj: stn?.cnpj ?? a.receipt_cnpj ?? "",
                        city: stn?.city ?? "",
                        state: stn?.state ?? "",
                        fuel_type: a.fuel_type ?? a.vehicles?.fuel_type ?? "flex",
                        km_at_fueling: a.km_at_request ?? a.vehicles?.current_km ?? "",
                        total_value: a.receipt_total ? String(a.receipt_total) : "",
                        receipt_url: a.receipt_photo_url ?? "",
                        dashboard_photo_url: a.km_photo_url ?? "",
                        fueled_at: (a.confirmed_at ?? a.used_at ?? new Date().toISOString()).slice(0, 16),
                        notes: `Lançamento manual a partir da autorização ${a.authorization_code ?? a.id.slice(0, 8)}`,
                      });
                      setOpen(true);
                    }}
                    className="bg-warning/20 text-warning hover:bg-warning/30 border border-warning/30"
                  >
                    <FileWarning className="h-4 w-4 mr-1" /> Lançar em Abastecimentos
                  </Button>
                )}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      <FuelDialog open={open} onOpenChange={setOpen} record={editing} onSaved={() => { load(); loadAuths(); }} />
    </div>
  );
}
