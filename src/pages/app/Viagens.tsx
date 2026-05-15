import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, MapPin, Calendar, Wallet, Loader2 } from "lucide-react";
import { TRIP_STATUS, TRIP_TYPES, formatBRL, labelOf } from "@/lib/trips";
import TripDialog from "@/components/trips/TripDialog";
import TripDetailDrawer from "@/components/trips/TripDetailDrawer";
import { toast } from "sonner";

export default function Viagens() {
  const { currentCompanyId } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [driverF, setDriverF] = useState("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const load = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    const [tripsRes, driversRes, vehiclesRes] = await Promise.all([
      supabase.from("trips").select("*").eq("company_id", currentCompanyId).order("created_at", { ascending: false }),
      supabase.from("drivers").select("id,full_name").eq("company_id", currentCompanyId).order("full_name"),
      supabase.from("vehicles").select("id,plate,model").eq("company_id", currentCompanyId).order("plate"),
    ]);
    if (tripsRes.error) toast.error(tripsRes.error.message);
    setItems(tripsRes.data ?? []);
    setDrivers(driversRes.data ?? []);
    setVehicles(vehiclesRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentCompanyId]);

  const driverMap = useMemo(() => Object.fromEntries(drivers.map((d) => [d.id, d.full_name])), [drivers]);
  const vehicleMap = useMemo(() => Object.fromEntries(vehicles.map((v) => [v.id, `${v.plate}${v.model ? " · " + v.model : ""}`])), [vehicles]);

  const filtered = items.filter((t) => {
    if (statusF !== "all" && t.status !== statusF) return false;
    if (driverF !== "all" && t.driver_id !== driverF) return false;
    if (q) {
      const hay = `${t.trip_code ?? ""} ${t.title ?? ""} ${t.destination_city ?? ""} ${t.destination_state ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const kpis = useMemo(() => {
    const inProgress = items.filter((t) => t.status === "em_andamento").length;
    const pending = items.filter((t) => ["aguardando_acerto", "acerto_pendente"].includes(t.status)).length;
    const totalSpent = items.reduce((s, t) => s + Number(t.total_spent_cash ?? 0) + Number(t.total_spent_card ?? 0) + Number(t.total_spent_other ?? 0) + Number(t.total_reimbursable ?? 0), 0);
    return { inProgress, pending, totalSpent };
  }, [items]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Viagens Programadas</h1>
          <p className="text-sm text-muted-foreground">Programe viagens, libere adiantamento, acompanhe despesas e faça o acerto final.</p>
        </div>
        <Button onClick={() => setOpenCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova viagem
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Em andamento" value={kpis.inProgress} icon={<MapPin className="h-4 w-4" />} />
        <Kpi label="Aguardando acerto" value={kpis.pending} icon={<Calendar className="h-4 w-4" />} />
        <Kpi label="Total movimentado" value={formatBRL(kpis.totalSpent)} icon={<Wallet className="h-4 w-4" />} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, destino, título..." className="pl-9" />
        </div>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {TRIP_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={driverF} onValueChange={setDriverF}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Motorista" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos motoristas</SelectItem>
            {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="surface-card rounded-xl p-10 text-center text-muted-foreground">
          Nenhuma viagem encontrada. Clique em "Nova viagem" para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const status = TRIP_STATUS.find((s) => s.value === t.status);
            const totalSpent = Number(t.total_spent_cash ?? 0) + Number(t.total_spent_card ?? 0) + Number(t.total_spent_other ?? 0) + Number(t.total_reimbursable ?? 0);
            const pctBudget = t.budget_total ? Math.round((totalSpent / Number(t.budget_total)) * 100) : null;
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className="surface-card text-left rounded-xl p-4 hover:border-primary/50 transition-all space-y-3"
              >
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
                  <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {new Date(t.scheduled_start_date).toLocaleDateString("pt-BR")}{t.scheduled_end_date ? ` → ${new Date(t.scheduled_end_date).toLocaleDateString("pt-BR")}` : ""}</div>
                </div>
                <div className="flex items-baseline justify-between pt-2 border-t border-border">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Gasto</div>
                    <div className="font-mono font-semibold">{formatBRL(totalSpent)}</div>
                  </div>
                  {t.budget_total && (
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-muted-foreground tracking-wider">de {formatBRL(Number(t.budget_total))}</div>
                      <div className={`text-xs font-mono ${pctBudget && pctBudget > 100 ? "text-destructive" : "text-muted-foreground"}`}>{pctBudget}%</div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <TripDialog open={openCreate} onOpenChange={setOpenCreate} drivers={drivers} vehicles={vehicles} onSaved={load} />
      {selected && (
        <TripDetailDrawer trip={selected} drivers={drivers} vehicles={vehicles} onClose={() => setSelected(null)} onChanged={load} />
      )}
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: any; icon: React.ReactNode }) {
  return (
    <div className="surface-card rounded-xl p-4 flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-xl font-semibold font-mono">{value}</div>
      </div>
    </div>
  );
}