import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Wrench, AlertCircle, Loader2, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import MaintenanceRequestWizard from "@/components/motorista/MaintenanceRequestWizard";
import MotoristaBottomNav from "@/components/motorista/MotoristaBottomNav";
import NotificationBell from "@/components/motorista/NotificationBell";
import { PROBLEM_CATEGORIES, SEVERITY_LEVELS, MR_STATUS } from "@/lib/maintenance-requests";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MotoristaManutencao() {
  const { user, currentCompanyId } = useAuth();
  const [vehicle, setVehicle] = useState<any | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [pickedVehicleId, setPickedVehicleId] = useState<string>("");
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  const load = async () => {
    if (!user || !currentCompanyId) return;
    const { data: drv } = await supabase.from("drivers").select("id, assigned_vehicle_id").eq("user_id", user.id).eq("company_id", currentCompanyId).maybeSingle();
    if (drv?.assigned_vehicle_id) {
      const { data: v } = await supabase.from("vehicles").select("*").eq("id", drv.assigned_vehicle_id).maybeSingle();
      setVehicle(v);
    }
    const { data: vs } = await supabase
      .from("vehicles")
      .select("id, plate, brand, model")
      .eq("company_id", currentCompanyId)
      .in("status", ["ativo", "manutencao"])
      .order("plate");
    setVehicles(vs ?? []);
    const { data } = await supabase
      .from("maintenance_requests")
      .select("*, vehicles(plate, brand, model)")
      .eq("driver_user_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(50);
    setRequests(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user, currentCompanyId]);

  const activeVehicle =
    vehicle ?? vehicles.find((v) => v.id === pickedVehicleId) ?? null;

  return (
    <div className="min-h-screen bg-background pb-20 max-w-md mx-auto">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/motorista" className="p-1.5 -ml-1.5 rounded hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-semibold flex-1">Manutenção</h1>
        <NotificationBell />
      </header>

      <div className="p-4 space-y-4">
        {!vehicle && vehicles.length > 0 && (
          <div className="surface-card rounded-xl p-3 space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" /> Selecione o veículo
            </div>
            <Select value={pickedVehicleId} onValueChange={setPickedVehicleId}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Escolher veículo..." /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <button
          onClick={() => setShowWizard(true)}
          disabled={!activeVehicle}
          className="w-full bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-2xl p-5 flex items-center gap-4 shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          <div className="h-14 w-14 rounded-xl bg-white/20 grid place-items-center">
            <Wrench className="h-7 w-7" />
          </div>
          <div className="text-left flex-1">
            <div className="text-lg font-bold">Reportar problema</div>
            <div className="text-sm text-white/80">{activeVehicle ? `${activeVehicle.plate} — ${activeVehicle.brand} ${activeVehicle.model}` : "Selecione um veículo acima"}</div>
          </div>
        </button>

        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">Minhas solicitações</div>
          {loading ? (
            <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : requests.length === 0 ? (
            <div className="surface-card rounded-xl p-8 text-center text-muted-foreground text-sm">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhuma solicitação ainda
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => {
                const cat = PROBLEM_CATEGORIES.find((c) => c.value === r.problem_category);
                const sev = SEVERITY_LEVELS.find((s) => s.value === r.severity_self_assessment);
                const st = MR_STATUS[r.status] ?? { label: r.status, color: "bg-muted" };
                return (
                  <div key={r.id} className="surface-card rounded-xl p-3">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{cat?.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm">{cat?.label}</span>
                          {sev && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sev.color}`}>{sev.label}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{r.problem_description}</div>
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(r.requested_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            {r.photos_urls?.length > 0 && ` · 📸 ${r.photos_urls.length}`}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${st.color}`}>{st.label}</span>
                        </div>
                        {r.rejection_reason && <div className="text-xs text-destructive mt-2 p-2 bg-destructive/10 rounded">Motivo: {r.rejection_reason}</div>}
                        {r.scheduled_date && <div className="text-xs text-cyan-400 mt-2">Agendada para {format(new Date(r.scheduled_date), "dd/MM/yyyy")}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showWizard && activeVehicle && (
        <MaintenanceRequestWizard
          vehicleId={activeVehicle.id}
          vehicleLabel={`${activeVehicle.plate} — ${activeVehicle.brand} ${activeVehicle.model}`}
          onClose={() => setShowWizard(false)}
          onCreated={load}
        />
      )}

      <MotoristaBottomNav />
    </div>
  );
}