import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useWorkshopAuth } from "@/contexts/WorkshopAuthContext";
import { toast } from "sonner";

type Row = {
  id: string;
  os_number: string;
  title: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_duration_hours: number | null;
  execution_status: string;
  vehicle: { plate: string; brand: string; model: string } | null;
  company: { name: string } | null;
};

export default function OficinaAgenda() {
  const { authedFetch } = useWorkshopAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const res = await authedFetch<{ rows: Row[] }>(`workshop-list?from=${today}`);
        setRows(res.rows.filter(r => r.scheduled_date && r.execution_status !== "completed" && r.execution_status !== "cancelled"));
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [authedFetch]);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const k = r.scheduled_date!;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  if (loading) return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (grouped.length === 0) return <div className="surface-card rounded-xl p-8 text-center text-muted-foreground">Nenhum agendamento próximo</div>;

  return (
    <div className="space-y-4">
      {grouped.map(([date, items]) => (
        <div key={date} className="surface-card rounded-xl p-4">
          <div className="text-sm font-display font-bold mb-3">
            {new Date(date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </div>
          <div className="space-y-2">
            {items.sort((a, b) => (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? "")).map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                <div className="font-mono text-sm w-14 text-primary">{r.scheduled_time?.slice(0, 5) ?? "--:--"}</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{r.os_number} · {r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.vehicle?.plate} · {r.vehicle?.brand} {r.vehicle?.model} · {r.company?.name}
                  </div>
                </div>
                <Badge variant="outline">{r.estimated_duration_hours ?? "—"}h</Badge>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}