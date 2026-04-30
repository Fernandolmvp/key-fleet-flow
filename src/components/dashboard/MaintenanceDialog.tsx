import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, Sparkles, Plus, Trash2, FileText } from "lucide-react";
import { MAINT_TYPES, MAINT_STATUS, MAINT_CATEGORIES } from "@/lib/maintenance";
import { extractDocument } from "@/lib/ai-extract";

interface Props { open: boolean; onOpenChange: (b: boolean) => void; record: any; onSaved: () => void; }

const blank = () => ({
  vehicle_id: "", driver_id: "",
  type: "preventiva", status: "concluida", category: "",
  service_at: new Date().toISOString().slice(0, 16),
  km_at_service: "",
  next_service_km: "", next_service_at: "",
  workshop_name: "", workshop_cnpj: "", city: "", state: "",
  description: "", notes: "",
  parts: [] as { name: string; qty?: number | null; unit_value?: number | null; total?: number | null }[],
  labor_value: "0", parts_value: "0", total_value: "0",
  invoice_url: "", attachments: [] as string[],
});

export default function MaintenanceDialog({ open, onOpenChange, record, onSaved }: Props) {
  const { currentCompanyId, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [form, setForm] = useState<any>(blank());

  useEffect(() => {
    if (!open || !currentCompanyId) return;
    (async () => {
      const [{ data: v }, { data: d }] = await Promise.all([
        supabase.from("vehicles").select("id,plate,brand,model,current_km").eq("company_id", currentCompanyId).eq("status", "ativo").order("plate"),
        supabase.from("drivers").select("id,full_name").eq("company_id", currentCompanyId).eq("status", "ativo").order("full_name"),
      ]);
      setVehicles(v ?? []); setDrivers(d ?? []);
    })();
    if (record) {
      setForm({
        ...blank(), ...record,
        service_at: record.service_at ? new Date(record.service_at).toISOString().slice(0, 16) : "",
        next_service_at: record.next_service_at ?? "",
        driver_id: record.driver_id ?? "",
        parts: record.parts ?? [],
        labor_value: String(record.labor_value ?? "0"),
        parts_value: String(record.parts_value ?? "0"),
        total_value: String(record.total_value ?? "0"),
      });
    } else setForm(blank());
  }, [open, record, currentCompanyId]);

  // total = labor + parts (recompute)
  useEffect(() => {
    const l = parseFloat(form.labor_value) || 0;
    const p = parseFloat(form.parts_value) || 0;
    setForm((f: any) => ({ ...f, total_value: (l + p).toFixed(2) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.labor_value, form.parts_value]);

  const onVehicleChange = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    setForm((f: any) => ({
      ...f, vehicle_id: id,
      km_at_service: v?.current_km ? String(v.current_km) : f.km_at_service,
    }));
  };

  const normalizePlate = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  const onInvoiceFile = async (file: File) => {
    if (!currentCompanyId) return;
    setAiBusy(true);
    try {
      const { data, archivedUrl } = await extractDocument({
        type: "maintenance_invoice",
        file,
        bucket: "maintenance-docs",
        companyId: currentCompanyId,
      });

      // Try to match plate to vehicle
      let vehicle_id = form.vehicle_id;
      if (!vehicle_id && data.plate) {
        const np = normalizePlate(String(data.plate));
        const match = vehicles.find((v) => normalizePlate(v.plate) === np);
        if (match) vehicle_id = match.id;
        else toast.warning(`Placa ${data.plate} da NF não está cadastrada na frota`);
      }

      const partsArr = Array.isArray(data.parts) ? data.parts : [];
      const labor = data.labor_value != null ? Number(data.labor_value) : 0;
      const parts_value = data.parts_value != null ? Number(data.parts_value)
        : partsArr.reduce((acc: number, p: any) => acc + (Number(p.total) || 0), 0);
      const total = data.total_value != null ? Number(data.total_value) : labor + parts_value;

      setForm((f: any) => ({
        ...f,
        vehicle_id,
        workshop_name: data.workshop_name ?? f.workshop_name,
        workshop_cnpj: data.workshop_cnpj ?? f.workshop_cnpj,
        city: data.city ?? f.city,
        state: data.state ?? f.state,
        service_at: data.service_at ? `${data.service_at}T12:00` : f.service_at,
        km_at_service: data.km_at_service != null ? String(data.km_at_service) : f.km_at_service,
        category: data.category ?? f.category,
        description: data.description ?? f.description,
        parts: partsArr,
        labor_value: String(labor || 0),
        parts_value: String(parts_value || 0),
        total_value: String(total || 0),
        invoice_url: archivedUrl ?? f.invoice_url,
        attachments: archivedUrl ? [...(f.attachments ?? []), archivedUrl] : f.attachments,
      }));
      toast.success("Nota fiscal lida pela IA");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler NF");
    } finally {
      setAiBusy(false);
    }
  };

  const addPart = () => setForm((f: any) => ({ ...f, parts: [...f.parts, { name: "", qty: 1, unit_value: 0, total: 0 }] }));
  const updatePart = (i: number, key: string, val: any) => {
    setForm((f: any) => {
      const parts = [...f.parts];
      parts[i] = { ...parts[i], [key]: val };
      if (key === "qty" || key === "unit_value") {
        const q = Number(parts[i].qty) || 0;
        const u = Number(parts[i].unit_value) || 0;
        parts[i].total = +(q * u).toFixed(2);
      }
      const partsTotal = parts.reduce((a, p) => a + (Number(p.total) || 0), 0);
      return { ...f, parts, parts_value: partsTotal.toFixed(2) };
    });
  };
  const removePart = (i: number) => {
    setForm((f: any) => {
      const parts = f.parts.filter((_: any, idx: number) => idx !== i);
      const partsTotal = parts.reduce((a: number, p: any) => a + (Number(p.total) || 0), 0);
      return { ...f, parts, parts_value: partsTotal.toFixed(2) };
    });
  };

  const submit = async () => {
    if (!currentCompanyId) return toast.error("Selecione uma empresa");
    if (!form.vehicle_id) return toast.error("Selecione o veículo");
    if (!form.type) return toast.error("Tipo obrigatório");

    setBusy(true);
    const payload: any = {
      company_id: currentCompanyId,
      vehicle_id: form.vehicle_id,
      driver_id: form.driver_id || null,
      type: form.type,
      status: form.status,
      category: form.category || null,
      service_at: new Date(form.service_at).toISOString(),
      km_at_service: form.km_at_service ? Number(form.km_at_service) : null,
      next_service_km: form.next_service_km ? Number(form.next_service_km) : null,
      next_service_at: form.next_service_at || null,
      workshop_name: form.workshop_name || null,
      workshop_cnpj: form.workshop_cnpj || null,
      city: form.city || null,
      state: form.state || null,
      description: form.description || null,
      notes: form.notes || null,
      parts: form.parts ?? [],
      labor_value: Number(form.labor_value) || 0,
      parts_value: Number(form.parts_value) || 0,
      total_value: Number(form.total_value) || 0,
      invoice_url: form.invoice_url || null,
      attachments: form.attachments ?? [],
      created_by: user?.id ?? null,
    };

    const op = record?.id
      ? supabase.from("maintenance_records").update(payload).eq("id", record.id)
      : supabase.from("maintenance_records").insert(payload);
    const { error } = await op;
    setBusy(false);
    if (error) return toast.error(error.message);

    // If next service scheduled and not editing existing schedule, create one
    if (!record?.id && (payload.next_service_km || payload.next_service_at)) {
      await supabase.from("maintenance_schedules").insert({
        company_id: currentCompanyId,
        vehicle_id: payload.vehicle_id,
        type: payload.type,
        category: payload.category ?? "Manutenção",
        description: payload.description,
        target_km: payload.next_service_km,
        target_date: payload.next_service_at,
        status: "pendente",
        created_by: user?.id ?? null,
      });
    }

    // Vehicle KM update
    if (payload.km_at_service) {
      await supabase.from("vehicles").update({ current_km: payload.km_at_service }).eq("id", payload.vehicle_id);
    }

    toast.success(record?.id ? "Manutenção atualizada" : "Manutenção registrada");
    onSaved(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {record?.id ? "Editar manutenção" : "Nova manutenção"}
          </DialogTitle>
        </DialogHeader>

        {/* IA upload */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" /> Preencher por NF/Orçamento (IA)
          </div>
          <p className="text-xs text-muted-foreground">
            Envie a foto ou PDF da nota fiscal/ordem de serviço da oficina. A IA preenche oficina, valores, peças e datas automaticamente.
          </p>
          <label className="inline-flex">
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={aiBusy}
              onChange={(e) => e.target.files?.[0] && onInvoiceFile(e.target.files[0])}
            />
            <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-primary/40 hover:bg-primary/10 cursor-pointer ${aiBusy ? "opacity-50 pointer-events-none" : ""}`}>
              {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {aiBusy ? "Lendo documento..." : "Enviar NF / Orçamento"}
            </span>
          </label>
          {form.invoice_url && (
            <a href={form.invoice_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <FileText className="h-3 w-3" /> Documento arquivado
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Veículo *</Label>
            <Select value={form.vehicle_id} onValueChange={onVehicleChange}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Motorista</Label>
            <Select value={form.driver_id} onValueChange={(v) => setForm((f: any) => ({ ...f, driver_id: v }))}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tipo *</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f: any) => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MAINT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f: any) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MAINT_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={(v) => setForm((f: any) => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>{MAINT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data do serviço</Label>
            <Input type="datetime-local" value={form.service_at} onChange={(e) => setForm((f: any) => ({ ...f, service_at: e.target.value }))} />
          </div>

          <div>
            <Label>KM no serviço</Label>
            <Input type="number" value={form.km_at_service} onChange={(e) => setForm((f: any) => ({ ...f, km_at_service: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Próx. KM</Label>
              <Input type="number" value={form.next_service_km} onChange={(e) => setForm((f: any) => ({ ...f, next_service_km: e.target.value }))} />
            </div>
            <div>
              <Label>Próx. data</Label>
              <Input type="date" value={form.next_service_at} onChange={(e) => setForm((f: any) => ({ ...f, next_service_at: e.target.value }))} />
            </div>
          </div>

          <div className="md:col-span-2">
            <Label>Descrição do serviço</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} />
          </div>

          <div>
            <Label>Oficina</Label>
            <Input value={form.workshop_name} onChange={(e) => setForm((f: any) => ({ ...f, workshop_name: e.target.value }))} />
          </div>
          <div>
            <Label>CNPJ oficina</Label>
            <Input value={form.workshop_cnpj} onChange={(e) => setForm((f: any) => ({ ...f, workshop_cnpj: e.target.value }))} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={form.city} onChange={(e) => setForm((f: any) => ({ ...f, city: e.target.value }))} />
          </div>
          <div>
            <Label>UF</Label>
            <Input maxLength={2} value={form.state} onChange={(e) => setForm((f: any) => ({ ...f, state: e.target.value.toUpperCase() }))} />
          </div>
        </div>

        {/* Itens / peças */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Peças e serviços</Label>
            <Button type="button" size="sm" variant="ghost" onClick={addPart}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
            </Button>
          </div>
          {form.parts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum item adicionado.</p>
          ) : (
            <div className="space-y-2">
              {form.parts.map((p: any, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6">
                    {i === 0 && <Label className="text-xs">Item</Label>}
                    <Input value={p.name ?? ""} onChange={(e) => updatePart(i, "name", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <Label className="text-xs">Qtd</Label>}
                    <Input type="number" step="0.01" value={p.qty ?? ""} onChange={(e) => updatePart(i, "qty", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <Label className="text-xs">Unit.</Label>}
                    <Input type="number" step="0.01" value={p.unit_value ?? ""} onChange={(e) => updatePart(i, "unit_value", e.target.value)} />
                  </div>
                  <div className="col-span-1">
                    {i === 0 && <Label className="text-xs">Total</Label>}
                    <Input readOnly value={Number(p.total ?? 0).toFixed(2)} />
                  </div>
                  <div className="col-span-1">
                    <Button type="button" size="icon" variant="ghost" onClick={() => removePart(i)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Mão de obra (R$)</Label>
            <Input type="number" step="0.01" value={form.labor_value} onChange={(e) => setForm((f: any) => ({ ...f, labor_value: e.target.value }))} />
          </div>
          <div>
            <Label>Peças (R$)</Label>
            <Input type="number" step="0.01" value={form.parts_value} onChange={(e) => setForm((f: any) => ({ ...f, parts_value: e.target.value }))} />
          </div>
          <div>
            <Label>Total (R$)</Label>
            <Input readOnly value={form.total_value} className="font-mono font-semibold text-primary" />
          </div>
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {record?.id ? "Salvar alterações" : "Registrar manutenção"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}