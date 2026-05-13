import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Plus, AlertOctagon, Mail, Gavel, DollarSign, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import KpiCard from "@/components/dashboard/KpiCard";
import FineCard from "@/components/fines/FineCard";
import FinePhotoUploadDialog from "@/components/fines/FinePhotoUploadDialog";
import FineFormDialog from "@/components/fines/FineFormDialog";
import FineDetailsDialog from "@/components/fines/FineDetailsDialog";
import {
  FINE_STATUS_LABEL, daysUntil, fmtBRL, type TrafficFine, type FineStatus,
} from "@/lib/fines";

export default function Multas() {
  const { currentCompanyId } = useAuth();
  const [fines, setFines] = useState<TrafficFine[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, any>>({});
  const [drivers, setDrivers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const [photoOpen, setPhotoOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [details, setDetails] = useState<TrafficFine | null>(null);

  const [filterType, setFilterType] = useState<"all" | "aviso" | "multa">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterVehicle, setFilterVehicle] = useState<string>("all");
  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    const { data: fs } = await supabase.from("traffic_fines").select("*").eq("company_id", currentCompanyId).order("infraction_date", { ascending: false });
    setFines((fs ?? []) as any);
    const { data: vs } = await supabase.from("vehicles").select("id,plate,brand,model").eq("company_id", currentCompanyId);
    setVehicles(Object.fromEntries((vs ?? []).map((v: any) => [v.id, v])));
    const { data: ds } = await supabase.from("drivers").select("id,full_name").eq("company_id", currentCompanyId);
    setDrivers(Object.fromEntries((ds ?? []).map((d: any) => [d.id, d])));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentCompanyId]);

  const filtered = useMemo(() => fines.filter(f => {
    if (filterType !== "all" && f.record_type !== filterType) return false;
    if (filterStatus !== "all" && f.status !== filterStatus) return false;
    if (filterVehicle !== "all" && f.vehicle_id !== filterVehicle) return false;
    if (filterDriver !== "all" && f.driver_id !== filterDriver) return false;
    if (search) {
      const v = vehicles[f.vehicle_id];
      const haystack = [v?.plate, v?.brand, v?.model, f.notification_number, f.location, f.city].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  }), [fines, filterType, filterStatus, filterVehicle, filterDriver, search, vehicles]);

  const kpis = useMemo(() => {
    const avisosPend = fines.filter(f => f.record_type === "aviso" && f.status === "aviso_recebido").length;
    const aVencer = fines.filter(f => f.record_type === "multa" && !f.paid_at && f.due_date && (daysUntil(f.due_date) ?? 999) <= 7 && (daysUntil(f.due_date) ?? -1) >= 0).length;
    const emRecurso = fines.filter(f => f.status === "em_recurso").length;
    const totalPendente = fines.filter(f => !f.paid_at && f.record_type === "multa" && !["recurso_deferido","arquivada","cancelada"].includes(f.status)).reduce((s, f) => s + Number(f.discount_amount ?? f.amount ?? 0), 0);
    const pontosRisco = fines.filter(f => !f.paid_at && f.record_type === "multa" && !["recurso_deferido","arquivada","cancelada"].includes(f.status)).reduce((s, f) => s + (f.license_points || 0), 0);
    return { avisosPend, aVencer, emRecurso, totalPendente, pontosRisco };
  }, [fines]);

  const vehicleList = Object.values(vehicles) as any[];
  const driverList = Object.values(drivers) as any[];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Multas e Avisos</h1>
          <p className="text-muted-foreground text-sm">Controle completo do fluxo de avisos, notificações, indicação, recurso e pagamento.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setPhotoOpen(true)} className="gap-2"><Sparkles className="h-4 w-4" /> Cadastrar via foto</Button>
          <Button variant="outline" onClick={() => setManualOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Cadastrar manualmente</Button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Avisos pendentes" value={kpis.avisosPend} icon={Mail} tone="primary" hint="Aguardando notificação" />
        <KpiCard label="A vencer (7d)" value={kpis.aVencer} icon={AlertOctagon} tone="destructive" />
        <KpiCard label="Em recurso" value={kpis.emRecurso} icon={Gavel} tone="warning" />
        <KpiCard label="Total pendente" value={fmtBRL(kpis.totalPendente)} icon={DollarSign} tone="warning" />
        <KpiCard label="Pontos em risco" value={kpis.pontosRisco} icon={AlertTriangle} tone="destructive" hint="Soma de pontos não pagos" />
      </div>

      <div className="surface-card rounded-xl p-3 flex flex-wrap gap-2 items-center">
        <Input placeholder="Buscar por placa, AIT, local…" className="max-w-xs" value={search} onChange={e => setSearch(e.target.value)} />
        <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="aviso">Só avisos</SelectItem>
            <SelectItem value="multa">Só multas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {Object.entries(FINE_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterVehicle} onValueChange={setFilterVehicle}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Veículo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos veículos</SelectItem>
            {vehicleList.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterDriver} onValueChange={setFilterDriver}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Motorista" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos motoristas</SelectItem>
            {driverList.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="surface-card rounded-xl p-10 text-center">
          <AlertOctagon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Nenhum registro encontrado.</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre via foto ou manualmente para começar.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(f => (
            <FineCard key={f.id} fine={f} vehicle={vehicles[f.vehicle_id]} driver={f.driver_id ? drivers[f.driver_id] : null} onOpen={setDetails} />
          ))}
        </div>
      )}

      {currentCompanyId && photoOpen && (
        <FinePhotoUploadDialog open={photoOpen} onClose={() => setPhotoOpen(false)} companyId={currentCompanyId} onSaved={() => { setPhotoOpen(false); load(); }} />
      )}
      {currentCompanyId && manualOpen && (
        <FineFormDialog open={manualOpen} onClose={() => setManualOpen(false)} companyId={currentCompanyId} onSaved={load} />
      )}
      {details && currentCompanyId && (
        <FineDetailsDialog
          open={!!details}
          onClose={() => setDetails(null)}
          fine={details}
          companyId={currentCompanyId}
          vehicle={vehicles[details.vehicle_id]}
          driver={details.driver_id ? drivers[details.driver_id] : null}
          onChanged={() => { load(); setDetails(null); }}
        />
      )}
    </div>
  );
}