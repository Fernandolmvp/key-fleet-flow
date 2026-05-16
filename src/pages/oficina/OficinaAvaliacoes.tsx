import { useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { useWorkshopAuth } from "@/contexts/WorkshopAuthContext";
import { toast } from "sonner";

export default function OficinaAvaliacoes() {
  const { authedFetch } = useWorkshopAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r: { rows: any[] } = await authedFetch("workshop-list?status=concluido");
        setRows(r.rows.filter((x) => x.rating != null));
      } catch (e: any) { toast.error(e.message); }
      setLoading(false);
    })();
  }, []);

  const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="surface-card rounded-xl p-4">
        <div className="text-xs text-muted-foreground">Média geral</div>
        <div className="flex items-center gap-3">
          <div className="text-3xl font-bold">{avg.toFixed(1)}</div>
          <div className="flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-5 w-5 ${n <= Math.round(avg) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />)}</div>
          <div className="text-xs text-muted-foreground">{rows.length} avaliação(ões)</div>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="surface-card rounded-xl p-8 text-center text-muted-foreground">Sem avaliações ainda</div>
      ) : rows.map((r) => (
        <div key={r.id} className="surface-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="font-mono text-sm text-primary">{r.os_number}</div>
            <div className="flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />)}</div>
          </div>
          <div className="text-xs text-muted-foreground">{r.company?.name} · {r.vehicle?.plate}</div>
          {r.rating_comment && <div className="text-sm mt-2">"{r.rating_comment}"</div>}
        </div>
      ))}
    </div>
  );
}