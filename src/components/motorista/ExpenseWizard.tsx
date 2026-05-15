import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, formatBRL } from "@/lib/trips";
import { Camera, ChevronLeft, ChevronRight, Loader2, Check, MapPin } from "lucide-react";
import { toast } from "sonner";

export default function ExpenseWizard({
  open, onOpenChange, trip, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; trip: any; onSaved: () => void }) {
  const { user, currentCompanyId } = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [hasInvoice, setHasInvoice] = useState<boolean | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplier, setSupplier] = useState("");
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [description, setDescription] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const reset = () => {
    setStep(0); setPhoto(null); setPhotoPreview(""); setHasInvoice(null);
    setInvoiceNumber(""); setSupplier(""); setCategory(""); setAmount("");
    setPaymentMethod(""); setDescription(""); setCoords(null);
  };

  const next = () => {
    if (step === 0 && !photo) return toast.error("Foto do comprovante é obrigatória");
    if (step === 1 && hasInvoice === null) return toast.error("Selecione uma opção");
    if (step === 2 && !category) return toast.error("Selecione a categoria");
    if (step === 3 && (!amount || Number(amount) <= 0)) return toast.error("Informe o valor");
    if (step === 4 && !paymentMethod) return toast.error("Selecione a forma de pagamento");
    if (step === 4) {
      navigator.geolocation?.getCurrentPosition(
        (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {},
        { timeout: 3000 }
      );
    }
    setStep((s) => s + 1);
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    if (!photo || !user || !currentCompanyId) return;
    setBusy(true);
    try {
      const ext = photo.name.split(".").pop() || "jpg";
      const path = `${trip.company_id}/${trip.id}/${Date.now()}-receipt.${ext}`;
      const { error: upErr } = await supabase.storage.from("trip-receipts").upload(path, photo);
      if (upErr) throw upErr;

      let invoicePath: string | null = null;
      if (hasInvoice) invoicePath = path; // reuse same upload as invoice proof

      const { error } = await supabase.from("trip_expenses").insert({
        company_id: trip.company_id,
        trip_id: trip.id,
        driver_id: trip.driver_id,
        expense_category: category,
        expense_date: new Date().toISOString().slice(0, 10),
        amount: Number(amount),
        payment_method: paymentMethod,
        has_invoice: !!hasInvoice,
        invoice_number: invoiceNumber || null,
        supplier_name: supplier || null,
        invoice_url: invoicePath,
        receipt_url: path,
        description: description || null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Despesa registrada!");
      reset();
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova despesa · Passo {step + 1}/6</DialogTitle>
        </DialogHeader>
        <div className="min-h-[280px]">
          {step === 0 && (
            <div className="space-y-3">
              <Label>Foto do comprovante *</Label>
              <label className="block surface-card rounded-lg p-6 text-center cursor-pointer hover:border-primary/50">
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
                {photoPreview ? (
                  <img src={photoPreview} alt="comprovante" className="max-h-48 mx-auto rounded" />
                ) : (
                  <div className="text-muted-foreground">
                    <Camera className="h-10 w-10 mx-auto mb-2" />
                    Tocar para tirar foto
                  </div>
                )}
              </label>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-3">
              <Label>Tem nota fiscal?</Label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setHasInvoice(true)} className={`surface-card rounded-lg p-6 text-center ${hasInvoice === true ? "border-primary" : ""}`}>📄<div className="mt-2 text-sm">Sim, tem NF</div></button>
                <button onClick={() => setHasInvoice(false)} className={`surface-card rounded-lg p-6 text-center ${hasInvoice === false ? "border-primary" : ""}`}>🧾<div className="mt-2 text-sm">Só recibo</div></button>
              </div>
              {hasInvoice && (
                <div className="space-y-2">
                  <Input placeholder="Número da NF (opcional)" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                  <Input placeholder="Fornecedor (opcional)" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              <Label>Categoria</Label>
              <div className="grid grid-cols-3 gap-2">
                {EXPENSE_CATEGORIES.map((c) => (
                  <button key={c.value} onClick={() => setCategory(c.value)} className={`surface-card rounded-lg p-3 text-center ${category === c.value ? "border-primary" : ""}`}>
                    <div className="text-2xl">{c.icon}</div>
                    <div className="text-[10px] mt-1">{c.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-2xl h-14 font-mono" placeholder="0,00" autoFocus />
              <Textarea placeholder="Observação (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
          )}
          {step === 4 && (
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <div className="space-y-2">
                {PAYMENT_METHODS.map((p) => (
                  <button key={p.value} onClick={() => setPaymentMethod(p.value)} className={`surface-card rounded-lg p-3 text-left w-full text-sm ${paymentMethod === p.value ? "border-primary" : ""}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 5 && (
            <div className="space-y-3">
              <div className="surface-card rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Categoria</span><span>{EXPENSE_CATEGORIES.find((c) => c.value === category)?.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-mono font-semibold">{formatBRL(Number(amount))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Pagamento</span><span>{PAYMENT_METHODS.find((p) => p.value === paymentMethod)?.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">NF</span><span>{hasInvoice ? "Sim" : "Não"}</span></div>
                {coords && <div className="flex justify-between text-xs text-success"><span><MapPin className="inline h-3 w-3" /> GPS</span><span>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span></div>}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-between pt-3 border-t border-border">
          <Button variant="ghost" onClick={() => step === 0 ? onOpenChange(false) : setStep((s) => s - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> {step === 0 ? "Cancelar" : "Voltar"}
          </Button>
          {step < 5 ? (
            <Button onClick={next}>Próximo <ChevronRight className="h-4 w-4 ml-1" /></Button>
          ) : (
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} Confirmar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}