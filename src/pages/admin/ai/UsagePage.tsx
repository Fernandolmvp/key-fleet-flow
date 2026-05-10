import { useEffect, useMemo, useState } from "react";
import { Loader2, BarChart3, DollarSign, Activity, Zap, TrendingUp } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  fmtBRL, fmtNum, featureLabel, listModels, listProviders,
  type Model, type Provider,
} from "@/lib/ai-admin";
import AIAlertsBanner from "./AIAlertsBanner";

type Log = {
  id: string;
  company_id: string;
  user_id: string | null;
  feature: string;
  model: string | null;
  provider_id: string | null;
  model_id_used: string | null;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  source: string;
  success: boolean;
  was_fallback: boolean;
  response_time_ms: number | null;
  error_message: string | null;
  created_at: string;
};

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

export default function UsagePage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [days, setDays] = useState("30");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [featureFilter, setFeatureFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");

  // monthly revenue
  const [monthRevenue, setMonthRevenue] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - Number(days) * 24 * 3600 * 1000).toISOString();
      const [{ data: lo, error: le }, p, m, { data: comps }] = await Promise.all([
        supabase
          .from("ai_usage_logs")
          .select("*")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(2000),
        listProviders(),
        listModels(),
        supabase.from("companies").select("id, name").order("name"),
      ]);
      if (le) throw le;
      setLogs((lo ?? []) as any);
      setProviders(p);
      setModels(m);
      setCompanies((comps ?? []) as any);

      // receita do mês corrente: subscription_payments + ai_token_purchases (status pago)
      const startOfMonth = new Date();
      startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
      const [{ data: subs }, { data: tk }] = await Promise.all([
        supabase.from("subscription_payments").select("amount, paid_at").gte("paid_at", startOfMonth.toISOString().slice(0, 10)),
        supabase.from("ai_token_purchases").select("amount_paid, created_at, status").eq("status", "paid").gte("created_at", startOfMonth.toISOString()),
      ]);
      const r1 = (subs ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const r2 = (tk ?? []).reduce((s: number, r: any) => s + Number(r.amount_paid || 0), 0);
      setMonthRevenue(r1 + r2);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar uso");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [days]);

  const providerById = useMemo(() => Object.fromEntries(providers.map((p) => [p.id, p])), [providers]);
  const modelById = useMemo(() => Object.fromEntries(models.map((m) => [m.id, m])), [models]);
  const companyById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c.name])), [companies]);

  // KPIs
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayCalls = logs.filter((l) => new Date(l.created_at) >= today).length;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthLogs = logs.filter((l) => new Date(l.created_at) >= monthStart);
  const monthCalls = monthLogs.length;
  const monthTokens = monthLogs.reduce((s, l) => s + (l.tokens_total || 0), 0);

  const monthCost = monthLogs.reduce((s, l) => {
    const m = l.model_id_used ? modelById[l.model_id_used] : null;
    if (!m) return s;
    const inC = (Number(m.input_cost_per_1k_tokens) || 0) * (l.tokens_input || 0) / 1000;
    const outC = (Number(m.output_cost_per_1k_tokens) || 0) * (l.tokens_output || 0) / 1000;
    return s + inC + outC;
  }, 0);

  // charts
  const byProvider = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach((l) => {
      const key = l.provider_id ? (providerById[l.provider_id]?.name ?? "—") : "Não rastreado";
      map[key] = (map[key] ?? 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [logs, providerById]);

  const byDay = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach((l) => {
      const d = new Date(l.created_at).toISOString().slice(0, 10);
      map[d] = (map[d] ?? 0) + 1;
    });
    const arr = Object.entries(map).map(([day, calls]) => ({ day: day.slice(5), calls }));
    return arr.sort((a, b) => a.day.localeCompare(b.day));
  }, [logs]);

  const byFeature = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach((l) => { map[l.feature] = (map[l.feature] ?? 0) + (l.tokens_total || 0); });
    return Object.entries(map)
      .map(([feature, tokens]) => ({ feature: featureLabel(feature), tokens }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10);
  }, [logs]);

  const fallbackByDay = useMemo(() => {
    const map: Record<string, { total: number; fb: number }> = {};
    logs.forEach((l) => {
      const d = new Date(l.created_at).toISOString().slice(0, 10);
      const r = (map[d] ??= { total: 0, fb: 0 });
      r.total += 1; if (l.was_fallback) r.fb += 1;
    });
    return Object.entries(map)
      .map(([day, v]) => ({ day: day.slice(5), pct: v.total ? (v.fb / v.total) * 100 : 0 }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [logs]);

  // tabela filtrada
  const filtered = logs.filter((l) => {
    if (companyFilter !== "all" && l.company_id !== companyFilter) return false;
    if (providerFilter !== "all" && l.provider_id !== providerFilter) return false;
    if (featureFilter !== "all" && l.feature !== featureFilter) return false;
    if (statusFilter === "ok" && !l.success) return false;
    if (statusFilter === "err" && l.success) return false;
    if (statusFilter === "fb" && !l.was_fallback) return false;
    if (q.trim()) {
      const cn = (companyById[l.company_id] ?? "").toLowerCase();
      if (!cn.includes(q.toLowerCase()) && !l.feature.toLowerCase().includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const featureOptions = Array.from(new Set(logs.map((l) => l.feature)));

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Estatísticas e Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão consolidada de uso, custo e fallback dos provedores de IA.
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AIAlertsBanner />

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Activity} label="Chamadas hoje" value={fmtNum(todayCalls)} />
        <Kpi icon={Activity} label="Chamadas mês" value={fmtNum(monthCalls)} />
        <Kpi icon={Zap} label="Tokens mês" value={fmtNum(monthTokens)} />
        <Kpi icon={DollarSign} label="Custo estimado mês" value={fmtBRL(monthCost)} accent="text-warning" />
        <Kpi icon={DollarSign} label="Receita mês" value={fmtBRL(monthRevenue)} accent="text-success" />
        <Kpi icon={TrendingUp} label="Margem" value={fmtBRL(monthRevenue - monthCost)} accent={monthRevenue - monthCost >= 0 ? "text-success" : "text-destructive"} />
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Uso por provedor">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={byProvider} dataKey="value" nameKey="name" outerRadius={80} label>
                    {byProvider.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Chamadas por dia">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="calls" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Tokens por feature (top 10)">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byFeature} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis type="category" dataKey="feature" stroke="hsl(var(--muted-foreground))" fontSize={10} width={120} />
                  <Tooltip />
                  <Bar dataKey="tokens" fill="hsl(var(--success))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Uso de fallback (% / dia)">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={fallbackByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Tooltip />
                  <Line type="monotone" dataKey="pct" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Filtros */}
          <div className="surface-card rounded-xl p-4 grid gap-3 md:grid-cols-5">
            <Input placeholder="Buscar empresa ou feature" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas empresas</SelectItem>
                {companies.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos provedores</SelectItem>
                {providers.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={featureFilter} onValueChange={setFeatureFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas features</SelectItem>
                {featureOptions.map((f) => (<SelectItem key={f} value={f}>{featureLabel(f)}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="ok">Sucesso</SelectItem>
                <SelectItem value="err">Erro</SelectItem>
                <SelectItem value="fb">Fallback</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabela */}
          <div className="surface-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Data</th>
                    <th className="text-left px-3 py-2">Empresa</th>
                    <th className="text-left px-3 py-2">Feature</th>
                    <th className="text-left px-3 py-2">Provedor</th>
                    <th className="text-left px-3 py-2">Modelo</th>
                    <th className="text-right px-3 py-2">Tokens</th>
                    <th className="text-center px-3 py-2">Fallback</th>
                    <th className="text-center px-3 py-2">Status</th>
                    <th className="text-right px-3 py-2">ms</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((l) => (
                    <tr key={l.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-3 py-1.5 whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-1.5">{companyById[l.company_id] ?? "—"}</td>
                      <td className="px-3 py-1.5">{featureLabel(l.feature)}</td>
                      <td className="px-3 py-1.5">{l.provider_id ? providerById[l.provider_id]?.name : "—"}</td>
                      <td className="px-3 py-1.5 font-mono">{l.model ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtNum(l.tokens_total)}</td>
                      <td className="px-3 py-1.5 text-center">
                        {l.was_fallback ? <Badge variant="outline" className="text-warning border-warning/40">FB</Badge> : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {l.success ? (
                          <Badge variant="outline" className="text-success border-success/40">OK</Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive/40" title={l.error_message ?? undefined}>ERR</Badge>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">{l.response_time_ms ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 500 && (
                <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
                  Mostrando primeiras 500 de {filtered.length} linhas. Refine os filtros para ver mais.
                </div>
              )}
              {filtered.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">Nenhum registro encontrado.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent = "" }: any) {
  return (
    <div className="surface-card rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`mt-2 text-xl font-bold font-display ${accent}`}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card rounded-xl p-4">
      <h3 className="font-display font-semibold text-sm mb-3">{title}</h3>
      {children}
    </div>
  );
}