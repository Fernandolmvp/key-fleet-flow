import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Users, Pencil, Trash2, Loader2, Upload, AlertTriangle, Sparkles, FileText, CheckCircle2, XCircle, LayoutGrid, List } from "lucide-react";
import { extractDocument } from "@/lib/ai-extract";
import { daysUntil } from "@/lib/documents";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import DriverHistoryTab from "@/components/dashboard/DriverHistoryTab";
import DriverBulkImportDialog from "@/components/dashboard/DriverBulkImportDialog";
import { openStoredFile } from "@/lib/storage-url";
import { useTabPermissions } from "@/lib/permissions";
import CepInput from "@/components/forms/CepInput";
import AddressNumberFields from "@/components/forms/AddressNumberFields";
import { isAddressMissingNumber } from "@/lib/address";
import { formatCpf, isValidCpf, onlyDigits } from "@/lib/document";
import { translateDbError } from "@/lib/db-error";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

interface Driver {
  id: string; full_name: string; cpf: string | null; phone: string | null;
  cnh_number: string | null; cnh_category: string | null; cnh_expires_at: string | null;
  medical_exam_expires_at: string | null; status: string; photo_url: string | null;
  user_id: string | null; auto_fuel_authorized: boolean | null; manager_user_id: string | null;
  has_assigned_vehicle?: boolean | null; assigned_vehicle_id?: string | null;
}

interface DriverDoc { id: string; entity_id: string; doc_type: string; file_url: string | null; expires_at: string | null; }

const STATUSES = [
  { value: "ativo", label: "Ativo" },
  { value: "ferias", label: "Férias" },
  { value: "afastado", label: "Afastado" },
  { value: "licenca_medica", label: "Licença médica" },
  { value: "suspenso", label: "Suspenso" },
  { value: "desligado", label: "Desligado" },
  { value: "inativo", label: "Inativo (outros)" },
];
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUSES.map(s => [s.value, s.label]));
const INACTIVE_STATUSES = ["desligado","inativo","suspenso","licenca_medica","afastado"];
const INACTIVATION_REASONS = [
  "Pedido de demissão",
  "Demissão sem justa causa",
  "Demissão por justa causa",
  "Aposentadoria",
  "Fim de contrato",
  "Acordo entre partes",
  "Atestado médico prolongado",
  "Suspensão da CNH",
  "Acidente de trabalho",
  "Licença maternidade/paternidade",
  "Férias prolongadas",
  "Transferência para outra empresa",
  "Falecimento",
  "Outro motivo",
];

