import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, ShieldCheck, Clock, Truck, LogOut, Receipt, CheckCircle2, UserCheck } from "lucide-react";
import { toast } from "sonner";

interface Auth {
  id: string; status: string; authorization_code: string | null;
  vehicle_id: string; estimated_liters: number | null; estimated_value: number | null;
  fuel_type: string | null; station_name: string | null;
  requested_at: string; approved_at: string | null; expires_at: string | null;
}

const STATUS_TONE: Record<string, string> = {
  pendente: "bg-warning/20 text-warning border-warning/30",
  aprovada: "bg-success/20 text-success border-success/30",
  recusada: "bg-destructive/20 text-destructive border-destructive/30",
  utilizada: "bg-primary/20 text-primary border-primary/30",
  expirada: "bg-muted text-muted-foreground border-border",
  cancelada: "bg-muted text-muted-foreground border-border",
};

export default function Colaborador() {
  const { currentCompanyId, user, signOut } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [auths, setAuths] = useState<Auth[]>([]);
  const [driver, setDriver] = useState<any | null>(null);
  const [managerName, setManagerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [vehicleId, setVehicleId] = useState("");
  const [estLiters, setEstLiters] = useState("");
  const [estValue, setEstValue] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [station, setStation] = useState("");

  const load = async () => {
    if (!currentCompanyId || !user) return;
    setLoading(true);
    const [{ data: v }, { data: a }, { data: drv }] = await Promise.all([
      supabase.from("vehicles").select("id,plate,brand,model,fuel_type,current_km").eq("company_id", currentCompanyId).order("plate"),
      supabase.from("fuel_authorizations").select("*").eq("company_id", currentCompanyId).eq("requested_by", user.id).order("requested_at", { ascending: false }).limit(20),
      supabase.from("drivers").select("id,full_name,auto_fuel_authorized,manager_user_id").eq("company_id", currentCompanyId).eq("user_id", user.id).maybeSingle(),
    ]);
    setVehicles(v ?? []);
    setAuths((a ?? []) as Auth[]);
    setDriver(drv ?? null);

    if (drv?.manager_user_id) {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", drv.manager_user_id).maybeSingle();
      setManagerName(prof?.full_name ?? null);
    } else {
      setManagerName(null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentCompanyId, user?.id]);

  const submit = async () => {
    if (!currentCompanyId || !user) return;
    if (!vehicleId) return toast.error("Selecione o veículo");
    setBusy(true);
    const { error } = await supabase.from("fuel_authorizations").insert({
      company_id: currentCompanyId,
      vehicle_id: vehicleId,
      requested_by: user.id,
      driver_id: driver?.id ?? null,
      estimated_liters: estLiters ? Number(estLiters) : null,
      estimated_value: estValue ? Number(estValue) : null,
      fuel_type: fuelType || null,
      station_name: station || null,
      status: "pendente",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(driver?.auto_fuel_authorized
      ? "Autorizado! Use o código gerado abaixo."
      : `Solicitação enviada para ${managerName || "seu gestor"}.`);
    setVehicleId(""); setEstLiters(""); setEstValue(""); setFuelType(""); setStation("");
    load();
  };

  const latestApproved = useMemo(() => auths.find((a) => a.status === "aprovada"), [auths]);

  return (
    <div className="space-y-5 animate-fade-in max-w-md mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Abastecimento
          </h1>
          <p className="text-xs text-muted-foreground">{driver?.full_name ?? user?.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
      </div>

      {/* Status de autorização */}
      <div className={`rounded-xl border p-4 ${driver?.auto_fuel_authorized ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10"}`}>
        <div className="flex items-center gap-3">
          {driver?.auto_fuel_authorized ? (
            <CheckCircle2 className="h-6 w-6 text-success" />
          ) : (
            <UserCheck className="h-6 w-6 text-warning" />
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {driver?.auto_fuel_authorized ? "Você está pré-autorizado" : "Solicitação precisa de aprovação"}
            </p>
            <p className="text-xs text-muted-foreground">
              {driver?.auto_fuel_authorized
                ? "Suas solicitações geram o código de autorização na hora."
                : managerName
                  ? `Seu gestor responsável: ${managerName}`
                  : "Nenhum gestor vinculado. Procure seu administrador."}
            </p>
          </div>
        </div>
      </div>

      {/* Último código aprovado em destaque */}
      {latestApproved?.authorization_code && (
        <div className="rounded-xl border border-success/40 bg-success/10 p-5 text-center">
          <div className="text-[10px] uppercase tracking-widest text-success/80 mb-1">Código de autorização</div>
          <div className="font-mono text-4xl font-bold text-success tracking-widest">{latestApproved.authorization_code}</div>
          <div className="text-[10px] text-muted-foreground mt-2">
            Informe ao posto · válido até {latestApproved.expires_at ? new Date(latestApproved.expires_at).toLocaleString("pt-BR") : "—"}
          </div>
        </div>
      )}

      {/* Form de nova solicitação */}
      <div className="surface-card rounded-xl p-4 space-y-3">
        <h3 className="font-display font-semibold flex items-center gap-2 text-sm"><Plus className="h-4 w-4" /> Nova solicitação</h3>
        <div>
          <Label className="text-xs">Veículo *</Label>
          <Select value={vehicleId} onValueChange={(v) => {
            setVehicleId(v);
            const veh = vehicles.find((x) => x.id === v);
            if (veh?.fuel_type) setFuelType(veh.fuel_type);
          }}>
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Litros est.</Label>
            <Input type="number" step="0.01" inputMode="decimal" value={estLiters} onChange={(e) => setEstLiters(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Valor (R$)</Label>
            <Input type="number" step="0.01" inputMode="decimal" value={estValue} onChange={(e) => setEstValue(e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Posto (opcional)</Label>
          <Input value={station} onChange={(e) => setStation(e.target.value)} placeholder="Nome do posto" />
        </div>
        <Button onClick={submit} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground h-11">
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {driver?.auto_fuel_authorized ? "Solicitar e gerar código" : "Enviar para o gestor"}
        </Button>
      </div>

      {/* Histórico */}
      <div className="space-y-2">
        <h3 className="font-display font-semibold text-sm px-1">Minhas solicitações</h3>
        {loading ? (
          <div className="text-center text-xs text-muted-foreground py-6">Carregando...</div>
        ) : auths.length === 0 ? (
          <div className="surface-card rounded-xl p-8 text-center">
            <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">Nenhuma solicitação ainda.</p>
          </div>
        ) : (
          auths.map((a) => {
            const veh = vehicles.find((v) => v.id === a.vehicle_id);
            return (
              <div key={a.id} className="surface-card rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-mono text-primary font-semibold text-sm">{veh?.plate ?? "—"}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(a.requested_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <Badge className={`capitalize border text-[10px] ${STATUS_TONE[a.status]}`}>{a.status}</Badge>
                </div>
                {a.status === "aprovada" && a.authorization_code && (
                  <div className="font-mono text-center text-lg font-bold text-success tracking-widest bg-success/5 rounded-md py-1.5">
                    {a.authorization_code}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}