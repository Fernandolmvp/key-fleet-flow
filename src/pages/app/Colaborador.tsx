import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, ShieldCheck, Clock, Truck, LogOut, Receipt, CheckCircle2, UserCheck, Camera, Gauge, Search, AlertTriangle, FileCheck, Fuel as FuelIcon, ClipboardList, Wrench, Link2 } from "lucide-react";
import { toast } from "sonner";
import { extractDocument } from "@/lib/ai-extract";

interface Auth {
  id: string; status: string; authorization_code: string | null;
  vehicle_id: string; estimated_liters: number | null; estimated_value: number | null;
  fuel_type: string | null; station_name: string | null;
  requested_at: string; approved_at: string | null; expires_at: string | null;
  fuel_station_id: string | null; km_at_request: number | null; plate_recognized: string | null;
  km_photo_url: string | null; plate_photo_url: string | null; receipt_photo_url: string | null;
  receipt_cnpj: string | null; receipt_total: number | null; cnpj_match: boolean | null;
  confirmed_at: string | null;
}

const STATUS_TONE: Record<string, string> = {
  pendente: "bg-warning/20 text-warning border-warning/30",
  aprovada: "bg-success/20 text-success border-success/30",
  recusada: "bg-destructive/20 text-destructive border-destructive/30",
  utilizada: "bg-primary/20 text-primary border-primary/30",
  expirada: "bg-muted text-muted-foreground border-border",
  cancelada: "bg-muted text-muted-foreground border-border",
};

