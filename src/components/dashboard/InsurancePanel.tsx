import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Upload, Sparkles, Pencil, Trash2, FileText, ExternalLink, Phone, Search, Truck, ShieldCheck, AlertTriangle, Loader2, Link2, Lock, Mail, ShieldAlert, Filter, ChevronDown, ChevronUp, Activity, CalendarClock, BarChart3 } from "lucide-react";
import VehicleDialog from "@/components/dashboard/VehicleDialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { normalizePlate, normChassis, normRenavam } from "@/lib/plate";

type Broker = { id: string; name: string; phone?: string | null; email?: string | null };
type Vehicle = { id: string; plate: string; brand: string; model: string; status: string; chassis: string | null; renavam: string | null; vehicle_type: string | null };
type AiVehicle = {
  plate: string;
  brand?: string | null;
  model?: string | null;
  year?: string | null;
  fipe_code?: string | null;
  chassis?: string | null;
  renavam?: string | null;
  insured_amount?: number | null;
  premium?: number | null;
  deductible?: number | null;
  inclusion_type?: "apolice" | "adendo" | null;
  endorsement_number?: string | null;
  coverage_notes?: string | null;
};
type Policy = {
  id: string;
  policy_number: string;
  insurer_name: string;
  insurer_phone: string | null;
  insurer_email: string | null;
  broker_id: string | null;
  start_date: string | null;
  end_date: string | null;
  total_value: number | null;
  deductible: number | null;
  coverage_summary: string | null;
  coverage_type: string | null;
  file_url: string | null;
  file_name: string | null;
  notes: string | null;
  status: string;
  ai_extracted: any;
};
type Link = {
  id: string;
  policy_id: string;
  vehicle_id: string;
  inclusion_type: "apolice" | "adendo" | "manual";
  included_at: string;
  endorsement_number: string | null;
  removed_at?: string | null;
};

const emptyPolicy: Partial<Policy> = { status: "ativa" };

const COVERAGE_TYPES: { value: string; label: string }[] = [
  { value: "compreensivo", label: "Compreensivo" },
  { value: "terceiros", label: "Terceiros (RCF)" },
  { value: "casco_total", label: "Casco Total" },
  { value: "casco_parcial", label: "Casco Parcial" },
  { value: "frota", label: "Frota" },
  { value: "outro", label: "Outro" },
];
const coverageTypeLabel = (v?: string | null) =>
  COVERAGE_TYPES.find((c) => c.value === v)?.label || null;

/** Normaliza string: maiúsculas e somente A-Z/0-9. (uso geral / chassi). */
function normId(s?: string | null): string {
  return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
/** Normaliza placa para formato Mercosul (cruza placas antigas e novas do mesmo carro). */
const normPlate = (s?: string | null) => normalizePlate(s);
/** Igualdade chassi: exato OU últimos 8 dígitos. */
function chassisMatch(a?: string | null, b?: string | null): boolean {
  const x = normChassis(a), y = normChassis(b);
  if (!x || !y) return false;
  return x === y || x.slice(-8) === y.slice(-8);
}
/** Igualdade RENAVAM (somente dígitos). */
function renavamEq(a?: string | null, b?: string | null): boolean {
  const x = normRenavam(a), y = normRenavam(b);
  return !!x && x === y;
}

/** Detecta se uma apólice veio de importação por IA.
 *  ai_extracted vazio, ou só com plates/vehicles vazios, NÃO conta como IA. */
function isAiPolicy(p: { ai_extracted?: any } | null | undefined): boolean {
  const ex = p?.ai_extracted;
  if (!ex || typeof ex !== "object") return false;
  const platesLen = Array.isArray(ex.plates) ? ex.plates.length : 0;
  const vehLen = Array.isArray(ex.vehicles) ? ex.vehicles.length : 0;
  if (platesLen > 0 || vehLen > 0) return true;
  const meaningful =
    ex.policy_number || ex.insurer_name || ex.broker_name ||
    ex.start_date || ex.end_date || ex.coverage_summary ||
    ex.total_value != null || ex.deductible != null;
  return !!meaningful;
}

/** Converte ArrayBuffer -> base64 sem estourar a stack em PDFs grandes. */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000; // 32KB
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  }
  return btoa(binary);
}

/** Normaliza nome de arquivo: sem acentos, minúsculas, espaços→underline, mantém extensão. */
function normalizeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1) : "";
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .toLowerCase()
      .replace(/\s+/g, "_")            // espaços → _
      .replace(/[^a-z0-9._-]/g, "_")   // caracteres não permitidos → _
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  const baseClean = clean(base) || "arquivo";
  const extClean = clean(ext);
  return extClean ? `${baseClean}.${extClean}` : baseClean;
}

type MatchStatus = "linked" | "not_found" | "mismatch";
type MatchResult = {
  ai: AiVehicle;
  vehicle: Vehicle | null;
  status: MatchStatus;
  reason?: string;
};

/** Busca o veículo cadastrado correspondente: 1) por placa, 2) fallback por chassi. Detecta inconsistência. */
function matchAiVehicle(ai: AiVehicle, vehicles: Vehicle[]): MatchResult {
  const aiPlateN = normPlate(ai.plate);

  // 1) placa Mercosul-normalizada (cruza placa antiga e nova do MESMO carro)
  let v: Vehicle | undefined;
  if (aiPlateN) v = vehicles.find((x) => normPlate(x.plate) === aiPlateN);
  // 2) chassi (exato ou últimos 8)
  if (!v && ai.chassis) v = vehicles.find((x) => chassisMatch(x.chassis, ai.chassis));
  // 3) RENAVAM exato
  if (!v && (ai as any).renavam) v = vehicles.find((x) => renavamEq(x.renavam, (ai as any).renavam));

  if (!v) return { ai, vehicle: null, status: "not_found" };
  return { ai, vehicle: v, status: "linked" };
}

async function syncVehicleInsuranceFields(_companyId: string, vehicleIds: string[]) {
  const ids = Array.from(new Set(vehicleIds.filter(Boolean)));
  if (!ids.length) return true;

  const { error } = await supabase.rpc("sync_vehicle_insurance_fields", {
    _vehicle_ids: ids,
  });

  if (error) {
    console.error("sync_vehicle_insurance_fields failed", error);
    toast.error("Não foi possível atualizar o seguro no cadastro do veículo.");
    return false;
  }

  return true;
}

/** Audit log helper para o módulo de seguros. */
async function logAudit(params: {
  companyId: string;
  table: "insurance_policies" | "insurance_policy_vehicles";
  recordId: string;
  action: string;
  changes?: Record<string, unknown>;
}) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("audit_logs").insert({
    company_id: params.companyId,
    table_name: params.table,
    record_id: params.recordId,
    action: params.action,
    user_id: u?.user?.id || null,
    changes: (params.changes as any) || {},
  });
}

