import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ADVANCE_PAYMENT_METHODS, formatBRL } from "@/lib/trips";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdvanceDialog({
  open, onOpenChange, trip, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; trip: any; onSaved: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [genPdf, setGenPdf] = useState(false);
  const [f, setF] = useState({
    amount: "",
    payment_method_used: "dinheiro",
    notes: "",
  });

  const save = async () => {
    const amt = Number(f.amount);
    if (!amt || amt <= 0) return toast.error("Informe um valor válido");
    setBusy(true);
    const { data, error } = await supabase.from("trip_advances").insert({
      company_id: trip.company_id,
      trip_id: trip.id,
      driver_id: trip.driver_id,
      amount: amt,
      payment_method_used: f.payment_method_used,
      notes: f.notes || null,
      created_by: user?.id ?? null,
      status: "aguardando_confirmacao",
    }).select().single();
    if (error) { setBusy(false); return toast.error(error.message); }

    if (genPdf && data) {
      try {
        const { data: pdf, error: pErr } = await supabase.functions.invoke("generate-advance-receipt", {
          body: { advance_id: data.id },
        });
        if (pErr) toast.warning("Adiantamento criado, mas não gerou PDF: " + pErr.message);
        else if (pdf?.url) toast.success("Recibo gerado!");
      } catch (e: any) {
        toast.warning("Adiantamento criado, mas não gerou PDF: " + e.message);
      }
    }
    setBusy(false);
    toast.success(`Adiantamento de ${formatBRL(amt)} liberado`);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liberar adiantamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Valor (R$) *</Label>
            <Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0,00" />
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={f.payment_method_used} onValueChange={(v) => setF({ ...f, payment_method_used: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ADVANCE_PAYMENT_METHODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={genPdf} onChange={(e) => setGenPdf(e.target.checked)} />
            <FileText className="h-4 w-4" /> Gerar recibo em PDF
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Liberar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}