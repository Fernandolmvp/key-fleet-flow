import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractDocument } from "@/lib/ai-extract";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  DOC_TYPE_LABELS, VEHICLE_DOC_TYPES, DRIVER_DOC_TYPES, crossValidate,
} from "@/lib/documents";

type EntityOption = { id: string; label: string; meta: { plate?: string; cpf?: string; full_name?: string } };

export type DocFormDoc = {
  id?: string;
  entity_type: "vehicle" | "driver";
  entity_id: string;
  doc_type: string;
  title?: string | null;
  document_number?: string | null;
  issuer?: string | null;
  issue_date?: string | null;
  expires_at?: string | null;
  notes?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  ai_extracted?: Record<string, any>;
};

export default function DocumentDialog({
  open, onOpenChange, companyId, doc, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  doc?: DocFormDoc | null;
  onSaved: () => void;
}) {
  const [vehicles, setVehicles] = useState<EntityOption[]>([]);
  const [drivers, setDrivers] = useState<EntityOption[]>([]);
  const [form, setForm] = useState<DocFormDoc>({
    entity_type: "vehicle", entity_id: "", doc_type: "crlv",
    title: "", document_number: "", issuer: "", issue_date: "", expires_at: "", notes: "",
    file_url: null, file_name: null, mime_type: null, ai_extracted: {},
  });
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [v, d] = await Promise.all([
        supabase.from("vehicles").select("id,plate,brand,model").eq("company_id", companyId).order("plate"),
        supabase.from("drivers").select("id,full_name,cpf").eq("company_id", companyId).order("full_name"),
      ]);
      setVehicles((v.data || []).map((x: any) => ({
        id: x.id, label: `${x.plate} — ${x.brand} ${x.model}`, meta: { plate: x.plate },
      })));
      setDrivers((d.data || []).map((x: any) => ({
        id: x.id, label: x.full_name, meta: { cpf: x.cpf, full_name: x.full_name },
      })));
    })();
  }, [open, companyId]);

  useEffect(() => {
    if (open) {
      const base: DocFormDoc = {
        entity_type: "vehicle", entity_id: "", doc_type: "crlv",
        title: "", document_number: "", issuer: "", issue_date: "", expires_at: "", notes: "",
        file_url: null, file_name: null, mime_type: null, ai_extracted: {},
      };
      setForm(doc ? { ...base, ...doc } : base);
      setFile(null);
    }
  }, [open, doc]);

  const typeOptions = form.entity_type === "vehicle" ? VEHICLE_DOC_TYPES : DRIVER_DOC_TYPES;
  const entityList = form.entity_type === "vehicle" ? vehicles : drivers;

  async function handleAIExtract() {
    if (!file) {
      toast.error("Selecione um arquivo primeiro");
      return;
    }
    // Pré-checagem: tamanho (10 MB) e tipo.
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo muito grande (máx. 10 MB). Reduza ou tire uma foto menor.");
      return;
    }
    const name = (file.name || "").toLowerCase();
    const mime = (file.type || "").toLowerCase();
    const isHeic = /\.(heic|heif)$/.test(name) || /hei[cf]/.test(mime);
    if (isHeic) {
      toast.error("Formato HEIC não suportado. No iPhone, ajuste para JPG/PNG ou envie PDF.");
      return;
    }
    const ACCEPTED = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
    const extOk = /\.(pdf|jpe?g|png|webp)$/.test(name);
    if (mime && !ACCEPTED.includes(mime) && !extOk) {
      toast.error("Formato não suportado. Envie PDF, JPG, PNG ou WEBP.");
      return;
    }
    setExtracting(true);
    try {
      const { data: raw, archivedUrl } = await extractDocument({
        type: "document", file, bucket: "documents", companyId,
      });
      const data: Record<string, any> = raw && typeof raw === "object" ? raw : {};
      const isStr = (v: any): v is string => typeof v === "string" && v.length > 0;
      const isIsoDate = (v: any) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
      const next: DocFormDoc = { ...form };
      const dt = isStr(data.doc_type) ? data.doc_type : null;
      if (dt && (typeOptions as readonly string[]).includes(dt)) {
        next.doc_type = dt;
      } else if (dt) {
        if ((VEHICLE_DOC_TYPES as readonly string[]).includes(dt)) {
          next.entity_type = "vehicle"; next.doc_type = dt;
        } else if ((DRIVER_DOC_TYPES as readonly string[]).includes(dt)) {
          next.entity_type = "driver"; next.doc_type = dt;
        }
      }
      if (isStr(data.title)) next.title = data.title;
      if (isStr(data.document_number)) next.document_number = data.document_number;
      if (isStr(data.issuer)) next.issuer = data.issuer;
      if (isIsoDate(data.issue_date)) next.issue_date = data.issue_date;
      if (isIsoDate(data.expires_at)) next.expires_at = data.expires_at;
      if (isStr(data.notes)) next.notes = data.notes;
      next.ai_extracted = data;
      next.file_url = archivedUrl || next.file_url;
      next.file_name = file.name;
      next.mime_type = file.type;
      setForm(next);
      toast.success("Dados extraídos pela IA");
    } catch (e: any) {
      // Loga TUDO para diagnóstico real no console do navegador.
      console.error("AI extract failed:", {
        message: e?.message,
        status: e?.status,
        raw: e?.raw,
        context: e?.context,
        stack: e?.stack,
      });
      const msg = e?.message
        || "Não foi possível ler o documento. Verifique o arquivo e tente de novo, ou preencha manualmente.";
      toast.error(msg);
    } finally {
      setExtracting(false);
    }
  }

  async function handleSave() {
    if (!form.entity_id) {
      toast.error("Selecione o veículo ou motorista");
      return;
    }
    setSaving(true);
    try {
      // Upload do arquivo se ainda não foi feito (ex.: usuário não rodou IA)
      let fileUrl = form.file_url;
      let fileName = form.file_name;
      let mime = form.mime_type;
      if (file && !fileUrl) {
        const path = `${companyId}/manual/${crypto.randomUUID()}-${file.name}`;
        const up = await supabase.storage.from("documents").upload(path, file, {
          contentType: file.type, upsert: false,
        });
        if (up.error) throw up.error;
        const { data: pub } = supabase.storage.from("documents").getPublicUrl(path);
        fileUrl = pub.publicUrl;
        fileName = file.name;
        mime = file.type;
      }

      // Validação cruzada
      let warning: string | null = null;
      let validation: Record<string, any> = {};
      const ent = entityList.find((e) => e.id === form.entity_id);
      if (ent && form.ai_extracted && Object.keys(form.ai_extracted).length) {
        const r = crossValidate({
          entityType: form.entity_type,
          extracted: form.ai_extracted,
          vehiclePlate: ent.meta.plate,
          driverCpf: ent.meta.cpf,
          driverName: ent.meta.full_name,
        });
        warning = r.warning;
        validation = { ok: r.ok, ...r.details, checked_at: new Date().toISOString() };
      }

      const { data: { user } } = await supabase.auth.getUser();

      const payload = {
        company_id: companyId,
        entity_type: form.entity_type,
        entity_id: form.entity_id,
        doc_type: form.doc_type as any,
        title: form.title || null,
        document_number: form.document_number || null,
        issuer: form.issuer || null,
        issue_date: form.issue_date || null,
        expires_at: form.expires_at || null,
        notes: form.notes || null,
        file_url: fileUrl || null,
        file_name: fileName || null,
        mime_type: mime || null,
        ai_extracted: form.ai_extracted || {},
        ai_validation: validation,
        validation_warning: warning,
        created_by: user?.id || null,
      };

      if (form.id) {
        const { error } = await supabase.from("documents").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("documents").insert(payload);
        if (error) throw error;
      }

      // Se for CRLV de veículo, sincroniza dados extraídos no cadastro do veículo
      if (form.entity_type === "vehicle" && form.doc_type === "crlv" && form.ai_extracted) {
        const ext = form.ai_extracted as Record<string, any>;
        const vehicleUpdate: Record<string, any> = {};
        if (ext.licensing_year) vehicleUpdate.licensing_year = Number(ext.licensing_year);
        if (ext.owner_name) vehicleUpdate.owner_name = ext.owner_name;
        if (ext.owner_doc) vehicleUpdate.owner_doc = String(ext.owner_doc).replace(/\D/g, "");
        if (ext.crlv_city) vehicleUpdate.crlv_city = ext.crlv_city;
        if (ext.issue_date) vehicleUpdate.crlv_issue_date = ext.issue_date;
        if (Object.keys(vehicleUpdate).length > 0) {
          const { error: vErr } = await supabase
            .from("vehicles").update(vehicleUpdate as any).eq("id", form.entity_id);
          if (vErr) console.warn("vehicle sync failed:", vErr.message);
        }
      }

      toast.success("Documento salvo");
      if (warning) toast.warning(warning);
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <ErrorBoundary>
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar documento" : "Novo documento"}</DialogTitle>
        </DialogHeader>

        {/* Upload + IA */}
        <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" /> Preenchimento automático com IA
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Button type="button" onClick={handleAIExtract} disabled={!file || extracting}>
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Extrair
            </Button>
          </div>
          {form.file_url && (
            <a href={form.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
              Ver arquivo anexado
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Vinculado a</Label>
            <Select value={form.entity_type} onValueChange={(v: any) => setForm({ ...form, entity_type: v, entity_id: "", doc_type: v === "vehicle" ? "crlv" : "cnh" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vehicle">Veículo</SelectItem>
                <SelectItem value="driver">Motorista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{form.entity_type === "vehicle" ? "Veículo" : "Motorista"}</Label>
            <Select value={form.entity_id} onValueChange={(v) => setForm({ ...form, entity_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {entityList.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tipo</Label>
            <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Número do documento</Label>
            <Input value={form.document_number || ""} onChange={(e) => setForm({ ...form, document_number: e.target.value })} />
          </div>

          <div>
            <Label>Emissor</Label>
            <Input value={form.issuer || ""} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
          </div>
          <div>
            <Label>Título / descrição</Label>
            <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>

          <div>
            <Label>Data de emissão</Label>
            <Input type="date" value={form.issue_date || ""} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
          </div>
          <div>
            <Label>Vencimento</Label>
            <Input type="date" value={form.expires_at || ""} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
          </div>

          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}