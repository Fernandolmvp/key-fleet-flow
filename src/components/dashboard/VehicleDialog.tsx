import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Upload, X, Sparkles, FileText, History, Undo2 } from "lucide-react";
import { extractDocument } from "@/lib/ai-extract";

const STATUSES = [
  { value: "ativo", label: "Ativo" },
  { value: "manutencao", label: "Em manutenção" },
  { value: "parado", label: "Parado" },
  { value: "vendido", label: "Vendido" },
  { value: "sinistrado", label: "Sinistrado" },
  { value: "inativo", label: "Inativo (outros)" },
  { value: "transferido", label: "Transferido" },
  { value: "roubado_furtado", label: "Roubado / Furtado" },
  { value: "leiloado", label: "Leiloado" },
];
const SOLD_STATUS = "vendido";
const INACTIVE_STATUSES = ["inativo","sinistrado","transferido","roubado_furtado","leiloado","parado"];
const UNDOABLE_MOVEMENT_TYPES = ["venda", "inativacao"];
const FUELS = ["gasolina","etanol","diesel","diesel_s10","flex","gnv","eletrico","hibrido"];

const INACTIVE_REASONS = [
  { value: "sinistro_total", label: "Sinistro total" },
  { value: "sinistro_parcial", label: "Sinistro parcial" },
  { value: "roubo", label: "Roubo" },
  { value: "furto", label: "Furto" },
  { value: "transferencia", label: "Transferência interna" },
  { value: "leilao", label: "Leilão" },
  { value: "manutencao_prolongada", label: "Manutenção prolongada" },
  { value: "fim_vida_util", label: "Fim de vida útil" },
  { value: "documentacao_pendente", label: "Documentação pendente" },
  { value: "judicial", label: "Bloqueio judicial" },
  { value: "outros", label: "Outros" },
];

interface MovementRow {
  id: string;
  movement_type: string;
  reason: string | null;
  notes: string | null;
  occurred_at: string | null;
  created_at: string;
  metadata: any;
}

const EMPTY_FORM = {
  plate: "", renavam: "", chassis: "", brand: "", model: "",
  year_manufacture: "", year_model: "", color: "", fuel_type: "flex",
  tank_capacity: "", vehicle_type: "", current_km: 0, status: "ativo",
  responsible: "", insurer: "", insurance_policy: "", insurance_expires_at: "", insurance_responsible: "",
  fipe_value: "", photos: [] as string[], documents: [] as string[],
  licensing_year: "", owner_name: "", owner_doc: "", crlv_issue_date: "", crlv_city: "",
  inactivated_at: "", inactive_reason: "", inactive_notes: "", notes: "",
  sale_date: "", sale_value: "", buyer_name: "", buyer_doc: "",
  buyer_phone: "", buyer_email: "", buyer_address: "",
  sale_notary: "", sale_city: "", sale_state: "", sale_payment_method: "", sale_notes: "", sale_contract_url: "",
};

const buildFormState = (data?: any) => ({
  ...EMPTY_FORM,
  ...(data ?? {}),
  photos: data?.photos ?? [],
  documents: data?.documents ?? [],
});

const getMovementTimestamp = (movement: MovementRow) => {
  if (movement.occurred_at) {
    return new Date(`${movement.occurred_at}T23:59:59`).getTime();
  }

  return new Date(movement.created_at).getTime();
};

const sortMovementsChronologically = (rows: MovementRow[]) => (
  [...rows].sort((a, b) => {
    const timeDiff = getMovementTimestamp(b) - getMovementTimestamp(a);
    if (timeDiff !== 0) return timeDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  })
);

const getRevertedMovementIds = (rows: MovementRow[]) => (
  new Set(
    rows
      .filter((movement) => movement.movement_type === "reversao")
      .map((movement) => String(movement.metadata?.reverted_movement_id ?? ""))
      .filter(Boolean)
  )
);

const getEffectiveMovements = (rows: MovementRow[]) => {
  const revertedIds = getRevertedMovementIds(rows);

  return sortMovementsChronologically(rows).filter(
    (movement) => movement.movement_type !== "reversao" && !revertedIds.has(movement.id)
  );
};

const getLatestUndoableMovement = (rows: MovementRow[]) => (
  getEffectiveMovements(rows).find((movement) => UNDOABLE_MOVEMENT_TYPES.includes(movement.movement_type)) ?? null
);

