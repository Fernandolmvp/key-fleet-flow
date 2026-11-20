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
import { Loader2, Sparkles } from "lucide-react";
import { TIRE_KIND } from "@/lib/tires";
import { buildBatchTires } from "@/lib/tire-ops";
import { parseTread } from "@/lib/tread-measurement";
import { extractDocument } from "@/lib/ai-extract";

interface Props { open: boolean; onOpenChange: (b: boolean) => void; onSaved: () => void; }
const blank = { qty: "4", brand: "", model: "", size: "", kind: "novo", tread: "", price: "", supplier: "", dot: "", serials: "", invoice_number: "", invoice_url: "", purchase_date: "" };

export default function TireBatchDialog({ open, onOpenChange, onSaved }: Props) {
  const { currentCompanyId, user } = useAuth();
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  useEffect(() => { if (open) setF(blank); }, [open]);
  const set = (k: keyof typeof blank) => (e: any) => setF({ ...f, [k]: e.target.value });

  const onInvoice = async (file: File) => {
    if (!currentCompanyId) return;
    setAiBusy(true);
    try {
      const { data, archivedUrl } = await extractDocument({ type: "tire_invoice", file, bucket: "tire-docs", companyId: currentCompanyId });
      const items: any[] = data.items ?? [];
      const it = items[0] ?? {};
      const qty = items.reduce((s, i) => s + (Number(i.quantity) || 1), 0) || 1;
      setF((p) => ({
        ...p, qty: String(qty), brand: it.brand ?? p.brand, model: it.model ?? p.model, size: it.size ?? p.size,
        dot: it.dot ?? p.dot, kind: data.kind ?? p.kind, price: it.unit_price != null ? String(it.unit_price) : p.price,
        supplier: data.supplier ?? p.supplier, invoice_number: data.invoice_number ?? p.invoice_number,
        invoice_url: archivedUrl ?? p.invoice_url, purchase_date: data.purchase_date ?? p.purchase_date,
        serials: items.map((i) => i.serial).filter(Boolean).join("\n") || p.serials,
      }));
      toast.success("NF lida pela IA — confira os dados");
    } catch (e: any) { toast.error(e?.message ?? "Falha ao ler NF"); } finally { setAiBusy(false); }
  };

  const save = async () => {
    if (!currentCompanyId) return;
    const qty = Number(f.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 200) return toast.error("Quantidade entre 1 e 200");
    if (!f.brand.trim() || !f.size.trim()) return toast.error("Informe marca e medida");
    const tread = f.tread.trim() ? parseTread(f.tread) : null;
    if (f.tread.trim() && tread == null) return toast.error("Sulco inválido");
    const price = f.price.trim() ? Number(f.price.replace(",", ".")) : null;
    if (price != null && !Number.isFinite(price)) return toast.error("Preço inválido");
    setBusy(true);
    const rows = buildBatchTires(currentCompanyId, qty, { ...f, tread_mm: tread, price }, f.serials, user?.id);
    const { error } = await supabase.from("tires").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${qty} pneu(s) adicionados ao estoque`);
    onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Cadastro em lote</DialogTitle></DialogHeader>
        <label className="inline-flex items-center gap-2 text-sm text-primary cursor-pointer">
          {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Preencher pela NF (IA)
          <input type="file" accept="image/*,application/pdf" className="hidden" disabled={aiBusy} onChange={(e) => e.target.files?.[0] && onInvoice(e.target.files[0])} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Quantidade</Label><Input inputMode="numeric" value={f.qty} onChange={set("qty")} /></div>
          <div><Label>Tipo</Label>
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIRE_KIND.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Marca</Label><Input value={f.brand} onChange={set("brand")} placeholder="Pirelli" /></div>
          <div><Label>Medida</Label><Input value={f.size} onChange={set("size")} placeholder="295/80 R22.5" /></div>
          <div><Label>Modelo</Label><Input value={f.model} onChange={set("model")} /></div>
          <div><Label>DOT</Label><Input value={f.dot} onChange={set("dot")} /></div>
          <div><Label>Sulco (mm)</Label><Input inputMode="decimal" value={f.tread} onChange={set("tread")} /></div>
          <div><Label>Preço unitário</Label><Input inputMode="decimal" value={f.price} onChange={set("price")} /></div>
          <div className="col-span-2"><Label>Fornecedor</Label><Input value={f.supplier} onChange={set("supplier")} /></div>
          <div className="col-span-2"><Label>Seriais (opcional, um por linha)</Label><Textarea rows={3} value={f.serials} onChange={set("serials")} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Adicionar ao estoque</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
