import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import KpiCard from "@/components/dashboard/KpiCard";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  Truck, Users, Wrench, Fuel, AlertTriangle, FileWarning, Gauge,
  ArrowUpRight, ArrowDownRight, CheckCircle2, Shield, UserPlus, Link2,
  Sparkles, ArrowRight, ChevronRight, FileText, Receipt, CircleDollarSign,
  ClipboardCheck
} from "lucide-react";

type Alert = { kind: string; severity: string; title: string; subtitle: string; date: string; link: string };
type TopVehicle = { vehicle_id: string; plate: string; model: string; total: number };
type Upcoming = { kind: string; date: string; title: string; amount: number | null; link: string };
type SeriesPoint = { month: string; total: number };
type RankPoint = { vehicle_id: string; plate: string; km_l: number };

type Summary = {
  company_id: string;
  mode: "new" | "active";
  vehicles: { total: number; active: number; maintenance: number; parado: number };
  drivers: { total: number; active: number; cnh_expiring: number };
  trips_running: number;
  counts: { docs_expiring: number; maint_7d: number; fines_open: number; approvals_pending: number; critical_alerts: number };
  month: {
    total: number; prev_total: number; km: number; prev_km: number;
    km_per_liter: number | null; prev_km_per_liter: number | null;
    breakdown: { fuel: number; maintenance: number; expenses: number; fines: number; trip_expenses: number };
  };
  alerts: Alert[];
  top_vehicles: TopVehicle[];
  upcoming: Upcoming[];
  series_12m: SeriesPoint[];
  ranking_km_l: RankPoint[];
  fuel_30d: number;
};

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmtBRL = (n: number) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtBRLp = (n: number) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => {
  try { return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); }
  catch { return s; }
};

export default function Dashboard() {
  const { user, currentCompanyId, companies } = useAuth();
  const currentCompany = companies.find((c) => c.id === currentCompanyId) ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary", currentCompanyId],
    enabled: !!currentCompanyId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_get_summary", { p_company_id: currentCompanyId! });
      if (error) throw error;
      if (!data || (data as any).company_id !== currentCompanyId) {
        throw new Error("company mismatch");
      }
      return data as unknown as Summary;
    },
  });

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  }, []);
  const firstName =
    (user?.user_metadata as any)?.full_name?.split(" ")?.[0]
    ?? user?.email?.split("@")[0] ?? "gestor";

  if (!currentCompanyId) {
    return <div className="p-6 text-muted-foreground">Selecione uma empresa para visualizar o dashboard.</div>;
  }
  if (isLoading || !data) return <DashboardSkeleton />;

  return data.mode === "new"
    ? <WelcomeMode greeting={greeting} firstName={firstName} company={currentCompany?.name} />
    : <FullDashboard data={data} greeting={greeting} firstName={firstName} company={currentCompany?.name} />;
}

/* ===================== WELCOME (NEW COMPANY) ===================== */

