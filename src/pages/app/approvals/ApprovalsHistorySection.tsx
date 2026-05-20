import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Fuel, Wrench, Route as RouteIcon, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type HistRow = {
  id: string;
  type: "abastecimento" | "manutencao" | "viagem";
  status: string;
  title: string;
  subtitle: string;
  date: string;
};

const TYPE_META: Record<string, { icon: any; label: string; color: string }> = {
  abastecimento: { icon: Fuel, label: "Abastecimento", color: "text-primary" },
  manutencao: { icon: Wrench, label: "Manutenção", color: "text-warning" },
  viagem: { icon: RouteIcon, label: "Viagem", color: "text-success" },
};

export default function ApprovalsHistorySection() {
  const { currentCompanyId } = useAuth();
  const [rows, setRows] = useState<HistRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentCompanyId) return;
    (async () => {
      setLoading(true);
      const [fuel, mr, trips] = await Promise.all([
        supabase.from("fuel_authorizations").select("id,status,station_name,requested_at,approved_at,vehicle_id,estimated_value").eq("company_id", currentCompanyId).in("status", ["aprovada", "recusada", "utilizada", "expirada", "cancelada"]).order("requested_at", { ascending: false }).limit(50),
        supabase.from("maintenance_requests").select("id,status,problem_category,reviewed_at,requested_at,problem_description").eq("company_id", currentCompanyId).in("status", ["agendada", "aprovada_agendamento", "rejeitada", "cancelada", "concluida"]).order("requested_at", { ascending: false }).limit(50),
        supabase.from("trips").select("id,status,trip_code,title,destination_city,created_at,updated_at").eq("company_id", currentCompanyId).in("status", ["finalizada", "cancelada"]).order("updated_at", { ascending: false }).limit(50),
      ]);

      const all: HistRow[] = [];
      for (const f of fuel.data ?? []) {
        all.push({
          id: `f-${f.id}`,
          type: "abastecimento",
          status: f.status,
          title: f.station_name ?? "Abastecimento",
          subtitle: f.estimated_value ? `R$ ${Number(f.estimated_value).toFixed(2)}` : "—",
          date: f.approved_at ?? f.requested_at,
        });
      }
      for (const m of mr.data ?? []) {
        all.push({
          id: `m-${m.id}`,
          type: "manutencao",
          status: m.status,
          title: m.problem_category ?? "Manutenção",
          subtitle: (m.problem_description ?? "").slice(0, 80),
          date: m.reviewed_at ?? m.requested_at,
        });
      }
      for (const t of trips.data ?? []) {
        all.push({
          id: `t-${t.id}`,
          type: "viagem",
          status: t.status,
          title: `${t.trip_code} · ${t.title ?? ""}`,
          subtitle: t.destination_city ?? "",
          date: t.updated_at ?? t.created_at,
        });
      }
      all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRows(all.slice(0, 100));
      setLoading(false);
    })();
  }, [currentCompanyId]);

  if (loading) return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (rows.length === 0) return <div className="surface-card rounded-xl p-10 text-center text-sm text-muted-foreground">Nenhuma decisão registrada ainda.</div>;

  return (
    <div className="surface-card rounded-xl divide-y divide-border">
      {rows.map((r) => {
        const meta = TYPE_META[r.type];
        const Icon = meta.icon;
        const positive = ["aprovada", "utilizada", "agendada", "aprovada_agendamento", "concluida", "finalizada"].includes(r.status);
        return (
          <div key={r.id} className="flex items-center gap-3 p-3">
            <div className={`h-9 w-9 rounded-lg bg-muted grid place-items-center ${meta.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{r.title}</div>
              <div className="text-xs text-muted-foreground truncate">{meta.label} · {r.subtitle}</div>
            </div>
            <div className="text-right">
              <div className={`text-[11px] inline-flex items-center gap-1 ${positive ? "text-success" : "text-destructive"}`}>
                {positive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {r.status}
              </div>
              <div className="text-[10px] text-muted-foreground">{format(new Date(r.date), "dd/MM HH:mm", { locale: ptBR })}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}