export default function Drivers() {
  const { currentCompanyId, refreshCompanies } = useAuth();
  const [items, setItems] = useState<Driver[]>([]);
  const [docsByDriver, setDocsByDriver] = useState<Record<string, DriverDoc[]>>({});
  const [managers, setManagers] = useState<{ user_id: string; name: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; plate: string; brand: string | null; model: string | null }[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [archivedDoc, setArchivedDoc] = useState<{ url: string; name: string; mime: string } | null>(null);
  const [form, setForm] = useState<any>(blank());
  const [view, setView] = useState<"grid" | "list">(() => (localStorage.getItem("drivers:view") as "grid" | "list") || "grid");
  const driverAddressRef = useRef<HTMLInputElement>(null);
  const driverNumberRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem("drivers:view", view); }, [view]);

  function blank() {
    return { full_name: "", cpf: "", birth_date: "", phone: "", email: "", cnh_number: "", cnh_category: "", cnh_expires_at: "", medical_exam_expires_at: "", cep: "", address: "", address_number: "", address_complement: "", neighborhood: "", city: "", state: "", status: "ativo", photo_url: "", user_id: "", auto_fuel_authorized: false, manager_user_id: "", inactivated_at: "", inactive_reason: "", termination_date: "", has_assigned_vehicle: false, assigned_vehicle_id: "" };
  }

  const load = async () => {
    if (!currentCompanyId) return;
    const { data, error } = await supabase.from("drivers")
      .select("*").eq("company_id", currentCompanyId)
      .order("full_name");
    if (error) toast.error(error.message);
    setItems((data ?? []) as Driver[]);

    const { data: docs } = await supabase.from("documents")
      .select("id,entity_id,doc_type,file_url,expires_at")
      .eq("company_id", currentCompanyId)
      .eq("entity_type", "driver");
    const map: Record<string, DriverDoc[]> = {};
    (docs ?? []).forEach((d: any) => {
      if (!map[d.entity_id]) map[d.entity_id] = [];
      map[d.entity_id].push(d);
    });
    setDocsByDriver(map);

    // Carrega gestores da empresa (admin/gestor_frota)
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("company_id", currentCompanyId)
      .in("role", ["admin", "gestor_frota"]);
    const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name").in("id", ids);
      setManagers((profs ?? []).map((p: any) => ({ user_id: p.id, name: p.full_name || "Gestor" })));
    } else {
      setManagers([]);
    }

    // Veículos ativos da empresa (sem inativados/vendidos) para vincular ao motorista
    const { data: vs } = await supabase
      .from("vehicles")
      .select("id, plate, brand, model, status")
      .eq("company_id", currentCompanyId)
      .order("plate");
    setVehicles(((vs ?? []) as any[]).filter((v) => !["vendido", "inativo"].includes(String(v.status ?? "").toLowerCase())));
  };
  useEffect(() => { load(); }, [currentCompanyId]);
  useAutoRefresh(load, ["drivers", "documents"]);

  const openNew = () => { setEditing(null); setForm(blank()); setArchivedDoc(null); setOpen(true); };
  const openEdit = (d: Driver) => { setEditing(d); setForm({ ...blank(), ...d }); setArchivedDoc(null); setOpen(true); };

  const upload = async (file: File) => {
    if (!currentCompanyId) return;
    setUploading(true);
    const path = `${currentCompanyId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("driver-photos").upload(path, file);
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data: pub } = supabase.storage.from("driver-photos").getPublicUrl(path);
    setForm((f: any) => ({ ...f, photo_url: pub.publicUrl }));
    setUploading(false);
  };

  const aiFill = async (file: File) => {
    let companyId = currentCompanyId;
    if (!companyId) {
      // Fallback: tenta resolver a empresa do usuário diretamente
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase
          .from("profiles").select("current_company_id").eq("id", user.id).maybeSingle();
        companyId = prof?.current_company_id ?? null;
        if (!companyId) {
          const { data: mem } = await supabase
            .from("company_members").select("company_id").eq("user_id", user.id).limit(1).maybeSingle();
          companyId = mem?.company_id ?? null;
        }
        if (companyId) await refreshCompanies();
      }
    }
    if (!companyId) return toast.error("Nenhuma empresa vinculada à sua conta");
    setAiBusy(true);
    try {
      const { data, archivedUrl } = await extractDocument({
        type: "driver", file, bucket: "documents", companyId,
      });
      setForm((f: any) => ({
        ...f,
        full_name: data.full_name ?? f.full_name,
        cpf: data.cpf ? String(data.cpf).replace(/\D/g, "") : f.cpf,
        cnh_number: data.cnh_number ?? f.cnh_number,
        cnh_category: data.cnh_category ?? f.cnh_category,
        cnh_expires_at: data.cnh_expires_at ?? f.cnh_expires_at,
        medical_exam_expires_at: data.medical_exam_expires_at ?? f.medical_exam_expires_at,
        birth_date: data.birth_date ?? f.birth_date,
        address: data.address ?? f.address,
      }));
      setArchivedDoc(archivedUrl ? { url: archivedUrl, name: file.name, mime: file.type } : null);
      toast.success("Dados preenchidos pela IA. Revise antes de salvar.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao processar documento");
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    if (!currentCompanyId) return;
    if (!form.full_name.trim()) return toast.error("Nome obrigatório");
    const cpfDigits = onlyDigits(form.cpf);
    if (cpfDigits && !isValidCpf(cpfDigits)) {
      return toast.error("CPF inválido — confira os dígitos verificadores");
    }
    setBusy(true);
    const payload: any = {
      ...form, company_id: currentCompanyId,
      cpf: cpfDigits || null,
      cnh_expires_at: form.cnh_expires_at || null,
      medical_exam_expires_at: form.medical_exam_expires_at || null,
      birth_date: form.birth_date || null,
      inactivated_at: form.inactivated_at || null,
      termination_date: form.termination_date || null,
      inactive_reason: form.inactive_reason || null,
      user_id: form.user_id || null,
      manager_user_id: form.manager_user_id || null,
      auto_fuel_authorized: !!form.auto_fuel_authorized,
      has_assigned_vehicle: !!form.has_assigned_vehicle,
      assigned_vehicle_id: form.has_assigned_vehicle && form.assigned_vehicle_id ? form.assigned_vehicle_id : null,
    };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    const op = editing
      ? supabase.from("drivers").update(payload).eq("id", editing.id)
      : supabase.from("drivers").insert(payload).select("id").single();
    const { data: saved, error } = await op as any;
    if (error) { setBusy(false); return toast.error(translateDbError(error)); }

    // Arquivar CNH na tabela de documentos (se enviada via IA neste fluxo)
    const driverId = editing ? editing.id : saved?.id;
    if (archivedDoc && driverId) {
      const { error: docErr } = await supabase.from("documents").insert({
        company_id: currentCompanyId,
        entity_type: "driver",
        entity_id: driverId,
        doc_type: "cnh",
        title: "CNH",
        document_number: form.cnh_number || null,
        expires_at: form.cnh_expires_at || null,
        file_url: archivedDoc.url,
        file_name: archivedDoc.name,
        mime_type: archivedDoc.mime,
        ai_extracted: { source: "driver_form", cnh_number: form.cnh_number, cnh_category: form.cnh_category },
      });
      if (docErr) console.warn("doc archive failed", docErr.message);
    }

    // Registrar movimentação de vínculo de veículo (em vehicle_movements)
    try {
      const prevVehicleId = editing?.assigned_vehicle_id || null;
      const newVehicleId = payload.assigned_vehicle_id || null;
      if (prevVehicleId !== newVehicleId && driverId) {
        const { data: { user } } = await supabase.auth.getUser();
        const driverName = form.full_name;
        const today = new Date().toISOString().slice(0, 10);
        const movs: any[] = [];
        if (prevVehicleId) {
          const v = vehicles.find((x) => x.id === prevVehicleId);
          movs.push({
            company_id: currentCompanyId, vehicle_id: prevVehicleId,
            movement_type: "desvinculo_motorista",
            reason: `Desvínculo de motorista: ${driverName}`,
            notes: newVehicleId ? `Motorista passou a ser vinculado a outro veículo` : `Motorista deixou de ter vínculo exclusivo`,
            occurred_at: today, created_by: user?.id ?? null,
            metadata: { driver_id: driverId, driver_name: driverName, vehicle_plate: (v as any)?.plate },
          });
        }
        if (newVehicleId) {
          const v = vehicles.find((x) => x.id === newVehicleId);
          movs.push({
            company_id: currentCompanyId, vehicle_id: newVehicleId,
            movement_type: "vinculo_motorista",
            reason: `Vínculo de motorista: ${driverName}`,
            notes: `Motorista vinculado para uso exclusivo deste veículo`,
            occurred_at: today, created_by: user?.id ?? null,
            metadata: { driver_id: driverId, driver_name: driverName, vehicle_plate: (v as any)?.plate },
          });
        }
        if (movs.length) {
          const { error: mErr } = await supabase.from("vehicle_movements").insert(movs);
          if (mErr) console.warn("vehicle_movement insert failed:", mErr.message);
        }
      }
    } catch (e: any) {
      console.warn("link movement log failed:", e?.message);
    }

    setBusy(false);
    toast.success(editing ? "Motorista atualizado" : "Motorista cadastrado");
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este motorista?")) return;
    const { error } = await supabase.from("drivers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Motorista removido"); load();
  };

  const [tab, setTab] = useState<string>(() => localStorage.getItem("drivers:tab") || "ativos");
  useEffect(() => { localStorage.setItem("drivers:tab", tab); }, [tab]);

  const { canViewTab, isVisible, fallback } = useTabPermissions(
    "drivers", ["ativos", "inativos", "todos"], tab,
  );
  useEffect(() => {
    if (!isVisible && fallback) setTab(fallback);
  }, [isVisible, fallback]);

  const byTab = items.filter((d) => {
    if (tab === "todos") return true;
    if (tab === "ativos") return d.status === "ativo" || d.status === "ferias";
    if (tab === "inativos") return INACTIVE_STATUSES.includes(d.status);
    return true;
  });
  const filtered = byTab.filter((d) =>
    [d.full_name, d.cpf, d.cnh_number].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase())
  );
  const counts = {
    ativos: items.filter(d => d.status === "ativo" || d.status === "ferias").length,
    inativos: items.filter(d => INACTIVE_STATUSES.includes(d.status)).length,
    todos: items.length,
  };

  type CnhStatus = { kind: "vencida" | "vencendo" | "valida" | "sem_data"; days: number | null; label: string };
  const cnhStatus = (date: string | null): CnhStatus => {
    if (!date) return { kind: "sem_data", days: null, label: "Sem validade" };
    const dl = daysUntil(date);
    if (dl === null) return { kind: "sem_data", days: null, label: "Sem validade" };
    if (dl < 0) return { kind: "vencida", days: dl, label: `Vencida há ${Math.abs(dl)} dias` };
    if (dl <= 30) return { kind: "vencendo", days: dl, label: `Vence em ${dl} dias` };
    return { kind: "valida", days: dl, label: `Válida (${dl} dias)` };
  };

  const findCnhDoc = (driverId: string) =>
    (docsByDriver[driverId] ?? []).find((d) => d.doc_type === "cnh" && d.file_url);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Motoristas</h1>
          <p className="text-muted-foreground">{items.length} motorista(s) cadastrado(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openNew} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
            <Plus className="h-4 w-4 mr-2" /> Novo motorista
          </Button>
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Importar em lote
          </Button>
        </div>
      </div>

      <div className="surface-card rounded-xl p-4">
        <Tabs value={tab} onValueChange={setTab} className="mb-4">
          <TabsList className="grid grid-cols-3 w-full sm:w-auto sm:inline-grid">
            {canViewTab("ativos") && <TabsTrigger value="ativos">Ativos · {counts.ativos}</TabsTrigger>}
            {canViewTab("inativos") && <TabsTrigger value="inativos">Inativos · {counts.inativos}</TabsTrigger>}
            {canViewTab("todos") && <TabsTrigger value="todos">Todos · {counts.todos}</TabsTrigger>}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="ml-auto inline-flex rounded-lg border border-border overflow-hidden">
            <Button type="button" size="sm" variant={view === "grid" ? "default" : "ghost"}
              className="rounded-none px-3" onClick={() => setView("grid")} title="Visualização em quadrante">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant={view === "list" ? "default" : "ghost"}
              className="rounded-none px-3" onClick={() => setView("list")} title="Visualização em lista">
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card rounded-xl p-12 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display font-semibold">Nenhum motorista</h3>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => {
            const cs = cnhStatus(d.cnh_expires_at);
            const cnhDoc = findCnhDoc(d.id);
            return (
              <div key={d.id} className="surface-card rounded-xl p-5 hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-full bg-gradient-primary grid place-items-center text-primary-foreground font-bold shrink-0 overflow-hidden">
                    {d.photo_url ? <img src={d.photo_url} alt="" className="h-full w-full object-cover" /> : d.full_name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{d.full_name}</h3>
                    <p className="text-xs text-muted-foreground">CPF: {d.cpf ?? "—"}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">{STATUS_LABEL[d.status] ?? d.status}</Badge>
                      {d.cnh_category && <Badge variant="outline" className="text-xs font-mono">CNH {d.cnh_category}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2 border"
                  style={undefined}
                >
                  {cs.kind === "vencida" && (
                    <span className="flex items-center gap-1.5 text-destructive bg-destructive/10 border-destructive/30 rounded-lg px-2 py-1 border w-full">
                      <XCircle className="h-3.5 w-3.5" /> CNH {cs.label.toLowerCase()}
                    </span>
                  )}
                  {cs.kind === "vencendo" && (
                    <span className="flex items-center gap-1.5 text-warning bg-warning/10 border-warning/30 rounded-lg px-2 py-1 border w-full">
                      <AlertTriangle className="h-3.5 w-3.5" /> CNH {cs.label.toLowerCase()}
                    </span>
                  )}
                  {cs.kind === "valida" && (
                    <span className="flex items-center gap-1.5 text-success bg-success/10 border-success/30 rounded-lg px-2 py-1 border w-full">
                      <CheckCircle2 className="h-3.5 w-3.5" /> CNH {cs.label}
                    </span>
                  )}
                  {cs.kind === "sem_data" && (
                    <span className="flex items-center gap-1.5 text-muted-foreground bg-muted/30 border-border rounded-lg px-2 py-1 border w-full">
                      <AlertTriangle className="h-3.5 w-3.5" /> CNH sem validade informada
                    </span>
                  )}
                </div>
                <div className="flex gap-2 pt-3 mt-3 border-t border-border">
                  <Button
                    size="sm" variant="outline" className="flex-1"
                    disabled={!cnhDoc?.file_url}
                    onClick={() => cnhDoc?.file_url && openStoredFile(cnhDoc.file_url)}
                    title={cnhDoc ? "Abrir CNH arquivada" : "Nenhuma CNH anexada"}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" /> {cnhDoc ? "Ver CNH" : "Sem CNH"}
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => openEdit(d)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(d.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="surface-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Motorista</th>
                  <th className="text-left px-4 py-3">CPF</th>
                  <th className="text-left px-4 py-3">CNH</th>
                  <th className="text-left px-4 py-3">Status CNH</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const cs = cnhStatus(d.cnh_expires_at);
                  const cnhDoc = findCnhDoc(d.id);
                  const tone =
                    cs.kind === "vencida" ? "border-destructive/40 text-destructive bg-destructive/10"
                    : cs.kind === "vencendo" ? "border-warning/40 text-warning bg-warning/10"
                    : cs.kind === "valida" ? "border-success/40 text-success bg-success/10"
                    : "border-border text-muted-foreground bg-muted/30";
                  return (
                    <tr key={d.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-primary grid place-items-center text-primary-foreground text-xs font-bold shrink-0 overflow-hidden">
                            {d.photo_url ? <img src={d.photo_url} alt="" className="h-full w-full object-cover" /> : d.full_name[0]?.toUpperCase()}
                          </div>
                          <span className="font-medium truncate">{d.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{d.cpf ?? "—"}</td>
                      <td className="px-4 py-3 text-xs font-mono">
                        {d.cnh_number ?? "—"}
                        {d.cnh_category && <span className="ml-1 text-muted-foreground">({d.cnh_category})</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`gap-1 ${tone}`}>
                          {cs.kind === "vencida" && <XCircle className="h-3 w-3" />}
                          {cs.kind === "vencendo" && <AlertTriangle className="h-3 w-3" />}
                          {cs.kind === "valida" && <CheckCircle2 className="h-3 w-3" />}
                          {cs.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs">{STATUS_LABEL[d.status] ?? d.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" disabled={!cnhDoc?.file_url}
                            onClick={() => cnhDoc?.file_url && openStoredFile(cnhDoc.file_url)} title="Ver CNH">
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(d)} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(d.id)} title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-2xl">{editing ? "Editar motorista" : "Novo motorista"}</DialogTitle></DialogHeader>
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className={`grid w-full ${editing ? "grid-cols-4" : "grid-cols-3"}`}>
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="autorizacao">Autorizações</TabsTrigger>
              <TabsTrigger value="inativacao" className={INACTIVE_STATUSES.includes(form.status) ? "text-warning data-[state=active]:text-warning" : ""}>
                Inativação{INACTIVE_STATUSES.includes(form.status) ? " ●" : ""}
              </TabsTrigger>
              {editing && <TabsTrigger value="historico">Histórico</TabsTrigger>}
            </TabsList>

            <TabsContent value="dados" className="mt-4 space-y-4">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-primary grid place-items-center shrink-0">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Preencher com IA</p>
                  <p className="text-xs text-muted-foreground">Envie a foto ou PDF da CNH — extraímos os dados e arquivamos.</p>
                </div>
                <label>
                  <Button type="button" size="sm" disabled={aiBusy} asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow cursor-pointer">
                    <span>
                      {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                      {aiBusy ? "Lendo..." : "Enviar CNH"}
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    hidden
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) aiFill(f); e.currentTarget.value = ""; }}
                  />
                </label>
              </div>
              {archivedDoc && (
                <a href={archivedDoc.url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                  <FileText className="h-3 w-3" /> CNH arquivada — será vinculada ao salvar
                </a>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
              <Label>Foto</Label>
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-full bg-muted overflow-hidden grid place-items-center">
                  {form.photo_url ? <img src={form.photo_url} alt="" className="h-full w-full object-cover" /> : <Users className="h-6 w-6 text-muted-foreground" />}
                </div>
                <label className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />} Enviar</span>
                  </Button>
                  <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
                </label>
              </div>
            </div>
                <div className="space-y-2 sm:col-span-2"><Label>Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  {(() => {
                    const digits = onlyDigits(form.cpf);
                    const invalid = digits.length > 0 && (digits.length < 11 || !isValidCpf(digits));
                    return (
                      <>
                        <Input
                          value={formatCpf(form.cpf || "")}
                          onChange={(e) => setForm({ ...form, cpf: onlyDigits(e.target.value).slice(0, 11) })}
                          placeholder="000.000.000-00"
                          className={invalid && digits.length === 11 ? "border-destructive focus-visible:ring-destructive" : undefined}
                        />
                        {invalid && digits.length === 11 && (
                          <p className="text-xs text-destructive">CPF inválido</p>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>CNH número</Label><Input value={form.cnh_number} onChange={(e) => setForm({ ...form, cnh_number: e.target.value })} /></div>
                <div className="space-y-2"><Label>Categoria</Label><Input value={form.cnh_category} onChange={(e) => setForm({ ...form, cnh_category: e.target.value })} placeholder="A, B, D, E..." /></div>
                <div className="space-y-2"><Label>Validade CNH</Label><Input type="date" value={form.cnh_expires_at} onChange={(e) => setForm({ ...form, cnh_expires_at: e.target.value })} /></div>
                <div className="space-y-2"><Label>Validade exames</Label><Input type="date" value={form.medical_exam_expires_at} onChange={(e) => setForm({ ...form, medical_exam_expires_at: e.target.value })} /></div>
                <div className="space-y-2"><Label>Data de nascimento</Label><Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></div>
                <div className="space-y-2"><CepInput
                  value={form.cep || ""}
                  onChange={(v) => setForm({ ...form, cep: v })}
                  nextFieldRef={driverNumberRef}
                  onAddressFound={(a) => setForm({ ...form, cep: a.cep, address: a.street, neighborhood: a.neighborhood, city: a.city, state: a.uf })}
                /></div>
                <div className="space-y-2"><Label>Endereço</Label><Input ref={driverAddressRef} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua / Logradouro" /></div>
                <div className="space-y-2"><Label>Bairro</Label><Input value={form.neighborhood || ""} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} /></div>
                <div className="space-y-2"><Label>Cidade</Label><Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div className="space-y-2"><Label>UF</Label><Input maxLength={2} value={form.state || ""} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} /></div>
                <AddressNumberFields
                  ref={driverNumberRef}
                  number={form.address_number || ""}
                  complement={form.address_complement || ""}
                  onNumberChange={(v) => setForm({ ...form, address_number: v })}
                  onComplementChange={(v) => setForm({ ...form, address_complement: v })}
                  warnLegacy={!!editing && isAddressMissingNumber(form)}
                />
              </div>
            </TabsContent>

            <TabsContent value="autorizacao" className="mt-4">
              <div className="rounded-xl border border-border p-4 space-y-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Autorização automática de abastecimento</p>
                  <p className="text-xs text-muted-foreground">Quando ligado, as solicitações deste colaborador são aprovadas na hora, sem passar pelo gestor.</p>
                </div>
                <Switch
                  checked={!!form.auto_fuel_authorized}
                  onCheckedChange={(v) => setForm({ ...form, auto_fuel_authorized: v })}
                />
              </div>

              {!form.auto_fuel_authorized && (
                <div className="space-y-2">
                  <Label>Gestor responsável pela aprovação</Label>
                  <Select value={form.manager_user_id || ""} onValueChange={(v) => setForm({ ...form, manager_user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar gestor..." /></SelectTrigger>
                    <SelectContent>
                      {managers.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground">Nenhum gestor cadastrado na empresa</div>
                      ) : managers.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">O nome aparece para o colaborador no app, indicando quem precisa autorizar.</p>
                </div>
              )}

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Possui veículo vinculado?</p>
                    <p className="text-xs text-muted-foreground">Marque quando o motorista usar sempre o mesmo veículo (uso exclusivo).</p>
                  </div>
                  <Switch
                    checked={!!form.has_assigned_vehicle}
                    onCheckedChange={(v) => setForm({ ...form, has_assigned_vehicle: v, assigned_vehicle_id: v ? form.assigned_vehicle_id : "" })}
                  />
                </div>

                {form.has_assigned_vehicle && (
                  <div className="space-y-2 mt-3">
                    <Label>Veículo vinculado</Label>
                    <Select value={form.assigned_vehicle_id || ""} onValueChange={(v) => setForm({ ...form, assigned_vehicle_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar veículo..." /></SelectTrigger>
                      <SelectContent>
                        {vehicles.length === 0 ? (
                          <div className="p-2 text-xs text-muted-foreground">Nenhum veículo ativo cadastrado</div>
                        ) : vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.plate} — {v.brand ?? ""} {v.model ?? ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">No app do motorista, este veículo será pré-selecionado nas solicitações de abastecimento.</p>
                  </div>
                )}
              </div>
            </div>
            </TabsContent>

            <TabsContent value="inativacao" className="mt-4">
              <div className="rounded-xl border border-border p-4 space-y-4 bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Inativação do colaborador</p>
                    <p className="text-xs text-muted-foreground">Registre o motivo e a data quando o motorista for desligado, suspenso ou afastado. O status muda automaticamente.</p>
                  </div>
                  {INACTIVE_STATUSES.includes(form.status) && (
                    <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10 shrink-0">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Inativo
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Tipo de inativação</Label>
                    <Select
                      value={INACTIVE_STATUSES.includes(form.status) ? form.status : ""}
                      onValueChange={(v) => setForm({
                        ...form,
                        status: v,
                        inactivated_at: form.inactivated_at || new Date().toISOString().slice(0, 10),
                      })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.filter((s) => INACTIVE_STATUSES.includes(s.value)).map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Motivo</Label>
                    <Select
                      value={INACTIVATION_REASONS.includes(form.inactive_reason) ? form.inactive_reason : (form.inactive_reason ? "Outro motivo" : "")}
                      onValueChange={(v) => setForm({ ...form, inactive_reason: v === "Outro motivo" ? "" : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione um motivo..." /></SelectTrigger>
                      <SelectContent>
                        {INACTIVATION_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Data da inativação</Label>
                    <Input type="date" value={form.inactivated_at || ""} onChange={(e) => setForm({ ...form, inactivated_at: e.target.value })} />
                  </div>

                  {form.status === "desligado" && (
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Data oficial de desligamento</Label>
                      <Input type="date" value={form.termination_date || ""} onChange={(e) => setForm({ ...form, termination_date: e.target.value })} />
                    </div>
                  )}

                  <div className="space-y-2 sm:col-span-2">
                    <Label>Detalhes / observações</Label>
                    <Textarea
                      rows={3}
                      value={form.inactive_reason || ""}
                      onChange={(e) => setForm({ ...form, inactive_reason: e.target.value })}
                      placeholder="Descreva o motivo com mais detalhes (ex.: pedido formal em 15/04, processo trabalhista, suspensão de 90 dias da CNH...)"
                    />
                  </div>
                </div>

                {INACTIVE_STATUSES.includes(form.status) && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setForm({ ...form, status: "ativo", inactivated_at: "", inactive_reason: "", termination_date: "" })}
                    >
                      Reativar motorista
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {editing && currentCompanyId && (
              <TabsContent value="historico" className="mt-4">
                <DriverHistoryTab driverId={editing.id} companyId={currentCompanyId} driverStatus={editing.status} />
              </TabsContent>
            )}
          </Tabs>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={busy} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DriverBulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} onImported={load} />
    </div>
  );
}