const buildVehicleStateFromHistory = (rows: MovementRow[]) => {
  const latestMovement = getEffectiveMovements(rows)[0] ?? null;
  const clearedState = {
    sale_date: null,
    sale_value: null,
    buyer_name: null,
    buyer_doc: null,
    buyer_phone: null,
    buyer_email: null,
    buyer_address: null,
    sale_notary: null,
    sale_city: null,
    sale_state: null,
    sale_payment_method: null,
    sale_notes: null,
    sale_contract_url: null,
    inactivated_at: null,
    inactive_reason: null,
    inactive_notes: null,
  };

  if (!latestMovement) {
    return { status: "ativo", notes: null, ...clearedState };
  }

  if (latestMovement.movement_type === "venda") {
    return {
      status: SOLD_STATUS,
      notes: null,
      ...clearedState,
      sale_date: latestMovement.occurred_at ?? null,
      sale_value: latestMovement.metadata?.sale_value ?? null,
      buyer_name: latestMovement.metadata?.buyer_name ?? null,
      buyer_doc: latestMovement.metadata?.buyer_doc ?? null,
      sale_payment_method: latestMovement.metadata?.payment_method ?? null,
      sale_notes: latestMovement.notes ?? null,
    };
  }

  if (latestMovement.movement_type === "inativacao") {
    const historicalStatus = latestMovement.metadata?.status;
    return {
      status: INACTIVE_STATUSES.includes(historicalStatus) ? historicalStatus : "inativo",
      notes: latestMovement.metadata?.general_notes ?? null,
      ...clearedState,
      inactivated_at: latestMovement.metadata?.inactivated_at ?? latestMovement.occurred_at ?? null,
      inactive_reason: latestMovement.metadata?.inactive_reason ?? latestMovement.reason ?? null,
      inactive_notes: latestMovement.metadata?.inactive_notes ?? latestMovement.notes ?? null,
    };
  }

  if (latestMovement.movement_type === "reativacao") {
    return {
      status: latestMovement.metadata?.to === "manutencao" ? "manutencao" : "ativo",
      notes: null,
      ...clearedState,
    };
  }

  return { status: "ativo", notes: null, ...clearedState };
};

