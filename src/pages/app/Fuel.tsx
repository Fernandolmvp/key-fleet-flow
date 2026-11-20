import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Fuel as FuelIcon, Pencil, Trash2, AlertTriangle, TrendingDown, TrendingUp, DollarSign } from "lucide-react";
import { toast } from "sonner";
import FuelDialog from "@/components/dashboard/FuelDialog";
import KpiCard from "@/components/dashboard/KpiCard";
import { Badge } from "@/components/ui/badge";
import { ANOMALY_LABEL, fmtMoney, fmtNum } from "@/lib/fuel";
import { analyzeFuel, rankFuel } from "@/lib/fuel-anomalies";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

interface Row {
  vehicle_id: string | null; driver_id: string | null; fuel_station_id: string | null;
  reconciliation_status: string; reconciled_at: string | null; reconciliation_notes: string | null;
  id: string; fueled_at: string; station_name: string | null; city: string | null;
  fuel_type: string; liters: number; price_per_liter: number; total_value: number;
  km_at_fueling: number; km_per_liter: number | null; cost_per_km: number | null;
  anomalies: string[]; anomaly_severity: string | null;
  vehicles: { tank_capacity: number | null; plate: string; brand: string; model: string; expected_consumption_kml: number | null; consumption_tolerance_pct: number | null } | null;
  drivers: { full_name: string } | null;
}

