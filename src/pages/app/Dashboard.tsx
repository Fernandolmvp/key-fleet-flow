import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import KpiCard from "@/components/dashboard/KpiCard";
import {
  Truck, Users, Wrench, Fuel, AlertTriangle, FileWarning, Activity, Gauge
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar
} from "recharts";

interface Counts {
  total: number; ativo: number; manutencao: number; parado: number;
  drivers: number; cnhVencendo: number;
  docsVencidos: number; docsVencendo: number;
  custoPorKm: number | null;
  consumoMedio: number | null;
}

const defaultCounts: Counts = { total: 0, ativo: 0, manutencao: 0, parado: 0, drivers: 0, cnhVencendo: 0, docsVencidos: 0, docsVencendo: 0, custoPorKm: null, consumoMedio: null };

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Dashboard() {
  const { currentCompanyId } = useAuth();
  const [counts, setCounts] = useState<Counts>(defaultCounts);
  const [loading, setLoading] = useState(true);
  const [consumo, setConsumo] = useState<{ mes: string; custo: number; km: number }[]>([]);
  const [ranking, setRanking] = useState<{ placa: string; kmL: number }[]>([]);

  useEffect(() => {
    if (!currentCompanyId) {
      setCounts(defaultCounts);
      setConsumo([]);
      setRanking([]);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      // Últimos 12 meses para gráfico de custo
      const since = new Date();
      since.setMonth(since.getMonth() - 11);
      since.setDate(1); since.setHours(0,0,0,0);

      const [{ data: vehicles }, { data: drivers }, { data: documents }, { data: fuel }] = await Promise.all([
        supabase.from("vehicles").select("id,plate,status").eq("company_id", currentCompanyId),
        supabase.from("drivers").select("cnh_expires_at").eq("company_id", currentCompanyId),
        supabase.from("documents").select("status").eq("company_id", currentCompanyId),
        supabase
          .from("fuel_records")
          .select("vehicle_id, fueled_at, total_value, km_driven, km_per_liter")
          .eq("company_id", currentCompanyId)
          .gte("fueled_at", since.toISOString()),
      ]);
      const vs = vehicles ?? [];
      const ds = drivers ?? [];
      const docs = documents ?? [];
      const fs = fuel ?? [];
      const in30 = new Date(); in30.setDate(in30.getDate() + 30);

      // Custo /km e consumo médio reais
      let totalCusto = 0, totalKm = 0, somaKmL = 0, nKmL = 0;
      for (const r of fs as any[]) {
        if (r.total_value) totalCusto += Number(r.total_value);
        if (r.km_driven && r.km_driven > 0) totalKm += Number(r.km_driven);
        if (r.km_per_liter && r.km_per_liter > 0) { somaKmL += Number(r.km_per_liter); nKmL++; }
      }
      const custoPorKm = totalKm > 0 ? totalCusto / totalKm : null;
      const consumoMedio = nKmL > 0 ? somaKmL / nKmL : null;

      // Série mensal de custo
      const buckets = new Map<string, number>();
      for (let i = 0; i < 12; i++) {
        const d = new Date(since); d.setMonth(since.getMonth() + i);
        buckets.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
      }
      for (const r of fs as any[]) {
        const d = new Date(r.fueled_at);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + Number(r.total_value || 0));
      }
      const serie = Array.from(buckets.entries()).map(([k, v]) => {
        const [, m] = k.split("-").map(Number);
        return { mes: MESES[m], custo: Math.round(v), km: 0 };
      });
      setConsumo(serie);

      // Ranking km/L por veículo
      const porVeic = new Map<string, { soma: number; n: number }>();
      for (const r of fs as any[]) {
        if (!r.vehicle_id || !r.km_per_liter || r.km_per_liter <= 0) continue;
        const cur = porVeic.get(r.vehicle_id) ?? { soma: 0, n: 0 };
        cur.soma += Number(r.km_per_liter); cur.n++;
        porVeic.set(r.vehicle_id, cur);
      }
      const placas = new Map<string, string>();
      for (const v of vs as any[]) placas.set(v.id, v.plate);
      const rk = Array.from(porVeic.entries())
        .map(([id, x]) => ({ placa: placas.get(id) || "—", kmL: +(x.soma / x.n).toFixed(1) }))
        .sort((a, b) => b.kmL - a.kmL)
        .slice(0, 6);
      setRanking(rk);

      setCounts({
        total: vs.length,
        ativo: vs.filter((v: any) => v.status === "ativo").length,
        manutencao: vs.filter((v: any) => v.status === "manutencao").length,
        parado: vs.filter((v: any) => v.status === "parado").length,
        drivers: ds.length,
        cnhVencendo: ds.filter((d: any) => d.cnh_expires_at && new Date(d.cnh_expires_at) <= in30).length,
        docsVencidos: docs.filter((d: any) => d.status === "vencido").length,
        docsVencendo: docs.filter((d: any) => d.status === "vencendo").length,
        custoPorKm,
        consumoMedio,
      });
      setLoading(false);
    })();
  }, [currentCompanyId]);

  const temCusto = consumo.some((c) => c.custo > 0);
  const temRanking = ranking.length > 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Dashboard executivo</h1>
        <p className="text-muted-foreground">Visão consolidada da operação · {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Veículos ativos" value={loading ? "—" : counts.ativo} icon={Truck} tone="success" hint={`${counts.total} no total`} />
        <KpiCard label="Em manutenção" value={loading ? "—" : counts.manutencao} icon={Wrench} tone="warning" />
        <KpiCard label="Veículos parados" value={loading ? "—" : counts.parado} icon={Activity} tone="destructive" />
        <KpiCard label="Motoristas" value={loading ? "—" : counts.drivers} icon={Users} tone="primary" hint={`${counts.cnhVencendo} c/ CNH vencendo`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Custo médio /km"
          value={loading ? "—" : counts.custoPorKm != null ? fmtBRL(counts.custoPorKm) : "—"}
          icon={Gauge}
          hint={counts.custoPorKm == null ? "Sem abastecimentos registrados" : "Últimos 12 meses"}
        />
        <KpiCard
          label="Consumo médio"
          value={loading ? "—" : counts.consumoMedio != null ? `${counts.consumoMedio.toFixed(1)} km/L` : "—"}
          icon={Fuel}
          tone={counts.consumoMedio != null ? "success" : undefined}
          hint={counts.consumoMedio == null ? "Sem abastecimentos registrados" : "Últimos 12 meses"}
        />
        <KpiCard label="Alertas críticos" value={counts.cnhVencendo} icon={AlertTriangle} tone="warning" hint="CNH vencendo em 30 dias" />
          <KpiCard
            label="Documentos vencendo"
            value={loading ? "—" : counts.docsVencendo + counts.docsVencidos}
            icon={FileWarning}
            tone={counts.docsVencidos > 0 ? "destructive" : counts.docsVencendo > 0 ? "warning" : undefined}
            hint={`${counts.docsVencidos} vencidos · ${counts.docsVencendo} a vencer`}
          />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="surface-card rounded-xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">Custo da frota — últimos 12 meses</h3>
            <span className="text-xs font-mono text-muted-foreground">R$</span>
          </div>
          <div className="h-64">
            {temCusto ? <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={consumo}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(190 100% 50%)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(190 100% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 30% 18%)" />
                <XAxis dataKey="mes" stroke="hsl(215 15% 65%)" fontSize={12} />
                <YAxis stroke="hsl(215 15% 65%)" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(215 38% 11%)", border: "1px solid hsl(215 30% 18%)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="custo" stroke="hsl(190 100% 50%)" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer> : (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                Sem abastecimentos registrados nesta empresa ainda.
              </div>
            )}
          </div>
        </div>

        <div className="surface-card rounded-xl p-6">
          <h3 className="font-display font-semibold mb-4">Ranking eficiência (km/L)</h3>
          <div className="h-64">
            {temRanking ? <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ranking} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 30% 18%)" />
                <XAxis type="number" stroke="hsl(215 15% 65%)" fontSize={12} />
                <YAxis type="category" dataKey="placa" stroke="hsl(215 15% 65%)" fontSize={11} width={70} />
                <Tooltip contentStyle={{ background: "hsl(215 38% 11%)", border: "1px solid hsl(215 30% 18%)", borderRadius: 8 }} />
                <Bar dataKey="kmL" fill="hsl(190 100% 50%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer> : (
              <div className="h-full grid place-items-center text-sm text-muted-foreground text-center px-4">
                Ainda não há dados de consumo por veículo.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="surface-card rounded-xl p-6">
        <h3 className="font-display font-semibold mb-4">Roadmap dos módulos</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          {[
            { l: "Veículos", s: "ativo" }, { l: "Motoristas", s: "ativo" },
            { l: "Abastecimentos", s: "soon" }, { l: "Manutenção", s: "soon" },
            { l: "Pneus", s: "soon" }, { l: "Documentos", s: "soon" },
            { l: "Multas", s: "soon" }, { l: "Checklist", s: "soon" },
          ].map((m) => (
            <div key={m.l} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
              <span>{m.l}</span>
              <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${m.s === "ativo" ? "bg-success/20 text-success" : "bg-muted/50 text-muted-foreground"}`}>{m.s === "ativo" ? "live" : "fase 2"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
