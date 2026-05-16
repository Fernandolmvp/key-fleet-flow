import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWorkshopAuth } from "@/contexts/WorkshopAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Send, Plus, Trash2, Upload, Play, PauseCircle, CheckCircle2, ImageIcon, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { QUOTE_STATUS, EXEC_STATUS, PRIORITY_LEVELS } from "@/lib/work-orders";

type QItem = { description: string; qty: number; unit_price: number; total: number };

export default function OficinaOSDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user, workshop, authedFetch, token } = useWorkshopAuth();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    try {
      const r = await authedFetch<any>(`workshop-os-detail?id=${id}`, { method: "GET" });
      setData(r);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { if (token) load(); }, [id, token]);

  // Polling chat a cada 5s
  useEffect(() => {
    if (!id || !token) return;
    const t = setInterval(async () => {
      try {
        const r = await authedFetch<{ messages: any[] }>(`workshop-os-message?os_id=${id}`, { method: "GET" });
        setData((d: any) => d ? { ...d, messages: r.messages } : d);
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [id, token]);

  if (!token) { nav("/oficina/login"); return null; }
  if (loading) return <div className="grid place-items-center h-64"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data?.os) return <div className="p-6">OS não encontrada</div>;

  const os = data.os;
  const exec = EXEC_STATUS[os.execution_status];
  const quote = QUOTE_STATUS[os.quote_status];
  const pri = PRIORITY_LEVELS[os.priority];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto p-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav("/oficina")}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex-1">
            <div className="font-bold text-lg">{os.os_number}</div>
            <div className="text-xs text-muted-foreground">{os.company?.name}</div>
          </div>
          <span className={`text-xs px-2 py-1 rounded border ${exec.color}`}>{exec.label}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 grid lg:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <div className="surface-card rounded-xl p-4">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${pri.color}`}>{pri.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${quote.color}`}>{quote.label}</span>
            </div>
            <h2 className="font-semibold text-lg">{os.title}</h2>
            {os.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{os.description}</p>}
            <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Veículo</div>{os.vehicle?.plate} · {os.vehicle?.brand} {os.vehicle?.model}</div>
              <div><div className="text-xs text-muted-foreground">KM</div>{os.vehicle?.current_km ?? "—"}</div>
              <div><div className="text-xs text-muted-foreground">Motorista</div>{os.driver?.full_name ?? "—"}</div>
              <div><div className="text-xs text-muted-foreground">Agendado</div>{format(new Date(os.scheduled_date), "dd/MM/yyyy", { locale: ptBR })} {os.scheduled_time ?? ""}</div>
            </div>
          </div>

          <QuoteSection os={os} authedFetch={authedFetch} reload={load} />
          <ExecutionSection os={os} authedFetch={authedFetch} reload={load} />
          <PhotosSection signed={data.signed} />
        </div>

        <ChatPanel os={os} messages={data.messages ?? []} authedFetch={authedFetch} reload={load} userName={user?.name ?? ""} />
      </div>
    </div>
  );
}

