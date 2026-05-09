import { useEffect, useMemo, useState } from "react";
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
import { Plus, Upload, Sparkles, Pencil, Trash2, FileText, ExternalLink, Phone, Search, Truck, ShieldCheck, AlertTriangle, Loader2, Link2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

type Broker = { id: string; name: string; phone?: string | null; email?: string | null };
type Vehicle = { id: string; plate: string; brand: string; model: string; status: string; chassis: string | null };
type AiVehicle = {
  plate: string;
  brand?: string | null;
  model?: string | null;
  year?: string | null;
  fipe_code?: string | null;
  chassis?: string | null;
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
  inclusion_type: "apolice" | "adendo";
  included_at: string;
  endorsement_number: string | null;
};

const emptyPolicy: Partial<Policy> = { status: "ativa" };

/** Normaliza placa/chassi: maiúsculas e somente A-Z/0-9. */
function normId(s?: string | null): string {
  return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
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
  const aiPlate = normId(ai.plate);
  const aiChassis = normId(ai.chassis);

  let v: Vehicle | undefined;
  if (aiPlate) v = vehicles.find((x) => normId(x.plate) === aiPlate);
  if (!v && aiChassis) v = vehicles.find((x) => normId(x.chassis) === aiChassis);

  if (!v) return { ai, vehicle: null, status: "not_found" };

  // Inconsistência: ambos os lados têm placa+chassi e algum não confere
  const dbPlate = normId(v.plate);
  const dbChassis = normId(v.chassis);
  if (aiPlate && dbPlate && aiPlate !== dbPlate) {
    return { ai, vehicle: v, status: "mismatch", reason: `Placa do banco (${v.plate}) ≠ placa da apólice (${ai.plate})` };
  }
  if (aiChassis && dbChassis && aiChassis !== dbChassis) {
    return { ai, vehicle: v, status: "mismatch", reason: `Chassi do banco (${v.chassis}) ≠ chassi da apólice (${ai.chassis})` };
  }
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

  const [vehicleSearch, setVehicleSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");

  async function load() {
    if (!currentCompanyId) return;
    setLoading(true);
    const [p, b, v, l] = await Promise.all([
      supabase.from("insurance_policies").select("*").eq("company_id", currentCompanyId).order("end_date", { ascending: false, nullsFirst: false }),
      supabase.from("insurance_brokers").select("id,name,phone,email").eq("company_id", currentCompanyId).eq("active", true).order("name"),
      supabase.from("vehicles").select("id,plate,brand,model,status,chassis").eq("company_id", currentCompanyId).eq("status", "ativo").order("plate"),
      supabase.from("insurance_policy_vehicles").select("*").eq("company_id", currentCompanyId).is("removed_at", null),
    ]);
    if (p.error) toast.error(p.error.message);
    setPolicies((p.data as any[]) || []);
    setBrokers((b.data as any[]) || []);
    setVehicles((v.data as any[]) || []);
    setLinks((l.data as any[]) || []);
    if (!selectedPolicyId && (p.data as any[])?.length) setSelectedPolicyId((p.data as any[])[0].id);
    setLoading(false);
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
    if (!form.policy_number?.trim() || !form.insurer_name?.trim()) {
      toast.error("Número e seguradora são obrigatórios"); return;
    }
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
      file_url: form.file_url || null,
      file_name: form.file_name || null,
      notes: form.notes || null,
      status: form.status || "ativa",
      ai_extracted: { ...(form.ai_extracted || {}), plates: aiPlates, vehicles: aiVehicles },
    };
    let policyId = form.id;
    if (form.id) {
      const r = await supabase.from("insurance_policies").update(payload).eq("id", form.id);
      if (r.error) { toast.error(r.error.message); return; }
    } else {
      const r = await supabase.from("insurance_policies").insert(payload).select("id").single();
      if (r.error) { toast.error(r.error.message); return; }
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

  async function linkVehicle(vehicleId: string, type: "apolice" | "adendo") {
    if (!selectedPolicyId || !currentCompanyId) return;
    const r = await supabase.from("insurance_policy_vehicles").upsert({
      company_id: currentCompanyId,
      policy_id: selectedPolicyId,
      vehicle_id: vehicleId,
      inclusion_type: type,
      removed_at: null,
    }, { onConflict: "policy_id,vehicle_id" });
    if (r.error) { toast.error(r.error.message); return; }
    await syncVehicleInsuranceFields(currentCompanyId, [vehicleId]);
    toast.success(type === "adendo" ? "Adendo registrado" : "Veículo incluído");
    load();
  }

  async function unlinkVehicle(linkId: string) {
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

  // Vincula em massa todas as placas da IA que estão cadastradas
  async function autoLinkAi() {
    if (!selectedPolicyId || !currentCompanyId || !validation) return;
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
    if (!q || q.length < 3) return null;
    const matches = vehicles.filter(
      (v) => normId(v.plate).includes(q) || normId(v.chassis).includes(q)
    );
    return matches.slice(0, 10);
  }, [globalSearch, vehicles]);

  function activePoliciesForVehicle(vehicleId: string) {
    const today = new Date();
    const ids = links
      .filter((l) => l.vehicle_id === vehicleId)
      .map((l) => l.policy_id);
    return policies.filter((p) => {
      if (!ids.includes(p.id)) return false;
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

  return (
    <div className="space-y-4">
      {/* BUSCA GLOBAL POR VEÍCULO */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <div className="font-display font-bold">Consultar seguro de um veículo</div>
        </div>
        <Input
          placeholder="Digite placa ou chassi (ignora traços, pontos e espaços)..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
        />
        {globalSearch && globalSearch.length < 3 && (
          <div className="text-xs text-muted-foreground">Digite ao menos 3 caracteres.</div>
        )}
        {globalSearchResult && globalSearchResult.length === 0 && (
          <div className="text-xs text-muted-foreground">Nenhum veículo encontrado.</div>
        )}
        {globalSearchResult && globalSearchResult.map((v) => {
          const active = activePoliciesForVehicle(v.id);
          return (
            <div key={v.id} className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  <span className="font-mono font-bold text-primary text-base">{v.plate}</span>
                  <span className="text-sm text-muted-foreground">{[v.brand, v.model].filter(Boolean).join(" ") || "—"}</span>
                </div>
                {v.chassis && <span className="text-[11px] font-mono text-muted-foreground">Chassi: {v.chassis}</span>}
              </div>
              {active.length === 0 ? (
                <div className="text-sm text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Veículo sem apólice ativa
                </div>
              ) : (
                <div className="space-y-2">
                  {active.map((p) => {
                    const broker = brokers.find((b) => b.id === p.broker_id);
                    const st = policyStatus(p);
                    return (
                      <div key={p.id} className="rounded-md border border-border bg-background/40 p-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Seguradora:</span> <strong>{p.insurer_name}</strong></div>
                        <div><span className="text-muted-foreground">Apólice:</span> <span className="font-mono">#{p.policy_number}</span></div>
                        <div><span className="text-muted-foreground">Vigência:</span> {p.start_date ? format(new Date(p.start_date + "T00:00:00"), "dd/MM/yy") : "—"} → {p.end_date ? format(new Date(p.end_date + "T00:00:00"), "dd/MM/yy") : "—"}</div>
                        <div><Badge variant="outline" className={st.cls}>{st.label}</Badge></div>
                        <div><span className="text-muted-foreground">Corretor:</span> {broker?.name || "—"}</div>
                        <div className="flex items-center gap-3">
                          {broker?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{broker.phone}</span>}
                          {broker?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{broker.email}</span>}
                        </div>
                        <div><span className="text-muted-foreground">Franquia:</span> {fmtBRL(p.deductible)}</div>
                        <div className="md:col-span-2"><span className="text-muted-foreground">Cobertura:</span> {p.coverage_summary || "—"}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* COLUNA ESQUERDA — Apólices */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display font-bold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Apólices da frota</div>
            <div className="text-xs text-muted-foreground">Suba o PDF — a IA extrai dados, corretor e placas cobertas.</div>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4" /> Nova apólice</Button>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {loading && <div className="text-sm text-muted-foreground py-4 text-center">Carregando…</div>}
          {!loading && policies.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhuma apólice cadastrada.</div>
          )}
          {policies.map((p) => {
            const st = policyStatus(p);
            const broker = brokers.find((b) => b.id === p.broker_id);
            const vCount = links.filter((l) => l.policy_id === p.id).length;
            const isSel = p.id === selectedPolicyId;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPolicyId(p.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${isSel ? "bg-primary/10 border-primary/40" : "border-border hover:bg-muted/30"}`}
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
                    </div>
                    {p.start_date && p.end_date && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {format(new Date(p.start_date + "T00:00:00"), "dd/MM/yy")} → {format(new Date(p.end_date + "T00:00:00"), "dd/MM/yy")}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {p.file_url && (
                      <Button asChild variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                        <a href={p.file_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); removePolicy(p.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* COLUNA DIREITA — Vínculos veículos ↔ apólice selecionada */}
      <Card className="p-4 space-y-3">
        <div>
          <div className="font-display font-bold flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" /> Veículos cobertos</div>
          {selectedPolicy ? (
            <div className="text-xs text-muted-foreground">
              {selectedPolicy.insurer_name} · #{selectedPolicy.policy_number}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Selecione uma apólice à esquerda.</div>
          )}
        </div>

        {selectedPolicy && (
          <>
            {/* ====== PAINEL DE VALIDAÇÃO ====== */}
            {validation && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-3">
                {/* Vigência e valores */}
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

                {/* Diagnóstico */}
                {validation.hasAi ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md p-2 border bg-emerald-500/10 border-emerald-500/30">
                        <div className="text-lg font-bold text-emerald-400">{validation.covered.length}</div>
                        <div className="text-[10px] uppercase text-emerald-400/80">Cobertos & cadastrados</div>
                      </div>
                      <div className="rounded-md p-2 border bg-amber-500/10 border-amber-500/30">
                        <div className="text-lg font-bold text-amber-400">{validation.onlyInPolicy.length}</div>
                        <div className="text-[10px] uppercase text-amber-400/80">Na apólice s/ cadastro</div>
                      </div>
                      <div className="rounded-md p-2 border bg-destructive/10 border-destructive/30">
                        <div className="text-lg font-bold text-destructive">{validation.linkedNotInAi.length}</div>
                        <div className="text-[10px] uppercase text-destructive/80">Vinculados s/ cobertura</div>
                      </div>
                    </div>

                    {validation.covered.length > 0 && (
                      <Button size="sm" variant="outline" onClick={autoLinkAi} className="w-full">
                        <Link2 className="h-3.5 w-3.5" /> Vincular automaticamente {validation.covered.filter((v) => !linkedVehicleIds.has(v.id)).length} pendente(s)
                      </Button>
                    )}

                    {validation.onlyInPolicy.length > 0 && (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                        <div className="text-xs font-medium text-amber-400 flex items-center gap-1 mb-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Placas na apólice mas NÃO cadastradas ({validation.onlyInPolicy.length})
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {validation.onlyInPolicy.map((x) => (
                            <div key={x.plate} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-mono font-bold text-amber-400">{x.plate}</span>
                              <span className="text-muted-foreground truncate">
                                {[x.ai?.brand, x.ai?.model, x.ai?.year].filter(Boolean).join(" ") || "—"}
                              </span>
                              <span className="text-muted-foreground whitespace-nowrap">{fmtBRL(x.ai?.insured_amount ?? null)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">Cadastre esses veículos para garantir cobertura completa.</div>
                      </div>
                    )}

                    {validation.linkedNotInAi.length > 0 && (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2">
                        <div className="text-xs font-medium text-destructive flex items-center gap-1 mb-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Vinculados manualmente mas NÃO encontrados na apólice ({validation.linkedNotInAi.length})
                        </div>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {validation.linkedNotInAi.map((v) => (
                            <div key={v.id} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-mono font-bold text-destructive">{v.plate}</span>
                              <span className="text-muted-foreground truncate">{v.brand} {v.model}</span>
                            </div>
                          ))}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">Verifique a apólice — podem estar como adendo ou fora de cobertura.</div>
                      </div>
                    )}

                    {validation.notCovered.length > 0 && (
                      <details className="rounded-md border border-border bg-background/30 p-2">
                        <summary className="text-xs font-medium cursor-pointer text-muted-foreground">
                          {validation.notCovered.length} veículo(s) da empresa SEM cobertura nesta apólice
                        </summary>
                        <div className="space-y-1 max-h-40 overflow-y-auto mt-2">
                          {validation.notCovered.map((v) => (
                            <div key={v.id} className="flex items-center justify-between gap-2 text-[11px] py-0.5">
                              <span className="font-mono">{v.plate}</span>
                              <span className="text-muted-foreground truncate">{v.brand} {v.model}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground rounded-md border border-dashed border-border p-3 text-center">
                    Nenhuma análise de IA disponível para esta apólice.
                    {selectedPolicy.file_url && " Abra a edição e clique em 'Reanalisar com IA'."}
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="text-xs uppercase text-muted-foreground mb-2">Já vinculados ({selectedLinks.length})</div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {selectedLinks.length === 0 && <div className="text-xs text-muted-foreground py-2">Nenhum veículo vinculado ainda.</div>}
                {selectedLinks.map((l) => {
                  const v = vehicles.find((x) => x.id === l.vehicle_id);
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-2 p-2 rounded border border-border bg-muted/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-primary">{v?.plate || "—"}</span>
                        <span className="text-xs text-muted-foreground truncate">{v?.brand} {v?.model}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={l.inclusion_type === "adendo" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-primary/15 text-primary border-primary/30"}>
                          {l.inclusion_type === "adendo" ? "Adendo" : "Apólice"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">{format(new Date(l.included_at + "T00:00:00"), "dd/MM/yy")}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => unlinkVehicle(l.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <div className="text-xs uppercase text-muted-foreground mb-2">Adicionar veículo</div>
              <div className="relative mb-2">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9 h-9" placeholder="Placa, marca ou modelo..." value={vehicleSearch} onChange={(e) => setVehicleSearch(e.target.value)} />
              </div>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {filteredVehicles.filter((v) => !linkedVehicleIds.has(v.id)).map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 p-2 rounded border border-border hover:bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-primary">{v.plate}</span>
                      <span className="text-xs text-muted-foreground truncate">{v.brand} {v.model}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7" onClick={() => linkVehicle(v.id, "apolice")}>
                        Apólice
                      </Button>
                      <Button size="sm" variant="outline" className="h-7" onClick={() => linkVehicle(v.id, "adendo")}>
                        Adendo
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredVehicles.filter((v) => !linkedVehicleIds.has(v.id)).length === 0 && (
                  <div className="text-xs text-muted-foreground py-2 text-center">Nenhum veículo disponível.</div>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mt-2 flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                Use <strong className="mx-1">Adendo</strong> para veículos incluídos após o fechamento da apólice.
              </div>
            </div>
          </>
        )}
      </Card>
      </div>

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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Número da apólice *</Label>
                <Input value={form.policy_number || ""} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} />
              </div>
              <div>
                <Label>Seguradora *</Label>
                <Input value={form.insurer_name || ""} onChange={(e) => setForm({ ...form, insurer_name: e.target.value })} />
              </div>
              <div>
                <Label>Telefone seguradora</Label>
                <Input value={form.insurer_phone || ""} onChange={(e) => setForm({ ...form, insurer_phone: e.target.value })} />
              </div>
              <div>
                <Label>Email seguradora</Label>
                <Input value={form.insurer_email || ""} onChange={(e) => setForm({ ...form, insurer_email: e.target.value })} />
              </div>
              <div>
                <Label>Início vigência</Label>
                <Input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <Label>Fim vigência</Label>
                <Input type="date" value={form.end_date || ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div>
                <Label>Prêmio total (R$)</Label>
                <Input type="number" step="0.01" value={form.total_value ?? ""} onChange={(e) => setForm({ ...form, total_value: e.target.value ? parseFloat(e.target.value) : null })} />
              </div>
              <div>
                <Label>Franquia (R$)</Label>
                <Input type="number" step="0.01" value={form.deductible ?? ""} onChange={(e) => setForm({ ...form, deductible: e.target.value ? parseFloat(e.target.value) : null })} />
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
                <Label>Coberturas</Label>
                <Textarea value={form.coverage_summary || ""} onChange={(e) => setForm({ ...form, coverage_summary: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPolicyDialog(false)}>Cancelar</Button>
            <Button onClick={savePolicy} disabled={uploading || extracting}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}