import { useEffect, useMemo, useState } from "react";
import { Loader2, ClipboardList, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useWorkshopAuth } from "@/contexts/WorkshopAuthContext";
import { toast } from "sonner";

type Row = {
  id: string;
  os_number: string;
  execution_status: string;
  quote_status: string;
  scheduled_date: string | null;
  actual_amount_total: number | null;
  vehicle: { plate: string; brand: string; model: string } | null;
};

function fmt(n: number) { return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(n); }

export default function OficinaDashboard() {
  const { authedFetch } = useWorkshopAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await authedFetch<{ rows: Row[] }>("workshop-list");
        setRows(res.rows);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [authedFetch]);

  const stats = useMemo(() => {
    const aguardando = rows.filter(r => r.quote_status === "pending" || r.quote_status === "draft").length;
    const aprovadas = rows.filter(r => r.quote_status === "approved" && r.execution_status === "scheduled").length;
    const emExecucao = rows.filter(r => r.execution_status === "in_progress").length;
    const concluidas = rows.filter(r => r.execution_status === "completed").length;
    const faturamento = rows
      .filter(r => r.execution_status === "completed")
      .reduce((s, r) => s + Number(r.actual_amount_total ?? 0), 0);
    return { aguardando, aprovadas, emExecucao, concluidas, faturamento };
  }, [rows]);

  if (loading) return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const cards = [
    { label: "Aguardando orçamento", value: stats.aguardando, icon: AlertCircle, color: "text-amber-400" },
    { label: "Agendadas", value: stats.aprovadas, icon: ClipboardList, color: "text-blue-400" },
    { label: "Em execução", value: stats.emExecucao, icon: Clock, color: "text-primary" },
    { label: "Concluídas", value: stats.concluidas, icon: CheckCircle2, color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="surface-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <div className="text-2xl font-bold mt-2">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="surface-card rounded-xl p-4">
        <div className="text-xs text-muted-foreground">Faturamento (concluídas)</div>
        <div className="text-3xl font-display font-bold mt-1">R$ {fmt(stats.faturamento)}</div>
      </div>
    </div>
  );
}