import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import KpiCard from "@/components/dashboard/KpiCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Truck, Users, Wrench, Fuel, AlertTriangle, FileWarning,
  ArrowRight, ArrowUpRight, ArrowDownRight, CheckCircle2, Circle,
  Shield, UserPlus, Link2, Calendar, Receipt, Activity, TrendingUp,
  CircleDollarSign, FileText, ChevronRight, Sparkles
} from "lucide-react";

type Alert = { kind: string; severity: string; title: string; subtitle: string; date: string; link: string };
type TopVehicle = { vehicle_id: string; plate: string; model: string; total: number };
type Upcoming = { kind: string; date: string; title: string; amount: number | null; link: string };
type Recent = { kind: string; date: string; title: string; link: string };

type Summary = {
  company_id: string;
  mode: "new" | "active";
  vehicles: { total: number; active: number; maintenance: number; parado: number };
  drivers: { total: number; available: number };
  trips_running: number;
  month: {
    total: number; prev_total: number; km: number;
    breakdown: { fuel: number; maintenance: number; expenses: number; fines: number; trip_expenses: number };
  };
  alerts: Alert[];
  top_vehicles: TopVehicle[];
  upcoming: Upcoming[];
  recent: Recent[];
};

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
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(null);
    if (!currentCompanyId) { setLoading(false); return; }
    const scoped = currentCompanyId;
    (async () => {
      setLoading(true);
      const { data: res, error } = await supabase.rpc("dashboard_get_summary", { p_company_id: scoped });
      if (scoped !== currentCompanyId) return;
      if (error) {
        console.error("[dashboard]", error);
        setData(null);
      } else if (res && (res as any).company_id === scoped) {
        setData(res as unknown as Summary);
      }
      setLoading(false);
    })();
  }, [currentCompanyId]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  }, []);
  const firstName =
    (user?.user_metadata as any)?.full_name?.split(" ")?.[0]
    ?? user?.email?.split("@")[0]
    ?? "gestor";

  if (loading) return <DashboardSkeleton />;
  if (!currentCompanyId) {
    return <div className="p-6 text-muted-foreground">Selecione uma empresa para visualizar o dashboard.</div>;
  }
  if (!data) {
    return <div className="p-6 text-muted-foreground">Não foi possível carregar os dados.</div>;
  }

  return data.mode === "new"
    ? <NewCompanyMode data={data} greeting={greeting} firstName={firstName} company={currentCompany?.name} />
    : <ActiveCompanyMode data={data} greeting={greeting} firstName={firstName} company={currentCompany?.name} />;
}

/* ---------- NEW COMPANY MODE ---------- */