export default function InsurancePanel() {
  const { currentCompanyId } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);

  const [policyDialog, setPolicyDialog] = useState(false);
  const [form, setForm] = useState<Partial<Policy>>(emptyPolicy);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [aiPlates, setAiPlates] = useState<string[]>([]);
  const [aiVehicles, setAiVehicles] = useState<AiVehicle[]>([]);
  const [reextracting, setReextracting] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const [vehicleSearch, setVehicleSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSearchMode, setGlobalSearchMode] = useState<"veiculo" | "apolice" | "seguradora" | "corretora">("veiculo");

  // Nova navegação por abas
  const [activeTab, setActiveTab] = useState<"overview" | "apolices" | "sem-cobertura">("overview");
  const [policySearch, setPolicySearch] = useState("");
  const [uncoveredSearch, setUncoveredSearch] = useState("");
  const [assuredFilter, setAssuredFilter] = useState<string>("all"); // policy id filter
  const [addToPolicyVehicleId, setAddToPolicyVehicleId] = useState<string | null>(null);
  const [addToPolicyTargetId, setAddToPolicyTargetId] = useState<string>("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<any | null>(null);

  // Cadastro rápido de veículo (Cenário 3 / placa órfã)
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [vehiclePrefill, setVehiclePrefill] = useState<any | null>(null);

  function openRegisterFromPolicy(ai: AiVehicle) {
    setVehiclePrefill({
      plate: (ai.plate || "").toUpperCase(),
      brand: ai.brand || "",
      model: ai.model || "",
      year_manufacture: ai.year || "",
      year_model: ai.year || "",
      chassis: ai.chassis || "",
    });
    setVehicleDialogOpen(true);
  }

  async function runAiReview() {
    if (!selectedPolicy?.file_url) {
      toast.error("Apólice sem PDF anexado para revisar.");
      return;
    }
    setReviewLoading(true);
    setReviewResult(null);
    try {
      const resp = await fetch(selectedPolicy.file_url);
      if (!resp.ok) throw new Error("Não foi possível baixar o PDF da apólice.");
      const blob = await resp.blob();
      const mimeType = blob.type || "application/pdf";
      const buf = await blob.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
      }
      const fileBase64 = btoa(bin);
      const registryVehicles = vehicles.map((v) => ({ plate: v.plate, brand: v.brand, model: v.model }));
      const { data, error } = await supabase.functions.invoke("review-insurance-policy", {
        body: {
          fileBase64,
          mimeType,
          registryVehicles,
          policyMeta: { policy_number: selectedPolicy.policy_number, insurer_name: selectedPolicy.insurer_name },
        },
      });
      if (error) {
        let msg = error.message || "Falha ao revisar com IA";
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; }
        } catch {}
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      setReviewResult((data as any)?.data ?? null);
      toast.success("Revisão concluída pela IA");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao revisar");
    } finally {
      setReviewLoading(false);
    }
  }

  async function load() {
    if (!currentCompanyId) return;
    setLoading(true);
    const [p, b, v, l] = await Promise.all([
      supabase.from("insurance_policies").select("*").eq("company_id", currentCompanyId).order("end_date", { ascending: false, nullsFirst: false }),
      supabase.from("insurance_brokers").select("id,name,phone,email").eq("company_id", currentCompanyId).eq("active", true).order("name"),
      supabase.from("vehicles").select("id,plate,brand,model,status,chassis,renavam,vehicle_type").eq("company_id", currentCompanyId).eq("status", "ativo").order("plate"),
      supabase.from("insurance_policy_vehicles").select("*").eq("company_id", currentCompanyId).is("removed_at", null),
    ]);
    if (p.error) toast.error(p.error.message);
    const policiesData = (p.data as any[]) || [];
    const vehiclesData = (v.data as any[]) || [];
    const linksData = (l.data as any[]) || [];
    setPolicies(policiesData);
    setBrokers((b.data as any[]) || []);
    setVehicles(vehiclesData);
    setLinks(linksData);
    setLoading(false);
    // Auto-vincula novos veículos cadastrados às apólices de IA já importadas
    autoLinkAiPolicies(policiesData, vehiclesData, linksData).catch((e) =>
      console.error("autoLinkAiPolicies failed", e)
    );
  }

  // Para cada apólice IA ativa, cria automaticamente os vínculos de veículos
  // cuja placa/chassi já está cadastrada e ainda não foi vinculada.
  // Em seguida, sincroniza os campos de seguro no cadastro do veículo.
  async function autoLinkAiPolicies(pols: Policy[], vehs: Vehicle[], lnks: Link[]) {
    if (!currentCompanyId) return;
    const today = new Date();
    const isVigente = (p: Policy) => {
      if (p.status !== "ativa") return false;
      if (!p.end_date) return true;
      return new Date(p.end_date + "T00:00:00") >= new Date(today.toDateString());
    };
    const aiActive = pols.filter((p) => isAiPolicy(p) && isVigente(p));
    if (!aiActive.length) return;
    const newLinks: { company_id: string; policy_id: string; vehicle_id: string; inclusion_type: "apolice" | "adendo"; removed_at: null }[] = [];
    const touchedVehicleIds = new Set<string>();
    for (const pol of aiActive) {
      const existing = new Set(
        lnks.filter((l) => l.policy_id === pol.id && !l.removed_at).map((l) => l.vehicle_id)
      );
      const ex: any = pol.ai_extracted || {};
      const aiList: AiVehicle[] = Array.isArray(ex.vehicles) && ex.vehicles.length
        ? ex.vehicles
        : (Array.isArray(ex.plates) ? ex.plates.map((p: string) => ({ plate: p } as AiVehicle)) : []);
      aiList.forEach((a) => {
        const r = matchAiVehicle(a, vehs);
        if (r.status === "linked" && r.vehicle && !existing.has(r.vehicle.id)) {
          newLinks.push({
            company_id: currentCompanyId!,
            policy_id: pol.id,
            vehicle_id: r.vehicle.id,
            inclusion_type: (a.inclusion_type === "adendo" ? "adendo" : "apolice"),
            removed_at: null,
          });
          touchedVehicleIds.add(r.vehicle.id);
        }
      });
    }
    if (!newLinks.length) return;
    const ins = await supabase.from("insurance_policy_vehicles").upsert(newLinks, { onConflict: "policy_id,vehicle_id" });
    if (ins.error) { console.error(ins.error); return; }
    await syncVehicleInsuranceFields(currentCompanyId, Array.from(touchedVehicleIds));
    // recarrega vínculos atualizados (sem chamar load() para evitar loop)
    const { data: refreshed } = await supabase
      .from("insurance_policy_vehicles").select("*")
      .eq("company_id", currentCompanyId).is("removed_at", null);
    setLinks((refreshed as any[]) || []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentCompanyId]);

  function openNew() { setForm(emptyPolicy); setAiPlates([]); setAiVehicles([]); setPolicyDialog(true); }
  function openEdit(p: Policy) {
    setForm(p);
    const ex = p.ai_extracted || {};
    setAiPlates(Array.isArray(ex.plates) ? ex.plates.map((x: string) => String(x).toUpperCase().replace(/[^A-Z0-9]/g, "")) : []);
    setAiVehicles(Array.isArray(ex.vehicles) ? ex.vehicles : []);
    setPolicyDialog(true);
  }

  async function handleFile(file: File) {
    if (!currentCompanyId) return;
    setUploading(true);
    try {
      const safeName = normalizeFileName(file.name);
      const path = `${currentCompanyId}/${Date.now()}-${safeName}`;
      const up = await supabase.storage.from("insurance-policies").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { data: signed } = await supabase.storage.from("insurance-policies").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      setForm((f) => ({ ...f, file_url: signed?.signedUrl || path, file_name: safeName }));
      toast.success("PDF enviado");
      // tenta extrair com IA
      await extractWithAI(file);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  }

  async function extractWithAI(file: File) {
    setExtracting(true);
    try {
      const buf = await file.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      const { data, error } = await supabase.functions.invoke("extract-insurance-policy", {
        body: { fileBase64: b64, mimeType: file.type || "application/pdf" },
      });
      if (error) {
        let msg = error.message || "Falha ao processar a apólice";
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) { const body = await ctx.json(); if (body?.error) msg = body.error; }
          else if (ctx?.text) {
            const txt = await ctx.text();
            try { const j = JSON.parse(txt); if (j?.error) msg = j.error; } catch { /* keep */ }
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      const ex = (data as any)?.data || {};
      setForm((f) => ({
        ...f,
        policy_number: f.policy_number || ex.policy_number || "",
        insurer_name: f.insurer_name || ex.insurer_name || "",
        insurer_phone: f.insurer_phone || ex.insurer_phone || "",
        insurer_email: f.insurer_email || ex.insurer_email || "",
        start_date: f.start_date || ex.start_date || null,
        end_date: f.end_date || ex.end_date || null,
        total_value: f.total_value ?? ex.total_value ?? null,
        deductible: f.deductible ?? ex.deductible ?? null,
        coverage_summary: f.coverage_summary || ex.coverage_summary || "",
        coverage_type: f.coverage_type || (COVERAGE_TYPES.some((c) => c.value === ex.coverage_type) ? ex.coverage_type : null),
        ai_extracted: ex,
      }));
      // se IA retornou corretor e não existe, cria
      if (ex.broker_name && currentCompanyId) {
        const existing = brokers.find((b) => b.name.toLowerCase() === String(ex.broker_name).toLowerCase());
        if (existing) {
          setForm((f) => ({ ...f, broker_id: existing.id }));
        } else {
          const ins = await supabase.from("insurance_brokers").insert({
            company_id: currentCompanyId,
            name: ex.broker_name,
            document: ex.broker_document || null,
            susep: ex.broker_susep || null,
            phone: ex.broker_phone || null,
            email: ex.broker_email || null,
          }).select("id,name").single();
          if (!ins.error && ins.data) {
            setBrokers((arr) => [...arr, ins.data as any]);
            setForm((f) => ({ ...f, broker_id: (ins.data as any).id }));
            toast.success(`Corretor "${ex.broker_name}" cadastrado automaticamente`);
          }
        }
      }
      if (Array.isArray(ex.plates)) {
        const norm = ex.plates.map((p: string) => String(p).toUpperCase().replace(/[^A-Z0-9]/g, ""));
        setAiPlates(norm);
        toast.success(`IA encontrou ${norm.length} placa(s) na apólice`);
      }
      if (Array.isArray(ex.vehicles)) {
        const norm = (ex.vehicles as AiVehicle[]).map((v) => ({
          ...v,
          plate: String(v.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
        })).filter((v) => v.plate);
        setAiVehicles(norm);
        // Se não veio plates[], deriva de vehicles[]
        if (!Array.isArray(ex.plates) || ex.plates.length === 0) {
          setAiPlates(norm.map((v) => v.plate));
        }
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ? `IA: ${e.message}` : "IA não conseguiu ler a apólice. Preencha manualmente.");
    } finally {
      setExtracting(false);
    }
  }

  /** Reanalisa o PDF já anexado. */
  async function reextract() {
    if (!form.file_url) { toast.error("Anexe o PDF primeiro"); return; }
    setReextracting(true);
    try {
      const resp = await fetch(form.file_url);
      if (!resp.ok) throw new Error("Não foi possível baixar o PDF anexado");
      const blob = await resp.blob();
      const file = new File([blob], form.file_name || "apolice.pdf", { type: blob.type || "application/pdf" });
      // Força reextração: limpa campos preenchidos pela IA antiga (mantém o que o usuário digitou? — mantemos manuais)
      await extractWithAI(file);
    } catch (e: any) {
      toast.error(e.message || "Falha ao reanalisar");
    } finally {
      setReextracting(false);
    }
  }

  async function savePolicy() {
    if (!currentCompanyId) return;
    if (savingPolicy) return; // trava contra duplo-clique
    if (!form.policy_number?.trim() || !form.insurer_name?.trim()) {
      toast.error("Número e seguradora são obrigatórios"); return;
    }
    setSavingPolicy(true);
    try {
    const payload: any = {
      company_id: currentCompanyId,
      policy_number: form.policy_number.trim(),
      insurer_name: form.insurer_name.trim(),
      insurer_phone: form.insurer_phone || null,
      insurer_email: form.insurer_email || null,
      broker_id: form.broker_id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      total_value: form.total_value ?? null,
      deductible: form.deductible ?? null,
      coverage_summary: form.coverage_summary || null,
      coverage_type: form.coverage_type || null,
      file_url: form.file_url || null,
      file_name: form.file_name || null,
      notes: form.notes || null,
      status: form.status || "ativa",
    };
    // ai_extracted: só preserva/grava se houver conteúdo real (vindo da IA).
    // Apólice 100% manual fica com ai_extracted = {} para não disparar isAiPolicy().
    const existingAi = (form.ai_extracted && typeof form.ai_extracted === "object") ? form.ai_extracted : {};
    const hasExistingAi =
      Object.keys(existingAi).some((k) => k !== "plates" && k !== "vehicles" && (existingAi as any)[k] != null);
    if (hasExistingAi || aiPlates.length > 0 || aiVehicles.length > 0) {
      payload.ai_extracted = { ...existingAi, plates: aiPlates, vehicles: aiVehicles };
    } else {
      payload.ai_extracted = {};
    }
    let policyId = form.id;
    if (form.id) {
      const r = await supabase.from("insurance_policies").update(payload).eq("id", form.id);
      if (r.error) { toast.error(r.error.message); return; }
    } else {
      // Validação prévia: já existe apólice com este número nesta empresa?
      const dup = await supabase
        .from("insurance_policies")
        .select("id")
        .eq("company_id", currentCompanyId)
        .eq("policy_number", payload.policy_number)
        .eq("insurer_name", payload.insurer_name)
        .limit(1)
        .maybeSingle();
      if (dup.data?.id) {
        toast.error("Já existe apólice com esse número nesta seguradora.");
        return;
      }
      const r = await supabase.from("insurance_policies").insert(payload).select("id").single();
      if (r.error) {
        if ((r.error as any).code === "23505") {
          toast.error("Já existe apólice com esse número nesta seguradora.");
        } else {
          toast.error(r.error.message);
        }
        return;
      }
      policyId = (r.data as any).id;
    }
    // vincula veículos extraídos pela IA (placa OU chassi), com classificação
    if (policyId) {
      const aiList: AiVehicle[] = aiVehicles.length
        ? aiVehicles
        : aiPlates.map((p) => ({ plate: p } as AiVehicle));
      const results = aiList.map((a) => matchAiVehicle(a, vehicles));
      const linked = results.filter((r) => r.status === "linked" && r.vehicle);
      const notFound = results.filter((r) => r.status === "not_found");
      const mismatch = results.filter((r) => r.status === "mismatch" && r.vehicle);
      if (linked.length) {
        const rows = linked.map((r) => ({
          company_id: currentCompanyId,
          policy_id: policyId!,
          vehicle_id: r.vehicle!.id,
          inclusion_type: (r.ai.inclusion_type === "adendo" ? "adendo" : "apolice") as "apolice" | "adendo",
          removed_at: null,
        }));
        await supabase.from("insurance_policy_vehicles").upsert(rows, { onConflict: "policy_id,vehicle_id" });
        await syncVehicleInsuranceFields(currentCompanyId, linked.map((r) => r.vehicle!.id));
        toast.success(`${linked.length} veículo(s) vinculado(s) à apólice`);
      }
      if (notFound.length) {
        toast.warning(`${notFound.length} veículo(s) da apólice não foram encontrados (placa/chassi não cadastrados).`);
      }
      if (mismatch.length) {
        toast.warning(`${mismatch.length} veículo(s) com inconsistência entre placa e chassi — revise manualmente.`);
      }
    }
    // Se a apólice já existia (edição), ressincroniza todos os veículos vinculados
    if (form.id && policyId) {
      const { data: existing } = await supabase
        .from("insurance_policy_vehicles").select("vehicle_id")
        .eq("policy_id", policyId);
      const vIds = (existing ?? []).map((x: any) => x.vehicle_id);
      if (vIds.length) await syncVehicleInsuranceFields(currentCompanyId, vIds);
    }
    toast.success("Apólice salva");
    setPolicyDialog(false);
    setSelectedPolicyId(policyId || null);
    load();
    } finally {
      setSavingPolicy(false);
    }
  }

  async function removePolicy(id: string) {
    if (!confirm("Excluir esta apólice e todos os vínculos?")) return;
    // captura os veículos antes da exclusão para ressincronizar
    const { data: existing } = await supabase
      .from("insurance_policy_vehicles").select("vehicle_id").eq("policy_id", id);
    const vIds = (existing ?? []).map((x: any) => x.vehicle_id);
    const r = await supabase.from("insurance_policies").delete().eq("id", id);
    if (r.error) { toast.error(r.error.message); return; }
    if (currentCompanyId && vIds.length) await syncVehicleInsuranceFields(currentCompanyId, vIds);
    if (currentCompanyId) {
      await logAudit({
        companyId: currentCompanyId,
        table: "insurance_policies",
        recordId: id,
        action: "delete",
        changes: { affected_vehicles: vIds.length },
      });
    }
    toast.success("Excluída");
    if (selectedPolicyId === id) setSelectedPolicyId(null);
    load();
  }

  async function linkVehicle(vehicleId: string, type: "apolice" | "adendo" | "manual") {
    if (!selectedPolicyId || !currentCompanyId) return;
    if (isAiPolicy(selectedPolicy)) {
      toast.error("Apólice importada via IA — não é permitido vincular veículos manualmente.");
      return;
    }
    const r = await supabase.from("insurance_policy_vehicles").upsert({
      company_id: currentCompanyId,
      policy_id: selectedPolicyId,
      vehicle_id: vehicleId,
      inclusion_type: type,
      removed_at: null,
    }, { onConflict: "policy_id,vehicle_id" });
    if (r.error) { toast.error(r.error.message); return; }
    await syncVehicleInsuranceFields(currentCompanyId, [vehicleId]);
    toast.success(type === "adendo" ? "Adendo registrado" : type === "manual" ? "Veículo vinculado manualmente" : "Veículo incluído");
    load();
  }

  async function unlinkVehicle(linkId: string) {
    const linkObj = links.find((l) => l.id === linkId);
    if (linkObj) {
      const pol = policies.find((p) => p.id === linkObj.policy_id);
      if (isAiPolicy(pol)) {
        toast.error("Apólice importada via IA — não é permitido remover vínculos.");
        return;
      }
    }
    // capturar vehicle_id antes
    const { data: link } = await supabase
      .from("insurance_policy_vehicles").select("vehicle_id").eq("id", linkId).maybeSingle();
    const vehicleId = (link as any)?.vehicle_id;
    const today = new Date().toISOString().slice(0, 10);
    const r = await supabase
      .from("insurance_policy_vehicles")
      .update({ removed_at: today })
      .eq("id", linkId);
    if (r.error) { toast.error(r.error.message); return; }
    if (currentCompanyId && vehicleId) await syncVehicleInsuranceFields(currentCompanyId, [vehicleId]);
    if (currentCompanyId) {
      await logAudit({
        companyId: currentCompanyId,
        table: "insurance_policy_vehicles",
        recordId: linkId,
        action: "soft_delete",
        changes: { vehicle_id: vehicleId, removed_at: today },
      });
    }
    toast.success("Vínculo removido");
    load();
  }

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId) || null;
  const selectedLinks = useMemo(
    () => links.filter((l) => l.policy_id === selectedPolicyId),
    [links, selectedPolicyId]
  );
  const linkedVehicleIds = new Set(selectedLinks.map((l) => l.vehicle_id));

  const policyIsAi = isAiPolicy(selectedPolicy);

  // === VALIDAÇÃO CRUZADA da apólice selecionada ===
  const validation = useMemo(() => {
    if (!selectedPolicy) return null;
    const ex = (selectedPolicy.ai_extracted as any) || {};
    const aiVeh: AiVehicle[] = Array.isArray(ex.vehicles) ? ex.vehicles : [];
    const aiPl: string[] = Array.isArray(ex.plates)
      ? ex.plates.map((p: string) => String(p).toUpperCase().replace(/[^A-Z0-9]/g, ""))
      : aiVeh.map((v) => String(v.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean);
    const aiPlSet = new Set(aiPl);
    const aiVehByPlate: Record<string, AiVehicle> = {};
    aiVeh.forEach((v) => {
      const p = String(v.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (p) aiVehByPlate[p] = v;
    });

    // Cobertos & cadastrados (interseção)
    const covered = vehicles
      .filter((v) => aiPlSet.has(v.plate.toUpperCase()))
      .map((v) => ({ ...v, ai: aiVehByPlate[v.plate.toUpperCase()] }));

    // Na apólice mas NÃO cadastrados
    const cadastradas = new Set(vehicles.map((v) => v.plate.toUpperCase()));
    const onlyInPolicy = aiPl
      .filter((p) => !cadastradas.has(p))
      .map((p) => ({ plate: p, ai: aiVehByPlate[p] }));

    // Vinculados manualmente mas que NÃO aparecem na apólice (IA)
    const linkedNotInAi = selectedLinks
      .map((l) => vehicles.find((v) => v.id === l.vehicle_id))
      .filter((v): v is Vehicle => !!v)
      .filter((v) => aiPl.length > 0 && !aiPlSet.has(v.plate.toUpperCase()));

    // Veículos da empresa SEM cobertura nesta apólice
    const notCovered = vehicles.filter((v) => !aiPlSet.has(v.plate.toUpperCase()) && !linkedVehicleIds.has(v.id));

    // Soma das importâncias seguradas extraídas
    const sumIS = aiVeh.reduce((s, v) => s + (Number(v.insured_amount) || 0), 0);
    const sumPremium = aiVeh.reduce((s, v) => s + (Number(v.premium) || 0), 0);

    return { aiPl, aiVehByPlate, covered, onlyInPolicy, linkedNotInAi, notCovered, sumIS, sumPremium, hasAi: aiPl.length > 0 };
  }, [selectedPolicy, vehicles, selectedLinks, linkedVehicleIds]);

  // Veículos da empresa SEM cobertura em NENHUMA apólice ativa
  const companyUncovered = useMemo(() => {
    const today = new Date();
    const isVigente = (p: Policy) => {
      if (p.status !== "ativa") return false;
      if (!p.end_date) return true;
      return new Date(p.end_date + "T00:00:00") >= new Date(today.toDateString());
    };
    const activePolicies = policies.filter(isVigente);
    const activePolicyIds = new Set(activePolicies.map((p) => p.id));
    const norm = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const plateToVehicleId = new Map<string, string>();
    vehicles.forEach((v) => plateToVehicleId.set(norm(v.plate), v.id));
    const coveredIds = new Set<string>(
      links.filter((l) => activePolicyIds.has(l.policy_id) && !l.removed_at).map((l) => l.vehicle_id)
    );
    // também considera coberto qualquer veículo cujas placas/chassis aparecem na extração IA
    activePolicies.forEach((p) => {
      const ex: any = p.ai_extracted || {};
      const plates: string[] = Array.isArray(ex.plates)
        ? ex.plates
        : Array.isArray(ex.vehicles) ? ex.vehicles.map((x: any) => x?.plate).filter(Boolean) : [];
      plates.forEach((pl) => {
        const vid = plateToVehicleId.get(norm(pl));
        if (vid) coveredIds.add(vid);
      });
    });
    return vehicles.filter((v) => !coveredIds.has(v.id));
  }, [vehicles, links, policies]);

  // Apólices manuais (para anexar veículo via tab "Sem cobertura")
  const manualPolicies = useMemo(() => policies.filter((p) => !isAiPolicy(p)), [policies]);

  // Veículos assegurados: lista plana {vehicle, policy, link} para tab 1
  const assuredVehicles = useMemo(() => {
    const today = new Date();
    const isVigente = (p: Policy) => {
      if (p.status !== "ativa") return false;
      if (!p.end_date) return true;
      return new Date(p.end_date + "T00:00:00") >= new Date(today.toDateString());
    };
    const vigenteMap = new Map(policies.filter(isVigente).map((p) => [p.id, p]));
    const out: { vehicle: Vehicle; policy: Policy; link: Link }[] = [];
    links.forEach((l) => {
      const p = vigenteMap.get(l.policy_id);
      if (!p) return;
      const v = vehicles.find((x) => x.id === l.vehicle_id);
      if (!v) return;
      if (assuredFilter !== "all" && p.id !== assuredFilter) return;
      out.push({ vehicle: v, policy: p, link: l });
    });
    return out.sort((a, b) => a.vehicle.plate.localeCompare(b.vehicle.plate));
  }, [policies, links, vehicles, assuredFilter]);

  async function addVehicleToPolicy() {
    if (!addToPolicyVehicleId || !addToPolicyTargetId || !currentCompanyId) return;
    const target = policies.find((p) => p.id === addToPolicyTargetId);
    if (!target || isAiPolicy(target)) {
      toast.error("Selecione uma apólice manual.");
      return;
    }
    const r = await supabase.from("insurance_policy_vehicles").upsert({
      company_id: currentCompanyId,
      policy_id: addToPolicyTargetId,
      vehicle_id: addToPolicyVehicleId,
      inclusion_type: "manual",
      removed_at: null,
    }, { onConflict: "policy_id,vehicle_id" });
    if (r.error) { toast.error(r.error.message); return; }
    await syncVehicleInsuranceFields(currentCompanyId, [addToPolicyVehicleId]);
    toast.success("Veículo vinculado à apólice");
    setAddToPolicyVehicleId(null);
    setAddToPolicyTargetId("");
    load();
  }

  // === RESUMO GERAL (todas as apólices) ===
  const fleetSummary = useMemo(() => {
    const today = new Date();
    const isVigente = (p: Policy) => {
      if (p.status !== "ativa") return false;
      if (!p.end_date) return true;
      return new Date(p.end_date + "T00:00:00") >= new Date(today.toDateString());
    };
    const activePolicies = policies.filter(isVigente);
    const activeIds = new Set(activePolicies.map((p) => p.id));
    const norm = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    // Mapa placa -> id do veículo cadastrado
    const plateToVehicleId = new Map<string, string>();
    vehicles.forEach((v) => plateToVehicleId.set(norm(v.plate), v.id));
    const cadastradas = new Set(plateToVehicleId.keys());

    // Cobertos = vínculos ativos OU placas presentes em ai_extracted de qualquer apólice vigente
    const coveredVehicleIds = new Set<string>(
      links.filter((l) => activeIds.has(l.policy_id) && !l.removed_at).map((l) => l.vehicle_id)
    );
    const onlyInPolicy = new Set<string>();
    activePolicies.forEach((p) => {
      const ex: any = p.ai_extracted || {};
      const plates: string[] = Array.isArray(ex.plates)
        ? ex.plates
        : Array.isArray(ex.vehicles) ? ex.vehicles.map((v: any) => v?.plate).filter(Boolean) : [];
      plates.forEach((pl) => {
        const n = norm(pl);
        if (!n) return;
        const vid = plateToVehicleId.get(n);
        if (vid) coveredVehicleIds.add(vid);
        else onlyInPolicy.add(n);
      });
    });
    let vencidas = 0, vencendo30 = 0, vigentes = 0;
    policies.forEach((p) => {
      if (p.status !== "ativa") return;
      if (!p.end_date) { vigentes++; return; }
      const d = differenceInDays(new Date(p.end_date + "T00:00:00"), today);
      if (d < 0) vencidas++;
      else if (d <= 30) { vencendo30++; vigentes++; }
      else vigentes++;
    });
    return {
      coveredCount: coveredVehicleIds.size,
      onlyInPolicyCount: onlyInPolicy.size,
      uncoveredCount: vehicles.filter((v) => !coveredVehicleIds.has(v.id)).length,
      vigentes,
      vencendo30,
      vencidas,
    };
  }, [policies, links, vehicles]);

  // === Estatísticas por apólice (para os cards) ===
  const policyStats = useMemo(() => {
    const norm = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const cadastradas = new Set(vehicles.map((v) => norm(v.plate)));
    const map: Record<string, { covered: number; onlyInPolicy: number }> = {};
    policies.forEach((p) => {
      const linkedVehicleSet = new Set(
        links.filter((l) => l.policy_id === p.id && !l.removed_at).map((l) => l.vehicle_id)
      );
      const ex: any = p.ai_extracted || {};
      const plates: string[] = Array.isArray(ex.plates)
        ? ex.plates
        : Array.isArray(ex.vehicles) ? ex.vehicles.map((v: any) => v?.plate).filter(Boolean) : [];
      const platesN = plates.map((pl) => norm(pl)).filter(Boolean);
      // Cobertos por essa apólice: vínculos OU placas (cadastradas) extraídas pela IA
      const coveredPlates = new Set<string>();
      vehicles.forEach((v) => { if (linkedVehicleSet.has(v.id)) coveredPlates.add(norm(v.plate)); });
      platesN.forEach((pl) => { if (cadastradas.has(pl)) coveredPlates.add(pl); });
      const onlyInPolicy = platesN.filter((pl) => !cadastradas.has(pl)).length;
      map[p.id] = { covered: coveredPlates.size, onlyInPolicy };
    });
    return map;
  }, [policies, links, vehicles]);

  // Vincula em massa todas as placas da IA que estão cadastradas
  async function autoLinkAi() {
    if (!selectedPolicyId || !currentCompanyId || !validation) return;
    if (isAiPolicy(selectedPolicy)) {
      toast.error("Apólice importada via IA — vínculos são gerados automaticamente na importação.");
      return;
    }
    const toLink = validation.covered.filter((v) => !linkedVehicleIds.has(v.id));
    if (!toLink.length) { toast.info("Todos os veículos cobertos já estão vinculados."); return; }
    const rows = toLink.map((v) => ({
      company_id: currentCompanyId,
      policy_id: selectedPolicyId,
      vehicle_id: v.id,
      inclusion_type: (v.ai?.inclusion_type === "adendo" ? "adendo" : "apolice") as "apolice" | "adendo",
      removed_at: null,
    }));
    const { error } = await supabase.from("insurance_policy_vehicles")
      .upsert(rows, { onConflict: "policy_id,vehicle_id" });
    if (error) { toast.error(error.message); return; }
    await syncVehicleInsuranceFields(currentCompanyId, toLink.map((v) => v.id));
    toast.success(`${toLink.length} veículo(s) vinculado(s) automaticamente`);
    load();
  }

  const filteredVehicles = vehicles.filter((v) => {
    if (!vehicleSearch) return true;
    const q = vehicleSearch.toLowerCase();
    return [v.plate, v.brand, v.model].join(" ").toLowerCase().includes(q);
  });

  // === Busca global por placa ou chassi ===
  const globalSearchResult = useMemo(() => {
    const q = normId(globalSearch);
    if (!q || q.length < 3 || globalSearchMode !== "veiculo") return null;
    const matches = vehicles.filter(
      (v) => normId(v.plate).includes(q) || normId(v.chassis).includes(q)
    );
    return matches.slice(0, 10);
  }, [globalSearch, vehicles, globalSearchMode]);

  // === Busca global por apólice / seguradora / corretora ===
  const globalPolicyResult = useMemo(() => {
    const q = (globalSearch || "").trim().toLowerCase();
    if (!q || q.length < 3 || globalSearchMode === "veiculo") return null;
    const list = policies.filter((p) => {
      if (globalSearchMode === "apolice") {
        return normId(p.policy_number || "").includes(normId(globalSearch));
      }
      if (globalSearchMode === "seguradora") {
        return (p.insurer_name || "").toLowerCase().includes(q);
      }
      if (globalSearchMode === "corretora") {
        const broker = brokers.find((b) => b.id === p.broker_id);
        return (broker?.name || "").toLowerCase().includes(q);
      }
      return false;
    });
    return list.slice(0, 20);
  }, [globalSearch, globalSearchMode, policies, brokers]);

  // === Mapa de placas órfãs (em apólice vigente, sem cadastro de veículo) ===
  const orphanPlates = useMemo(() => {
    const today = new Date();
    const isVigente = (p: Policy) =>
      p.status === "ativa" &&
      (!p.end_date || new Date(p.end_date + "T00:00:00") >= new Date(today.toDateString()));
    const registeredPlates = new Set(vehicles.map((v) => normPlate(v.plate)).filter(Boolean));
    const map = new Map<string, { plate: string; entries: { policy: Policy; ai: AiVehicle }[] }>();
    for (const p of policies.filter(isVigente)) {
      const ex: any = p.ai_extracted || {};
      const list: AiVehicle[] = Array.isArray(ex.vehicles) && ex.vehicles.length
        ? ex.vehicles
        : (Array.isArray(ex.plates) ? ex.plates.map((pl: string) => ({ plate: pl } as AiVehicle)) : []);
      for (const a of list) {
        const key = normPlate(a.plate);
        if (!key) continue;
        if (registeredPlates.has(key)) continue;
        // antes de marcar como órfã, tenta cruzar por chassi/renavam
        const matchedByVin = vehicles.some(
          (v) => chassisMatch(v.chassis, a.chassis) || renavamEq(v.renavam, (a as any).renavam),
        );
        if (matchedByVin) continue;
        if (!map.has(key)) map.set(key, { plate: (a.plate || key).toUpperCase(), entries: [] });
        map.get(key)!.entries.push({ policy: p, ai: a });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.plate.localeCompare(b.plate));
  }, [policies, vehicles]);

  // === Resultado da busca por placa/chassi cobrindo os 4 cenários ===
  type SearchResult =
    | { kind: "scenario1"; vehicle: Vehicle; policies: Policy[] }
    | { kind: "scenario2"; vehicle: Vehicle }
    | { kind: "scenario3"; plate: string; entries: { policy: Policy; ai: AiVehicle }[] }
    | { kind: "scenario4"; term: string };

  const smartSearchResults = useMemo<SearchResult[] | null>(() => {
    if (globalSearchMode !== "veiculo") return null;
    const term = normId(globalSearch);
    if (!term || term.length < 3) return null;
    const today = new Date();
    const isVigente = (p: Policy) =>
      p.status === "ativa" &&
      (!p.end_date || new Date(p.end_date + "T00:00:00") >= new Date(today.toDateString()));

    const matchedVehicles = vehicles.filter(
      (v) => normId(v.plate).includes(term) || (v.chassis && normId(v.chassis).includes(term))
    );
    const matchedPlates = new Set(matchedVehicles.map((v) => normId(v.plate)));

    const policyHits = new Map<string, { policy: Policy; ai: AiVehicle }[]>();
    for (const p of policies.filter(isVigente)) {
      const ex: any = p.ai_extracted || {};
      const list: AiVehicle[] = Array.isArray(ex.vehicles) && ex.vehicles.length
        ? ex.vehicles
        : (Array.isArray(ex.plates) ? ex.plates.map((pl: string) => ({ plate: pl } as AiVehicle)) : []);
      for (const a of list) {
        const ap = normId(a.plate);
        const ac = normId(a.chassis);
        const hit = (ap && ap.includes(term)) || (ac && ac.includes(term));
        if (!hit) continue;
        const key = ap || ac;
        if (!key) continue;
        if (!policyHits.has(key)) policyHits.set(key, []);
        policyHits.get(key)!.push({ policy: p, ai: a });
      }
    }

    const results: SearchResult[] = [];
    for (const v of matchedVehicles.slice(0, 10)) {
      const pols = activePoliciesForVehicle(v.id);
      results.push(pols.length > 0
        ? { kind: "scenario1", vehicle: v, policies: pols }
        : { kind: "scenario2", vehicle: v });
    }
    for (const [key, entries] of policyHits) {
      // se a placa exata já corresponde a um veículo cadastrado, foi tratada acima
      if (matchedPlates.has(key)) continue;
      const isRegistered = vehicles.some((v) => normId(v.plate) === key);
      if (isRegistered) continue;
      const ai0 = entries[0].ai;
      results.push({ kind: "scenario3", plate: (ai0.plate || key).toUpperCase(), entries });
    }
    if (results.length === 0) results.push({ kind: "scenario4", term: globalSearch });
    return results;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalSearch, globalSearchMode, vehicles, policies, links]);

  function activePoliciesForVehicle(vehicleId: string) {
    const today = new Date();
    const v = vehicles.find((x) => x.id === vehicleId);
    const plateN = normId(v?.plate);
    const chassisN = normId(v?.chassis);
    const ids = new Set<string>(links
      .filter((l) => l.vehicle_id === vehicleId)
      .map((l) => l.policy_id));
    // também considera apólices que listam a placa/chassi via IA
    policies.forEach((p) => {
      const ex: any = p.ai_extracted || {};
      const plates: string[] = Array.isArray(ex.plates)
        ? ex.plates
        : Array.isArray(ex.vehicles) ? ex.vehicles.map((x: any) => x?.plate).filter(Boolean) : [];
      const chassisList: string[] = Array.isArray(ex.vehicles)
        ? ex.vehicles.map((x: any) => x?.chassis).filter(Boolean) : [];
      if (plateN && plates.some((pl) => normId(pl) === plateN)) ids.add(p.id);
      if (chassisN && chassisList.some((c) => normId(c) === chassisN)) ids.add(p.id);
    });
    return policies.filter((p) => {
      if (!ids.has(p.id)) return false;
      if (p.status !== "ativa") return false;
      if (!p.end_date) return true;
      return new Date(p.end_date + "T00:00:00") >= new Date(today.toDateString());
    });
  }

  const fmtBRL = (n: number | null | undefined) =>
    n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  function policyStatus(p: Policy) {
    if (!p.end_date) return { label: "Sem vigência", cls: "bg-muted/30 text-muted-foreground border-border" };
    const d = differenceInDays(new Date(p.end_date + "T00:00:00"), new Date());
    if (d < 0) return { label: `Vencida há ${Math.abs(d)}d`, cls: "bg-destructive/15 text-destructive border-destructive/30" };
    if (d <= 30) return { label: `Vence em ${d}d`, cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
    return { label: `Vigente (${d}d)`, cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  }

  function renderPolicyDetails() {
    if (!selectedPolicy) return null;
    const ex: any = selectedPolicy.ai_extracted || {};
    const coverageSummary = selectedPolicy.coverage_summary || ex.coverage_summary || "";
    const reserveCar = /carro\s*reserva|veículo\s*reserva|veiculo\s*reserva/i.test(coverageSummary);
    const broker = brokers.find((b) => b.id === selectedPolicy.broker_id);
    return (
      <>
        {policyIsAi && (
          <div className="rounded-lg border-2 border-destructive bg-destructive/15 p-2 space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-destructive shrink-0" />
              <div className="text-xs text-destructive font-bold">🔒 Apólice importada via IA — nenhuma alteração permitida</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setReviewOpen(true)}>
                <Search className="h-3.5 w-3.5" /> Revisar Veículos com Apólice
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/20"
                onClick={() => removePolicy(selectedPolicy.id)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir apólice
              </Button>
            </div>
          </div>
        )}

        {validation && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded-md bg-background/40 p-2 border border-border">
                <div className="text-[10px] uppercase text-muted-foreground">Vigência</div>
                <div className="text-xs font-medium">
                  {selectedPolicy.start_date ? format(new Date(selectedPolicy.start_date + "T00:00:00"), "dd/MM/yy") : "—"} →{" "}
                  {selectedPolicy.end_date ? format(new Date(selectedPolicy.end_date + "T00:00:00"), "dd/MM/yy") : "—"}
                </div>
                <Badge variant="outline" className={policyStatus(selectedPolicy).cls + " mt-1 text-[10px]"}>
                  {policyStatus(selectedPolicy).label}
                </Badge>
              </div>
              <div className="rounded-md bg-background/40 p-2 border border-border">
                <div className="text-[10px] uppercase text-muted-foreground">Prêmio total</div>
                <div className="text-sm font-bold text-primary">{fmtBRL(selectedPolicy.total_value)}</div>
                {validation.sumPremium > 0 && (
                  <div className="text-[10px] text-muted-foreground">Soma p/ veíc.: {fmtBRL(validation.sumPremium)}</div>
                )}
              </div>
              <div className="rounded-md bg-background/40 p-2 border border-border">
                <div className="text-[10px] uppercase text-muted-foreground">Franquia</div>
                <div className="text-sm font-bold">{fmtBRL(selectedPolicy.deductible)}</div>
              </div>
              <div className="rounded-md bg-background/40 p-2 border border-border">
                <div className="text-[10px] uppercase text-muted-foreground">IS Total</div>
                <div className="text-sm font-bold">{validation.sumIS > 0 ? fmtBRL(validation.sumIS) : "—"}</div>
              </div>
            </div>

            {/* Info adicional: corretor, contatos, tipo, carro reserva */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-background/40 p-2 border border-border">
                <div className="text-[10px] uppercase text-muted-foreground">Tipo de cobertura</div>
                <div className="font-medium">{coverageTypeLabel(selectedPolicy.coverage_type) || "—"}</div>
              </div>
              <div className="rounded-md bg-background/40 p-2 border border-border">
                <div className="text-[10px] uppercase text-muted-foreground">Carro reserva</div>
                <div className="font-medium flex items-center gap-1">
                  {reserveCar ? (
                    <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Sim</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px]">Não informado</Badge>
                  )}
                </div>
              </div>
              <div className="rounded-md bg-background/40 p-2 border border-border">
                <div className="text-[10px] uppercase text-muted-foreground">Seguradora</div>
                <div className="font-medium">{selectedPolicy.insurer_name}</div>
                {selectedPolicy.insurer_phone && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" /> {selectedPolicy.insurer_phone}</div>
                )}
              </div>
              <div className="rounded-md bg-background/40 p-2 border border-border">
                <div className="text-[10px] uppercase text-muted-foreground">Corretor</div>
                <div className="font-medium">{broker?.name || "—"}</div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                  {broker?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{broker.phone}</span>}
                  {broker?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{broker.email}</span>}
                </div>
              </div>
            </div>

            {coverageSummary && (
              <div className="rounded-md bg-background/40 p-2 border border-border text-xs">
                <div className="text-[10px] uppercase text-muted-foreground mb-1">Resumo de cobertura</div>
                <div className="whitespace-pre-wrap">{coverageSummary}</div>
              </div>
            )}

            {(() => {
              const coveredCount = validation.hasAi ? validation.covered.length : selectedLinks.length;
              return (
                <>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-md p-2 border bg-emerald-500/10 border-emerald-500/30">
                      <div className="text-lg font-bold text-emerald-400">{coveredCount}</div>
                      <div className="text-[10px] uppercase text-emerald-400/80">Cobertos & cadastrados</div>
                    </div>
                    <div className="rounded-md p-2 border bg-amber-500/10 border-amber-500/30">
                      <div className="text-lg font-bold text-amber-400">{validation.onlyInPolicy.length}</div>
                      <div className="text-[10px] uppercase text-amber-400/80">Na apólice s/ cadastro</div>
                    </div>
                  </div>

                  {validation.hasAi && validation.covered.length > 0 && !policyIsAi && (
                    <Button size="sm" variant="outline" onClick={autoLinkAi} className="w-full">
                      <Link2 className="h-3.5 w-3.5" /> Vincular automaticamente {validation.covered.filter((v: any) => !linkedVehicleIds.has(v.id)).length} pendente(s)
                    </Button>
                  )}

                  {validation.onlyInPolicy.length > 0 && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                      <div className="text-xs font-medium text-amber-400 flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Placas na apólice mas NÃO cadastradas ({validation.onlyInPolicy.length})
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {validation.onlyInPolicy.map((x: any) => (
                          <div key={x.plate} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-mono font-bold text-amber-400">{x.plate}</span>
                            <span className="text-muted-foreground truncate">{[x.ai?.brand, x.ai?.model, x.ai?.year].filter(Boolean).join(" ") || "—"}</span>
                            <span className="text-muted-foreground whitespace-nowrap">{fmtBRL(x.ai?.insured_amount ?? null)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {validation.linkedNotInAi.length > 0 && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2">
                      <div className="text-xs font-medium text-destructive flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Vinculados manualmente mas NÃO encontrados na apólice ({validation.linkedNotInAi.length})
                      </div>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {validation.linkedNotInAi.map((v: any) => (
                          <div key={v.id} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-mono font-bold text-destructive">{v.plate}</span>
                            <span className="text-muted-foreground truncate">{v.brand} {v.model}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        <div>
          <div className="text-xs uppercase text-muted-foreground mb-2 flex items-center gap-2">
            <Truck className="h-3.5 w-3.5" /> Veículos assegurados ({selectedLinks.length})
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {selectedLinks.length === 0 && (
              <div className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                Nenhum veículo vinculado a esta apólice ainda.
              </div>
            )}
            {selectedLinks.map((l) => {
              const v = vehicles.find((x) => x.id === l.vehicle_id);
              const norm = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
              const aiVeh = (ex.vehicles || []).find((av: any) => norm(av.plate || "") === norm(v?.plate || ""));
              return (
                <div key={l.id} className="flex items-center justify-between gap-2 p-2 rounded border border-border bg-muted/20">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="font-mono font-bold text-primary">{v?.plate || "—"}</span>
                    <span className="text-xs text-muted-foreground truncate">{v?.brand} {v?.model}</span>
                    {aiVeh?.insured_amount && (
                      <span className="text-[11px] text-emerald-400">IS: {fmtBRL(aiVeh.insured_amount)}</span>
                    )}
                    {aiVeh?.page_number && (
                      <Badge variant="outline" className="text-[10px] bg-muted/30 text-muted-foreground border-border">
                        Pág. {aiVeh.page_number}
                      </Badge>
                    )}
                    {selectedPolicy?.file_url && aiVeh?.page_number && (
                      <Button asChild variant="ghost" size="icon" className="h-6 w-6" title={`Abrir PDF na página ${aiVeh.page_number}`}>
                        <a href={`${selectedPolicy.file_url}#page=${aiVeh.page_number}`} target="_blank" rel="noreferrer">
                          <FileText className="h-3 w-3 text-primary" />
                        </a>
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {l.inclusion_type === "manual" ? (
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Manual</Badge>
                    ) : l.inclusion_type === "adendo" ? (
                      <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30 flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" /> Adendo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" /> Via apólice
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground">{format(new Date(l.included_at + "T00:00:00"), "dd/MM/yy")}</span>
                    {l.inclusion_type === "manual" && !policyIsAi && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => unlinkVehicle(l.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="apolices" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Apólices
            <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 ml-1">
              {policies.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="sem-cobertura" className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Sem Cobertura
            <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 ml-1">
              {companyUncovered.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ===================== TAB 0 — VISÃO GERAL ===================== */}
        <TabsContent value="overview" className="space-y-4 mt-0">
          {/* Consulta de seguro por placa ou chassi */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              <div>
                <div className="font-display font-bold">Consultar seguro do veículo</div>
                <div className="text-xs text-muted-foreground">Busque por placa ou chassi para ver todas as apólices vigentes que cobrem o veículo.</div>
              </div>
            </div>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 h-9"
                placeholder="Digite a placa ou chassi (mín. 3 caracteres)..."
                value={globalSearchMode === "veiculo" ? globalSearch : ""}
                onChange={(e) => { setGlobalSearchMode("veiculo"); setGlobalSearch(e.target.value); }}
              />
            </div>
            {smartSearchResults && (
              <div className="space-y-3">
                {smartSearchResults.map((r, idx) => {
                  if (r.kind === "scenario1") {
                    const v = r.vehicle;
                    return (
                      <div key={`s1-${v.id}`} className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 overflow-hidden">
                        <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border-b border-emerald-500/30 flex-wrap">
                          <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          <span className="font-mono font-bold text-emerald-400">{v.plate}</span>
                          <span className="text-sm text-muted-foreground">{[v.brand, v.model].filter(Boolean).join(" ") || "—"}</span>
                          {v.chassis && <span className="text-[11px] font-mono text-muted-foreground">Chassi: {v.chassis}</span>}
                          <Badge variant="outline" className="ml-auto bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                            {r.policies.length} apólice(s) ativa(s)
                          </Badge>
                        </div>
                        <div className="divide-y divide-border">
                          {r.policies.map((p) => {
                            const broker = brokers.find((b) => b.id === p.broker_id);
                            const st = policyStatus(p);
                            return (
                              <button key={p.id} type="button"
                                onClick={() => { setActiveTab("apolices"); setSelectedPolicyId(p.id); }}
                                className="w-full text-left p-3 space-y-2 hover:bg-muted/30 transition-colors">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="min-w-0">
                                    <div className="font-display font-bold flex items-center gap-2">
                                      <ShieldCheck className="h-4 w-4 text-primary" /> {p.insurer_name}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground font-mono">Apólice #{p.policy_number}</div>
                                  </div>
                                  <Badge variant="outline" className={st.cls + " whitespace-nowrap"}>{st.label}</Badge>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                  <div><div className="text-[10px] uppercase text-muted-foreground">Vigência</div>
                                    <div className="font-medium">{p.start_date || "—"} → {p.end_date || "—"}</div></div>
                                  <div><div className="text-[10px] uppercase text-muted-foreground">Tipo</div>
                                    <div className="font-medium">{coverageTypeLabel(p.coverage_type) || "—"}</div></div>
                                  <div><div className="text-[10px] uppercase text-muted-foreground">Franquia</div>
                                    <div className="font-medium">{fmtBRL(p.deductible)}</div></div>
                                  <div><div className="text-[10px] uppercase text-muted-foreground">Corretor</div>
                                    <div className="font-medium truncate">{broker?.name || "—"}</div></div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  if (r.kind === "scenario2") {
                    const v = r.vehicle;
                    return (
                      <div key={`s2-${v.id}`} className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                          <span className="font-mono font-bold text-amber-400">{v.plate}</span>
                          <span className="text-sm text-muted-foreground">{[v.brand, v.model].filter(Boolean).join(" ") || "—"}</span>
                          <Badge variant="outline" className="ml-auto bg-amber-500/15 text-amber-400 border-amber-500/30">SEM COBERTURA ATIVA</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">Veículo cadastrado, mas nenhuma apólice vigente cobre esta placa.</div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline"
                            onClick={() => { setAddToPolicyVehicleId(v.id); setActiveTab("sem-cobertura"); }}>
                            <Link2 className="h-3.5 w-3.5" /> Adicionar a uma apólice
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setActiveTab("apolices"); openNew(); }}>
                            <Plus className="h-3.5 w-3.5" /> Importar nova apólice
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  if (r.kind === "scenario3") {
                    return (
                      <div key={`s3-${r.plate}-${idx}`} className="rounded-lg border border-sky-500/40 bg-sky-500/5 overflow-hidden">
                        <div className="flex items-center gap-3 p-3 bg-sky-500/10 border-b border-sky-500/30 flex-wrap">
                          <Sparkles className="h-4 w-4 text-sky-400" />
                          <span className="font-mono font-bold text-sky-400">{r.plate}</span>
                          <span className="text-sm text-muted-foreground">Placa identificada na apólice</span>
                          <Badge variant="outline" className="ml-auto bg-sky-500/15 text-sky-400 border-sky-500/30">
                            Veículo NÃO cadastrado
                          </Badge>
                        </div>
                        <div className="p-3 space-y-3">
                          <div className="text-xs text-muted-foreground">
                            Esta placa aparece em {r.entries.length} apólice(s) ativa(s) mas não está cadastrada na sua frota.
                          </div>
                          <div className="space-y-2">
                            {r.entries.map(({ policy: p, ai }, i) => {
                              const st = policyStatus(p);
                              return (
                                <div key={`${p.id}-${i}`} className="rounded-md border border-border bg-background/40 p-3 space-y-1">
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <div className="min-w-0">
                                      <div className="font-display font-bold flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-primary" /> {p.insurer_name}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground font-mono">Apólice #{p.policy_number}</div>
                                    </div>
                                    <Badge variant="outline" className={st.cls + " whitespace-nowrap"}>{st.label}</Badge>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs pt-1">
                                    <div><div className="text-[10px] uppercase text-muted-foreground">Vigência</div>
                                      <div className="font-medium">{p.start_date || "—"} → {p.end_date || "—"}</div></div>
                                    <div><div className="text-[10px] uppercase text-muted-foreground">Modelo (apólice)</div>
                                      <div className="font-medium truncate">{[ai.brand, ai.model].filter(Boolean).join(" ") || "—"}{ai.year ? ` ${ai.year}` : ""}</div></div>
                                    <div><div className="text-[10px] uppercase text-muted-foreground">Cobertura</div>
                                      <div className="font-medium">{coverageTypeLabel(p.coverage_type) || "—"}</div></div>
                                  </div>
                                  <div className="pt-2">
                                    <Button size="sm" variant="ghost"
                                      onClick={() => { setActiveTab("apolices"); setSelectedPolicyId(p.id); }}>
                                      <ExternalLink className="h-3.5 w-3.5" /> Ver apólice
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button size="sm" onClick={() => openRegisterFromPolicy(r.entries[0].ai)}>
                              <Plus className="h-3.5 w-3.5" /> Cadastrar este veículo na frota
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  // scenario 4
                  return (
                    <div key={`s4-${idx}`} className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3 text-center">
                      <div className="flex items-center justify-center gap-2 text-destructive">
                        <ShieldAlert className="h-4 w-4" />
                        <span className="font-medium">Nenhum veículo nem apólice para "{r.term}"</span>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Button size="sm" onClick={() => openRegisterFromPolicy({ plate: r.term } as AiVehicle)}>
                          <Plus className="h-3.5 w-3.5" /> Cadastrar veículo novo
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setActiveTab("apolices"); openNew(); }}>
                          <Upload className="h-3.5 w-3.5" /> Importar nova apólice
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* 3 KPIs grandes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => { setActiveTab("apolices"); setAssuredFilter("all"); }}
              className="surface-card rounded-xl p-5 text-left hover:border-emerald-500/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Veículos cobertos</p>
                  <p className="font-display text-4xl font-bold mt-2 text-emerald-400">{fleetSummary.coveredCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">com apólice vigente</p>
                </div>
                <div className="h-10 w-10 rounded-lg grid place-items-center bg-emerald-500/15 text-emerald-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sem-cobertura")}
              className="surface-card rounded-xl p-5 text-left hover:border-destructive/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Sem cobertura</p>
                  <p className="font-display text-4xl font-bold mt-2 text-destructive">{companyUncovered.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">veículos ativos da frota</p>
                </div>
                <div className="h-10 w-10 rounded-lg grid place-items-center bg-destructive/15 text-destructive">
                  <ShieldAlert className="h-5 w-5" />
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("apolices")}
              className="surface-card rounded-xl p-5 text-left hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Apólices vigentes</p>
                  <p className="font-display text-4xl font-bold mt-2 text-primary">{fleetSummary.vigentes}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fleetSummary.vencidas > 0 && <span className="text-destructive">{fleetSummary.vencidas} vencidas · </span>}
                    {fleetSummary.vencendo30} vencendo em 30d
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg grid place-items-center bg-primary/15 text-primary">
                  <Activity className="h-5 w-5" />
                </div>
              </div>
            </button>
          </div>

          {/* Donut + Alertas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-primary" />
                <div className="font-display font-bold">Cobertura da frota</div>
              </div>
              {(() => {
                const total = fleetSummary.coveredCount + fleetSummary.uncoveredCount;
                const pctCov = total > 0 ? Math.round((fleetSummary.coveredCount / total) * 100) : 0;
                const data = [
                  { name: "Cobertos", value: fleetSummary.coveredCount },
                  { name: "Sem cobertura", value: fleetSummary.uncoveredCount },
                ];
                const COLORS = ["hsl(var(--success))", "hsl(var(--destructive))"];
                return (
                  <div className="flex items-center gap-4">
                    <div className="w-40 h-40 shrink-0 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                            {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                          </Pie>
                          <RTooltip
                            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 grid place-items-center pointer-events-none">
                        <div className="text-center">
                          <div className="font-display text-2xl font-bold text-emerald-400">{pctCov}%</div>
                          <div className="text-[10px] uppercase text-muted-foreground">cobertos</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-success" />
                        <span>{fleetSummary.coveredCount} cobertos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
                        <span>{fleetSummary.uncoveredCount} sem cobertura</span>
                      </div>
                      {fleetSummary.onlyInPolicyCount > 0 && (
                        <RouterLink
                          to="/app/insurance/orphans"
                          className="mt-2 flex items-center gap-2 text-xs text-sky-400 hover:underline"
                        >
                          <Sparkles className="h-3 w-3" />
                          {fleetSummary.onlyInPolicyCount} placa(s) em apólice sem cadastro · ver lista
                        </RouterLink>
                      )}
                    </div>
                  </div>
                );
              })()}
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <div className="font-display font-bold">Alertas críticos</div>
              </div>
              <div className="space-y-2 text-sm">
                {fleetSummary.vencendo30 === 0 && fleetSummary.vencidas === 0 && companyUncovered.length === 0 && (
                  <div className="text-xs text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Tudo em ordem.
                  </div>
                )}
                {fleetSummary.vencidas > 0 && (
                  <button onClick={() => setActiveTab("apolices")} className="w-full flex items-center justify-between p-2 rounded border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 transition-colors text-left">
                    <span className="flex items-center gap-2 text-destructive">
                      <ShieldAlert className="h-4 w-4" /> {fleetSummary.vencidas} apólice(s) vencida(s)
                    </span>
                    <ExternalLink className="h-3 w-3 text-destructive" />
                  </button>
                )}
                {fleetSummary.vencendo30 > 0 && (
                  <button onClick={() => setActiveTab("apolices")} className="w-full flex items-center justify-between p-2 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-colors text-left">
                    <span className="flex items-center gap-2 text-amber-400">
                      <CalendarClock className="h-4 w-4" /> {fleetSummary.vencendo30} apólice(s) vencendo em ≤ 30 dias
                    </span>
                    <ExternalLink className="h-3 w-3 text-amber-400" />
                  </button>
                )}
                {companyUncovered.length > 0 && (
                  <button onClick={() => setActiveTab("sem-cobertura")} className="w-full flex items-center justify-between p-2 rounded border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 transition-colors text-left">
                    <span className="flex items-center gap-2 text-destructive">
                      <Truck className="h-4 w-4" /> {companyUncovered.length} veículo(s) ativos sem cobertura
                    </span>
                    <ExternalLink className="h-3 w-3 text-destructive" />
                  </button>
                )}
                {orphanPlates.length > 0 && (
                  <RouterLink
                    to="/app/insurance/orphans"
                    className="w-full flex items-center justify-between p-2 rounded border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2 text-sky-400">
                      <Sparkles className="h-4 w-4" /> {orphanPlates.length} placa(s) coberta(s) por apólice mas SEM cadastro
                    </span>
                    <ExternalLink className="h-3 w-3 text-sky-400" />
                  </RouterLink>
                )}
              </div>
            </Card>
          </div>

          {/* Próximas a vencer */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="h-4 w-4 text-primary" />
              <div className="font-display font-bold">Próximas a vencer</div>
            </div>
            {(() => {
              const today = new Date();
              const upcoming = policies
                .filter((p) => p.status === "ativa" && p.end_date)
                .map((p) => ({ p, days: differenceInDays(new Date(p.end_date! + "T00:00:00"), today) }))
                .filter((x) => x.days >= 0 && x.days <= 90)
                .sort((a, b) => a.days - b.days)
                .slice(0, 5);
              if (upcoming.length === 0) {
                return <div className="text-xs text-muted-foreground py-4 text-center">Nenhuma apólice vence nos próximos 90 dias.</div>;
              }
              return (
                <div className="space-y-1">
                  {upcoming.map(({ p, days }) => {
                    const st = policyStatus(p);
                    const vCount = links.filter((l) => l.policy_id === p.id).length;
                    return (
                      <button
                        key={p.id}
                        onClick={() => { setActiveTab("apolices"); setSelectedPolicyId(p.id); }}
                        className="w-full flex items-center justify-between gap-2 p-2 rounded border border-border bg-muted/10 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.insurer_name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">#{p.policy_number} · {vCount} veíc.</div>
                        </div>
                        <Badge variant="outline" className={st.cls + " whitespace-nowrap"}>{st.label}</Badge>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </Card>
        </TabsContent>

        {/* ===================== TAB 1 — APÓLICES ===================== */}
        <TabsContent value="apolices" className="space-y-4 mt-0">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-display font-bold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Apólices da frota</div>
            <div className="text-xs text-muted-foreground">Suba o PDF — a IA extrai dados, corretor e placas cobertas. Clique num card para expandir.</div>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4" /> Nova apólice</Button>
        </div>

        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 h-9"
            placeholder="Filtrar por seguradora, nº da apólice ou corretor..."
            value={policySearch}
            onChange={(e) => setPolicySearch(e.target.value)}
          />
        </div>

        <div className="space-y-2 max-h-[800px] overflow-y-auto">
          {loading && <div className="text-sm text-muted-foreground py-4 text-center">Carregando…</div>}
          {!loading && policies.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhuma apólice cadastrada.</div>
          )}
          {policies
            .filter((p) => {
              const q = policySearch.trim().toLowerCase();
              if (!q) return true;
              const broker = brokers.find((b) => b.id === p.broker_id);
              return [p.insurer_name, p.policy_number, broker?.name].filter(Boolean).join(" ").toLowerCase().includes(q);
            })
            .map((p) => {
            const st = policyStatus(p);
            const broker = brokers.find((b) => b.id === p.broker_id);
            const vCount = links.filter((l) => l.policy_id === p.id).length;
            const isSel = p.id === selectedPolicyId;
            return (
              <div key={p.id} className="space-y-0">
              <div
                onClick={() => setSelectedPolicyId(isSel ? null : p.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${isSel ? "bg-primary/10 border-primary/40 rounded-b-none" : "border-border hover:bg-muted/30"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.insurer_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">#{p.policy_number}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> {vCount} veíc.</span>
                      {broker && <span className="text-xs text-muted-foreground">Corretor: {broker.name}</span>}
                      {p.insurer_phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{p.insurer_phone}</span>}
                      {coverageTypeLabel(p.coverage_type) && <span className="text-xs text-muted-foreground">Tipo: {coverageTypeLabel(p.coverage_type)}</span>}
                    </div>
                    {p.start_date && p.end_date && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {format(new Date(p.start_date + "T00:00:00"), "dd/MM/yy")} → {format(new Date(p.end_date + "T00:00:00"), "dd/MM/yy")}
                      </div>
                    )}
                    {(() => {
                      const s = policyStats[p.id] || { covered: 0, onlyInPolicy: 0 };
                      return (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0.5">
                            {s.covered} cobertos
                          </Badge>
                          {s.onlyInPolicy > 0 && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0.5">
                              {s.onlyInPolicy} s/ cadastro
                            </Badge>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-end text-muted-foreground">
                      {isSel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                    {p.file_url && (
                      <Button asChild variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                        <a href={p.file_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                    )}
                    {(() => {
                      const isAi = isAiPolicy(p);
                      if (isAi) {
                        return (
                          <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] flex items-center gap-1 px-1.5 py-0.5">
                            <Lock className="h-2.5 w-2.5" /> IA
                          </Badge>
                        );
                      }
                      return (
                        <>
                          <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 text-[10px] px-1.5 py-0.5">
                            Manual
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); removePolicy(p.id); }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
              {isSel && (
                <div className="border border-t-0 border-primary/40 bg-background/40 rounded-b-lg p-3 space-y-3 animate-accordion-down">
                  {renderPolicyDetails()}
                </div>
              )}
              </div>
            );
          })}
        </div>
      </Card>
        </TabsContent>

        {/* ===================== TAB 2 — SEM COBERTURA ===================== */}
        <TabsContent value="sem-cobertura" className="mt-0">
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <div>
                <div className="font-display font-bold">Veículos sem cobertura</div>
                <div className="text-xs text-muted-foreground">
                  {companyUncovered.length === 0
                    ? "Toda a frota possui apólice vigente."
                    : `${companyUncovered.length} veículo(s) ativos da frota sem nenhuma apólice vigente.`}
                </div>
              </div>
            </div>
            {companyUncovered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-10 text-center border border-dashed border-border rounded-lg">
                ✓ Nenhum veículo sem cobertura.
              </div>
            ) : (
              <>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 h-9"
                  placeholder="Buscar por placa, marca ou modelo..."
                  value={uncoveredSearch}
                  onChange={(e) => setUncoveredSearch(e.target.value)}
                />
              </div>
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {(() => {
                  const q = uncoveredSearch.trim().toLowerCase();
                  const list = q
                    ? companyUncovered.filter((v) =>
                        [v.plate, v.brand, v.model].filter(Boolean).join(" ").toLowerCase().includes(q),
                      )
                    : companyUncovered;
                  if (list.length === 0) {
                    return (
                      <div className="text-xs text-muted-foreground py-6 text-center">
                        Nenhum veículo encontrado para "{uncoveredSearch}".
                      </div>
                    );
                  }
                  return list.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 p-2 rounded border border-destructive/30 bg-destructive/5">
                    <div className="flex items-center gap-3 min-w-0 flex-1 flex-wrap">
                      <span className="font-mono font-bold text-destructive">{v.plate}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {[v.brand, v.model].filter(Boolean).join(" ") || "—"}
                      </span>
                      {v.vehicle_type && <Badge variant="outline" className="text-[10px] h-5">{v.vehicle_type}</Badge>}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-destructive/40 text-destructive hover:bg-destructive/20"
                      onClick={() => {
                        setAddToPolicyVehicleId(v.id);
                        setAddToPolicyTargetId(manualPolicies[0]?.id || "");
                      }}
                    >
                      <Link2 className="h-3 w-3" /> Adicionar à apólice
                    </Button>
                  </div>
                  ));
                })()}
              </div>
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG — adicionar veículo a uma apólice (Tab 2) */}
      <Dialog open={!!addToPolicyVehicleId} onOpenChange={(o) => { if (!o) { setAddToPolicyVehicleId(null); setAddToPolicyTargetId(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adicionar veículo a uma apólice</DialogTitle></DialogHeader>
          {(() => {
            const v = vehicles.find((x) => x.id === addToPolicyVehicleId);
            return v ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-2 rounded border border-border bg-muted/20">
                  <Truck className="h-4 w-4 text-primary" />
                  <span className="font-mono font-bold text-primary">{v.plate}</span>
                  <span className="text-xs text-muted-foreground truncate">{[v.brand, v.model].filter(Boolean).join(" ") || "—"}</span>
                </div>
                <div>
                  <Label>Apólice de destino (somente manuais)</Label>
                  <Select value={addToPolicyTargetId} onValueChange={setAddToPolicyTargetId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar apólice..." /></SelectTrigger>
                    <SelectContent>
                      {manualPolicies.length === 0 && (
                        <SelectItem value="none" disabled>Nenhuma apólice manual cadastrada</SelectItem>
                      )}
                      {manualPolicies.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.insurer_name} · #{p.policy_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Apólices importadas via IA não permitem vínculo manual. Crie uma nova apólice se necessário.
                  </div>
                </div>
              </div>
            ) : null;
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddToPolicyVehicleId(null); setAddToPolicyTargetId(""); }}>Cancelar</Button>
            <Button onClick={addVehicleToPolicy} disabled={!addToPolicyTargetId || manualPolicies.length === 0}>Vincular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG — Revisar veículos da apólice (IA) */}
      <Dialog open={reviewOpen} onOpenChange={(o) => { setReviewOpen(o); if (!o) setReviewResult(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" /> Revisão de veículos · {selectedPolicy?.insurer_name} #{selectedPolicy?.policy_number}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2 -mt-1">
            <Button size="sm" onClick={runAiReview} disabled={reviewLoading || !selectedPolicy?.file_url}>
              {reviewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {reviewLoading ? "IA analisando apólice..." : "Analisar com IA (apólice × cadastro)"}
            </Button>
            {!selectedPolicy?.file_url && (
              <span className="text-[11px] text-muted-foreground">Anexe um PDF na apólice para liberar a análise.</span>
            )}
          </div>

          {reviewResult && (() => {
            const r = reviewResult || {};
            const added: any[] = Array.isArray(r.added_in_policy_not_in_registry) ? r.added_in_policy_not_in_registry : [];
            const missing: any[] = Array.isArray(r.in_registry_not_in_policy) ? r.in_registry_not_in_policy : [];
            const inPolicy: any[] = Array.isArray(r.vehicles_in_policy) ? r.vehicles_in_policy : [];
            const divergences: any[] = Array.isArray(r.divergences) ? r.divergences : [];
            return (
              <div className="space-y-3 rounded-lg border-2 border-primary/40 bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> Análise da IA
                </div>
                {r.summary && <div className="text-xs whitespace-pre-wrap">{r.summary}</div>}

                {added.length > 0 && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
                    <div className="text-xs font-medium text-amber-400 flex items-center gap-1 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> Veículos NA apólice mas NÃO no cadastro ({added.length})
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {added.map((x: any) => (
                        <div key={x.plate} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-mono font-bold text-amber-400">{x.plate}</span>
                          <span className="text-muted-foreground truncate flex-1">
                            {[x.brand, x.model, x.year].filter(Boolean).join(" ") || "—"}
                            {x.inclusion_type === "adendo" && (
                              <Badge variant="outline" className="ml-1 text-[9px] bg-amber-500/15 text-amber-400 border-amber-500/30">
                                Adendo {x.endorsement_number || ""}
                              </Badge>
                            )}
                          </span>
                          {x.page_number && selectedPolicy?.file_url && (
                            <Button asChild variant="ghost" size="icon" className="h-5 w-5">
                              <a href={`${selectedPolicy.file_url}#page=${x.page_number}`} target="_blank" rel="noreferrer" title={`Pág. ${x.page_number}`}>
                                <FileText className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {divergences.length > 0 && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                    <div className="text-xs font-medium text-amber-400 flex items-center gap-1 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> Divergências de dados ({divergences.length})
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {divergences.map((d: any, i: number) => (
                        <div key={i} className="text-[11px] flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400">{d.plate}</span>
                          <span className="text-muted-foreground">{d.field}:</span>
                          <span>"{d.policy_value || "—"}"</span>
                          <span className="text-muted-foreground">vs</span>
                          <span>"{d.registry_value || "—"}"</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {missing.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2">
                    <div className="text-xs font-medium text-destructive flex items-center gap-1 mb-1">
                      <ShieldAlert className="h-3.5 w-3.5" /> Cadastrados mas SEM esta apólice ({missing.length})
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {missing.map((x: any) => (
                        <div key={x.plate} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-mono font-bold text-destructive">{x.plate}</span>
                          <span className="text-muted-foreground truncate">{[x.brand, x.model].filter(Boolean).join(" ") || "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {added.length === 0 && missing.length === 0 && divergences.length === 0 && (
                  <div className="text-xs text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Tudo em ordem: nenhum veículo extra na apólice e nenhuma divergência detectada.
                  </div>
                )}

                <details className="text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer">Ver detalhamento por veículo da apólice ({inPolicy.length})</summary>
                  <div className="mt-1 space-y-0.5">
                    {inPolicy.map((v: any) => (
                      <div key={v.plate} className="flex items-center gap-2">
                        <span className="font-mono font-bold">{v.plate}</span>
                        <span className="truncate flex-1">{[v.brand, v.model, v.year].filter(Boolean).join(" ") || "—"}</span>
                        <Badge variant="outline" className={
                          v.status_vs_registry === "cadastrado_ok"
                            ? "text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : v.status_vs_registry === "cadastrado_divergente"
                              ? "text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "text-[9px] bg-destructive/15 text-destructive border-destructive/30"
                        }>
                          {v.status_vs_registry?.replace(/_/g, " ") || "—"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            );
          })()}

          {(() => {
            if (!selectedPolicy) return null;
            const ex: any = selectedPolicy.ai_extracted || {};
            const aiVeh: AiVehicle[] = Array.isArray(ex.vehicles) ? ex.vehicles : [];
            const norm = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
            const linkedSet = new Set(selectedLinks.map((l) => l.vehicle_id));
            const rows = aiVeh.map((v) => {
              const plateN = norm(v.plate);
              const reg = vehicles.find((x) => norm(x.plate) === plateN) || null;
              const linked = reg ? linkedSet.has(reg.id) : false;
              return { v, reg, linked, plateN };
            });
            const cadastrados = rows.filter((r) => !!r.reg).length;
            const vinculados = rows.filter((r) => r.linked).length;
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md p-2 border border-border bg-background/40">
                    <div className="text-lg font-bold">{rows.length}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">Na apólice (IA)</div>
                  </div>
                  <div className="rounded-md p-2 border border-emerald-500/30 bg-emerald-500/10">
                    <div className="text-lg font-bold text-emerald-400">{cadastrados}</div>
                    <div className="text-[10px] uppercase text-emerald-400/80">Cadastrados na frota</div>
                  </div>
                  <div className="rounded-md p-2 border border-amber-500/30 bg-amber-500/10">
                    <div className="text-lg font-bold text-amber-400">{vinculados}</div>
                    <div className="text-[10px] uppercase text-amber-400/80">Vinculados à apólice</div>
                  </div>
                </div>
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] uppercase text-muted-foreground bg-muted/30 border-b border-border">
                    <div className="col-span-2">Placa</div>
                    <div className="col-span-4">Veículo</div>
                    <div className="col-span-2 text-right">IS</div>
                    <div className="col-span-2 text-right">Prêmio</div>
                    <div className="col-span-1 text-center">Pág.</div>
                    <div className="col-span-1 text-center">Status</div>
                  </div>
                  <div className="max-h-[55vh] overflow-y-auto divide-y divide-border">
                    {rows.length === 0 && (
                      <div className="text-xs text-muted-foreground py-6 text-center">Nenhum veículo extraído pela IA.</div>
                    )}
                    {rows.map(({ v, reg, linked }) => (
                      <div key={v.plate} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs items-center">
                        <div className="col-span-2 font-mono font-bold text-primary">{v.plate}</div>
                        <div className="col-span-4 truncate">
                          {[v.brand, v.model, v.year].filter(Boolean).join(" ") || "—"}
                          {v.inclusion_type === "adendo" && (
                            <Badge variant="outline" className="ml-1 text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30">Adendo</Badge>
                          )}
                        </div>
                        <div className="col-span-2 text-right font-medium">{fmtBRL(v.insured_amount ?? null)}</div>
                        <div className="col-span-2 text-right">{fmtBRL(v.premium ?? null)}</div>
                        <div className="col-span-1 text-center">
                          {(v as any).page_number && selectedPolicy?.file_url ? (
                            <Button asChild variant="ghost" size="icon" className="h-6 w-6" title={`Pág. ${(v as any).page_number}`}>
                              <a href={`${selectedPolicy.file_url}#page=${(v as any).page_number}`} target="_blank" rel="noreferrer">
                                <FileText className="h-3 w-3" />
                              </a>
                            </Button>
                          ) : <span className="text-muted-foreground">—</span>}
                        </div>
                        <div className="col-span-1 text-center">
                          {linked ? (
                            <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">OK</Badge>
                          ) : reg ? (
                            <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30">S/ vínc.</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] bg-destructive/15 text-destructive border-destructive/30">S/ cad.</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE APÓLICE */}
      <Dialog open={policyDialog} onOpenChange={setPolicyDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar apólice" : "Nova apólice"}</DialogTitle></DialogHeader>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              {form.file_url ? (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">{form.file_name || "PDF anexado"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={reextract} disabled={reextracting || extracting}>
                      {reextracting || extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Reanalisar com IA
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a href={form.file_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Ver</a>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, file_url: null, file_name: null }))}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />
                  <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground py-2">
                    {uploading || extracting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        {extracting ? <>IA lendo a apólice...</> : <>Enviando PDF...</>}
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5" />
                        <span>Clique para enviar o PDF da apólice</span>
                        <span className="text-[11px] flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> A IA preenche os campos e identifica as placas automaticamente</span>
                      </>
                    )}
                  </div>
                </label>
              )}
            </div>

            {aiVehicles.length > 0 ? (() => {
              const matches = aiVehicles.map((v) => matchAiVehicle(v, vehicles));
              const linkedM = matches.filter((m) => m.status === "linked");
              const mismatchM = matches.filter((m) => m.status === "mismatch");
              const notFoundM = matches.filter((m) => m.status === "not_found");
              return (
                <div className="space-y-3">
                  <div className="text-xs font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-primary" /> Resultado da importação ({aiVehicles.length} veículo(s))
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* QUADRANTE 1 — VINCULADOS */}
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                      <div className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> Vinculados ({linkedM.length})
                      </div>
                      {linkedM.length === 0 ? (
                        <div className="text-[11px] text-muted-foreground">Nenhum veículo da apólice foi encontrado no cadastro.</div>
                      ) : (
                        <div className="space-y-1 max-h-56 overflow-y-auto">
                          {linkedM.map((m) => (
                            <div key={m.ai.plate} className="flex items-center justify-between gap-2 text-[11px] p-1.5 rounded bg-background/40">
                              <span className="font-mono font-bold text-emerald-400">{m.vehicle!.plate}</span>
                              <span className="text-muted-foreground truncate">{[m.vehicle!.brand, m.vehicle!.model].filter(Boolean).join(" ") || "—"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-2">Serão vinculados automaticamente ao salvar.</div>
                    </div>
                    {/* QUADRANTE 2 — NÃO ENCONTRADOS */}
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                      <div className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Não encontrados ({notFoundM.length})
                      </div>
                      {notFoundM.length === 0 ? (
                        <div className="text-[11px] text-muted-foreground">Todos os veículos da apólice estão cadastrados.</div>
                      ) : (
                        <div className="space-y-1 max-h-56 overflow-y-auto">
                          {notFoundM.map((m) => (
                            <div key={m.ai.plate} className="text-[11px] p-1.5 rounded bg-background/40">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-bold text-amber-400">{m.ai.plate || "—"}</span>
                                <span className="text-muted-foreground truncate">{[m.ai.brand, m.ai.model, m.ai.year].filter(Boolean).join(" ") || "—"}</span>
                              </div>
                              {m.ai.chassis && <div className="font-mono text-[10px] text-muted-foreground">Chassi: {m.ai.chassis}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-[10px] text-amber-400/80 mt-2">Esses veículos vieram na apólice mas não existem no cadastro. Cadastre-os manualmente para vinculá-los.</div>
                    </div>
                  </div>
                  {mismatchM.length > 0 && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <div className="text-xs font-bold text-destructive mb-2 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Inconsistência placa × chassi ({mismatchM.length})
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {mismatchM.map((m) => (
                          <div key={m.ai.plate} className="text-[11px] p-1.5 rounded bg-background/40">
                            <div className="font-mono font-bold text-destructive">{m.ai.plate}</div>
                            <div className="text-muted-foreground">{m.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })() : aiPlates.length > 0 && (
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                <div className="text-xs font-medium mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3" /> Placas identificadas pela IA</div>
                <div className="flex flex-wrap gap-1">
                  {aiPlates.map((p) => {
                    const found = vehicles.some((v) => v.plate.toUpperCase() === p);
                    return (
                      <Badge key={p} variant="outline" className={found ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-mono" : "bg-amber-500/15 text-amber-400 border-amber-500/30 font-mono"}>
                        {p} {!found && "·não cadastrada"}
                      </Badge>
                    );
                  })}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">As placas cadastradas serão vinculadas como apólice ao salvar.</div>
              </div>
            )}

            {(() => {
              const aiLocked = isAiPolicy(form as any);
              const lockedCls = aiLocked ? "bg-muted/40 cursor-not-allowed" : "";
              const LockLabel = ({ children }: { children: React.ReactNode }) => (
                <Label className="flex items-center gap-1">{children}{aiLocked && <Lock className="h-3 w-3 text-muted-foreground" />}</Label>
              );
              return (
            <div className="grid grid-cols-2 gap-3">
              {aiLocked && (
                <div className="col-span-2 text-[11px] text-muted-foreground bg-muted/20 border border-border rounded p-2 flex items-center gap-2">
                  <Lock className="h-3 w-3" /> Os dados desta apólice foram extraídos do PDF pela IA e são somente leitura. Para alterá-los, importe uma nova apólice.
                </div>
              )}
              <div>
                <LockLabel>Número da apólice *</LockLabel>
                <Input className={lockedCls} readOnly={aiLocked} value={form.policy_number || ""} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} />
              </div>
              <div>
                <LockLabel>Seguradora *</LockLabel>
                <Input className={lockedCls} readOnly={aiLocked} value={form.insurer_name || ""} onChange={(e) => setForm({ ...form, insurer_name: e.target.value })} />
              </div>
              <div>
                <LockLabel>Telefone seguradora</LockLabel>
                <Input className={lockedCls} readOnly={aiLocked} value={form.insurer_phone || ""} onChange={(e) => setForm({ ...form, insurer_phone: e.target.value })} />
              </div>
              <div>
                <LockLabel>Email seguradora</LockLabel>
                <Input className={lockedCls} readOnly={aiLocked} value={form.insurer_email || ""} onChange={(e) => setForm({ ...form, insurer_email: e.target.value })} />
              </div>
              <div>
                <LockLabel>Início vigência</LockLabel>
                <Input className={lockedCls} readOnly={aiLocked} type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <LockLabel>Fim vigência</LockLabel>
                <Input className={lockedCls} readOnly={aiLocked} type="date" value={form.end_date || ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div>
                <LockLabel>Prêmio total (R$)</LockLabel>
                <Input className={lockedCls} readOnly={aiLocked} type="number" step="0.01" value={form.total_value ?? ""} onChange={(e) => setForm({ ...form, total_value: e.target.value ? parseFloat(e.target.value) : null })} />
              </div>
              <div>
                <LockLabel>Franquia (R$)</LockLabel>
                <Input className={lockedCls} readOnly={aiLocked} type="number" step="0.01" value={form.deductible ?? ""} onChange={(e) => setForm({ ...form, deductible: e.target.value ? parseFloat(e.target.value) : null })} />
              </div>
              <div>
                <LockLabel>Tipo de cobertura</LockLabel>
                <Select value={form.coverage_type || "none"} onValueChange={(v) => !aiLocked && setForm({ ...form, coverage_type: v === "none" ? null : v })}>
                  <SelectTrigger className={lockedCls} disabled={aiLocked}><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Não definido —</SelectItem>
                    {COVERAGE_TYPES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Corretor</Label>
                <Select value={form.broker_id || "none"} onValueChange={(v) => setForm({ ...form, broker_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar corretor..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {brokers.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <LockLabel>Coberturas</LockLabel>
                <Textarea className={lockedCls} readOnly={aiLocked} value={form.coverage_summary || ""} onChange={(e) => setForm({ ...form, coverage_summary: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPolicyDialog(false)}>Cancelar</Button>
            <Button onClick={savePolicy} disabled={uploading || extracting || savingPolicy}>
              {savingPolicy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {savingPolicy ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VehicleDialog
        open={vehicleDialogOpen}
        onOpenChange={(o: boolean) => {
          setVehicleDialogOpen(o);
          if (!o) setVehiclePrefill(null);
        }}
        vehicle={null}
        prefill={vehiclePrefill}
        onSaved={async () => {
          setVehicleDialogOpen(false);
          setVehiclePrefill(null);
          toast.success("Veículo cadastrado. Vinculando à apólice…");
          await load();
        }}
      />
    </div>
  );
}