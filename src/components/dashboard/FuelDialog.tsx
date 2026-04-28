import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Upload, X, Camera, Gauge, ShieldCheck, ShieldAlert } from "lucide-react";
import { FUELS, PAYMENTS } from "@/lib/fuel";
import { extractDocument } from "@/lib/ai-extract";

interface Props { open: boolean; onOpenChange: (b: boolean) => void; record: any; onSaved: () => void; }

const blank = () => ({
  vehicle_id: "", driver_id: "", fueled_at: new Date().toISOString().slice(0, 16),
  station_name: "", station_cnpj: "", city: "", state: "",
  fuel_type: "flex", liters: "", price_per_liter: "", total_value: "", full_tank: false,
  km_at_fueling: "", payment_method: "cartao_frota", card_number: "",
  invoice_url: "", receipt_url: "", dashboard_photo_url: "", pump_photo_url: "", notes: "",
});

export default function FuelDialog({ open, onOpenChange, record, onSaved }: Props) {
  const { currentCompanyId, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [form, setForm] = useState<any>(blank());
  const [uploading, setUploading] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<"plate" | "odometer" | null>(null);
  const [plateCheck, setPlateCheck] = useState<{ plate: string; ok: boolean; vehicleId?: string } | null>(null);

  useEffect(() => {
    if (!open || !currentCompanyId) return;
    setPlateCheck(null);
    (async () => {
      const [{ data: v }, { data: d }] = await Promise.all([
        supabase.from("vehicles").select("id,plate,brand,model,current_km,fuel_type,tank_capacity").eq("company_id", currentCompanyId).order("plate"),
        supabase.from("drivers").select("id,full_name").eq("company_id", currentCompanyId).eq("status", "ativo").order("full_name"),
      ]);
      setVehicles(v ?? []); setDrivers(d ?? []);
    })();
    if (record) {
      setForm({
        ...blank(), ...record,
        fueled_at: record.fueled_at ? new Date(record.fueled_at).toISOString().slice(0, 16) : "",
        driver_id: record.driver_id ?? "",
      });
    } else setForm(blank());
  }, [open, record, currentCompanyId]);

  // Auto-cálculo total = litros × valor/litro
  useEffect(() => {
    const l = parseFloat(form.liters), p = parseFloat(form.price_per_liter);
    if (!isNaN(l) && !isNaN(p)) {
      setForm((f: any) => ({ ...f, total_value: (l * p).toFixed(2) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.liters, form.price_per_liter]);

  // Quando seleciona veículo, preenche fuel_type e KM atual
  const onVehicleChange = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    setForm((f: any) => ({
      ...f, vehicle_id: id,
      fuel_type: v?.fuel_type ?? f.fuel_type,
      km_at_fueling: v?.current_km ? String(v.current_km) : f.km_at_fueling,
    }));
  };

  const normalizePlate = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const onPlatePhoto = async (file: File) => {
    setAiBusy("plate");
    setPlateCheck(null);
    try {
      const { data } = await extractDocument({ type: "plate", file });
      const plate = normalizePlate(String(data.plate ?? ""));
      if (!plate) {
        toast.error("Não consegui ler a placa. Tente outra foto.");
        return;
      }
      const match = vehicles.find((v) => normalizePlate(v.plate) === plate);
      if (!match) {
        setPlateCheck({ plate, ok: false });
        toast.error(`Placa ${plate} não cadastrada na frota. Abastecimento bloqueado.`);
        setForm((f: any) => ({ ...f, vehicle_id: "" }));
        return;
      }
      setPlateCheck({ plate, ok: true, vehicleId: match.id });
      onVehicleChange(match.id);
      toast.success(`Placa ${plate} validada — ${match.brand} ${match.model}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao validar placa");
    } finally {
      setAiBusy(null);
    }
  };

  const onOdometerPhoto = async (file: File) => {
    setAiBusy("odometer");
    try {
      const { data } = await extractDocument({ type: "odometer", file });
      const km = Number(data.km);
      if (!km || isNaN(km)) {
        toast.error("Não consegui ler o KM do painel.");
        return;
      }
      setForm((f: any) => ({ ...f, km_at_fueling: String(km) }));
      toast.success(`KM lido: ${km.toLocaleString("pt-BR")}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler hodômetro");
    } finally {
      setAiBusy(null);
    }
  };

  const upload = async (field: string, file: File) => {
    if (!currentCompanyId) return;
    setUploading(field);
    const path = `${currentCompanyId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("fuel-receipts").upload(path, file);
    if (error) { setUploading(null); return toast.error(error.message); }
    const { data } = await supabase.storage.from("fuel-receipts").createSignedUrl(path, 60 * 60 * 24 * 365);
    setForm((f: any) => ({ ...f, [field]: data?.signedUrl ?? path }));
    setUploading(null);
  };

  const save = async () => {
    if (!currentCompanyId) return;
    if (!form.vehicle_id) return toast.error("Selecione um veículo");
    if (plateCheck && !plateCheck.ok) return toast.error("Placa não autorizada — abastecimento bloqueado");
    if (!form.liters || !form.price_per_liter || !form.km_at_fueling) return toast.error("Litros, valor/L e KM são obrigatórios");
    setBusy(true);
    const payload: any = {
      ...form,
      company_id: currentCompanyId,
      created_by: user?.id,
      driver_id: form.driver_id || null,
      liters: Number(form.liters),
      price_per_liter: Number(form.price_per_liter),
      total_value: Number(form.total_value),
      km_at_fueling: Number(form.km_at_fueling),
      fueled_at: new Date(form.fueled_at).toISOString(),
    };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    delete payload.km_driven; delete payload.km_per_liter; delete payload.cost_per_km;
    delete payload.anomalies; delete payload.anomaly_severity;

    const op = record
      ? supabase.from("fuel_records").update(payload).eq("id", record.id)
      : supabase.from("fuel_records").insert(payload);
    const { error } = await op;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(record ? "Abastecimento atualizado" : "Abastecimento registrado");
    onOpenChange(false); onSaved();
  };

  const fileField = (label: string, field: string) => (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        {form[field] ? (
          <div className="flex-1 flex items-center gap-2 surface-card rounded-lg px-3 py-1.5 text-xs">
            <a href={form[field]} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex-1">arquivo</a>
            <button type="button" onClick={() => setForm((f: any) => ({ ...f, [field]: "" }))}><X className="h-3 w-3 text-muted-foreground" /></button>
          </div>
        ) : (
          <label className="flex-1 cursor-pointer">
            <div className="flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              {uploading === field ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Enviar
            </div>
            <input type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(field, f); }} />
          </label>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-2xl">{record ? "Editar abastecimento" : "Novo abastecimento"}</DialogTitle></DialogHeader>

        {!record && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold text-sm">Validação por IA</h3>
              <span className="text-xs text-muted-foreground">Foto da placa libera o abastecimento + foto do painel preenche o KM</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="cursor-pointer">
                <div className="flex items-center justify-center gap-2 border border-dashed border-primary/40 rounded-lg py-3 text-sm hover:border-primary hover:bg-primary/10 transition-colors">
                  {aiBusy === "plate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  <span>Foto da placa</span>
                </div>
                <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPlatePhoto(f); e.currentTarget.value = ""; }} />
              </label>
              <label className="cursor-pointer">
                <div className="flex items-center justify-center gap-2 border border-dashed border-primary/40 rounded-lg py-3 text-sm hover:border-primary hover:bg-primary/10 transition-colors">
                  {aiBusy === "odometer" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
                  <span>Foto do hodômetro (KM)</span>
                </div>
                <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onOdometerPhoto(f); e.currentTarget.value = ""; }} />
              </label>
            </div>
            {plateCheck && (
              <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${plateCheck.ok ? "bg-success/10 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
                {plateCheck.ok ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                <span className="font-mono font-bold">{plateCheck.plate}</span>
                <span>{plateCheck.ok ? "autorizada — abastecimento liberado" : "não cadastrada — abastecimento bloqueado"}</span>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Veículo *</Label>
            <Select value={form.vehicle_id} onValueChange={onVehicleChange}>
              <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="font-mono">{v.plate}</span> · {v.brand} {v.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Motorista</Label>
            <Select value={form.driver_id} onValueChange={(v) => setForm({ ...form, driver_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2"><Label>Data/hora *</Label>
            <Input type="datetime-local" value={form.fueled_at} onChange={(e) => setForm({ ...form, fueled_at: e.target.value })} />
          </div>

          <div className="space-y-2"><Label>Posto</Label><Input value={form.station_name} onChange={(e) => setForm({ ...form, station_name: e.target.value })} /></div>
          <div className="space-y-2"><Label>CNPJ posto</Label><Input value={form.station_cnpj} onChange={(e) => setForm({ ...form, station_cnpj: e.target.value })} /></div>
          <div className="space-y-2"><Label>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="space-y-2"><Label>UF</Label><Input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} /></div>

          <div className="space-y-2">
            <Label>Combustível *</Label>
            <Select value={form.fuel_type} onValueChange={(v) => setForm({ ...form, fuel_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FUELS.map((f) => <SelectItem key={f} value={f} className="capitalize">{f.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>KM no abastecimento *</Label>
            <Input type="number" value={form.km_at_fueling} onChange={(e) => setForm({ ...form, km_at_fueling: e.target.value })} />
          </div>
          <div className="space-y-2"><Label>Litros *</Label>
            <Input type="number" step="0.01" value={form.liters} onChange={(e) => setForm({ ...form, liters: e.target.value })} />
          </div>
          <div className="space-y-2"><Label>Valor / litro (R$) *</Label>
            <Input type="number" step="0.001" value={form.price_per_liter} onChange={(e) => setForm({ ...form, price_per_liter: e.target.value })} />
          </div>
          <div className="space-y-2"><Label>Valor total (R$)</Label>
            <Input type="number" step="0.01" value={form.total_value} onChange={(e) => setForm({ ...form, total_value: e.target.value })} className="font-mono" />
          </div>
          <div className="space-y-2 flex items-end gap-3 pb-2">
            <Switch checked={form.full_tank} onCheckedChange={(v) => setForm({ ...form, full_tank: v })} id="full" />
            <Label htmlFor="full" className="cursor-pointer">Tanque cheio</Label>
          </div>

          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENTS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Cartão / identificador</Label><Input value={form.card_number} onChange={(e) => setForm({ ...form, card_number: e.target.value })} /></div>

          <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
            {fileField("Nota fiscal", "invoice_url")}
            {fileField("Comprovante", "receipt_url")}
            {fileField("Foto painel KM", "dashboard_photo_url")}
            {fileField("Foto bomba", "pump_photo_url")}
          </div>

          <div className="space-y-2 sm:col-span-2"><Label>Observações</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
