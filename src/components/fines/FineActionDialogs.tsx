import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { FINE_PAYMENT_METHODS, type TrafficFine } from "@/lib/fines";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = r.result as string; const i = s.indexOf(","); resolve(i >= 0 ? s.slice(i+1) : s); };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
async function uploadAttachment(companyId: string, file: File): Promise<string | null> {
  const path = `${companyId}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from("fines-attachments").upload(path, file, { contentType: file.type, upsert: false });
  if (error) { console.warn(error); return null; }
  const { data } = await supabase.storage.from("fines-attachments").createSignedUrl(path, 60*60*24*30);
  return data?.signedUrl ?? null;
}

/* ========== Converter Aviso → Multa ========== */
export function ConvertAvisoDialog({ open, onClose, fine, onSaved }: { open: boolean; onClose: () => void; fine: TrafficFine; onSaved: () => void; }) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracted, setExtracted] = useState<any | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    notification_number: "", notification_received_date: "",
    amount: "", discount_amount: "", license_points: fine.license_points || 0,
    due_date: "", recourse_deadline: "", driver_indication_deadline: "",
  });

  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("extract-traffic-fine", {
        body: { fileBase64: base64, mimeType: file.type || "image/jpeg" },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const ai = data.data;
      setExtracted(ai);
      setForm((f: any) => ({
        ...f,
        notification_number: ai.numero_ait ?? f.notification_number,
        amount: ai.valor ?? f.amount,
        discount_amount: ai.valor_desconto ?? f.discount_amount,
        license_points: ai.pontos_cnh ?? f.license_points,
        due_date: ai.data_vencimento ?? f.due_date,
        recourse_deadline: ai.prazo_recurso ?? f.recourse_deadline,
        driver_indication_deadline: ai.prazo_indicacao ?? f.driver_indication_deadline,
      }));
      const url = await uploadAttachment(fine.company_id, file);
      setPhotoUrl(url);
    } catch (e: any) {
      toast({ title: "IA falhou", description: e.message, variant: "destructive" });
    } finally { setAnalyzing(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      let url = photoUrl;
      if (file && !url) url = await uploadAttachment(fine.company_id, file);
      const { error } = await supabase.from("traffic_fines").update({
        record_type: "multa", status: "multa_autuada",
        notification_number: form.notification_number || null,
        notification_received_date: form.notification_received_date || new Date().toISOString().slice(0,10),
        amount: form.amount === "" ? null : Number(form.amount),
        discount_amount: form.discount_amount === "" ? null : Number(form.discount_amount),
        license_points: Number(form.license_points || 0),
        due_date: form.due_date || null,
        recourse_deadline: form.recourse_deadline || null,
        driver_indication_deadline: form.driver_indication_deadline || null,
        notification_photo_url: url ?? fine.notification_photo_url,
        ai_extracted: extracted ? { ...(fine.ai_extracted ?? {}), notificacao: extracted } : fine.ai_extracted,
        updated_by: user?.id ?? null,
      }).eq("id", fine.id);
      if (error) throw error;
      toast({ title: "Aviso convertido em multa" });
      onSaved(); onClose();
    } catch (e: any) {
      toast({ title: "Erro ao converter", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Converter Aviso em Multa</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Foto da notificação oficial</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <Button size="sm" variant="outline" className="mt-2 gap-2" onClick={analyze} disabled={!file || analyzing}>
              {analyzing ? <><Loader2 className="h-3 w-3 animate-spin" /> IA analisando…</> : <><Sparkles className="h-3 w-3" /> Extrair com IA</>}
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Nº AIT</Label><Input value={form.notification_number} onChange={e => setForm({...form, notification_number: e.target.value})} /></div>
            <div><Label>Recebido em</Label><Input type="date" value={form.notification_received_date} onChange={e => setForm({...form, notification_received_date: e.target.value})} /></div>
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} /></div>
            <div><Label>Valor c/ desconto</Label><Input type="number" step="0.01" value={form.discount_amount} onChange={e => setForm({...form, discount_amount: e.target.value})} /></div>
            <div><Label>Pontos CNH</Label><Input type="number" value={form.license_points} onChange={e => setForm({...form, license_points: e.target.value})} /></div>
            <div><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} /></div>
            <div><Label>Prazo recurso</Label><Input type="date" value={form.recourse_deadline} onChange={e => setForm({...form, recourse_deadline: e.target.value})} /></div>
            <div><Label>Prazo indicação</Label><Input type="date" value={form.driver_indication_deadline} onChange={e => setForm({...form, driver_indication_deadline: e.target.value})} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Converter em Multa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ========== Indicar Motorista ========== */
export function IndicateDriverDialog({ open, onClose, fine, companyId, onSaved }: { open: boolean; onClose: () => void; fine: TrafficFine; companyId: string; onSaved: () => void; }) {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driverId, setDriverId] = useState(fine.driver_id ?? "");
  const [method, setMethod] = useState<"manual" | "app_motorista">("manual");
  const [saving, setSaving] = useState(false);

  if (open && drivers.length === 0) {
    supabase.from("drivers").select("id,full_name,license_number,license_expires_at").eq("company_id", companyId).order("full_name").then(({data}) => setDrivers(data ?? []));
  }

  const save = async () => {
    if (!driverId) { toast({ title: "Selecione um motorista", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("traffic_fines").update({
        driver_id: driverId,
        driver_indicated_at: new Date().toISOString().slice(0,10),
        driver_indication_method: method,
        status: "motorista_indicado",
        updated_by: user?.id ?? null,
      }).eq("id", fine.id);
      if (error) throw error;
      toast({ title: "Motorista indicado" });
      if (method === "app_motorista") toast({ title: "Notificação no app do motorista será enviada (em breve)" });
      onSaved(); onClose();
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Indicar motorista</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Motorista</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}{d.license_number ? ` — CNH ${d.license_number}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Método de indicação</Label>
            <RadioGroup value={method} onValueChange={(v: any) => setMethod(v)} className="mt-2 space-y-2">
              <div className="flex items-center gap-2"><RadioGroupItem value="manual" id="m1" /><Label htmlFor="m1" className="font-normal">Indicação manual (gestor preencheu papel)</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="app_motorista" id="m2" /><Label htmlFor="m2" className="font-normal">Solicitar confirmação do motorista no app</Label></div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Indicar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ========== Recurso ========== */
export function RecourseDialog({ open, onClose, fine, mode, onSaved }: { open: boolean; onClose: () => void; fine: TrafficFine; mode: "open" | "result"; onSaved: () => void; }) {
  const { user } = useAuth();
  const [defenseType, setDefenseType] = useState("defesa_previa");
  const [argumentText, setArgumentText] = useState("");
  const [filedAt, setFiledAt] = useState(new Date().toISOString().slice(0,10));
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<"deferido" | "indeferido">("deferido");
  const [resultDate, setResultDate] = useState(new Date().toISOString().slice(0,10));
  const [resultNotes, setResultNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      let payload: any = { updated_by: user?.id ?? null };
      if (mode === "open") {
        let url: string | null = null;
        if (file) url = await uploadAttachment(fine.company_id, file);
        payload = {
          ...payload,
          recourse_filed_at: filedAt,
          recourse_notes: `[${defenseType}] ${argumentText}`,
          recourse_document_url: url,
          status: "em_recurso",
        };
      } else {
        payload = {
          ...payload,
          recourse_result: result,
          recourse_result_date: resultDate,
          recourse_notes: (fine.recourse_notes ?? "") + `\n[Resultado] ${resultNotes}`,
          status: result === "deferido" ? "recurso_deferido" : "recurso_indeferido",
        };
      }
      const { error } = await supabase.from("traffic_fines").update(payload).eq("id", fine.id);
      if (error) throw error;
      toast({ title: "Recurso atualizado" });
      onSaved(); onClose();
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{mode === "open" ? "Entrar com recurso" : "Atualizar resultado do recurso"}</DialogTitle></DialogHeader>
        {mode === "open" ? (
          <div className="space-y-3">
            <div>
              <Label>Tipo de defesa</Label>
              <Select value={defenseType} onValueChange={setDefenseType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="defesa_previa">Defesa prévia</SelectItem>
                  <SelectItem value="recurso_jari">Recurso JARI</SelectItem>
                  <SelectItem value="recurso_cetran">Recurso CETRAN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Argumentos</Label><Textarea rows={5} value={argumentText} onChange={e => setArgumentText(e.target.value)} /></div>
            <div><Label>Data do protocolo</Label><Input type="date" value={filedAt} onChange={e => setFiledAt(e.target.value)} /></div>
            <div><Label>Documento (opcional)</Label><Input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Resultado</Label>
              <RadioGroup value={result} onValueChange={(v:any) => setResult(v)} className="mt-2 space-y-2">
                <div className="flex items-center gap-2"><RadioGroupItem value="deferido" id="r1" /><Label htmlFor="r1" className="font-normal text-success">✓ Deferido (recurso aceito — multa cancelada)</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="indeferido" id="r2" /><Label htmlFor="r2" className="font-normal text-destructive">✗ Indeferido (multa mantida)</Label></div>
              </RadioGroup>
            </div>
            <div><Label>Data do resultado</Label><Input type="date" value={resultDate} onChange={e => setResultDate(e.target.value)} /></div>
            <div><Label>Observações</Label><Textarea rows={3} value={resultNotes} onChange={e => setResultNotes(e.target.value)} /></div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ========== Pagamento ========== */
export function PaymentDialog({ open, onClose, fine, onSaved }: { open: boolean; onClose: () => void; fine: TrafficFine; onSaved: () => void; }) {
  const { user } = useAuth();
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0,10));
  const [paidAmount, setPaidAmount] = useState<string>(String(fine.discount_amount ?? fine.amount ?? ""));
  const [method, setMethod] = useState("pix");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      let url: string | null = null;
      if (file) url = await uploadAttachment(fine.company_id, file);
      const amountNum = Number(paidAmount);
      const status = (fine.discount_amount != null && Math.abs(amountNum - Number(fine.discount_amount)) < 0.01) ? "paga_com_desconto" : "paga_integral";
      const { error } = await supabase.from("traffic_fines").update({
        paid_at: paidAt, paid_amount: amountNum, payment_method: method,
        payment_receipt_url: url ?? fine.payment_receipt_url, status,
        updated_by: user?.id ?? null,
      }).eq("id", fine.id);
      if (error) throw error;
      toast({ title: "Pagamento registrado" });
      onSaved(); onClose();
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Marcar como paga</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Data do pagamento</Label><Input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} /></div>
          <div><Label>Valor pago (R$)</Label><Input type="number" step="0.01" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} /></div>
          <div>
            <Label>Método</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FINE_PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Comprovante</Label><Input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Confirmar pagamento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}