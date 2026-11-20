import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalToday } from "@/hooks/useLocalToday";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { loadFleetAlerts } from "@/lib/alerts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const types: Record<string, string> = {
  document: "Documentos", maintenance: "Manutenções", fine: "Multas",
  policy: "Apólices vencidas", uninsured: "Veículos sem seguro", cnh: "CNH", trip: "Viagens",
};

export default function Alerts() {
  const { currentCompanyId } = useAuth();
  const today = useLocalToday();
  const [type, setType] = useState("all");
  const { data: alerts = [], isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["fleet-alerts", currentCompanyId, today],
    enabled: !!currentCompanyId,
    queryFn: () => {
      if (!currentCompanyId) throw new Error("company required");
      return loadFleetAlerts(currentCompanyId, today);
    },
  });
  useAutoRefresh(refetch, ["vehicles", "drivers", "documents", "detran_calendar", "companies", "maintenance_records", "maintenance_schedules", "maintenance_work_orders", "traffic_fines", "trips", "insurance_policies", "insurance_policy_vehicles", "vehicle_policy_manual_matches"], { enabled: !!currentCompanyId });
  const filtered = alerts.filter((a) => type === "all" || a.kind === type);
  if (!currentCompanyId) return <p className="text-muted-foreground">Selecione uma empresa para visualizar os alertas.</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Alertas</h1>
          <p className="text-sm text-muted-foreground">{alerts.length} alerta(s) · {alerts.filter((a) => a.severity === "high").length} urgente(s)</p>
        </div>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Tipo de alerta"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(types).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} resultado(s)</span>
      </div>
      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
      ) : isError ? (
        <div className="py-12 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-muted-foreground">Não foi possível carregar os alertas.</p>
          <Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-3" />
          <p className="font-display font-semibold">Nenhum alerta{type === "all" ? "" : " neste tipo"}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((alert) => (
            <li key={alert.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-4">
              <AlertTriangle className={`h-5 w-5 shrink-0 ${alert.severity === "high" ? "text-destructive" : "text-warning"}`} />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{types[alert.kind] ?? alert.kind}</Badge>
                  <Badge variant="outline" className={alert.severity === "high" ? "text-destructive border-destructive/30" : "text-warning border-warning/30"}>{alert.severity === "high" ? "Urgente" : "A vencer"}</Badge>
                </div>
                <p className="font-medium break-words">{alert.title}</p>
                <p className="text-xs text-muted-foreground break-words">{alert.subtitle}{alert.date ? ` · ${new Date(alert.date.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}</p>
              </div>
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link to={alert.link}>Ver origem <ArrowRight className="h-4 w-4 ml-2" /></Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}