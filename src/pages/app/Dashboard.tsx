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
}

const defaultCounts: Counts = { total: 0, ativo: 0, manutencao: 0, parado: 0, drivers: 0, cnhVencendo: 0 };

export default function Dashboard() {
  const { currentCompanyId } = useAuth();
  const [counts, setCounts] = useState<Counts>(defaultCounts);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentCompanyId) return;
    (async () => {
      setLoading(true);
      const [{ data: vehicles }, { data: drivers }] = await Promise.all([
        supabase.from("vehicles").select("status").eq("company_id", currentCompanyId),
        supabase.from("drivers").select("cnh_expires_at").eq("company_id", currentCompanyId),
      ]);
      const vs = vehicles ?? [];
      const ds = drivers ?? [];
      const in30 = new Date(); in30.setDate(in30.getDate() + 30);
      setCounts({
        total: vs.length,
        ativo: vs.filter((v: any) => v.status === "ativo").length,
        manutencao: vs.filter((v: any) => v.status === "manutencao").length,
        parado: vs.filter((v: any) => v.status === "parado").length,
        drivers: ds.length,
        cnhVencendo: ds.filter((d: any) => d.cnh_expires_at && new Date(d.cnh_expires_at) <= in30).length,
      });
      setLoading(false);
    })();
  }, [currentCompanyId]);

  // Demo chart data — substituir por dados reais quando módulo de abastecimento entrar
  const consumo = Array.from({ length: 12 }).map((_, i) => ({
    mes: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][i],
    custo: Math.round(8 + Math.random() * 5),
    km: Math.round(900 + Math.random() * 300),
  }));

  const ranking = Array.from({ length: 6 }).map((_, i) => ({
    placa: `ABC-${1000 + i * 37}`, kmL: +(7 + Math.random() * 5).toFixed(1),
  }));

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
        <KpiCard label="Custo médio /km" value="R$ 1,42" icon={Gauge} trend="↓ 6% vs mês anterior" />
        <KpiCard label="Consumo médio" value="9,8 km/L" icon={Fuel} trend="↑ 3% vs mês anterior" tone="success" />
        <KpiCard label="Alertas críticos" value={counts.cnhVencendo} icon={AlertTriangle} tone="warning" hint="CNH vencendo em 30 dias" />
        <KpiCard label="Documentos vencendo" value="—" icon={FileWarning} hint="módulo em construção" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="surface-card rounded-xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">Custo da frota — últimos 12 meses</h3>
            <span className="text-xs font-mono text-muted-foreground">R$ mil</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
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
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card rounded-xl p-6">
          <h3 className="font-display font-semibold mb-4">Ranking eficiência (km/L)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ranking} layout="vertical">
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
