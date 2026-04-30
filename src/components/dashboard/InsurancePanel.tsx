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
import { Plus, Upload, Sparkles, Pencil, Trash2, FileText, ExternalLink, Phone, Search, Truck, ShieldCheck, AlertTriangle, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

type Broker = { id: string; name: string };
type Vehicle = { id: string; plate: string; brand: string; model: string; status: string };
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

/**
 * Sincroniza os campos de seguro no cadastro do veículo a partir das apólices
 * vinculadas a ele (insurer, insurance_policy, insurance_expires_at, insurance_responsible).
 * Escolhe a apólice ATIVA com a maior data de fim. Se não houver apólice ativa,
 * limpa os campos do veículo.
 */
async function syncVehicleInsuranceFields(companyId: string, vehicleIds: string[]) {
  if (!companyId || !vehicleIds.length) return;
  const ids = Array.from(new Set(vehicleIds.filter(Boolean)));

  const { data: links } = await supabase
    .from("insurance_policy_vehicles")
    .select("vehicle_id, removed_at, policy:insurance_policies(id,policy_number,insurer_name,end_date,status,broker_id)")
    .eq("company_id", companyId)
    .in("vehicle_id", ids);

  // brokers cache
  const brokerIds = Array.from(new Set(((links ?? []) as any[])
    .map((l) => l.policy?.broker_id).filter(Boolean)));
  let brokersById: Record<string, string> = {};
  if (brokerIds.length) {
    const { data: bs } = await supabase
      .from("insurance_brokers").select("id,name").in("id", brokerIds);
    brokersById = Object.fromEntries((bs ?? []).map((b: any) => [b.id, b.name]));
  }

  for (const vid of ids) {
    const pols = ((links ?? []) as any[])
      .filter((l) => l.vehicle_id === vid && !l.removed_at && l.policy && l.policy.status === "ativa")
      .map((l) => l.policy)
      .sort((a, b) => (b?.end_date || "").localeCompare(a?.end_date || ""));
    const best = pols[0];
    const update: any = best ? {
      insurer: best.insurer_name || null,
      insurance_policy: best.policy_number || null,
      insurance_expires_at: best.end_date || null,
      insurance_responsible: best.broker_id ? (brokersById[best.broker_id] || null) : null,
    } : {
      insurer: null,
      insurance_policy: null,
      insurance_expires_at: null,
      insurance_responsible: null,
    };
    await supabase.from("vehicles").update(update).eq("id", vid);
  }
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

  const [vehicleSearch, setVehicleSearch] = useState("");

  async function load() {
    if (!currentCompanyId) return;
    setLoading(true);
    const [p, b, v, l] = await Promise.all([
      supabase.from("insurance_policies").select("*").eq("company_id", currentCompanyId).order("end_date", { ascending: false, nullsFirst: false }),
      supabase.from("insurance_brokers").select("id,name").eq("company_id", currentCompanyId).eq("active", true).order("name"),
      supabase.from("vehicles").select("id,plate,brand,model,status").eq("company_id", currentCompanyId).eq("status", "ativo").order("plate"),
      supabase.from("insurance_policy_vehicles").select("*").eq("company_id", currentCompanyId),
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

  function openNew() { setForm(emptyPolicy); setAiPlates([]); setPolicyDialog(true); }
  function openEdit(p: Policy) { setForm(p); setAiPlates([]); setPolicyDialog(true); }

  async function handleFile(file: File) {
    if (!currentCompanyId) return;
    setUploading(true);
    try {
      const path = `${currentCompanyId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const up = await supabase.storage.from("insurance-policies").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { data: signed } = await supabase.storage.from("insurance-policies").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      setForm((f) => ({ ...f, file_url: signed?.signedUrl || path, file_name: file.name }));
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
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const { data, error } = await supabase.functions.invoke("extract-insurance-policy", {
        body: { fileBase64: b64, mimeType: file.type || "application/pdf" },
      });
      if (error) throw error;
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
    } catch (e: any) {
      console.error(e);
      toast.error("IA não conseguiu ler a apólice. Preencha manualmente.");
    } finally {
      setExtracting(false);
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
      ai_extracted: form.ai_extracted || {},
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
    // vincula placas extraídas pela IA (apólice original)
    if (policyId && aiPlates.length) {
      const matches = vehicles.filter((v) => aiPlates.includes(v.plate.toUpperCase()));
      if (matches.length) {
        const rows = matches.map((m) => ({
          company_id: currentCompanyId,
          policy_id: policyId!,
          vehicle_id: m.id,
          inclusion_type: "apolice" as const,
        }));
        await supabase.from("insurance_policy_vehicles").upsert(rows, { onConflict: "policy_id,vehicle_id", ignoreDuplicates: true });
        await syncVehicleInsuranceFields(currentCompanyId, matches.map((m) => m.id));
        toast.success(`${matches.length} veículo(s) vinculado(s) à apólice`);
      }
      const notFound = aiPlates.filter((p) => !vehicles.some((v) => v.plate.toUpperCase() === p));
      if (notFound.length) {
        toast.warning(`${notFound.length} placa(s) da apólice não estão cadastradas: ${notFound.join(", ")}`);
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
    toast.success("Excluída");
    if (selectedPolicyId === id) setSelectedPolicyId(null);
    load();
  }

  async function linkVehicle(vehicleId: string, type: "apolice" | "adendo") {
    if (!selectedPolicyId || !currentCompanyId) return;
    const r = await supabase.from("insurance_policy_vehicles").insert({
      company_id: currentCompanyId,
      policy_id: selectedPolicyId,
      vehicle_id: vehicleId,
      inclusion_type: type,
    });
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
    const r = await supabase.from("insurance_policy_vehicles").delete().eq("id", linkId);
    if (r.error) { toast.error(r.error.message); return; }
    if (currentCompanyId && vehicleId) await syncVehicleInsuranceFields(currentCompanyId, [vehicleId]);
    toast.success("Vínculo removido");
    load();
  }

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId) || null;
  const selectedLinks = useMemo(
    () => links.filter((l) => l.policy_id === selectedPolicyId),
    [links, selectedPolicyId]
  );
  const linkedVehicleIds = new Set(selectedLinks.map((l) => l.vehicle_id));
  const filteredVehicles = vehicles.filter((v) => {
    if (!vehicleSearch) return true;
    const q = vehicleSearch.toLowerCase();
    return [v.plate, v.brand, v.model].join(" ").toLowerCase().includes(q);
  });

  function policyStatus(p: Policy) {
    if (!p.end_date) return { label: "Sem vigência", cls: "bg-muted/30 text-muted-foreground border-border" };
    const d = differenceInDays(new Date(p.end_date + "T00:00:00"), new Date());
    if (d < 0) return { label: `Vencida há ${Math.abs(d)}d`, cls: "bg-destructive/15 text-destructive border-destructive/30" };
    if (d <= 30) return { label: `Vence em ${d}d`, cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
    return { label: `Vigente (${d}d)`, cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  }

  return (
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

      {/* DIALOG DE APÓLICE */}
      <Dialog open={policyDialog} onOpenChange={setPolicyDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar apólice" : "Nova apólice"}</DialogTitle></DialogHeader>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              {form.file_url ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-primary" /> {form.file_name || "PDF anexado"}
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={form.file_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Ver</a>
                  </Button>
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

            {aiPlates.length > 0 && (
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