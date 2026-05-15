import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TRIP_STATUS, formatBRL, tripBalance } from "@/lib/trips";
import { Loader2, MapPin, ArrowLeft, ChevronRight } from "lucide-react";

export default function MotoristaViagens() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) return;
      // get driver record(s) for this user
      const { data: drvs } = await supabase.from("drivers").select("id").eq("user_id", user.id);
      const ids = (drvs ?? []).map((d) => d.id);
      if (ids.length === 0) { setItems([]); setLoading(false); return; }
      const { data } = await supabase.from("trips").select("*").in("driver_id", ids).order("scheduled_start_date", { ascending: false });
      setItems(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/motorista" className="p-1.5 rounded hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-semibold">Minhas viagens</h1>
      </div>
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="surface-card rounded-xl p-8 text-center text-muted-foreground text-sm">
            Você ainda não tem viagens programadas.
          </div>
        ) : items.map((t) => {
          const status = TRIP_STATUS.find((s) => s.value === t.status);
          const bal = tripBalance(t);
          return (
            <Link key={t.id} to={`/motorista/viagens/${t.id}`} className="surface-card rounded-xl p-4 flex items-center gap-3 hover:border-primary/50 transition-all">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-primary">{t.trip_code}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${status?.color ?? ""}`}>{status?.label}</span>
                </div>
                <div className="font-semibold truncate">{t.title}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" /> {t.origin_city || "?"} → {t.destination_city || "?"}
                </div>
                {bal > 0 && (
                  <div className="text-xs text-success mt-1">Saldo: {formatBRL(bal)}</div>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}