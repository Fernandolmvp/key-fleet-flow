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
import { Loader2, Upload, Sparkles, FileText } from "lucide-react";
import { TIRE_KIND, TIRE_STATUS } from "@/lib/tires";
import { extractDocument } from "@/lib/ai-extract";

interface Props { open: boolean; onOpenChange: (b: boolean) => void; tire: any; onSaved: () => void; }

const blank = () => ({
  serial: "", brand: "", model: "", size: "", dot: "",
  kind: "novo", status: "estoque",
  initial_tread_mm: "", current_tread_mm: "", min_tread_mm: "1.6",
  km_target: "60000", purchase_price: "", purchase_date: "",
  supplier: "", invoice_number: "", invoice_url: "", notes: "",
});

export default function TireDialog({ open, onOpenChange, tire, onSaved }: Props) {
  const { currentCompanyId, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [form, setForm] = useState<any>(blank());

  useEffect(() => {
    if (!open) return;
    if (tire) {
      setForm({
        ...blank(), ...tire,
        purchase_date: tire.purchase_date ?? "",
        initial_tread_mm: tire.initial_tread_mm != null ? String(tire.initial_tread_mm) : "",
        current_tread_mm: tire.current_tread_mm != null ? String(tire.current_tread_mm) : "",
        min_tread_mm: tire.min_tread_mm != null ? String(tire.min_tread_mm) : "1.6",
        km_target: tire.km_target != null ? String(tire.km_target) : "60000",
        purchase_price: tire.purchase_price != null ? String(tire.purchase_price) : "",
      });
    } else setForm(blank());
  }, [open, tire]);

  const onInvoiceFile = async (file: File) => {
    if (!currentCompanyId) return;
    setAiBusy(true);
    try {
      const { data, archivedUrl } = await extractDocument({
        type: "tire_invoice", file, bucket: "tire-docs", companyId: currentCompanyId,
      });
      // Pega o primeiro item para preencher; outros podem virar lote (nesse dialog 1 pneu por vez).
      const item = (data.items ?? [])[0] ?? {};
      setForm((f: any) => ({
        ...f,
        brand: item.brand ?? f.brand,
        model: item.model ?? f.model,
        size: item.size ?? f.size,
        dot: item.dot ?? f.dot,
        serial: item.serial ?? f.serial,
        kind: data.kind ?? f.kind,
        purchase_price: item.unit_price != null ? String(item.unit_price) : f.purchase_price,
        purchase_date: data.purchase_date ?? f.purchase_date,
        supplier: data.supplier ?? f.supplier,
        invoice_number: data.invoice_number ?? f.invoice_number,
        invoice_url: archivedUrl ?? f.invoice_url,
      }));
      const extras = (data.items ?? []).length - 1;
      toast.success(extras > 0
        ? `NF lida. ${extras} pneu(s) adicional(is) detectado(s) — cadastre individualmente.`
        : "NF lida pela IA");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler NF");
    } finally { setAiBusy(false); }
  };

  const submit = async () => {
    if (!currentCompanyId) return toast.error("Selecione uma empresa");
    if (!form.brand || !form.size) return toast.error("Marca e medida são obrigatórias");

    setBusy(true);
    const payload: any = {
      company_id: currentCompanyId,
      serial: form.serial || null,
      brand: form.brand, model: form.model || null, size: form.size, dot: form.dot || null,
      kind: form.kind, status: form.status,
      initial_tread_mm: form.initial_tread_mm ? Number(form.initial_tread_mm) : null,
      current_tread_mm: form.current_tread_mm ? Number(form.current_tread_mm) : (form.initial_tread_mm ? Number(form.initial_tread_mm) : null),
      min_tread_mm: form.min_tread_mm ? Number(form.min_tread_mm) : 1.6,
      km_target: form.km_target ? Number(form.km_target) : 60000,
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      purchase_date: form.purchase_date || null,
      supplier: form.supplier || null,
      invoice_number: form.invoice_number || null,
      invoice_url: form.invoice_url || null,
      notes: form.notes || null,
      created_by: user?.id ?? null,
    };

    const op = tire?.id
      ? supabase.from("tires").update(payload).eq("id", tire.id)
      : supabase.from("tires").insert(payload);
    const { error } = await op;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(tire?.id ? "Pneu atualizado" : "Pneu cadastrado");
    onSaved(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">{tire?.id ? "Editar pneu" : "Novo pneu"}</DialogTitle></DialogHeader>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" /> Preencher por NF (IA)
          </div>
          <p className="text-xs text-muted-foreground">
            Envie a NF de compra ou recapagem. A IA extrai marca, modelo, medida, DOT, valor e fornecedor.
          </p>
          <label className="inline-flex">
            <input type="file" accept="image/*,application/pdf" className="hidden" disabled={aiBusy}
              onChange={(e) => e.target.files?.[0] && onInvoiceFile(e.target.files[0])} />
            <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-primary/40 hover:bg-primary/10 cursor-pointer ${aiBusy ? "opacity-50 pointer-events-none" : ""}`}>
              {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {aiBusy ? "Lendo documento..." : "Enviar NF de pneus"}
            </span>
          </label>
          {form.invoice_url && (
            <a href={form.invoice_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <FileText className="h-3 w-3" /> Documento arquivado
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Marca *</Label><Input value={form.brand} onChange={(e) => setForm((f: any) => ({ ...f, brand: e.target.value }))} /></div>
          <div><Label>Modelo</Label><Input value={form.model} onChange={(e) => setForm((f: any) => ({ ...f, model: e.target.value }))} /></div>
          <div><Label>Medida *</Label><Input placeholder="295/80 R22.5" value={form.size} onChange={(e) => setForm((f: any) => ({ ...f, size: e.target.value }))} /></div>

          <div><Label>DOT</Label><Input value={form.dot} onChange={(e) => setForm((f: any) => ({ ...f, dot: e.target.value }))} /></div>
          <div><Label>Serial / etiqueta interna</Label><Input value={form.serial} onChange={(e) => setForm((f: any) => ({ ...f, serial: e.target.value }))} /></div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.kind} onValueChange={(v) => setForm((f: any) => ({ ...f, kind: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIRE_KIND.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f: any) => ({ ...f, status: v }))} disabled={!!tire?.id}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIRE_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
            {tire?.id && <p className="text-[10px] text-muted-foreground mt-1">Status muda via movimentações</p>}
          </div>
          <div><Label>Sulco inicial (mm)</Label><Input type="number" step="0.1" value={form.initial_tread_mm} onChange={(e) => setForm((f: any) => ({ ...f, initial_tread_mm: e.target.value }))} /></div>
          <div><Label>Sulco atual (mm)</Label><Input type="number" step="0.1" value={form.current_tread_mm} onChange={(e) => setForm((f: any) => ({ ...f, current_tread_mm: e.target.value }))} /></div>

          <div><Label>Sulco mínimo (mm)</Label><Input type="number" step="0.1" value={form.min_tread_mm} onChange={(e) => setForm((f: any) => ({ ...f, min_tread_mm: e.target.value }))} /></div>
          <div><Label>KM alvo (vida útil)</Label><Input type="number" value={form.km_target} onChange={(e) => setForm((f: any) => ({ ...f, km_target: e.target.value }))} /></div>
          <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm((f: any) => ({ ...f, purchase_price: e.target.value }))} /></div>

          <div><Label>Data compra</Label><Input type="date" value={form.purchase_date} onChange={(e) => setForm((f: any) => ({ ...f, purchase_date: e.target.value }))} /></div>
          <div><Label>Fornecedor</Label><Input value={form.supplier} onChange={(e) => setForm((f: any) => ({ ...f, supplier: e.target.value }))} /></div>
          <div><Label>Nº NF</Label><Input value={form.invoice_number} onChange={(e) => setForm((f: any) => ({ ...f, invoice_number: e.target.value }))} /></div>

          <div className="md:col-span-3">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy} className="bg-gradient-primary text-primary-foreground">
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}