export default function VehicleDialog({ open, onOpenChange, vehicle, onSaved }: any) {
  const { currentCompanyId, refreshCompanies } = useAuth();

  const resolveCompany = async (): Promise<string | null> => {
    if (currentCompanyId) return currentCompanyId;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: prof } = await supabase
      .from("profiles").select("current_company_id").eq("id", user.id).maybeSingle();
    let cid = prof?.current_company_id ?? null;
    if (!cid) {
      const { data: mem } = await supabase
        .from("company_members").select("company_id").eq("user_id", user.id).limit(1).maybeSingle();
      cid = mem?.company_id ?? null;
    }
    if (cid) await refreshCompanies();
    return cid;
  };
  const isEdit = !!vehicle;
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [archivedDoc, setArchivedDoc] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dados");
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [form, setForm] = useState<any>(buildFormState());

  useEffect(() => {
    let alive = true;

    const hydrateForm = async () => {
      setArchivedDoc(null);
      setActiveTab("dados");

      if (!open) return;
      if (!vehicle?.id) {
        setForm(buildFormState());
        return;
      }

      setForm(buildFormState(vehicle));

      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", vehicle.id)
        .maybeSingle();

      if (!alive) return;
      if (error) {
        console.warn("vehicle full load failed:", error.message);
        return;
      }

      setForm(buildFormState(data ?? vehicle));
    };

    hydrateForm();
    return () => { alive = false; };
  }, [vehicle, open]);

  const loadMovements = async () => {
    if (!vehicle?.id) { setMovements([]); return; }
    const { data } = await supabase
      .from("vehicle_movements")
      .select("id,movement_type,reason,notes,occurred_at,created_at,metadata")
      .eq("vehicle_id", vehicle.id)
      .order("created_at", { ascending: false });
    setMovements(sortMovementsChronologically((data ?? []) as MovementRow[]));
  };

  const undoMovement = async (m: MovementRow) => {
    if (!vehicle?.id || !currentCompanyId) return;
    const latestUndoableMovement = getLatestUndoableMovement(movements);
    if (!latestUndoableMovement || latestUndoableMovement.id !== m.id) {
      return toast.error("Só é possível desfazer a última movimentação cronológica.");
    }
    const tipo = m.movement_type === "venda" ? "venda" : m.movement_type === "inativacao" ? "inativação" : m.movement_type;
    if (!confirm(`Desfazer este movimento de ${tipo}? O veículo voltará para o estado anterior no histórico.`)) return;

    setBusy(true);
    try {
      if (!UNDOABLE_MOVEMENT_TYPES.includes(m.movement_type)) {
        toast.error("Somente movimentos de venda ou inativação podem ser desfeitos.");
        setBusy(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { error: revErr } = await supabase.from("vehicle_movements").insert({
        company_id: currentCompanyId,
        vehicle_id: vehicle.id,
        movement_type: "reversao",
        reason: `Reversão de ${tipo}`,
        notes: `Desfeito movimento original de ${m.occurred_at || m.created_at?.slice(0,10)}`,
        occurred_at: new Date().toISOString().slice(0, 10),
        created_by: user?.id ?? null,
        metadata: { reverted_movement_id: m.id, original_type: m.movement_type, original_metadata: m.metadata ?? {} },
      });
      if (revErr) console.warn("reversal insert failed:", revErr.message);

      const nextHistory = sortMovementsChronologically([
        ...movements,
        {
          id: crypto.randomUUID(),
          company_id: currentCompanyId,
          vehicle_id: vehicle.id,
          movement_type: "reversao",
          reason: `Reversão de ${tipo}`,
          notes: `Desfeito movimento original de ${m.occurred_at || m.created_at?.slice(0,10)}`,
          occurred_at: new Date().toISOString().slice(0, 10),
          created_at: new Date().toISOString(),
          metadata: { reverted_movement_id: m.id, original_type: m.movement_type, original_metadata: m.metadata ?? {} },
        } as MovementRow,
      ]);

      const resetPayload = buildVehicleStateFromHistory(nextHistory);
      const { error: upErr } = await supabase.from("vehicles").update(resetPayload).eq("id", vehicle.id);
      if (upErr) throw upErr;

      setForm((f: any) => ({
        ...f,
        status: resetPayload.status ?? "ativo",
        sale_date: resetPayload.sale_date ?? "",
        sale_value: resetPayload.sale_value ?? "",
        buyer_name: resetPayload.buyer_name ?? "",
        buyer_doc: resetPayload.buyer_doc ?? "",
        buyer_phone: resetPayload.buyer_phone ?? "",
        buyer_email: resetPayload.buyer_email ?? "",
        buyer_address: resetPayload.buyer_address ?? "",
        sale_notary: resetPayload.sale_notary ?? "",
        sale_city: resetPayload.sale_city ?? "",
        sale_state: resetPayload.sale_state ?? "",
        sale_payment_method: resetPayload.sale_payment_method ?? "",
        sale_notes: resetPayload.sale_notes ?? "",
        sale_contract_url: resetPayload.sale_contract_url ?? "",
        inactivated_at: resetPayload.inactivated_at ?? "",
        inactive_reason: resetPayload.inactive_reason ?? "",
        inactive_notes: resetPayload.inactive_notes ?? "",
        notes: resetPayload.notes ?? f.notes,
      }));

      await loadMovements();
      onSaved?.();
      toast.success(`Movimento de ${tipo} desfeito. O veículo voltou para o estado anterior do histórico.`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao desfazer movimento");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (open && vehicle?.id) loadMovements();
    else setMovements([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicle?.id]);

  const upload = async (file: File) => {
    if (!currentCompanyId) return;
    setUploading(true);
    const path = `${currentCompanyId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("vehicle-photos").upload(path, file);
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data: pub } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
    setForm((f: any) => ({ ...f, photos: [...f.photos, pub.publicUrl] }));
    setUploading(false);
  };

  const removePhoto = (idx: number) => setForm((f: any) => ({ ...f, photos: f.photos.filter((_: any, i: number) => i !== idx) }));

  const aiFill = async (file: File) => {
    const companyId = await resolveCompany();
    if (!companyId) return toast.error("Nenhuma empresa vinculada à sua conta");
    setAiBusy(true);
    try {
      const { data, archivedUrl } = await extractDocument({
        type: "vehicle", file, bucket: "vehicle-docs", companyId,
      });
      setForm((f: any) => ({
        ...f,
        plate: data.plate ? String(data.plate).toUpperCase().replace(/[^A-Z0-9]/g, "") : f.plate,
        renavam: data.renavam ?? f.renavam,
        chassis: data.chassis ?? f.chassis,
        brand: data.brand ?? f.brand,
        model: data.model ?? f.model,
        year_manufacture: data.year_manufacture ?? f.year_manufacture,
        year_model: data.year_model ?? f.year_model,
        color: data.color ?? f.color,
        fuel_type: data.fuel_type ?? f.fuel_type,
        vehicle_type: data.vehicle_type ?? f.vehicle_type,
        owner_name: data.owner_name ?? f.owner_name,
        owner_doc: data.owner_doc ? String(data.owner_doc).replace(/\D/g, "") : f.owner_doc,
        crlv_city: data.crlv_city ?? f.crlv_city,
        crlv_issue_date: data.crlv_issue_date ?? f.crlv_issue_date,
        licensing_year: data.licensing_year ?? f.licensing_year,
        documents: archivedUrl ? [...(f.documents ?? []), archivedUrl] : (f.documents ?? []),
      }));
      setArchivedDoc(archivedUrl);
      toast.success("Dados preenchidos pela IA. Revise antes de salvar.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao processar documento");
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    if (!currentCompanyId) return toast.error("Selecione uma empresa");
    if (!form.plate.trim() || !form.brand.trim() || !form.model.trim()) return toast.error("Placa, marca e modelo são obrigatórios");
    setBusy(true);

    // Auto-flag: se preencheu data de venda mas o status não foi alterado, marca como vendido.
    const hasSaleData = !!(form.sale_date || form.sale_value || form.buyer_name);
    const hasInactiveLaunch = !!(form.inactivated_at || form.inactive_reason || form.inactive_notes || form.notes);
    const prevStatus = vehicle?.status ?? null;
    let finalStatus = form.status;
    if (hasSaleData && finalStatus !== SOLD_STATUS) {
      finalStatus = SOLD_STATUS;
    }
    if (activeTab === "inativacao" && hasInactiveLaunch && !INACTIVE_STATUSES.includes(finalStatus) && finalStatus !== SOLD_STATUS) {
      finalStatus = "inativo";
    }

    const dataPayload: any = {
      plate: form.plate.toUpperCase().trim(),
      renavam: form.renavam || null,
      chassis: form.chassis || null,
      brand: form.brand.trim(),
      model: form.model.trim(),
      year_manufacture: form.year_manufacture ? Number(form.year_manufacture) : null,
      year_model: form.year_model ? Number(form.year_model) : null,
      color: form.color || null,
      fuel_type: form.fuel_type || null,
      tank_capacity: form.tank_capacity ? Number(form.tank_capacity) : null,
      vehicle_type: form.vehicle_type || null,
      current_km: Number(form.current_km) || 0,
      status: finalStatus,
      responsible: form.responsible || null,
      insurer: form.insurer || null,
      insurance_policy: form.insurance_policy || null,
      insurance_expires_at: form.insurance_expires_at || null,
      insurance_responsible: form.insurance_responsible || null,
      fipe_value: form.fipe_value ? Number(form.fipe_value) : null,
      photos: form.photos ?? [],
      documents: form.documents ?? [],
      licensing_year: form.licensing_year ? Number(form.licensing_year) : null,
      owner_name: form.owner_name || null,
      owner_doc: form.owner_doc || null,
      crlv_issue_date: form.crlv_issue_date || null,
      crlv_city: form.crlv_city || null,
    };
    const salePayload: any = {
      status: finalStatus,
      sale_date: form.sale_date || null,
      sale_value: form.sale_value ? Number(form.sale_value) : null,
      buyer_name: form.buyer_name || null,
      buyer_doc: form.buyer_doc || null,
      buyer_phone: form.buyer_phone || null,
      buyer_email: form.buyer_email || null,
      buyer_address: form.buyer_address || null,
      sale_notary: form.sale_notary || null,
      sale_city: form.sale_city || null,
      sale_state: form.sale_state || null,
      sale_payment_method: form.sale_payment_method || null,
      sale_notes: form.sale_notes || null,
      sale_contract_url: form.sale_contract_url || null,
    };
    const inactivePayload: any = {
      status: finalStatus,
      inactivated_at: form.inactivated_at || null,
      inactive_reason: form.inactive_reason || null,
      inactive_notes: form.inactive_notes || null,
      notes: form.notes || null,
    };
    const payload: any = isEdit
      ? {
          ...(activeTab === "dados" ? dataPayload : {}),
          ...(activeTab === "venda" ? salePayload : {}),
          ...(activeTab === "inativacao" ? inactivePayload : {}),
        }
      : {
          ...dataPayload,
          ...salePayload,
          ...inactivePayload,
          company_id: currentCompanyId,
        };

    if (isEdit) payload.company_id = currentCompanyId;
    delete payload.id;
    // Normaliza strings vazias para null em todos os demais campos (evita perder dados ou quebrar tipos)
    for (const k of Object.keys(payload)) {
      if (payload[k] === "") payload[k] = null;
    }
    // Remove campos calculados/relacionais que não pertencem à tabela vehicles
    delete payload.created_at;
    delete payload.updated_at;
    const op = isEdit
      ? supabase.from("vehicles").update(payload).eq("id", vehicle.id)
      : supabase.from("vehicles").insert(payload).select("id").single();
    const { data: saved, error } = await (op as any);
    if (error) { setBusy(false); return toast.error(error.message); }

    // Vincula CRLV anexado pela IA na tabela `documents`
    const vehicleId = isEdit ? vehicle.id : saved?.id;
    if (archivedDoc && vehicleId) {
      const { error: docErr } = await supabase.from("documents").insert({
        company_id: currentCompanyId,
        entity_type: "vehicle",
        entity_id: vehicleId,
        doc_type: "crlv",
        title: "CRLV",
        issue_date: form.crlv_issue_date || null,
        file_url: archivedDoc,
        file_name: archivedDoc.split("/").pop() || null,
        mime_type: archivedDoc.toLowerCase().endsWith(".pdf") ? "application/pdf" : null,
        ai_extracted: {
          source: "vehicle_form",
          plate: payload.plate,
          owner_name: form.owner_name,
          owner_doc: form.owner_doc,
          crlv_city: form.crlv_city,
          licensing_year: payload.licensing_year,
          crlv_issue_date: form.crlv_issue_date,
        },
      });
      if (docErr) console.warn("vehicle CRLV archive failed:", docErr.message);
    }

    // Movimentações automáticas
    if (vehicleId) {
      const { data: { user } } = await supabase.auth.getUser();
      const movs: any[] = [];

      // Venda: registra quando a aba de venda é salva com dados preenchidos
      const becameSold = finalStatus === SOLD_STATUS && prevStatus !== SOLD_STATUS;
      const shouldRegisterSale = activeTab === "venda" && hasSaleData;
      if (shouldRegisterSale || (becameSold && !shouldRegisterSale) || (hasSaleData && !isEdit)) {
        movs.push({
          company_id: currentCompanyId,
          vehicle_id: vehicleId,
          movement_type: "venda",
          reason: "Venda do veículo",
          notes: form.sale_notes || null,
          occurred_at: form.sale_date || new Date().toISOString().slice(0, 10),
          created_by: user?.id ?? null,
          metadata: {
            buyer_name: form.buyer_name || null,
            buyer_doc: form.buyer_doc || null,
            sale_value: payload.sale_value,
            payment_method: form.sale_payment_method || null,
          },
        });
      }

      // Inativação: registra sempre que houver lançamento salvo nesta aba
      const becameInactive = INACTIVE_STATUSES.includes(finalStatus) && !INACTIVE_STATUSES.includes(prevStatus ?? "");
      const shouldRegisterInactive = activeTab === "inativacao" && hasInactiveLaunch;
      if (becameInactive || shouldRegisterInactive) {
        movs.push({
          company_id: currentCompanyId,
          vehicle_id: vehicleId,
          movement_type: "inativacao",
          reason: form.inactive_reason || finalStatus,
          notes: form.inactive_notes || form.notes || null,
          occurred_at: form.inactivated_at || new Date().toISOString().slice(0, 10),
          created_by: user?.id ?? null,
          metadata: {
            status: finalStatus,
            inactive_reason: form.inactive_reason || null,
            inactive_notes: form.inactive_notes || null,
            general_notes: form.notes || null,
            inactivated_at: form.inactivated_at || null,
          },
        });

        // Os campos da aba "Observações & Inativação" foram arquivados no histórico.
        // Limpa apenas esses campos no veículo — os dados da aba "Dados" permanecem intactos.
        const resetPayload: any = {
          inactive_reason: null,
          inactive_notes: null,
          inactivated_at: null,
          notes: null,
        };
        const { error: resetErr } = await supabase
          .from("vehicles").update(resetPayload).eq("id", vehicleId);
        if (resetErr) console.warn("vehicle reset on inactivation failed:", resetErr.message);

        // Reflete o reset no formulário local
        setForm((f: any) => ({ ...f, inactive_reason: "", inactive_notes: "", inactivated_at: "", notes: "" }));
      }

      // Reativação
      const wasInactiveOrSold = INACTIVE_STATUSES.includes(prevStatus ?? "") || prevStatus === SOLD_STATUS;
      const nowActive = finalStatus === "ativo" || finalStatus === "manutencao";
      if (wasInactiveOrSold && nowActive) {
        movs.push({
          company_id: currentCompanyId,
          vehicle_id: vehicleId,
          movement_type: "reativacao",
          reason: "Reativação do veículo",
          notes: null,
          occurred_at: new Date().toISOString().slice(0, 10),
          created_by: user?.id ?? null,
          metadata: { from: prevStatus, to: finalStatus },
        });
      }

      if (movs.length) {
        const { error: mErr } = await supabase.from("vehicle_movements").insert(movs);
        if (mErr) {
          console.warn("vehicle movement insert failed:", mErr.message);
          toast.error("Veículo salvo, mas a movimentação não foi registrada.");
        }
      }
    }

    setBusy(false);
    toast.success(isEdit ? "Veículo atualizado" : "Veículo cadastrado");
    onSaved();
    // Se houve inativação, mantém o diálogo aberto e mostra o histórico
    const becameInactiveNow = activeTab === "inativacao" && hasInactiveLaunch;
    if (becameInactiveNow && vehicleId) {
      await loadMovements();
      setActiveTab("movimentacoes");
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{isEdit ? "Editar veículo" : "Novo veículo"}</DialogTitle>
        </DialogHeader>

        {activeTab === "dados" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary grid place-items-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Preencher com IA</p>
            <p className="text-xs text-muted-foreground">Envie a foto ou PDF do CRLV/CRV — extraímos os dados e arquivamos o documento.</p>
          </div>
          <label>
            <Button type="button" size="sm" disabled={aiBusy} asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow cursor-pointer">
              <span>
                {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                {aiBusy ? "Lendo..." : "Enviar CRLV"}
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
        )}
        {activeTab === "dados" && archivedDoc && (
          <a href={archivedDoc} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
            <FileText className="h-3 w-3" /> Documento arquivado
          </a>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="venda">Venda</TabsTrigger>
            <TabsTrigger value="inativacao">Observações & Inativação</TabsTrigger>
            <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-4 mt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Placa *</Label><Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} className="font-mono uppercase" /></div>
          <div className="space-y-2"><Label>RENAVAM</Label><Input value={form.renavam} onChange={(e) => setForm({ ...form, renavam: e.target.value })} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Chassi</Label><Input value={form.chassis} onChange={(e) => setForm({ ...form, chassis: e.target.value })} /></div>
          <div className="space-y-2"><Label>Marca *</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
          <div className="space-y-2"><Label>Modelo *</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
          <div className="space-y-2"><Label>Ano fabricação</Label><Input type="number" value={form.year_manufacture} onChange={(e) => setForm({ ...form, year_manufacture: e.target.value })} /></div>
          <div className="space-y-2"><Label>Ano modelo</Label><Input type="number" value={form.year_model} onChange={(e) => setForm({ ...form, year_model: e.target.value })} /></div>
          <div className="space-y-2"><Label>Cor</Label><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
          <div className="space-y-2"><Label>Tipo</Label><Input value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} placeholder="Sedan, utilitário, caminhão..." /></div>
          <div className="space-y-2">
            <Label>Combustível</Label>
            <Select value={form.fuel_type} onValueChange={(v) => setForm({ ...form, fuel_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FUELS.map((f) => <SelectItem key={f} value={f} className="capitalize">{f.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Capacidade tanque (L)</Label><Input type="number" step="0.01" value={form.tank_capacity} onChange={(e) => setForm({ ...form, tank_capacity: e.target.value })} /></div>
          <div className="space-y-2"><Label>KM atual</Label><Input type="number" value={form.current_km} onChange={(e) => setForm({ ...form, current_km: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Responsável</Label><Input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} /></div>
          <div className="space-y-2"><Label>Seguradora</Label><Input value={form.insurer} onChange={(e) => setForm({ ...form, insurer: e.target.value })} /></div>
          <div className="space-y-2"><Label>Apólice</Label><Input value={form.insurance_policy} onChange={(e) => setForm({ ...form, insurance_policy: e.target.value })} /></div>
          <div className="space-y-2"><Label>Vencimento seguro</Label><Input type="date" value={form.insurance_expires_at} onChange={(e) => setForm({ ...form, insurance_expires_at: e.target.value })} /></div>
          <div className="space-y-2"><Label>Valor FIPE (R$)</Label><Input type="number" step="0.01" value={form.fipe_value} onChange={(e) => setForm({ ...form, fipe_value: e.target.value })} /></div>
          <div className="space-y-2"><Label>Proprietário (CRLV)</Label><Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="Nome conforme CRLV" /></div>
          <div className="space-y-2"><Label>CPF / CNPJ do proprietário</Label><Input value={form.owner_doc} onChange={(e) => setForm({ ...form, owner_doc: e.target.value.replace(/\D/g, "") })} placeholder="Somente números" /></div>
          <div className="space-y-2"><Label>Município de emplacamento</Label><Input value={form.crlv_city} onChange={(e) => setForm({ ...form, crlv_city: e.target.value })} /></div>
          <div className="space-y-2"><Label>Data de emissão CRLV</Label><Input type="date" value={form.crlv_issue_date} onChange={(e) => setForm({ ...form, crlv_issue_date: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Exercício de licenciamento</Label>
            <Input type="number" min="2000" max="2100" value={form.licensing_year} onChange={(e) => setForm({ ...form, licensing_year: e.target.value })} placeholder={String(new Date().getFullYear())} />
            <p className="text-[11px] text-muted-foreground">Se igual ao ano atual, o veículo é considerado licenciado.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Fotos do veículo</Label>
          <div className="flex flex-wrap gap-3">
            {form.photos.map((url: string, i: number) => (
              <div key={i} className="relative h-20 w-28 rounded-lg overflow-hidden border border-border">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-destructive/90 text-destructive-foreground rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="h-20 w-28 rounded-lg border border-dashed border-border grid place-items-center cursor-pointer hover:border-primary text-muted-foreground hover:text-primary transition-colors">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /></>}
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            </label>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="venda" className="space-y-4 mt-4">
            {form.status !== SOLD_STATUS && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                Para registrar a venda, defina o status do veículo como <strong>Vendido</strong> na aba Dados. Os campos abaixo serão salvos mesmo sem alterar o status.
              </div>
            )}
            <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
              <p className="text-sm font-semibold">Dados da venda</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Data da venda</Label><Input type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} /></div>
                <div className="space-y-2"><Label>Valor da venda (R$)</Label><Input type="number" step="0.01" value={form.sale_value} onChange={(e) => setForm({ ...form, sale_value: e.target.value })} /></div>
                <div className="space-y-2"><Label>Forma de pagamento</Label><Input value={form.sale_payment_method} onChange={(e) => setForm({ ...form, sale_payment_method: e.target.value })} placeholder="À vista, financiado, transferência..." /></div>
                <div className="space-y-2"><Label>URL do contrato (opcional)</Label><Input value={form.sale_contract_url} onChange={(e) => setForm({ ...form, sale_contract_url: e.target.value })} placeholder="https://..." /></div>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
              <p className="text-sm font-semibold">Comprador</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Nome / Razão social</Label><Input value={form.buyer_name} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>CPF / CNPJ</Label><Input value={form.buyer_doc} onChange={(e) => setForm({ ...form, buyer_doc: e.target.value.replace(/\D/g, "") })} placeholder="Somente números" /></div>
                <div className="space-y-2"><Label>Telefone</Label><Input value={form.buyer_phone} onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })} /></div>
                <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.buyer_email} onChange={(e) => setForm({ ...form, buyer_email: e.target.value })} /></div>
                <div className="space-y-2 sm:col-span-2"><Label>Endereço</Label><Input value={form.buyer_address} onChange={(e) => setForm({ ...form, buyer_address: e.target.value })} /></div>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
              <p className="text-sm font-semibold">Cartório / Registro</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2 sm:col-span-2"><Label>Cartório (nome)</Label><Input value={form.sale_notary} onChange={(e) => setForm({ ...form, sale_notary: e.target.value })} placeholder="Ex: 2º Tabelião de Notas" /></div>
                <div className="space-y-2"><Label>Cidade</Label><Input value={form.sale_city} onChange={(e) => setForm({ ...form, sale_city: e.target.value })} /></div>
                <div className="space-y-2"><Label>UF</Label><Input value={form.sale_state} onChange={(e) => setForm({ ...form, sale_state: e.target.value.toUpperCase().slice(0,2) })} maxLength={2} /></div>
              </div>
              <div className="space-y-2"><Label>Observações da venda</Label><Textarea rows={3} value={form.sale_notes} onChange={(e) => setForm({ ...form, sale_notes: e.target.value })} placeholder="Detalhes do reconhecimento de firma, transferência, recibo..." /></div>
            </div>
          </TabsContent>

          <TabsContent value="inativacao" className="space-y-4 mt-4">
            <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
              <p className="text-sm font-semibold">Inativação</p>
              {!INACTIVE_STATUSES.includes(form.status) && form.status !== SOLD_STATUS && (
                <p className="text-xs text-muted-foreground">Os campos abaixo são usados quando o status é Inativo, Sinistrado, Transferido, Roubado/Furtado, Leiloado ou Parado.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Data da inativação</Label><Input type="date" value={form.inactivated_at} onChange={(e) => setForm({ ...form, inactivated_at: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Motivo</Label>
                  <Select value={form.inactive_reason || ""} onValueChange={(v) => setForm({ ...form, inactive_reason: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                    <SelectContent>
                      {INACTIVE_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observação (linha única)</Label>
                <Input value={form.inactive_notes} onChange={(e) => setForm({ ...form, inactive_notes: e.target.value })} placeholder="Resumo curto — será adicionado ao histórico de movimentações" />
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
              <p className="text-sm font-semibold">Observações gerais</p>
              <Textarea rows={5} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas livres sobre o veículo, histórico, particularidades..." />
            </div>
          </TabsContent>

          <TabsContent value="movimentacoes" className="space-y-3 mt-4">
            {!isEdit ? (
              <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
                Salve o veículo primeiro para visualizar o histórico de movimentações.
              </div>
            ) : movements.length === 0 ? (
              <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
                <History className="h-6 w-6 mx-auto mb-2 opacity-50" />
                Nenhuma movimentação registrada ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const latestUndoableMovement = getLatestUndoableMovement(movements);
                  return movements.map((m) => (
                  <div key={m.id} className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold capitalize">{m.movement_type}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {m.occurred_at ? new Date(m.occurred_at).toLocaleDateString("pt-BR") : new Date(m.created_at).toLocaleDateString("pt-BR")}
                        </span>
                        {UNDOABLE_MOVEMENT_TYPES.includes(m.movement_type) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            disabled={busy || latestUndoableMovement?.id !== m.id}
                            onClick={() => undoMovement(m)}
                            title={latestUndoableMovement?.id === m.id ? "Desfazer este movimento" : "Desfaça primeiro a última movimentação cronológica"}
                          >
                            <Undo2 className="h-3.5 w-3.5 mr-1" /> Desfazer
                          </Button>
                        )}
                      </div>
                    </div>
                    {m.reason && <div className="text-xs text-muted-foreground mt-1">Motivo: {m.reason}</div>}
                    {m.notes && <div className="text-xs mt-1">{m.notes}</div>}
                    {m.metadata && Object.keys(m.metadata).length > 0 && (
                      <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                        {Object.entries(m.metadata).filter(([,v]) => v != null && v !== "").map(([k,v]) => `${k}: ${v}`).join(" · ")}
                      </div>
                    )}
                  </div>
                ));
                })()}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