function WelcomeMode({ greeting, firstName, company }: { greeting: string; firstName: string; company?: string | null }) {
  const { currentCompanyId } = useAuth();
  const [steps, setSteps] = useState({ vehicle: false, driver: false, link: false, policy: false, team: false });
  const [loadingSteps, setLoadingSteps] = useState(true);

  useEffect(() => {
    if (!currentCompanyId) return;
    (async () => {
      setLoadingSteps(true);
      const [v, d, link, p, t] = await Promise.all([
        supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("company_id", currentCompanyId),
        supabase.from("drivers").select("id", { count: "exact", head: true }).eq("company_id", currentCompanyId),
        supabase.from("drivers").select("id", { count: "exact", head: true })
          .eq("company_id", currentCompanyId).eq("has_assigned_vehicle", true),
        supabase.from("insurance_policies").select("id", { count: "exact", head: true }).eq("company_id", currentCompanyId),
        supabase.from("company_members").select("user_id", { count: "exact", head: true }).eq("company_id", currentCompanyId),
      ]);
      setSteps({
        vehicle: (v.count ?? 0) > 0,
        driver: (d.count ?? 0) > 0,
        link: (link.count ?? 0) > 0,
        policy: (p.count ?? 0) > 0,
        team: (t.count ?? 0) > 1,
      });
      setLoadingSteps(false);
    })();
  }, [currentCompanyId]);

  const items = [
    { key: "vehicle", icon: Truck, title: "Cadastrar veículo", desc: "Adicione o primeiro veículo da sua frota.", to: "/app/vehicles" },
    { key: "driver", icon: Users, title: "Cadastrar motorista", desc: "Crie o cadastro do primeiro motorista.", to: "/app/drivers" },
    { key: "link", icon: Link2, title: "Vincular motorista ao veículo", desc: "Defina quem dirige cada veículo.", to: "/app/vehicles" },
    { key: "policy", icon: Shield, title: "Cadastrar apólice", desc: "Importe o PDF — a IA preenche tudo.", to: "/app/insurance" },
    { key: "team", icon: UserPlus, title: "Convidar equipe", desc: "Adicione gestores e colaboradores.", to: "/app/configuracoes" },
  ] as const;

  const done = Object.values(steps).filter(Boolean).length;
  const pct = Math.round((done / items.length) * 100);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <header className="text-center max-w-2xl mx-auto space-y-2 pt-4">
        <div className="inline-flex items-center gap-2 text-primary text-sm font-medium">
          <Sparkles className="h-4 w-4" /> Vamos colocar sua frota no ar
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">
          {greeting}, <span className="text-primary">{firstName}</span>!
        </h1>
        <p className="text-muted-foreground">
          Bem-vindo à FrotaOps{company ? <> · <span className="text-foreground font-medium">{company}</span></> : null}.
          Vamos configurar sua frota em poucos minutos.
        </p>
      </header>

      <div className="surface-card rounded-xl p-5 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Progresso</p>
            <p className="font-display text-2xl font-bold mt-1">{done} de {items.length} passos</p>
          </div>
          <span className="text-sm font-mono text-muted-foreground">{pct}%</span>
        </div>
        <Progress value={pct} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 max-w-3xl mx-auto w-full">
        {items.map((it) => {
          const Icon = it.icon;
          const ok = (steps as any)[it.key] && !loadingSteps;
          return (
            <Link key={it.key} to={it.to}
              className={cn(
                "surface-card rounded-xl p-5 flex gap-4 items-start transition-colors hover:border-primary/50 min-h-[120px]",
                ok && "opacity-70"
              )}>
              <div className={cn(
                "h-12 w-12 rounded-lg grid place-items-center shrink-0",
                ok ? "bg-success/15 text-success" : "bg-primary/10 text-primary"
              )}>
                {ok ? <CheckCircle2 className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={cn("font-display font-semibold leading-tight", ok && "line-through")}>{it.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{it.desc}</p>
                <div className="mt-3 inline-flex items-center text-xs font-medium text-primary">
                  {ok ? "Concluído" : "Começar"} <ArrowRight className="h-3 w-3 ml-1" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== FULL DASHBOARD ===================== */

const PIE_COLORS = [
  "hsl(190 100% 50%)", // cian
  "hsl(270 80% 65%)",  // roxo
  "hsl(28 95% 60%)",   // laranja
  "hsl(0 80% 60%)",    // vermelho
  "hsl(140 70% 50%)",  // verde
];

function FullDashboard({
  data, greeting, firstName, company,
}: { data: Summary; greeting: string; firstName: string; company?: string | null }) {
  const { vehicles, drivers, counts, month, alerts, top_vehicles, upcoming, series_12m, ranking_km_l } = data;

  const fleetPctMaint = vehicles.total > 0 ? Math.round((vehicles.maintenance / vehicles.total) * 100) : 0;
  const variation = month.prev_total > 0 ? ((month.total - month.prev_total) / month.prev_total) * 100 : null;
  const costPerKm = month.km > 0 ? month.total / month.km : null;
  const prevCostPerKm = month.prev_km > 0 ? month.prev_total / month.prev_km : null;
  const costPerKmDelta = costPerKm != null && prevCostPerKm != null && prevCostPerKm > 0
    ? ((costPerKm - prevCostPerKm) / prevCostPerKm) * 100 : null;
  const kmlDelta = month.km_per_liter != null && month.prev_km_per_liter != null && month.prev_km_per_liter > 0
    ? ((month.km_per_liter - month.prev_km_per_liter) / month.prev_km_per_liter) * 100 : null;

  const serie = series_12m.map((p) => {
    const d = new Date(p.month);
    return { mes: MESES[d.getMonth()], custo: Math.round(Number(p.total) || 0) };
  });
  const temCusto = serie.some((s) => s.custo > 0);
  const ranking = ranking_km_l.map((r) => ({ placa: r.plate || "—", kmL: Number(r.km_l) }));
  const temRanking = ranking.length > 0;

  const breakdown = [
    { name: "Combustível", value: month.breakdown.fuel },
    { name: "Manutenção", value: month.breakdown.maintenance },
    { name: "Despesas", value: month.breakdown.expenses },
    { name: "Multas", value: month.breakdown.fines },
    { name: "Viagens", value: month.breakdown.trip_expenses },
  ].filter((x) => Number(x.value) > 0);
  const topMax = top_vehicles.reduce((m, x) => Math.max(m, Number(x.total)), 0);
  const upcomingTotal = upcoming.reduce((s, x) => s + Number(x.amount || 0), 0);

  const attentionCards = [
    counts.docs_expiring > 0 && {
      icon: FileWarning, tone: "warning" as const, count: counts.docs_expiring,
      title: "documento(s) vencendo", subtitle: "Próximos 30 dias", to: "/app/documents",
    },
    counts.maint_7d > 0 && {
      icon: Wrench, tone: "warning" as const, count: counts.maint_7d,
      title: "manutenção(ões) nos próximos 7 dias", subtitle: "Programar serviço", to: "/app/maintenance",
    },
    counts.fines_open > 0 && {
      icon: AlertTriangle, tone: "destructive" as const, count: counts.fines_open,
      title: "multa(s) em aberto", subtitle: "Requer providência", to: "/app/multas",
    },
    counts.approvals_pending > 0 && {
      icon: ClipboardCheck, tone: "primary" as const, count: counts.approvals_pending,
      title: "aprovação(ões) pendente(s)", subtitle: "Autorizar ou recusar", to: "/app/approvals",
    },
  ].filter(Boolean) as Array<{ icon: any; tone: "warning"|"destructive"|"primary"; count: number; title: string; subtitle: string; to: string }>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Dashboard executivo</h1>
        <p className="text-muted-foreground">
          {company ? <><span className="text-foreground font-medium">{company}</span> · </> : null}
          Visão consolidada da operação · {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* LINHA 1 - operação */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Veículos ativos" value={vehicles.active} icon={Truck} tone="success" hint={`${vehicles.total} no total`} />
        <KpiCard label="Em manutenção" value={vehicles.maintenance} icon={Wrench} tone="warning" hint={`${fleetPctMaint}% da frota`} />
        <KpiCard
          label="Documentos vencendo"
          value={counts.docs_expiring}
          icon={FileWarning}
          tone={counts.docs_expiring > 0 ? "warning" : "default"}
          hint="Em até 30 dias"
        />
        <KpiCard
          label="Alertas críticos"
          value={counts.critical_alerts}
          icon={AlertTriangle}
          tone={counts.critical_alerts > 0 ? "destructive" : "default"}
          hint="Requer atenção"
        />
      </div>

      {/* LINHA 2 - custos */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Custo do mês"
          value={fmtBRL(month.total)}
          icon={CircleDollarSign}
          tone="primary"
          hint={variation != null ? `${variation > 0 ? "↑" : "↓"} ${Math.abs(variation).toFixed(1)}% vs mês anterior` : "Sem comparativo"}
        />
        <KpiCard
          label="Custo médio /km"
          value={costPerKm != null ? fmtBRLp(costPerKm) : "—"}
          icon={Gauge}
          hint={
            costPerKmDelta != null
              ? `${costPerKmDelta > 0 ? "↑" : "↓"} ${Math.abs(costPerKmDelta).toFixed(1)}% vs mês anterior`
              : (costPerKm == null ? "Sem km no mês" : "Sem comparativo")
          }
        />
        <KpiCard
          label="Consumo médio"
          value={month.km_per_liter != null ? `${Number(month.km_per_liter).toFixed(1)} km/L` : "—"}
          icon={Fuel}
          tone={month.km_per_liter != null ? "success" : "default"}
          hint={
            kmlDelta != null
              ? `${kmlDelta > 0 ? "↑" : "↓"} ${Math.abs(kmlDelta).toFixed(1)}% vs mês anterior`
              : "Mês corrente"
          }
        />
        <KpiCard
          label="Motoristas ativos"
          value={drivers.active}
          icon={Users}
          tone="primary"
          hint={`${drivers.cnh_expiring} c/ CNH vencendo`}
        />
      </div>

      {/* LINHA 3 - dois gráficos */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="surface-card rounded-xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">Custo da frota — últimos 12 meses</h3>
            <span className="text-xs font-mono text-muted-foreground">R$</span>
          </div>
          <div className="h-64">
            {temCusto ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serie}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(190 100% 50%)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(190 100% 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 30% 18%)" />
                  <XAxis dataKey="mes" stroke="hsl(215 15% 65%)" fontSize={12} />
                  <YAxis stroke="hsl(215 15% 65%)" fontSize={12} />
                  <Tooltip
                    formatter={(v: number) => fmtBRL(v)}
                    contentStyle={{ background: "hsl(215 38% 11%)", border: "1px solid hsl(215 30% 18%)", borderRadius: 8 }}
                  />
                  <Area type="monotone" dataKey="custo" stroke="hsl(190 100% 50%)" strokeWidth={2} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                Sem custos registrados nesta empresa ainda.
              </div>
            )}
          </div>
        </div>

        <div className="surface-card rounded-xl p-6">
          <h3 className="font-display font-semibold mb-4">Ranking eficiência (km/L)</h3>
          <div className="h-64">
            {temRanking ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ranking} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 30% 18%)" />
                  <XAxis type="number" stroke="hsl(215 15% 65%)" fontSize={12} />
                  <YAxis type="category" dataKey="placa" stroke="hsl(215 15% 65%)" fontSize={11} width={70} />
                  <Tooltip contentStyle={{ background: "hsl(215 38% 11%)", border: "1px solid hsl(215 30% 18%)", borderRadius: 8 }} />
                  <Bar dataKey="kmL" fill="hsl(190 100% 50%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full grid place-items-center text-sm text-muted-foreground text-center px-4">
                Sem dados de consumo nos últimos 90 dias.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LINHA 4 - onde está indo o dinheiro */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="surface-card rounded-xl p-6">
          <h3 className="font-display font-semibold mb-4">Onde está indo seu dinheiro</h3>
          {breakdown.length === 0 ? (
            <div className="h-56 grid place-items-center text-sm text-muted-foreground">
              Sem gastos no mês corrente.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={breakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {breakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => fmtBRL(v)}
                    contentStyle={{ background: "hsl(215 38% 11%)", border: "1px solid hsl(215 30% 18%)", borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="surface-card rounded-xl p-6 lg:col-span-2">
          <h3 className="font-display font-semibold mb-4">Top 5 veículos que mais custaram este mês</h3>
          {top_vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de custo por veículo este mês.</p>
          ) : (
            <ul className="space-y-3">
              {top_vehicles.map((v) => {
                const pct = topMax > 0 ? (Number(v.total) / topMax) * 100 : 0;
                return (
                  <li key={v.vehicle_id}>
                    <Link to={`/app/vehicles/${v.vehicle_id}/historico`} className="block rounded-lg hover:bg-muted/30 px-2 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono font-bold tracking-wider">{v.plate || "—"}</p>
                          <p className="text-xs text-muted-foreground truncate">{v.model?.trim() || "—"}</p>
                        </div>
                        <p className="font-display font-semibold whitespace-nowrap">{fmtBRL(Number(v.total))}</p>
                      </div>
                      <div className="mt-2 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* LINHA 5 - precisa de atenção */}
      {attentionCards.length > 0 && (
        <div>
          <h3 className="font-display font-semibold mb-3">Precisa de atenção</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {attentionCards.map((c) => {
              const Icon = c.icon;
              const toneCls = c.tone === "destructive" ? "text-destructive" :
                              c.tone === "warning" ? "text-warning" : "text-primary";
              return (
                <Link key={c.to} to={c.to} className="surface-card rounded-xl p-5 hover:border-primary/40 transition-colors block">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={cn("font-display text-3xl font-bold", toneCls)}>{c.count}</p>
                      <p className="text-sm font-medium mt-1">{c.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.subtitle}</p>
                    </div>
                    <div className={cn("h-10 w-10 rounded-lg grid place-items-center bg-muted/40", toneCls)}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* LINHA 6 - próximos compromissos */}
      <div className="surface-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display font-semibold">Próximos compromissos (30 dias)</h3>
          {upcomingTotal > 0 && (
            <span className="text-sm font-mono text-muted-foreground">~{fmtBRL(upcomingTotal)}</span>
          )}
        </div>
        {upcomingTotal > 0 && (
          <p className="text-xs text-muted-foreground mb-3">
            Você tem cerca de <span className="text-foreground font-medium">{fmtBRL(upcomingTotal)}</span> comprometidos para os próximos 30 dias.
          </p>
        )}
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada com vencimento nos próximos 30 dias.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {upcoming.slice(0, 10).map((u, i) => (
              <li key={i}>
                <Link to={u.link} className="flex items-center gap-3 py-2.5 min-h-[44px] hover:opacity-90">
                  <div className="h-9 w-9 rounded-lg bg-muted/40 grid place-items-center shrink-0 text-muted-foreground">
                    {u.kind === "maintenance" ? <Wrench className="h-4 w-4" />
                      : u.kind === "fine" ? <AlertTriangle className="h-4 w-4" />
                      : u.kind === "policy" ? <Shield className="h-4 w-4" />
                      : <FileText className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.title}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(u.date)}</p>
                  </div>
                  {u.amount != null && Number(u.amount) > 0 && (
                    <span className="font-mono text-sm whitespace-nowrap">{fmtBRL(Number(u.amount))}</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}