const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const normalizePlate = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export default function Colaborador() {
  const { currentCompanyId, user, signOut } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [auths, setAuths] = useState<Auth[]>([]);
  const [driver, setDriver] = useState<any | null>(null);
  const [managerName, setManagerName] = useState<string | null>(null);
  const [assignedVehicle, setAssignedVehicle] = useState<any | null>(null);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"abastecimento" | "checklist" | "manutencao">("abastecimento");
  const [maintDesc, setMaintDesc] = useState("");
  const [maintCategory, setMaintCategory] = useState("Outros");
  const [maintBusy, setMaintBusy] = useState(false);
  const [myMaint, setMyMaint] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [myRuns, setMyRuns] = useState<any[]>([]);

  // Etapas: 1-foto KM, 2-foto placa (IA valida), 3-posto, 4-revisar/enviar
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [kmPhoto, setKmPhoto] = useState<File | null>(null);
  const [kmPhotoUrl, setKmPhotoUrl] = useState<string | null>(null);
  const [kmRead, setKmRead] = useState<number | null>(null);
  const [platePhoto, setPlatePhoto] = useState<File | null>(null);
  const [platePhotoUrl, setPlatePhotoUrl] = useState<string | null>(null);
  const [plateRead, setPlateRead] = useState<string | null>(null);
  const [matchedVehicle, setMatchedVehicle] = useState<any | null>(null);
  const [stationSearch, setStationSearch] = useState("");
  const [stationId, setStationId] = useState("");
  const [estLiters, setEstLiters] = useState("");
  const [estValue, setEstValue] = useState("");

  // Confirmação pós-abastecimento
  const [confirmAuthId, setConfirmAuthId] = useState<string | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);

  const kmInputRef = useRef<HTMLInputElement>(null);
  const plateInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!currentCompanyId || !user) return;
    setLoading(true);
    const [{ data: v }, { data: a }, { data: drv }, { data: st }, { data: tpl }] = await Promise.all([
      supabase.from("vehicles").select("id,plate,brand,model,fuel_type,current_km").eq("company_id", currentCompanyId).in("status", ["ativo","manutencao"]).order("plate"),
      supabase.from("fuel_authorizations").select("*").eq("company_id", currentCompanyId).eq("requested_by", user.id).order("requested_at", { ascending: false }).limit(20),
      supabase.from("drivers").select("id,full_name,auto_fuel_authorized,manager_user_id,has_assigned_vehicle,assigned_vehicle_id").eq("company_id", currentCompanyId).eq("user_id", user.id).maybeSingle(),
      supabase.from("fuel_stations").select("id,name,cnpj,brand,city,state").eq("company_id", currentCompanyId).eq("active", true).order("name"),
      supabase.from("checklist_templates").select("id,name,frequency,active").eq("company_id", currentCompanyId).eq("active", true).order("name"),
    ]);
    setVehicles(v ?? []);
    setAuths((a ?? []) as Auth[]);
    setDriver(drv ?? null);
    setStations(st ?? []);
    setTemplates(tpl ?? []);

    if (drv?.has_assigned_vehicle && drv?.assigned_vehicle_id) {
      const av = (v ?? []).find((x: any) => x.id === drv.assigned_vehicle_id);
      if (av) setAssignedVehicle(av);
      else {
        const { data: avFetch } = await supabase.from("vehicles").select("id,plate,brand,model,fuel_type,current_km").eq("id", drv.assigned_vehicle_id).maybeSingle();
        setAssignedVehicle(avFetch ?? null);
      }
    } else {
      setAssignedVehicle(null);
    }

    if (drv?.id) {
      const [{ data: mr }, { data: cr }] = await Promise.all([
        supabase.from("maintenance_records").select("id,description,category,status,service_at,vehicle_id").eq("company_id", currentCompanyId).eq("driver_id", drv.id).eq("type", "corretiva").order("service_at", { ascending: false }).limit(10),
        supabase.from("checklist_runs").select("id,status,started_at,completed_at,template_id,vehicle_id,score").eq("company_id", currentCompanyId).eq("driver_id", drv.id).order("created_at", { ascending: false }).limit(10),
      ]);
      setMyMaint(mr ?? []);
      setMyRuns(cr ?? []);
    } else {
      setMyMaint([]); setMyRuns([]);
    }

    if (drv?.manager_user_id) {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", drv.manager_user_id).maybeSingle();
      setManagerName(prof?.full_name ?? null);
    } else {
      setManagerName(null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentCompanyId, user?.id]);

  const reset = () => {
    setStep(1); setKmPhoto(null); setKmPhotoUrl(null); setKmRead(null);
    setPlatePhoto(null); setPlatePhotoUrl(null); setPlateRead(null); setMatchedVehicle(null);
    setStationSearch(""); setStationId(""); setEstLiters(""); setEstValue("");
  };

  // ETAPA 1 — Foto do KM
  const handleKmPhoto = async (file: File) => {
    if (!currentCompanyId) return;
    setBusy(true);
    try {
      const { data, archivedUrl } = await extractDocument({
        type: "odometer", file, bucket: "fuel-photos", companyId: currentCompanyId,
      });
      const km = data?.km ? Number(data.km) : null;
      if (!km) throw new Error("Não consegui ler o KM. Aproxime mais a câmera do hodômetro.");
      setKmPhoto(file); setKmPhotoUrl(archivedUrl); setKmRead(km);
      setStep(2);
      toast.success(`KM identificado: ${km.toLocaleString("pt-BR")}`);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao ler o KM");
    } finally {
      setBusy(false);
    }
  };

  // ETAPA 2 — Foto da Placa (IA reconhece e bate com cadastro)
  const handlePlatePhoto = async (file: File) => {
    if (!currentCompanyId) return;
    setBusy(true);
    try {
      const { data, archivedUrl } = await extractDocument({
        type: "plate", file, bucket: "fuel-photos", companyId: currentCompanyId,
      });
      const plate = normalizePlate(data?.plate as string | null);
      if (!plate) throw new Error("Não consegui ler a placa. Tente outro ângulo.");
      const veh = vehicles.find((v) => normalizePlate(v.plate) === plate);
      if (!veh) {
        setPlatePhoto(file); setPlatePhotoUrl(archivedUrl); setPlateRead(plate); setMatchedVehicle(null);
        throw new Error(`Placa ${plate} não está cadastrada. Procure seu gestor.`);
      }
      if (assignedVehicle && veh.id !== assignedVehicle.id) {
        throw new Error(`Você está vinculado ao veículo ${assignedVehicle.plate}. Esta placa (${plate}) não corresponde.`);
      }
      // KM lido tem que ser >= current_km
      if (kmRead != null && veh.current_km != null && kmRead < veh.current_km) {
        toast.warning(`Atenção: KM lido (${kmRead}) é menor que o último registrado (${veh.current_km}).`);
      }
      setPlatePhoto(file); setPlatePhotoUrl(archivedUrl); setPlateRead(plate); setMatchedVehicle(veh);
      setStep(3);
      toast.success(`Veículo identificado: ${veh.plate} ${veh.brand} ${veh.model}`);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao ler a placa");
    } finally {
      setBusy(false);
    }
  };

  // ETAPA 4 — Envia solicitação
  const submit = async () => {
    if (!currentCompanyId || !user || !matchedVehicle || !stationId || kmRead == null) {
      return toast.error("Complete todas as etapas");
    }
    setBusy(true);
    const station = stations.find((s) => s.id === stationId);
    const { error } = await supabase.from("fuel_authorizations").insert({
      company_id: currentCompanyId,
      vehicle_id: matchedVehicle.id,
      requested_by: user.id,
      driver_id: driver?.id ?? null,
      fuel_station_id: stationId,
      station_name: station?.name ?? null,
      estimated_liters: estLiters ? Number(estLiters) : null,
      estimated_value: estValue ? Number(estValue) : null,
      fuel_type: matchedVehicle.fuel_type || null,
      km_at_request: kmRead,
      km_photo_url: kmPhotoUrl,
      plate_photo_url: platePhotoUrl,
      plate_recognized: plateRead,
      status: "pendente",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(driver?.auto_fuel_authorized
      ? "Autorizado! Use o código gerado abaixo."
      : `Solicitação enviada para ${managerName || "seu gestor"}.`);
    reset();
    load();
  };

  // CONFIRMAÇÃO PÓS-ABASTECIMENTO — Foto do cupom + IA + valida CNPJ
  const handleReceiptPhoto = async (auth: Auth, file: File) => {
    if (!currentCompanyId) return;
    setReceiptBusy(true);
    try {
      const { data, archivedUrl } = await extractDocument({
        type: "fuel_receipt", file, bucket: "fuel-photos", companyId: currentCompanyId,
      });
      const cupomCnpj = onlyDigits(data?.station_cnpj as string | null);
      let stationCnpj = "";
      if (auth.fuel_station_id) {
        const s = stations.find((x) => x.id === auth.fuel_station_id);
        stationCnpj = onlyDigits(s?.cnpj);
      }
      const cnpjMatch = stationCnpj && cupomCnpj ? stationCnpj === cupomCnpj : null;

      const updateData: any = {
        receipt_photo_url: archivedUrl,
        receipt_cnpj: cupomCnpj || null,
        receipt_total: data?.total_value ?? null,
        receipt_extracted: data,
        cnpj_match: cnpjMatch,
        confirmed_at: new Date().toISOString(),
      };
      // Bloqueia: se CNPJ não bate, marca como anomalia (status fica pendente revisão pelo gestor)
      if (cnpjMatch === false) {
        updateData.status = "pendente";
        updateData.notes = `[ANOMALIA] CNPJ do cupom (${cupomCnpj}) não confere com o posto selecionado (${stationCnpj}).`;
      } else {
        updateData.status = "utilizada";
      }

      const { error: upErr } = await supabase
        .from("fuel_authorizations")
        .update(updateData)
        .eq("id", auth.id);
      if (upErr) throw upErr;

      // Insere itens do cupom (motorista não pode editar/excluir depois)
      const items = Array.isArray(data?.items) ? data.items : [];
      if (items.length) {
        const rows = items.map((it: any) => ({
          company_id: currentCompanyId,
          authorization_id: auth.id,
          description: String(it.description ?? "Item"),
          quantity: Number(it.quantity ?? 1),
          unit_value: Number(it.unit_value ?? 0),
          total_value: Number(it.total ?? 0),
          is_fuel: !!it.is_fuel,
          fuel_type: it.fuel_type ?? null,
        }));
        await supabase.from("fuel_authorization_items").insert(rows);
      }

      // Cria registro em fuel_records (módulo de Abastecimentos) quando válido
      if (cnpjMatch !== false) {
        const fuelItem = items.find((it: any) => it.is_fuel) || items[0];
        const liters = Number(fuelItem?.quantity ?? (data as any)?.liters ?? auth.estimated_liters ?? 0);
        const ppl = Number(fuelItem?.unit_value ?? (data as any)?.price_per_liter ?? 0);
        const total = Number(data?.total_value ?? fuelItem?.total ?? auth.estimated_value ?? 0);
        if (liters > 0 && total > 0) {
          const station = stations.find((x) => x.id === auth.fuel_station_id);
          const fuelType = (fuelItem?.fuel_type || auth.fuel_type || "diesel_s10") as any;
          const { data: fr, error: frErr } = await supabase.from("fuel_records").insert({
            company_id: currentCompanyId,
            vehicle_id: auth.vehicle_id,
            driver_id: driver?.id ?? null,
            fuel_station_id: auth.fuel_station_id,
            station_name: station?.name ?? auth.station_name,
            station_cnpj: station?.cnpj ?? cupomCnpj ?? null,
            city: station?.city ?? null,
            state: station?.state ?? null,
            fuel_type: fuelType,
            liters,
            price_per_liter: ppl > 0 ? ppl : Number((total / liters).toFixed(3)),
            total_value: total,
            km_at_fueling: auth.km_at_request ?? 0,
            payment_method: "cartao_frota",
            receipt_url: archivedUrl,
            created_by: user?.id,
          }).select("id").maybeSingle();
          if (!frErr && fr?.id) {
            await supabase.from("fuel_authorizations").update({ fuel_record_id: fr.id }).eq("id", auth.id);
          }
        }
      }

      if (cnpjMatch === false) {
        toast.error("CNPJ do cupom não confere com o posto. Solicitação enviada para revisão do gestor.");
      } else {
        toast.success("Abastecimento confirmado e registrado!");
      }
      setConfirmAuthId(null);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao processar cupom");
    } finally {
      setReceiptBusy(false);
    }
  };

  // ====== MANUTENÇÃO CORRETIVA ======
  const submitMaintenance = async () => {
    if (!currentCompanyId || !user) return;
    if (!maintDesc.trim()) return toast.error("Descreva o problema observado");
    const vehicleId = assignedVehicle?.id;
    if (!vehicleId) return toast.error("Sem veículo vinculado. Procure seu gestor.");
    setMaintBusy(true);
    const { error } = await supabase.from("maintenance_records").insert({
      company_id: currentCompanyId,
      vehicle_id: vehicleId,
      driver_id: driver?.id ?? null,
      type: "corretiva",
      category: maintCategory,
      status: "agendada",
      service_at: new Date().toISOString(),
      description: `[SOLICITAÇÃO MOTORISTA] ${maintDesc}`,
      created_by: user.id,
    });
    setMaintBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Solicitação de manutenção enviada ao gestor");
    setMaintDesc(""); setMaintCategory("Outros");
    load();
  };

  const latestApproved = useMemo(() => auths.find((a) => a.status === "aprovada"), [auths]);

  const filteredStations = useMemo(() => {
    const q = stationSearch.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter((s) =>
      [s.name, s.brand, s.cnpj, s.city].filter(Boolean).some((v: string) => String(v).toLowerCase().includes(q))
    );
  }, [stations, stationSearch]);

  return (
    <div className="space-y-5 animate-fade-in max-w-md mx-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Painel do Motorista
          </h1>
          <p className="text-xs text-muted-foreground">{driver?.full_name ?? user?.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="abastecimento" className="text-xs gap-1"><FuelIcon className="h-3.5 w-3.5" />Abastec.</TabsTrigger>
          <TabsTrigger value="checklist" className="text-xs gap-1"><ClipboardList className="h-3.5 w-3.5" />Checklist</TabsTrigger>
          <TabsTrigger value="manutencao" className="text-xs gap-1"><Wrench className="h-3.5 w-3.5" />Manut.</TabsTrigger>
        </TabsList>

        <TabsContent value="abastecimento" className="space-y-5 mt-4">
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

      {/* Wizard de nova solicitação */}
      <div className="surface-card rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> Nova solicitação
          </h3>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((s) => (
              <span key={s} className={`h-1.5 w-6 rounded-full ${step >= s ? "bg-primary" : "bg-border"}`} />
            ))}
          </div>
        </div>

        {/* ETAPA 1 — KM */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Gauge className="h-4 w-4" /> 1. Foto do hodômetro (KM)
            </div>
            <p className="text-xs text-muted-foreground">Tire uma foto nítida do painel mostrando o KM total do veículo.</p>
            <input ref={kmInputRef} type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => e.target.files?.[0] && handleKmPhoto(e.target.files[0])} />
            <Button onClick={() => kmInputRef.current?.click()} disabled={busy}
              className="w-full bg-gradient-primary text-primary-foreground h-12">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
              Fotografar KM
            </Button>
          </div>
        )}

        {/* ETAPA 2 — Placa */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="rounded-md bg-success/10 border border-success/30 p-2 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              KM: <strong>{kmRead?.toLocaleString("pt-BR")}</strong>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Truck className="h-4 w-4" /> 2. Foto da placa
            </div>
            <p className="text-xs text-muted-foreground">Fotografe a placa do veículo. A IA vai validar com o cadastro da empresa.</p>
            <input ref={plateInputRef} type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => e.target.files?.[0] && handlePlatePhoto(e.target.files[0])} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={() => plateInputRef.current?.click()} disabled={busy}
                className="bg-gradient-primary text-primary-foreground">
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                Fotografar placa
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 3 — Posto */}
        {step === 3 && matchedVehicle && (
          <div className="space-y-3">
            <div className="rounded-md bg-success/10 border border-success/30 p-2 text-xs">
              <div className="flex items-center gap-2"><Truck className="h-3.5 w-3.5 text-success" />
                <span className="font-mono font-semibold">{matchedVehicle.plate}</span> · {matchedVehicle.brand} {matchedVehicle.model}
              </div>
              <div className="text-muted-foreground mt-0.5">KM: {kmRead?.toLocaleString("pt-BR")}</div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Search className="h-4 w-4" /> 3. Selecione o posto
            </div>
            <Input placeholder="Buscar por nome, CNPJ ou cidade..." value={stationSearch}
              onChange={(e) => setStationSearch(e.target.value)} />
            <div className="max-h-56 overflow-y-auto space-y-1 border border-border rounded-md p-1">
              {filteredStations.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-4">Nenhum posto encontrado.</p>
              ) : filteredStations.map((s) => (
                <button key={s.id} type="button"
                  onClick={() => setStationId(s.id)}
                  className={`w-full text-left rounded-md p-2 text-xs transition ${stationId === s.id ? "bg-primary/15 border border-primary/40" : "hover:bg-muted/40 border border-transparent"}`}>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-muted-foreground">{s.brand && `${s.brand} · `}{s.city ?? "—"}{s.state && `/${s.state}`} {s.cnpj && ` · CNPJ ${s.cnpj}`}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Litros est.</Label>
                <Input type="number" step="0.01" inputMode="decimal" value={estLiters} onChange={(e) => setEstLiters(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Valor R$</Label>
                <Input type="number" step="0.01" inputMode="decimal" value={estValue} onChange={(e) => setEstValue(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={() => setStep(4)} disabled={!stationId} className="bg-gradient-primary text-primary-foreground">
                Revisar
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 4 — Revisão */}
        {step === 4 && matchedVehicle && (
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3 space-y-1 text-xs">
              <div><span className="text-muted-foreground">Veículo:</span> <strong>{matchedVehicle.plate}</strong> · {matchedVehicle.brand} {matchedVehicle.model}</div>
              <div><span className="text-muted-foreground">KM:</span> {kmRead?.toLocaleString("pt-BR")}</div>
              <div><span className="text-muted-foreground">Posto:</span> {stations.find((s) => s.id === stationId)?.name}</div>
              {estLiters && <div><span className="text-muted-foreground">Litros est.:</span> {estLiters}</div>}
              {estValue && <div><span className="text-muted-foreground">Valor est.:</span> R$ {estValue}</div>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>Voltar</Button>
              <Button onClick={submit} disabled={busy} className="bg-gradient-primary text-primary-foreground">
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {driver?.auto_fuel_authorized ? "Gerar código" : "Enviar"}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={reset} className="w-full text-xs">Cancelar</Button>
          </div>
        )}
      </div>

      {/* Histórico */}
      <div className="space-y-2">
        <h3 className="font-display font-semibold text-sm px-1">Minhas solicitações</h3>
        <input ref={receiptInputRef} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            const a = auths.find((x) => x.id === confirmAuthId);
            if (f && a) handleReceiptPhoto(a, f);
            e.target.value = "";
          }} />
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
            const canConfirm = a.status === "aprovada" && !a.confirmed_at;
            return (
              <div key={a.id} className="surface-card rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-mono text-primary font-semibold text-sm">{veh?.plate ?? "—"}</span>
                      {a.km_at_request && <span className="text-[10px] text-muted-foreground">· {a.km_at_request.toLocaleString("pt-BR")} km</span>}
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
                {canConfirm && (
                  <Button size="sm" variant="outline" className="w-full"
                    disabled={receiptBusy}
                    onClick={() => { setConfirmAuthId(a.id); receiptInputRef.current?.click(); }}>
                    {receiptBusy && confirmAuthId === a.id
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Lendo cupom...</>
                      : <><FileCheck className="h-3.5 w-3.5 mr-1.5" />Confirmar com foto do cupom</>}
                  </Button>
                )}
                {a.confirmed_at && a.cnpj_match === false && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/40 p-2 text-[11px] flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                    <span>CNPJ do cupom não confere com o posto. Em revisão pelo gestor.</span>
                  </div>
                )}
                {a.confirmed_at && a.cnpj_match !== false && (
                  <div className="text-[11px] text-success flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Confirmado · R$ {Number(a.receipt_total ?? 0).toFixed(2)}
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