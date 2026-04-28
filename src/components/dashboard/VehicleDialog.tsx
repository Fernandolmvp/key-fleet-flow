import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";

const STATUSES = ["ativo","manutencao","vendido","parado","sinistrado"];
const FUELS = ["gasolina","etanol","diesel","diesel_s10","flex","gnv","eletrico","hibrido"];

export default function VehicleDialog({ open, onOpenChange, vehicle, onSaved }: any) {
  const { currentCompanyId } = useAuth();
  const isEdit = !!vehicle;
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<any>({
    plate: "", renavam: "", chassis: "", brand: "", model: "",
    year_manufacture: "", year_model: "", color: "", fuel_type: "flex",
    tank_capacity: "", vehicle_type: "", current_km: 0, status: "ativo",
    responsible: "", insurer: "", insurance_policy: "", insurance_expires_at: "",
    fipe_value: "", photos: [] as string[],
  });

  useEffect(() => {
    if (vehicle) setForm({ ...form, ...vehicle, photos: vehicle.photos ?? [] });
    else setForm({
      plate: "", renavam: "", chassis: "", brand: "", model: "",
      year_manufacture: "", year_model: "", color: "", fuel_type: "flex",
      tank_capacity: "", vehicle_type: "", current_km: 0, status: "ativo",
      responsible: "", insurer: "", insurance_policy: "", insurance_expires_at: "",
      fipe_value: "", photos: [],
    });
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
