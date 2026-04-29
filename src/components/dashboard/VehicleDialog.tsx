import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, X, Sparkles, FileText } from "lucide-react";
import { extractDocument } from "@/lib/ai-extract";

const STATUSES = ["ativo","manutencao","vendido","parado","sinistrado"];
const FUELS = ["gasolina","etanol","diesel","diesel_s10","flex","gnv","eletrico","hibrido"];

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
  const [form, setForm] = useState<any>({
    plate: "", renavam: "", chassis: "", brand: "", model: "",
    year_manufacture: "", year_model: "", color: "", fuel_type: "flex",
    tank_capacity: "", vehicle_type: "", current_km: 0, status: "ativo",
    responsible: "", insurer: "", insurance_policy: "", insurance_expires_at: "",
    fipe_value: "", photos: [] as string[],
    licensing_year: "", owner_name: "", crlv_issue_date: "", crlv_city: "",
  });

  useEffect(() => {
    if (vehicle) setForm({ ...form, ...vehicle, photos: vehicle.photos ?? [] });
    else setForm({
      plate: "", renavam: "", chassis: "", brand: "", model: "",
      year_manufacture: "", year_model: "", color: "", fuel_type: "flex",
      tank_capacity: "", vehicle_type: "", current_km: 0, status: "ativo",
      responsible: "", insurer: "", insurance_policy: "", insurance_expires_at: "",
      fipe_value: "", photos: [],
      licensing_year: "", owner_name: "", crlv_issue_date: "", crlv_city: "",
    });
    setArchivedDoc(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle, open]);

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
    const payload: any = {
      ...form,
      company_id: currentCompanyId,
      plate: form.plate.toUpperCase().trim(),
      year_manufacture: form.year_manufacture ? Number(form.year_manufacture) : null,
      year_model: form.year_model ? Number(form.year_model) : null,
      tank_capacity: form.tank_capacity ? Number(form.tank_capacity) : null,
      current_km: Number(form.current_km) || 0,
      fipe_value: form.fipe_value ? Number(form.fipe_value) : null,
      insurance_expires_at: form.insurance_expires_at || null,
      licensing_year: form.licensing_year ? Number(form.licensing_year) : null,
      crlv_issue_date: form.crlv_issue_date || null,
      owner_name: form.owner_name || null,
      crlv_city: form.crlv_city || null,
    };
    delete payload.id;
    const op = isEdit
      ? supabase.from("vehicles").update(payload).eq("id", vehicle.id)
      : supabase.from("vehicles").insert(payload);
    const { error } = await op;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Veículo atualizado" : "Veículo cadastrado");
    onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{isEdit ? "Editar veículo" : "Novo veículo"}</DialogTitle>
        </DialogHeader>

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
        {archivedDoc && (
          <a href={archivedDoc} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
            <FileText className="h-3 w-3" /> Documento arquivado
          </a>
        )}

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
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Responsável</Label><Input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} /></div>
          <div className="space-y-2"><Label>Seguradora</Label><Input value={form.insurer} onChange={(e) => setForm({ ...form, insurer: e.target.value })} /></div>
          <div className="space-y-2"><Label>Apólice</Label><Input value={form.insurance_policy} onChange={(e) => setForm({ ...form, insurance_policy: e.target.value })} /></div>
          <div className="space-y-2"><Label>Vencimento seguro</Label><Input type="date" value={form.insurance_expires_at} onChange={(e) => setForm({ ...form, insurance_expires_at: e.target.value })} /></div>
          <div className="space-y-2"><Label>Valor FIPE (R$)</Label><Input type="number" step="0.01" value={form.fipe_value} onChange={(e) => setForm({ ...form, fipe_value: e.target.value })} /></div>
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