function NewCompanyMode({
  data, greeting, firstName, company,
}: { data: Summary; greeting: string; firstName: string; company?: string | null }) {
  const { currentCompanyId } = useAuth();
  const [steps, setSteps] = useState({
    vehicle: false, driver: false, link: false, policy: false, team: false,
  });
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
    { key: "vehicle", icon: Truck, title: "Cadastrar primeiro veículo", desc: "Comece adicionando um carro, caminhão ou moto da frota.", to: "/app/vehicles", cta: "Cadastrar veículo" },
    { key: "driver", icon: Users, title: "Cadastrar primeiro motorista", desc: "Adicione um motorista para vincular aos veículos.", to: "/app/drivers", cta: "Cadastrar motorista" },
    { key: "link", icon: Link2, title: "Vincular motorista ao veículo", desc: "Defina quem dirige cada veículo da frota.", to: "/app/vehicles", cta: "Abrir veículos" },
    { key: "policy", icon: Shield, title: "Cadastrar apólice de seguro", desc: "Importe a apólice (PDF) e a IA preenche tudo.", to: "/app/insurance", cta: "Adicionar apólice" },
    { key: "team", icon: UserPlus, title: "Convidar equipe (opcional)", desc: "Adicione gestores e colaboradores ao sistema.", to: "/app/configuracoes", cta: "Convidar pessoa" },
  ] as const;

  const done = Object.values(steps).filter(Boolean).length;
  const total = items.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-primary text-sm font-medium">
          <Sparkles className="h-4 w-4" /> Vamos colocar sua frota no ar
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">
          {greeting}, <span className="text-primary">{firstName}</span>!
        </h1>
        <p className="text-muted-foreground">
          {company ? <><span className="text-foreground font-medium">{company}</span> · </> : null}
          Em poucos minutos você terá sua operação rodando. Siga os próximos passos.
        </p>
      </header>

      <div className="surface-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Progresso da configuração</p>
            <p className="font-display text-2xl font-bold mt-1">{done} de {total} passos</p>
          </div>
          <span className="text-sm font-mono text-muted-foreground">{pct}%</span>
        </div>
        <Progress value={pct} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((it) => {
          const Icon = it.icon;
          const ok = (steps as any)[it.key] && !loadingSteps;
          return (
            <Link
              key={it.key}
              to={it.to}
              className={cn(
                "surface-card rounded-xl p-4 flex gap-4 items-start transition-colors hover:border-primary/50 min-h-[112px]",
                ok && "opacity-70"
              )}
            >
              <div className={cn(
                "h-11 w-11 rounded-lg grid place-items-center shrink-0",
                ok ? "bg-success/15 text-success" : "bg-primary/10 text-primary"
              )}>
                {ok ? <CheckCircle2 className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={cn("font-display font-semibold leading-tight", ok && "line-through")}>{it.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{it.desc}</p>
                <div className="mt-3 inline-flex items-center text-xs font-medium text-primary">
                  {ok ? "Concluído" : it.cta} <ArrowRight className="h-3 w-3 ml-1" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="surface-card rounded-xl p-5">
        <h3 className="font-display font-semibold mb-1">Dica</h3>
        <p className="text-sm text-muted-foreground">
          Assim que você cadastrar <strong>3 veículos</strong> ou o <strong>primeiro abastecimento</strong>,
          o painel automaticamente mostrará seus indicadores de custo, alertas e operação.
        </p>
      </div>
    </div>
  );
}

/* ---------- ACTIVE COMPANY MODE ---------- */

function ActiveCompanyMode({
  data, greeting, firstName, company,
}: { data: Summary; greeting: string; firstName: string; company?: string | null }) {
  const { month, vehicles, drivers, trips_running, alerts, top_vehicles, upcoming, recent } = data;
  const variation = month.prev_total > 0 ? ((month.total - month.prev_total) / month.prev_total) * 100 : null;
  const variationUp = (variation ?? 0) > 0;
  const costPerKm = month.km > 0 ? month.total / month.km : null;

  const breakdownItems = [
    { key: "fuel", label: "Combustível", value: month.breakdown.fuel, color: "bg-primary" },
    { key: "maintenance", label: "Manutenção", value: month.breakdown.maintenance, color: "bg-warning" },
    { key: "expenses", label: "Despesas", value: month.breakdown.expenses, color: "bg-info" },
    { key: "fines", label: "Multas", value: month.breakdown.fines, color: "bg-destructive" },
    { key: "trip_expenses", label: "Viagens", value: month.breakdown.trip_expenses, color: "bg-success" },
  ].filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const breakdownMax = breakdownItems.reduce((m, x) => Math.max(m, x.value), 0);
  const topMax = top_vehicles.reduce((m, x) => Math.max(m, Number(x.total)), 0);
  const upcomingTotal = upcoming.reduce((s, x) => s + Number(x.amount || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-bold">
          {greeting}, <span className="text-primary">{firstName}</span>
        </h1>
        <p className="text-muted-foreground text-sm">
          {company ? <><span className="text-foreground font-medium">{company}</span> · </> : null}
          Visão consolidada · {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </header>

      {/* BLOCO 1 - alertas */}
      {alerts.length > 0 && (
        <section className="rounded-xl border border-warning/40 bg-warning/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h2 className="font-display font-semibold text-warning">Precisa de atenção</h2>
            <span className="text-xs font-mono text-muted-foreground ml-auto">{alerts.length} itens</span>
          </div>
          <ul className="space-y-1">
            {alerts.slice(0, 6).map((a, i) => (
              <li key={i}>
                <Link
                  to={a.link}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-warning/10 min-h-[44px]"
                >
                  <span className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    a.severity === "high" ? "bg-destructive" : "bg-warning"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.subtitle}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* BLOCO 2 - custos */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Quanto você gastou este mês</h2>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="grid gap-3 grid-cols-2">
          <div className="surface-card rounded-xl p-4 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
              <CircleDollarSign className="h-4 w-4" /> Gasto total
            </div>
            <p className="font-display text-3xl font-bold mt-2">{fmtBRL(month.total)}</p>
            {variation != null ? (
              <p className={cn(
                "text-xs mt-1 flex items-center gap-1",
                variationUp ? "text-destructive" : "text-success"
              )}>
                {variationUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(variation).toFixed(1)}% vs mês anterior
              </p>
            ) : (
              <p className="text-xs mt-1 text-muted-foreground">Sem comparativo do mês anterior</p>
            )}
          </div>

          <KpiCard
            label="Custo /km"
            value={costPerKm != null ? fmtBRLp(costPerKm) : "—"}
            icon={TrendingUp}
            hint={costPerKm != null ? `${month.km.toLocaleString("pt-BR")} km no mês` : "Sem km registrado"}
          />

          <KpiCard
            label="Mês anterior"
            value={fmtBRL(month.prev_total)}
            icon={Receipt}
            tone="primary"
            hint="Total gasto no mês passado"
          />
        </div>

        {/* breakdown */}
        <div className="surface-card rounded-xl p-5">
          <h3 className="font-display font-semibold mb-4">Onde está indo seu dinheiro</h3>
          {breakdownItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum gasto registrado este mês.</p>
          ) : (
            <div className="space-y-3">
              {breakdownItems.map((b) => {
                const pct = breakdownMax > 0 ? (b.value / breakdownMax) * 100 : 0;
                const share = month.total > 0 ? (b.value / month.total) * 100 : 0;
                return (
                  <div key={b.key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{b.label}</span>
                      <span className="font-mono text-muted-foreground">
                        {fmtBRL(b.value)} <span className="text-xs">({share.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", b.color)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* top vehicles */}
        <div className="surface-card rounded-xl p-5">
          <h3 className="font-display font-semibold mb-4">Top 3 veículos que mais custaram</h3>
          {top_vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de custo por veículo este mês.</p>
          ) : (
            <ul className="space-y-3">
              {top_vehicles.map((v) => {
                const pct = topMax > 0 ? (Number(v.total) / topMax) * 100 : 0;
                return (
                  <li key={v.vehicle_id}>
                    <Link
                      to={`/app/vehicles/${v.vehicle_id}/historico`}
                      className="block rounded-lg hover:bg-muted/30 px-2 py-2 min-h-[44px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono font-bold tracking-wider">{v.plate}</p>
                          <p className="text-xs text-muted-foreground truncate">{v.model.trim() || "—"}</p>
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
      </section>

      {/* BLOCO 3 - operação atual */}
      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Operação agora</h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <OpsTile to="/app/vehicles" icon={Truck} label="Veículos ativos" value={vehicles.active} hint={`de ${vehicles.total}`} tone="success" />
          <OpsTile to="/app/maintenance" icon={Wrench} label="Em manutenção" value={vehicles.maintenance} tone="warning" />
          <OpsTile to="/app/drivers" icon={Users} label="Motoristas disponíveis" value={drivers.available} hint={`de ${drivers.total}`} tone="primary" />
          <OpsTile to="/app/viagens" icon={Activity} label="Viagens em andamento" value={trips_running} />
        </div>
      </section>

      {/* BLOCO 4 - próximas saídas */}
      <section className="surface-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Próximas saídas (30 dias)</h2>
          {upcomingTotal > 0 && (
            <span className="text-sm font-mono text-muted-foreground">~{fmtBRL(upcomingTotal)}</span>
          )}
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada com vencimento nos próximos 30 dias.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {upcoming.slice(0, 8).map((u, i) => (
              <li key={i}>
                <Link to={u.link} className="flex items-center gap-3 py-2.5 min-h-[44px] hover:opacity-90">
                  <div className="h-9 w-9 rounded-lg bg-muted/40 grid place-items-center shrink-0 text-muted-foreground">
                    {u.kind === "maintenance" ? <Wrench className="h-4 w-4" />
                      : u.kind === "fine" ? <AlertTriangle className="h-4 w-4" />
                      : <FileText className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.title}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(u.date)}</p>
                  </div>
                  {u.amount != null && u.amount > 0 && (
                    <span className="font-mono text-sm whitespace-nowrap">{fmtBRL(Number(u.amount))}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* BLOCO 5 - atividade recente */}
      <section className="surface-card rounded-xl p-5">
        <h2 className="font-display text-base font-semibold mb-3">Atividade recente</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((r, i) => (
              <li key={i}>
                <Link to={r.link} className="flex items-center gap-3 text-sm py-1.5 hover:opacity-90">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span className="truncate flex-1">{r.title}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function OpsTile({
  to, icon: Icon, label, value, hint, tone = "default",
}: { to: string; icon: any; label: string; value: number; hint?: string; tone?: "default"|"primary"|"success"|"warning"|"destructive" }) {
  const toneCls = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];
  return (
    <Link to={to} className="surface-card rounded-xl p-4 hover:border-primary/50 transition-colors min-h-[112px] flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <Icon className={cn("h-4 w-4", toneCls)} />
      </div>
      <div>
        <p className={cn("font-display text-3xl font-bold", toneCls)}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-64" />
    </div>
  );
}