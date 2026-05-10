import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatFeature, formatNumber, formatSource, FEATURE_LABELS } from "@/lib/ai-credits";

const PAGE_SIZE = 20;

type Period = "7d" | "30d" | "month" | "prev_month" | "all";

interface Row {
  id: string;
  created_at: string;
  feature: string;
  user_id: string | null;
  tokens_total: number;
  source: string;
  success: boolean;
  error_message: string | null;
}

interface Member { id: string; full_name: string | null; }

function periodRange(p: Period): { from?: string; to?: string } {
  const now = new Date();
  if (p === "all") return {};
  if (p === "7d") return { from: new Date(now.getTime() - 7 * 86400000).toISOString() };
  if (p === "30d") return { from: new Date(now.getTime() - 30 * 86400000).toISOString() };
  if (p === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() };
  }
  if (p === "prev_month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      to: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    };
  }
  return {};
}

export default function UsageHistory({ companyId, members }: { companyId: string; members: Member[] }) {
  const [period, setPeriod] = useState<Period>("30d");
  const [feature, setFeature] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ai_usage_logs")
        .select("feature")
        .eq("company_id", companyId)
        .limit(500);
      const set = new Set<string>((data ?? []).map((r: any) => r.feature).filter(Boolean));
      setFeatures(Array.from(set).sort());
    })();
  }, [companyId]);

  useEffect(() => { setPage(0); }, [period, feature, userId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { from, to } = periodRange(period);
      let q = supabase
        .from("ai_usage_logs")
        .select("id,created_at,feature,user_id,tokens_total,source,success,error_message", { count: "exact" })
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lt("created_at", to);
      if (feature !== "all") q = q.eq("feature", feature);
      if (userId !== "all") q = q.eq("user_id", userId);
      const { data, count } = await q;
      if (!alive) return;
      setRows((data as any) ?? []);
      setCount(count ?? 0);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [companyId, period, feature, userId, page]);

  const memberName = useMemo(() => {
    const m = new Map(members.map(x => [x.id, x.full_name || "—"]));
    return (uid: string | null) => uid ? (m.get(uid) ?? "—") : "Sistema";
  }, [members]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="surface-card rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-display font-semibold">Histórico de uso</h3>
        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="month">Mês atual</SelectItem>
              <SelectItem value="prev_month">Mês anterior</SelectItem>
              <SelectItem value="all">Todo período</SelectItem>
            </SelectContent>
          </Select>
          <Select value={feature} onValueChange={setFeature}>
            <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Funcionalidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas funcionalidades</SelectItem>
              {features.map(f => (
                <SelectItem key={f} value={f}>{FEATURE_LABELS[f] ?? f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Usuário" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos usuários</SelectItem>
              {members.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.full_name || m.id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Sparkles className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
          <p className="text-sm text-muted-foreground">Nenhum uso registrado no período.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">Data</th>
                  <th className="py-2 pr-3 font-medium">Funcionalidade</th>
                  <th className="py-2 pr-3 font-medium">Usuário</th>
                  <th className="py-2 pr-3 font-medium text-right">Tokens</th>
                  <th className="py-2 pr-3 font-medium">Origem</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2 pr-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </td>
                    <td className="py-2 pr-3">{formatFeature(r.feature)}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{memberName(r.user_id)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{formatNumber(r.tokens_total)}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className="text-[10px]">{formatSource(r.source)}</Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {r.success ? (
                        <Badge variant="outline" className="text-[10px] border-success/40 text-success">Sucesso</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive" title={r.error_message ?? ""}>Erro</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {count} registro{count !== 1 ? "s" : ""} · página {page + 1} de {totalPages}
            </p>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}