function QuoteSection({ os, authedFetch, reload }: any) {
  const [open, setOpen] = useState(false);
  const [parts, setParts] = useState(String(os.quote_amount_parts ?? ""));
  const [labor, setLabor] = useState(String(os.quote_amount_labor ?? ""));
  const [other, setOther] = useState(String(os.quote_amount_other ?? ""));
  const [warranty, setWarranty] = useState(String(os.quote_warranty_days ?? 90));
  const [validity, setValidity] = useState(String(os.quote_validity_days ?? 7));
  const [notes, setNotes] = useState(os.quote_notes ?? "");
  const [items, setItems] = useState<QItem[]>(Array.isArray(os.quote_details) ? os.quote_details : []);
  const [busy, setBusy] = useState(false);

  const total = (Number(parts) || 0) + (Number(labor) || 0) + (Number(other) || 0);

  const send = async () => {
    setBusy(true);
    try {
      await authedFetch("workshop-os-action", {
        method: "POST",
        body: JSON.stringify({
          os_id: os.id, action: "send_quote",
          payload: {
            amount_parts: Number(parts) || 0, amount_labor: Number(labor) || 0, amount_other: Number(other) || 0,
            warranty_days: Number(warranty) || 90, validity_days: Number(validity) || 7,
            notes, details: items,
          },
        }),
      });
      toast.success("Orçamento enviado"); setOpen(false); reload();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const editable = ["pendente", "em_elaboracao", "rejeitado"].includes(os.quote_status);

  return (
    <div className="surface-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Orçamento</div>
        {editable && !open && <Button size="sm" onClick={() => setOpen(true)}>{os.quote_status === "rejeitado" ? "Revisar" : "Criar orçamento"}</Button>}
      </div>

      {os.quote_status === "rejeitado" && os.quote_rejected_reason && (
        <div className="text-xs text-destructive mb-2">Motivo: {os.quote_rejected_reason}</div>
      )}
      {os.quote_status === "aprovado" && (
        <div className="text-xs text-green-400 mb-2">✓ Orçamento aprovado pelo gestor {os.quote_approval_notes ? `· ${os.quote_approval_notes}` : ""}</div>
      )}

      {os.quote_amount_total != null && !open && (
        <div className="text-sm space-y-1">
          <div className="grid grid-cols-3 gap-2">
            <div><div className="text-xs text-muted-foreground">Peças</div>R$ {Number(os.quote_amount_parts ?? 0).toFixed(2)}</div>
            <div><div className="text-xs text-muted-foreground">Mão de obra</div>R$ {Number(os.quote_amount_labor ?? 0).toFixed(2)}</div>
            <div><div className="text-xs text-muted-foreground">Outros</div>R$ {Number(os.quote_amount_other ?? 0).toFixed(2)}</div>
          </div>
          <div className="font-bold text-lg">Total: R$ {Number(os.quote_amount_total).toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">Garantia: {os.quote_warranty_days}d · Validade: {os.quote_validity_days}d</div>
        </div>
      )}

      {open && (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Itens detalhados</div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_60px_80px_80px_30px] gap-2 items-center">
                <Input value={it.description} onChange={(e) => { const a = [...items]; a[i].description = e.target.value; setItems(a); }} placeholder="Descrição" />
                <Input type="number" value={it.qty} onChange={(e) => { const a = [...items]; a[i].qty = Number(e.target.value); a[i].total = a[i].qty * a[i].unit_price; setItems(a); }} />
                <Input type="number" step="0.01" value={it.unit_price} onChange={(e) => { const a = [...items]; a[i].unit_price = Number(e.target.value); a[i].total = a[i].qty * a[i].unit_price; setItems(a); }} placeholder="Unit." />
                <div className="text-xs text-right">R$ {it.total.toFixed(2)}</div>
                <button onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setItems([...items, { description: "", qty: 1, unit_price: 0, total: 0 }])}><Plus className="h-3 w-3 mr-1" /> Adicionar item</Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Total peças</Label><Input type="number" step="0.01" value={parts} onChange={(e) => setParts(e.target.value)} /></div>
            <div><Label className="text-xs">Mão de obra</Label><Input type="number" step="0.01" value={labor} onChange={(e) => setLabor(e.target.value)} /></div>
            <div><Label className="text-xs">Outros</Label><Input type="number" step="0.01" value={other} onChange={(e) => setOther(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Garantia (dias)</Label><Input type="number" value={warranty} onChange={(e) => setWarranty(e.target.value)} /></div>
            <div><Label className="text-xs">Validade (dias)</Label><Input type="number" value={validity} onChange={(e) => setValidity(e.target.value)} /></div>
          </div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações" rows={2} />
          <div className="text-lg font-bold">Total: R$ {total.toFixed(2)}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancelar</Button>
            <Button onClick={send} disabled={busy} className="flex-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar para gestor"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExecutionSection({ os, authedFetch, reload }: any) {
  const [busy, setBusy] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [kmStart, setKmStart] = useState("");
  const [kmEnd, setKmEnd] = useState("");
  const [actualTotal, setActualTotal] = useState(String(os.quote_amount_total ?? ""));
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [warrantyUntil, setWarrantyUntil] = useState("");
  const [finalNotes, setFinalNotes] = useState("");
  const [beforePhotos, setBeforePhotos] = useState<string[]>(os.before_photos_urls ?? []);
  const [afterPhotos, setAfterPhotos] = useState<string[]>(os.after_photos_urls ?? []);
  const [invoicePath, setInvoicePath] = useState<string | null>(os.invoice_url);

  const act = async (action: string, payload?: any) => {
    setBusy(true);
    try {
      await authedFetch("workshop-os-action", { method: "POST", body: JSON.stringify({ os_id: os.id, action, payload }) });
      toast.success("Atualizado"); setCompleting(false); reload();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const upload = async (file: File, kind: "antes" | "depois" | "nf"): Promise<string | null> => {
    const b64 = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => { const s = r.result as string; res(s.split(",")[1]); };
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    try {
      const r: { path: string } = await authedFetch("workshop-os-upload", {
        method: "POST",
        body: JSON.stringify({ os_id: os.id, kind, filename: file.name, content_type: file.type, base64: b64 }),
      });
      return r.path;
    } catch (e: any) { toast.error(e.message); return null; }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, kind: "antes" | "depois" | "nf") => {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) {
      const path = await upload(f, kind);
      if (!path) continue;
      if (kind === "antes") setBeforePhotos((p) => [...p, path]);
      else if (kind === "depois") setAfterPhotos((p) => [...p, path]);
      else if (kind === "nf") setInvoicePath(path);
    }
    e.target.value = "";
  };

  if (os.quote_status !== "aprovado" && os.execution_status !== "concluido") {
    return null;
  }

  return (
    <div className="surface-card rounded-xl p-4 space-y-3">
      <div className="font-semibold">Execução</div>

      {os.execution_status === "aprovado_aguardando_inicio" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">KM no início</Label><Input type="number" value={kmStart} onChange={(e) => setKmStart(e.target.value)} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Fotos "antes"</Label>
              <Input type="file" accept="image/*" multiple onChange={(e) => handleUpload(e, "antes")} />
              <div className="text-[10px] text-muted-foreground">{beforePhotos.length} foto(s)</div>
            </div>
          </div>
          <Button onClick={() => act("start_execution", { km_at_start: Number(kmStart) || null, before_photos_paths: beforePhotos })} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-1" /> Iniciar execução</>}
          </Button>
        </div>
      )}

      {os.execution_status === "em_execucao" && !completing && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => act("mark_waiting_parts")} disabled={busy} className="flex-1"><PauseCircle className="h-4 w-4 mr-1" /> Aguardando peças</Button>
          <Button onClick={() => setCompleting(true)} className="flex-1"><CheckCircle2 className="h-4 w-4 mr-1" /> Concluir</Button>
        </div>
      )}
      {os.execution_status === "aguardando_pecas" && (
        <Button onClick={() => act("resume_execution")} disabled={busy} className="w-full"><Play className="h-4 w-4 mr-1" /> Retomar execução</Button>
      )}

      {completing && (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">KM final *</Label><Input type="number" value={kmEnd} onChange={(e) => setKmEnd(e.target.value)} /></div>
            <div><Label className="text-xs">Valor real *</Label><Input type="number" step="0.01" value={actualTotal} onChange={(e) => setActualTotal(e.target.value)} /></div>
            <div><Label className="text-xs">Nº NF</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></div>
            <div><Label className="text-xs">Garantia até</Label><Input type="date" value={warrantyUntil} onChange={(e) => setWarrantyUntil(e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fotos "depois"</Label>
            <Input type="file" accept="image/*" multiple onChange={(e) => handleUpload(e, "depois")} />
            <div className="text-[10px] text-muted-foreground">{afterPhotos.length} foto(s)</div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nota Fiscal (PDF/imagem)</Label>
            <Input type="file" accept="application/pdf,image/*" onChange={(e) => handleUpload(e, "nf")} />
            {invoicePath && <div className="text-[10px] text-muted-foreground">✓ NF anexada</div>}
          </div>
          <Textarea value={finalNotes} onChange={(e) => setFinalNotes(e.target.value)} placeholder="Observações finais" rows={2} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCompleting(false)} className="flex-1">Cancelar</Button>
            <Button onClick={() => act("complete", {
              km_at_completion: Number(kmEnd) || null,
              actual_amount_total: Number(actualTotal) || null,
              invoice_number: invoiceNumber || null,
              invoice_path: invoicePath,
              warranty_until: warrantyUntil || null,
              final_notes: finalNotes || null,
              after_photos_paths: afterPhotos,
            })} disabled={busy} className="flex-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalizar OS"}</Button>
          </div>
        </div>
      )}

      {os.execution_status === "concluido" && (
        <div className="text-sm text-green-400">✓ OS concluída em {os.execution_completed_at ? format(new Date(os.execution_completed_at), "dd/MM/yyyy HH:mm") : ""}</div>
      )}
    </div>
  );
}

function PhotosSection({ signed }: { signed: any }) {
  if (!signed) return null;
  const { beforePhotos = [], afterPhotos = [], invoiceUrl } = signed;
  if (!beforePhotos.length && !afterPhotos.length && !invoiceUrl) return null;
  return (
    <div className="surface-card rounded-xl p-4 space-y-3">
      {beforePhotos.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Antes</div>
          <div className="grid grid-cols-4 gap-2">{beforePhotos.map((p: any, i: number) => <a key={i} href={p.url} target="_blank" rel="noreferrer" className="aspect-square rounded overflow-hidden border border-border"><img src={p.url} className="w-full h-full object-cover" /></a>)}</div>
        </div>
      )}
      {afterPhotos.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Depois</div>
          <div className="grid grid-cols-4 gap-2">{afterPhotos.map((p: any, i: number) => <a key={i} href={p.url} target="_blank" rel="noreferrer" className="aspect-square rounded overflow-hidden border border-border"><img src={p.url} className="w-full h-full object-cover" /></a>)}</div>
        </div>
      )}
      {invoiceUrl && (
        <a href={invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary"><FileText className="h-3 w-3" /> Ver Nota Fiscal</a>
      )}
    </div>
  );
}

function ChatPanel({ os, messages, authedFetch, reload, userName }: any) {
  const [text, setText] = useState("");
  const send = async () => {
    if (!text.trim()) return;
    const t = text.trim(); setText("");
    try {
      await authedFetch("workshop-os-message", { method: "POST", body: JSON.stringify({ os_id: os.id, message: t }) });
      reload();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <div className="surface-card rounded-xl p-4 lg:sticky lg:top-4 h-fit">
      <div className="font-semibold mb-2 flex items-center gap-2"><Send className="h-4 w-4" /> Chat com gestor</div>
      <div className="max-h-[420px] overflow-y-auto space-y-2 mb-2 pr-1">
        {messages.length === 0 && <div className="text-xs text-muted-foreground">Sem mensagens</div>}
        {messages.map((m: any) => (
          <div key={m.id} className={`flex ${m.sender_role === "oficina" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${m.sender_role === "oficina" ? "bg-primary/15 border border-primary/30" : "bg-muted/40 border border-border"}`}>
              <div className="text-[10px] opacity-70 mb-0.5">{m.sender_role === "oficina" ? userName || "Você" : "Gestor"} · {format(new Date(m.created_at), "dd/MM HH:mm")}</div>
              <div className="whitespace-pre-wrap">{m.message}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Mensagem..." />
        <Button onClick={send} disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}