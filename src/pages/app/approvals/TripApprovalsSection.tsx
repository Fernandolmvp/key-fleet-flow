import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, MapPin, Calendar, Wallet, Route as RouteIcon } from "lucide-react";
import { TRIP_STATUS, formatBRL } from "@/lib/trips";
import TripDetailDrawer from "@/components/trips/TripDetailDrawer";

export default function TripApprovalsSection() {
  const { currentCompanyId } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  const load = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    const [tr, dr, vh] = await Promise.all([
      supabase
        .from("trips")
        .select("*")
        .eq("company_id", currentCompanyId)
        .in("status", ["aguardando_acerto", "acerto_pendente"])
        .order("created_at", { ascending: false }),
      supabase.from("drivers").select("id,full_name").eq("company_id", currentCompanyId),
      supabase.from("vehicles").select("id,plate,model").eq("company_id", currentCompanyId),
    ]);
    setItems(tr.data ?? []);
    setDrivers(dr.data ?? []);
    setVehicles(vh.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentCompanyId]);

  const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d.full_name]));
  const vehicleMap = Object.fromEntries(vehicles.map((v) => [v.id, `${v.plate}${v.model ? " · " + v.model : ""}`]));

  if (loading) {
    return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="surface-card rounded-xl p-10 text-center">
        <RouteIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma viagem aguardando aprovação de acerto.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map((t) => {
          const status = TRIP_STATUS.find((s) => s.value === t.status);
          const totalSpent = Number(t.total_spent_cash ?? 0) + Number(t.total_spent_card ?? 0) + Number(t.total_spent_other ?? 0) + Number(t.total_reimbursable ?? 0);
          return (
            <button key={t.id} onClick={() => setSelected(t)} className="surface-card text-left rounded-xl p-4 hover:border-primary/50 transition-all space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-mono text-primary">{t.trip_code}</div>
                  <div className="font-semibold truncate">{t.title}</div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${status?.color ?? ""}`}>{status?.label}</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {t.origin_city || "?"} → {t.destination_city || "?"}</div>
                <div>👤 {driverMap[t.driver_id] ?? "—"} · 🚛 {vehicleMap[t.vehicle_id] ?? "—"}</div>
                <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {new Date(t.scheduled_start_date).toLocaleDateString("pt-BR")}</div>
              </div>
              <div className="flex items-baseline justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Gasto</div>
                <div className="font-mono font-semibold">{formatBRL(totalSpent)}</div>
              </div>
            </button>
          );
        })}
      </div>
      {selected && (
        <TripDetailDrawer trip={selected} drivers={drivers} vehicles={vehicles} onClose={() => setSelected(null)} onChanged={load} />
      )}
    </>
  );
}