export default function Fuel() {
  const { currentCompanyId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [driver, setDriver] = useState("");
  const [station, setStation] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const request = useRef(0);
  const invalidPeriod = !!(from && to && from > to);
  const load = useCallback(async () => {
    const token = ++request.current;
    setRows([]);
    if (!currentCompanyId || invalidPeriod) { setLoading(false); return; }
    setLoading(true);
    try {
      const collected: Row[] = [];
      for (let offset = 0; ; offset += 500) {
        let query = supabase.from("fuel_records")
          .select("*, vehicles:vehicles!fuel_records_vehicle_id_fkey(plate,brand,model,tank_capacity,expected_consumption_kml,consumption_tolerance_pct), drivers:drivers!fuel_records_driver_id_fkey(full_name)")
          .eq("company_id", currentCompanyId)
          .order("fueled_at", { ascending: false }).order("id", { ascending: false });
        if (from) query = query.gte("fueled_at", new Date(`${from}T00:00:00`).toISOString());
        if (to) {
          const nextDay = new Date(`${to}T00:00:00`);
          nextDay.setDate(nextDay.getDate() + 1);
          query = query.lt("fueled_at", nextDay.toISOString());
        }
        const { data, error } = await query.range(offset, offset + 499);
        if (token !== request.current) return;
        if (error) throw error;
        collected.push(...(data ?? []) as Row[]);
        if ((data?.length ?? 0) < 500) break;
      }
      if (token === request.current) setRows(collected);
    } catch (error) {
      if (token === request.current) toast.error(error instanceof Error ? error.message : "Não foi possível carregar os abastecimentos.");
    } finally {
      if (token === request.current) setLoading(false);
    }
  }, [currentCompanyId, from, to, invalidPeriod]);

  useEffect(() => { void load(); return () => { request.current++; }; }, [load]);
  useAutoRefresh(load, ["fuel_records"]);

  const reconcile = async (row: Row, status: string) => {
    if (!currentCompanyId || saving) return;
    const note = window.prompt("Observação da conciliação (opcional):", row.reconciliation_notes ?? "");
    if (note === null) return;
    setSaving(row.id);
    try {
      const { data, error } = await supabase.from("fuel_records").update({
        reconciliation_status: status,
        reconciled_at: status === "pendente" ? null : new Date().toISOString(),
        reconciliation_notes: note.trim() || null,
      }).eq("company_id", currentCompanyId).eq("id", row.id).select("id").single();
      if (error || !data) throw error ?? new Error("Registro não atualizado.");
      toast.success("Conciliação atualizada");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a conciliação.");
    } finally { setSaving(null); }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este abastecimento? Esta ação será registrada no histórico de auditoria.")) return;
    const { error } = await supabase.from("fuel_records").delete().eq("company_id", currentCompanyId).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido"); load();
  };

  const filtered = useMemo(() => rows.filter((r) => {
    const t = q.toLowerCase();
    if (vehicle && r.vehicle_id !== vehicle) return false;
    if (driver && r.driver_id !== driver) return false;
    if (station && (r.fuel_station_id ? `id:${r.fuel_station_id}` : `name:${r.station_name ?? ""}`) !== station) return false;
    return [r.vehicles?.plate, r.vehicles?.model, r.drivers?.full_name, r.station_name, r.city]
      .filter(Boolean).join(" ").toLowerCase().includes(t);
  }), [rows, q, vehicle, driver, station]);
  // Price reference uses the entire selected period, not only one station/vehicle.
  const alerts = useMemo(() => analyzeFuel(rows), [rows]);
  const rankings = useMemo(() => ({ vehicles: rankFuel(filtered, "vehicle"), drivers: rankFuel(filtered, "driver") }), [filtered]);
  const options = useMemo(() => {
    const vehicles = new Map<string, string>();
    const drivers = new Map<string, string>();
    const stations = new Map<string, string>();
    rows.forEach(row => {
      if (row.vehicle_id) vehicles.set(row.vehicle_id, row.vehicles?.plate ?? row.vehicle_id);
      if (row.driver_id) drivers.set(row.driver_id, row.drivers?.full_name ?? row.driver_id);
      stations.set(row.fuel_station_id ? `id:${row.fuel_station_id}` : `name:${row.station_name ?? ""}`, row.station_name ?? "Posto não informado");
    });
    return { vehicles, drivers, stations };
  }, [rows]);
  const exportCsv = () => {
    const number = (value: number | null) => value == null ? "" : value.toLocaleString("pt-BR", { useGrouping: false, maximumFractionDigits: 6 });
    const cell = (value: unknown) => {
      let text = String(value ?? "");
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const table = [["Data", "Veículo", "Motorista", "Posto", "Combustível", "Litros", "Preço/L", "Total", "km/L", "Conciliação", "Conciliado em", "Observação", "Alertas"],
      ...filtered.map(row => [new Date(row.fueled_at).toLocaleString("pt-BR"), row.vehicles?.plate, row.drivers?.full_name, row.station_name, row.fuel_type,
        number(row.liters), number(row.price_per_liter), number(row.total_value), number(row.km_per_liter), row.reconciliation_status,
        row.reconciled_at ? new Date(row.reconciled_at).toLocaleString("pt-BR") : "", row.reconciliation_notes,
        (alerts.get(row.id) ?? []).map(a => a.explanation).join(" | ")])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + table.map(row => row.map(cell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url; link.download = "abastecimentos.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const stats = useMemo(() => {
    const monthRows = filtered;
    const totalCost = monthRows.reduce((s, r) => s + Number(r.total_value), 0);
    const totalLiters = monthRows.reduce((s, r) => s + Number(r.liters), 0);
    // Consumo médio ponderado por litros, ignorando outliers/anomalias de KM
    const valid = filtered.filter(
      (r) =>
        r.km_per_liter != null &&
        Number(r.km_per_liter) > 0 &&
        Number(r.km_per_liter) < 30 && // limite físico realista (km/L)
        !(r.anomalies?.includes("km_regressivo")),
    );
    const sumKm = valid.reduce((s, r) => s + Number(r.km_per_liter) * Number(r.liters), 0);
    const sumL = valid.reduce((s, r) => s + Number(r.liters), 0);
    const avgKml = sumL > 0 ? sumKm / sumL : 0;
    const anomalies = filtered.filter((r) => (alerts.get(r.id)?.length ?? 0) > 0).length;
    return { totalCost, totalLiters, avgKml, anomalies, monthCount: monthRows.length, validCount: valid.length };
  }, [filtered, alerts]);

  // gráfico: custo por mês (últimos 6)
  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => {
      const d = new Date(r.fueled_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + Number(r.total_value));
    });
    const arr = Array.from(map.entries()).sort().slice(-6).map(([k, v]) => ({
      mes: new Date(k + "-01").toLocaleDateString("pt-BR", { month: "short" }),
      custo: Math.round(v),
    }));
    return arr;
  }, [filtered]);

  const topVehicles = rankings.vehicles.top.map(row => ({ placa: row.name, kmL: row.average }));

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
        <KpiCard label="Custo no período" value={fmtMoney(stats.totalCost)} icon={DollarSign} tone="primary" hint={`${stats.monthCount} abastecimentos`} />
        <KpiCard label="Litros no período" value={fmtNum(stats.totalLiters, { maximumFractionDigits: 1 })} icon={FuelIcon} hint="L" />
        <KpiCard
          label="Consumo médio"
          value={stats.avgKml > 0 ? `${stats.avgKml.toFixed(1)} km/L` : "—"}
          icon={stats.avgKml >= 8 ? TrendingUp : TrendingDown}
          tone={stats.avgKml >= 8 ? "success" : "warning"}
          hint={stats.validCount > 0 ? `${stats.validCount} lançamento(s) válidos` : "Precisa de 2+ abastecimentos sequenciais"}
        />
        <KpiCard label="Anomalias detectadas" value={stats.anomalies} icon={AlertTriangle} tone={stats.anomalies > 0 ? "warning" : "success"} hint="lançamentos com alerta" />
      </div>

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

      <div className="grid gap-4 md:grid-cols-2">
        {([['Veículos', rankings.vehicles], ['Motoristas', rankings.drivers]] as const).map(([title, ranking]) => (
          <div key={title} className="surface-card rounded-xl p-4">
            <h3 className="font-display font-semibold">Eficiência — {title}</h3>
            <p className="text-xs text-muted-foreground">Média simples de km/L positivos no período filtrado.</p>
            <div className="grid grid-cols-2 gap-4 mt-3">
              {([['Mais eficientes', ranking.top], ['Menos eficientes', ranking.bottom]] as const).map(([label, list]) => (
                <div key={label}><h4 className="text-sm font-semibold">{label}</h4>
                  {list.length ? <ol>{list.map(item => <li key={item.id} className="text-sm">{item.name}: {fmtNum(item.average, { maximumFractionDigits: 2 })} km/L ({item.count})</li>)}</ol> : <p className="text-sm text-muted-foreground">Sem dados válidos</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="surface-card rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">De<Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="text-sm">Até<Input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          {([
            ['Veículo', vehicle, setVehicle, options.vehicles],
            ['Motorista', driver, setDriver, options.drivers],
            ['Posto', station, setStation, options.stations],
          ] as const).map(([label, value, setter, choices]) => <label key={label} className="text-sm">{label}
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={e => setter(e.target.value)}>
              <option value="">Todos</option>
              {value && !choices.has(value) && <option value={value}>Seleção sem registros no período</option>}
              {[...choices].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>)}
          <Button variant="outline" disabled={loading || invalidPeriod || !filtered.length} onClick={exportCsv}>Exportar CSV</Button>
        </div>
        {invalidPeriod && <p role="alert" className="text-sm text-destructive">A data inicial deve ser anterior ou igual à final.</p>}
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
                  <th className="text-left px-4 py-3">Conciliação</th>
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
                        {(alerts.get(r.id) ?? []).map(a => (
                          <details key={a.code} className="text-xs">
                            <summary className="cursor-pointer"><Badge variant="outline" className="text-warning border-warning/40">{ANOMALY_LABEL[a.code] ?? a.code}</Badge></summary>
                            <p className="mt-1 max-w-xs text-muted-foreground">{a.explanation}</p>
                          </details>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select aria-label={`Conciliação de ${r.vehicles?.plate ?? r.id}`} className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                        value={r.reconciliation_status ?? "pendente"} disabled={!!saving || loading} onChange={e => void reconcile(r, e.target.value)}>
                        <option value="pendente">Pendente</option><option value="conferido">Conferido</option><option value="divergente">Divergente</option>
                      </select>
                      {r.reconciled_at && <p className="text-xs text-muted-foreground">{new Date(r.reconciled_at).toLocaleString("pt-BR")}</p>}
                      {r.reconciliation_notes && <p className="text-xs text-muted-foreground max-w-xs">{r.reconciliation_notes}</p>}
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

      <FuelDialog open={open} onOpenChange={setOpen} record={editing} onSaved={load} />
    </div>
  );
}
