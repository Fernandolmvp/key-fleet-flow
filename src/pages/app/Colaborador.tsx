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
import { Loader2, Plus, ShieldCheck, Clock, Truck, LogOut, Receipt, CheckCircle2, Camera, Search, AlertTriangle, FileCheck, Fuel as FuelIcon, ClipboardList, Wrench, Link2 } from "lucide-react";
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
  const [fuelTab, setFuelTab] = useState<"novo" | "minhas">("novo");
  const [showWizard, setShowWizard] = useState(false);
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
  const [stationCity, setStationCity] = useState("");
  const [stationId, setStationId] = useState("");

  // Confirmação pós-abastecimento
  const [confirmAuthId, setConfirmAuthId] = useState<string | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  // Dados que o motorista informa ao enviar o cupom
  const [receiptFuelType, setReceiptFuelType] = useState<string>("diesel_s10");
  const [receiptLiters, setReceiptLiters] = useState<string>("");
  const [receiptUnitValue, setReceiptUnitValue] = useState<string>("");

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
    setStationCity(""); setStationId("");
    setShowWizard(false);
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
      estimated_liters: null,
      estimated_value: null,
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
    setFuelTab("minhas");
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

      // Calcula litros / valor unitário / total a partir do que o motorista digitou,
      // caindo para o que a IA extraiu se algum campo estiver vazio.
      const items = Array.isArray(data?.items) ? data.items : [];
      const fuelItem = items.find((it: any) => it.is_fuel) || items[0];
      const driverLiters = Number(receiptLiters);
      const driverPpl = Number(receiptUnitValue);
      const liters = driverLiters > 0
        ? driverLiters
        : Number(fuelItem?.quantity ?? (data as any)?.liters ?? 0);
      const ppl = driverPpl > 0
        ? driverPpl
        : Number(fuelItem?.unit_value ?? (data as any)?.price_per_liter ?? 0);
      const aiTotal = Number(data?.total_value ?? fuelItem?.total ?? 0);
      const total = aiTotal > 0
        ? aiTotal
        : (liters > 0 && ppl > 0 ? Number((liters * ppl).toFixed(2)) : 0);

      const updateData: any = {
        receipt_photo_url: archivedUrl,
        receipt_cnpj: cupomCnpj || null,
        receipt_total: total > 0 ? total : (data?.total_value ?? null),
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
        if (liters > 0 && total > 0) {
          const station = stations.find((x) => x.id === auth.fuel_station_id);
          const fuelType = (receiptFuelType || fuelItem?.fuel_type || auth.fuel_type || "diesel_s10") as any;
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
          if (frErr) {
            console.error("Erro ao gravar em fuel_records:", frErr);
            toast.error("Cupom salvo, mas falhou registrar em Abastecimentos: " + frErr.message);
          } else if (fr?.id) {
            await supabase.from("fuel_authorizations").update({ fuel_record_id: fr.id }).eq("id", auth.id);
          }
        } else {
          toast.warning("Abastecimento não foi lançado em Abastecimentos: informe litros e valor unitário.");
        }
      }

      if (cnpjMatch === false) {
        toast.error("CNPJ do cupom não confere com o posto. Solicitação enviada para revisão do gestor.");
      } else {
        toast.success("Abastecimento confirmado e registrado!");
      }
      setConfirmAuthId(null);
      setReceiptFuelType("diesel_s10");
      setReceiptLiters("");
      setReceiptUnitValue("");
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

  // Código fica visível por 20 minutos após a aprovação. Depois disso some da tela
  // do motorista (mas continua válido no backend até expires_at de 24h, para o gestor).
  const CODE_VISIBLE_MINUTES = 20;
  const codeStillVisible = (approvedAt: string | null) => {
    if (!approvedAt) return false;
    const ageMs = Date.now() - new Date(approvedAt).getTime();
    return ageMs <= CODE_VISIBLE_MINUTES * 60 * 1000;
  };

  // Tick a cada 30s para que o código suma sozinho ao passar dos 20 min
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  // Bloqueia nova solicitação se houver alguma aprovada sem cupom enviado
  const blockingPending = useMemo(
    () => auths.find((a) => a.status === "aprovada" && !a.confirmed_at) ?? null,
    [auths],
  );

  // Cidades distintas que possuem postos cadastrados
  const stationCities = useMemo(() => {
    const map = new Map<string, { city: string; state: string | null; count: number }>();
    stations.forEach((s) => {
      const city = (s.city ?? "").trim();
      if (!city) return;
      const key = `${city}|${s.state ?? ""}`;
      const cur = map.get(key);
      if (cur) cur.count += 1;
      else map.set(key, { city, state: s.state ?? null, count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => a.city.localeCompare(b.city));
  }, [stations]);

  const stationsInCity = useMemo(() => {
    if (!stationCity) return [];
    const [city, state] = stationCity.split("|");
    return stations.filter(
      (s) => (s.city ?? "") === city && (s.state ?? "") === (state ?? ""),
    );
  }, [stations, stationCity]);

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
          {/* Último código aprovado em destaque (sempre visível, é o que importa) */}
          {latestApproved?.authorization_code && codeStillVisible(latestApproved.approved_at) && (
        <div className="rounded-xl border border-success/40 bg-success/10 p-5 text-center">
          <div className="text-[10px] uppercase tracking-widest text-success/80 mb-1">Código de autorização</div>
          <div className="font-mono text-4xl font-bold text-success tracking-widest">{latestApproved.authorization_code}</div>
          <div className="text-[10px] text-muted-foreground mt-2">
            Informe ao posto · visível por {CODE_VISIBLE_MINUTES} min após aprovação
          </div>
        </div>
      )}

          {/* Sub-abas: Nova solicitação | Minhas solicitações */}
          <Tabs value={fuelTab} onValueChange={(v) => setFuelTab(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="novo" className="text-xs">Nova</TabsTrigger>
              <TabsTrigger value="minhas" className="text-xs">Minhas solicitações</TabsTrigger>
            </TabsList>

            <TabsContent value="novo" className="space-y-3 mt-4">
              {blockingPending ? (
                <div className="rounded-xl border border-warning/40 bg-warning/10 p-5 text-center space-y-2">
                  <AlertTriangle className="h-7 w-7 mx-auto text-warning" />
                  <div className="font-semibold text-sm">Cupom fiscal pendente</div>
                  <p className="text-xs text-muted-foreground">
                    Você precisa enviar a foto do cupom da última autorização aprovada antes de fazer uma nova solicitação.
                  </p>
                  <Button
                    onClick={() => setFuelTab("minhas")}
                    className="w-full bg-gradient-primary text-primary-foreground"
                  >
                    Enviar cupom agora
                  </Button>
                </div>
              ) : !showWizard ? (
                <Button
                  onClick={() => { reset(); setShowWizard(true); setStep(1); }}
                  className="w-full h-20 text-base bg-gradient-primary text-primary-foreground rounded-xl shadow-glow"
                >
                  <Plus className="h-6 w-6 mr-2" /> Nova solicitação
                </Button>
              ) : (
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
            <input ref={kmInputRef} type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => e.target.files?.[0] && handleKmPhoto(e.target.files[0])} />
            <Button onClick={() => kmInputRef.current?.click()} disabled={busy}
              className="w-full bg-gradient-primary text-primary-foreground h-16 text-base">
              {busy ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Camera className="h-5 w-5 mr-2" />}
              Fotografar KM
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} className="w-full text-xs">Cancelar</Button>
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
            {/* 3a. Cidade */}
            <div className="space-y-1">
              <Label className="text-xs">Cidade</Label>
              {stationCities.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum posto cadastrado.</p>
              ) : (
                <Select
                  value={stationCity}
                  onValueChange={(v) => { setStationCity(v); setStationId(""); }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a cidade" /></SelectTrigger>
                  <SelectContent>
                    {stationCities.map((c) => (
                      <SelectItem key={`${c.city}|${c.state ?? ""}`} value={`${c.city}|${c.state ?? ""}`}>
                        {c.city}{c.state ? `/${c.state}` : ""} · {c.count} posto{c.count > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {/* 3b. Posto na cidade */}
            {stationCity && (
              <div className="space-y-1">
                <Label className="text-xs">Posto</Label>
                <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-md p-1">
                  {stationsInCity.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-4">Nenhum posto nesta cidade.</p>
                  ) : stationsInCity.map((s) => (
                    <button key={s.id} type="button"
                      onClick={() => setStationId(s.id)}
                      className={`w-full text-left rounded-md p-2 text-xs transition ${stationId === s.id ? "bg-primary/15 border border-primary/40" : "hover:bg-muted/40 border border-transparent"}`}>
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-muted-foreground">{s.brand && `${s.brand} · `}{s.cnpj && `CNPJ ${s.cnpj}`}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
              )}
            </TabsContent>

            <TabsContent value="minhas" className="space-y-2 mt-4">
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
            const pendingReceipt = a.status === "aprovada" && !a.confirmed_at;
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
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={`capitalize border text-[10px] ${STATUS_TONE[a.status]}`}>{a.status}</Badge>
                    {pendingReceipt && (
                      <Badge className="bg-warning/15 text-warning border-warning/40 border text-[10px] gap-1">
                        <AlertTriangle className="h-3 w-3" /> Cupom pendente
                      </Badge>
                    )}
                  </div>
                </div>
                {pendingReceipt && (
                  <div className="rounded-md bg-warning/10 border border-warning/30 p-2 text-[11px] flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                    <span>Envie a foto do cupom fiscal para concluir este abastecimento.</span>
                  </div>
                )}
                {a.status === "aprovada" && a.authorization_code && codeStillVisible(a.approved_at) && (
                  <div className="font-mono text-center text-lg font-bold text-success tracking-widest bg-success/5 rounded-md py-1.5">
                    {a.authorization_code}
                  </div>
                )}
                {a.status === "aprovada" && a.authorization_code && !codeStillVisible(a.approved_at) && !a.confirmed_at && (
                  <div className="rounded-md bg-muted/40 border border-border p-2 text-[11px] text-center text-muted-foreground">
                    Código não está mais visível ({CODE_VISIBLE_MINUTES} min). Envie o cupom fiscal para concluir.
                  </div>
                )}
                {canConfirm && confirmAuthId !== a.id && (
                  <Button size="sm" variant="outline" className="w-full"
                    disabled={receiptBusy}
                    onClick={() => {
                      setConfirmAuthId(a.id);
                      setReceiptFuelType((a.fuel_type as string) || "diesel_s10");
                      setReceiptLiters(""); setReceiptUnitValue("");
                    }}>
                    <FileCheck className="h-3.5 w-3.5 mr-1.5" />Enviar cupom fiscal
                  </Button>
                )}
                {canConfirm && confirmAuthId === a.id && (
                  <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-2">
                    <div className="text-[11px] font-semibold text-primary">Dados do cupom</div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Combustível</Label>
                      <Select value={receiptFuelType} onValueChange={setReceiptFuelType}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gasolina">Gasolina</SelectItem>
                          <SelectItem value="etanol">Etanol</SelectItem>
                          <SelectItem value="diesel">Diesel</SelectItem>
                          <SelectItem value="diesel_s10">Diesel S10</SelectItem>
                          <SelectItem value="flex">Flex</SelectItem>
                          <SelectItem value="gnv">GNV</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Litros</Label>
                        <Input type="number" step="0.01" inputMode="decimal" className="h-8 text-xs"
                          value={receiptLiters} onChange={(e) => setReceiptLiters(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Valor unit. R$</Label>
                        <Input type="number" step="0.001" inputMode="decimal" className="h-8 text-xs"
                          value={receiptUnitValue} onChange={(e) => setReceiptUnitValue(e.target.value)} />
                      </div>
                    </div>
                    {receiptLiters && receiptUnitValue && (
                      <div className="text-[10px] text-muted-foreground text-right">
                        Total: R$ {(Number(receiptLiters) * Number(receiptUnitValue)).toFixed(2)}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="ghost" className="text-xs"
                        onClick={() => { setConfirmAuthId(null); }}>
                        Cancelar
                      </Button>
                      <Button size="sm" className="bg-gradient-primary text-primary-foreground text-xs"
                        disabled={receiptBusy || !receiptLiters || !receiptUnitValue}
                        onClick={() => receiptInputRef.current?.click()}>
                        {receiptBusy
                          ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Lendo...</>
                          : <><Camera className="h-3.5 w-3.5 mr-1.5" />Foto do cupom</>}
                      </Button>
                    </div>
                  </div>
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
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ===== CHECKLIST ===== */}
        <TabsContent value="checklist" className="space-y-3 mt-4">
          <div className="surface-card rounded-xl p-4 space-y-2">
            <h3 className="font-display font-semibold text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> Checklists disponíveis
            </h3>
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum modelo de checklist publicado pela empresa.</p>
            ) : templates.map((t) => (
              <div key={t.id} className="rounded-md border border-border p-3 text-xs flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{t.name}</div>
                  <div className="text-muted-foreground capitalize">{t.frequency}</div>
                </div>
                <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">Pelo gestor</Badge>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-1">
              Os checklists são abertos pelo gestor a partir do veículo. Em breve, preenchimento direto pelo motorista.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-sm px-1">Meus últimos checklists</h3>
            {myRuns.length === 0 ? (
              <div className="surface-card rounded-xl p-6 text-center text-xs text-muted-foreground">
                Nenhum checklist registrado ainda.
              </div>
            ) : myRuns.map((r) => {
              const veh = vehicles.find((v) => v.id === r.vehicle_id);
              return (
                <div key={r.id} className="surface-card rounded-xl p-3 text-xs flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5"><Truck className="h-3 w-3 text-primary" /> <span className="font-mono">{veh?.plate ?? "—"}</span></div>
                    <div className="text-muted-foreground text-[10px] mt-0.5">{r.completed_at ? new Date(r.completed_at).toLocaleString("pt-BR") : "Em andamento"}</div>
                  </div>
                  <Badge className="text-[10px] capitalize">{r.status}</Badge>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ===== MANUTENÇÃO CORRETIVA ===== */}
        <TabsContent value="manutencao" className="space-y-3 mt-4">
          <div className="surface-card rounded-xl p-4 space-y-3">
            <h3 className="font-display font-semibold text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" /> Solicitar manutenção corretiva
            </h3>
            {!assignedVehicle ? (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <span>Você não tem veículo vinculado. Procure seu gestor para abrir solicitações.</span>
              </div>
            ) : (
              <>
                <div className="rounded-md bg-primary/5 border border-primary/20 p-2 text-xs">
                  <div className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-primary" /><span className="font-mono font-semibold">{assignedVehicle.plate}</span> · {assignedVehicle.brand} {assignedVehicle.model}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={maintCategory} onValueChange={setMaintCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Motor","Freios","Suspensão","Elétrica","Câmbio","Pneus","Arrefecimento","Vidros","Funilaria/Pintura","Outros"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descreva o problema</Label>
                  <Textarea rows={4} value={maintDesc} onChange={(e) => setMaintDesc(e.target.value)} placeholder="Ex.: Barulho ao frear, pisca-alerta não funciona, perda de potência..." />
                </div>
                <Button onClick={submitMaintenance} disabled={maintBusy} className="w-full bg-gradient-primary text-primary-foreground">
                  {maintBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enviar solicitação
                </Button>
              </>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-semibold text-sm px-1">Minhas solicitações</h3>
            {myMaint.length === 0 ? (
              <div className="surface-card rounded-xl p-6 text-center text-xs text-muted-foreground">
                Nenhuma solicitação registrada.
              </div>
            ) : myMaint.map((m) => {
              const veh = vehicles.find((v) => v.id === m.vehicle_id);
              return (
                <div key={m.id} className="surface-card rounded-xl p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5"><Truck className="h-3 w-3 text-primary" /><span className="font-mono">{veh?.plate ?? "—"}</span> · {m.category}</div>
                    <Badge className="text-[10px] capitalize">{m.status}</Badge>
                  </div>
                  <div className="text-muted-foreground line-clamp-2">{m.description}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(m.service_at).toLocaleString("pt-BR")}</div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Rodapé fixo: vínculo com veículo */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background-elevated/95 backdrop-blur px-4 py-2 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
            {assignedVehicle ? (
              <>
                <span className="font-mono font-semibold text-primary">{assignedVehicle.plate}</span>
                <span className="text-muted-foreground truncate">· {assignedVehicle.brand} {assignedVehicle.model}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Sem veículo vinculado</span>
            )}
          </div>
          {driver?.auto_fuel_authorized ? (
            <div className="flex items-center gap-1 text-success shrink-0" title="Você está pré-autorizado">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="font-semibold">Autorizado</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-warning shrink-0" title={managerName ? `Gestor: ${managerName}` : "Aguarda aprovação do gestor"}>
              <Clock className="h-3.5 w-3.5" />
              <span className="font-semibold">Requer aprovação</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}