import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ClipboardList, Star, Send, Check, X, FileText, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { QUOTE_STATUS, EXEC_STATUS, PAYMENT_STATUS, PRIORITY_LEVELS } from "@/lib/work-orders";

export default function WorkOrders() {
  const { currentCompanyId } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ativas");
  const [selected, setSelected] = useState<any | null>(null);

  const load = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    let q = supabase.from("maintenance_work_orders")
      .select("*, vehicle:vehicles(plate, brand, model), workshop:workshops(id, name), driver:drivers(full_name)")
      .eq("company_id", currentCompanyId)
      .order("scheduled_date", { ascending: false });
    if (filter === "ativas") q = q.not("execution_status", "in", "(concluido,cancelado)");
    else if (filter === "concluidas") q = q.eq("execution_status", "concluido");
    else if (filter === "aguardando_aprov") q = q.eq("quote_status", "enviado");
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [currentCompanyId, filter]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-6 w-6 text-primary" /> Ordens de serviço</h1>
          <p className="text-sm text-muted-foreground">Acompanhamento de OS junto às oficinas</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativas">Em andamento</SelectItem>
            <SelectItem value="aguardando_aprov">Aguardando aprovação de orçamento</SelectItem>
            <SelectItem value="concluidas">Concluídas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <div className="surface-card rounded-xl p-12 text-center text-muted-foreground">Nenhuma OS</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => {
            const exec = EXEC_STATUS[r.execution_status] ?? { label: r.execution_status, color: "bg-muted" };
            const quote = QUOTE_STATUS[r.quote_status] ?? { label: r.quote_status, color: "bg-muted" };
            const pri = PRIORITY_LEVELS[r.priority] ?? { label: r.priority, color: "" };
            return (
              <button key={r.id} onClick={() => setSelected(r)} className="surface-card rounded-xl p-4 text-left hover:border-primary/50 transition-all">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-semibold">{r.os_number} <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded border ${pri.color}`}>{pri.label}</span></div>
                    <div className="text-xs text-muted-foreground">{r.title}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${exec.color}`}>{exec.label}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>🚚 {r.vehicle?.plate} · {r.vehicle?.brand} {r.vehicle?.model}</div>
                  <div>🔧 {r.workshop?.name} · 📅 {format(new Date(r.scheduled_date), "dd/MM/yyyy", { locale: ptBR })}</div>
                  <div>💰 <span className={`px-1.5 py-0.5 rounded border ${quote.color}`}>{quote.label}</span> {r.quote_amount_total ? `· R$ ${Number(r.quote_amount_total).toFixed(2)}` : ""}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && <WorkOrderDetail osId={selected.id} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function WorkOrderDetail({ osId, onClose, onChanged }: { osId: string; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const [os, setOs] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [quoteAction, setQuoteAction] = useState<"" | "approve" | "reject">("");
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("pix");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [chatMsg, setChatMsg] = useState("");

  const load = async () => {
    const { data } = await supabase.from("maintenance_work_orders")
      .select("*, vehicle:vehicles(plate, brand, model, current_km), workshop:workshops(id, name), driver:drivers(full_name)")
      .eq("id", osId).maybeSingle();
    setOs(data);
    const { data: msgs } = await supabase.from("work_order_messages")
      .select("*").eq("work_order_id", osId).order("created_at", { ascending: true });
    setMessages(msgs ?? []);
  };
  useEffect(() => { load(); }, [osId]);

  // Realtime chat
  useEffect(() => {
    const ch = supabase.channel(`wo-msg-${osId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "work_order_messages", filter: `work_order_id=eq.${osId}` },
        (p) => setMessages((m) => [...m, p.new as any]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "maintenance_work_orders", filter: `id=eq.${osId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [osId]);

  const sendMsg = async () => {
    if (!chatMsg.trim() || !os) return;
    const text = chatMsg.trim();
    setChatMsg("");
    const { error } = await supabase.from("work_order_messages").insert({
      work_order_id: os.id, company_id: os.company_id, workshop_id: os.workshop_id,
      sender_id: user?.id, sender_role: "gestor", message: text,
    });
    if (error) toast.error(error.message);
  };

  const approveQuote = async () => {
    if (!os) return;
    setBusy(true);
    const { error } = await supabase.from("maintenance_work_orders").update({
      quote_status: "aprovado", execution_status: "aprovado_aguardando_inicio",
      quote_approved_by: user?.id, quote_approved_at: new Date().toISOString(),
      quote_approval_notes: approveNotes || null, updated_by: user?.id,
    }).eq("id", os.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Orçamento aprovado"); setQuoteAction(""); load(); onChanged();
  };
  const rejectQuote = async () => {
    if (!os || !rejectReason.trim()) { toast.error("Informe o motivo"); return; }
    setBusy(true);
    const { error } = await supabase.from("maintenance_work_orders").update({
      quote_status: "rejeitado", quote_rejected_reason: rejectReason, updated_by: user?.id,
    }).eq("id", os.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Orçamento rejeitado"); setQuoteAction(""); load(); onChanged();
  };

  const markPaid = async () => {
    if (!os) return;
    setBusy(true);
    const { error } = await supabase.from("maintenance_work_orders").update({
      payment_status: "pago", payment_method: payMethod, payment_paid_at: payDate,
      actual_amount_total: payAmount ? Number(payAmount) : os.actual_amount_total,
      updated_by: user?.id,
    }).eq("id", os.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pagamento registrado"); load(); onChanged();
  };

  const submitRating = async () => {
    if (!os || !rating) { toast.error("Selecione a nota"); return; }
    setBusy(true);
    const { error } = await supabase.from("maintenance_work_orders").update({
      rating, rating_comment: ratingComment || null, rated_by: user?.id, rated_at: new Date().toISOString(),
    }).eq("id", os.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Avaliação registrada"); load(); onChanged();
  };

  if (!os) return null;
  const quote = QUOTE_STATUS[os.quote_status];
  const exec = EXEC_STATUS[os.execution_status];
  const pay = PAYMENT_STATUS[os.payment_status];
  const items: any[] = Array.isArray(os.quote_details) ? os.quote_details : [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <ClipboardList className="h-5 w-5 text-primary" /> {os.os_number}
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${exec.color}`}>{exec.label}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${quote.color}`}>{quote.label}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${pay.color}`}>Pgto: {pay.label}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="surface-card rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Veículo</div>
            <div>{os.vehicle?.plate} · {os.vehicle?.brand} {os.vehicle?.model}</div>
            <div className="text-xs text-muted-foreground mt-2">Motorista</div>
            <div>{os.driver?.full_name ?? "—"}</div>
          </div>
          <div className="surface-card rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Oficina</div>
            <div>{os.workshop?.name}</div>
            <div className="text-xs text-muted-foreground mt-2">Agendado para</div>
            <div>{format(new Date(os.scheduled_date), "dd/MM/yyyy", { locale: ptBR })} {os.scheduled_time ?? ""}</div>
          </div>
        </div>

        <div className="surface-card rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Descrição</div>
          <div className="text-sm">{os.title}</div>
          {os.description && <div className="text-xs text-muted-foreground mt-1">{os.description}</div>}
        </div>

        {/* Orçamento */}
        {os.quote_status === "enviado" && (
          <div className="surface-card rounded-lg p-3 border border-amber-500/30 bg-amber-500/5">
            <div className="font-semibold mb-2">Orçamento da oficina</div>
            <div className="grid grid-cols-3 gap-2 text-sm mb-2">
              <div><div className="text-xs text-muted-foreground">Peças</div>R$ {Number(os.quote_amount_parts ?? 0).toFixed(2)}</div>
              <div><div className="text-xs text-muted-foreground">Mão de obra</div>R$ {Number(os.quote_amount_labor ?? 0).toFixed(2)}</div>
              <div><div className="text-xs text-muted-foreground">Outros</div>R$ {Number(os.quote_amount_other ?? 0).toFixed(2)}</div>
            </div>
            <div className="text-lg font-bold mb-2">Total: R$ {Number(os.quote_amount_total ?? 0).toFixed(2)}</div>
            {items.length > 0 && (
              <div className="text-xs space-y-1 mb-2">
                {items.map((it, i) => (
                  <div key={i} className="flex justify-between border-b border-border/30 py-1">
                    <span>{it.description} ×{it.qty}</span><span>R$ {Number(it.total).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            {os.quote_notes && <div className="text-xs text-muted-foreground mb-2">📝 {os.quote_notes}</div>}
            <div className="text-xs text-muted-foreground mb-3">
              Garantia: {os.quote_warranty_days}d · Validade: {os.quote_validity_days}d
            </div>
            {!quoteAction && (
              <div className="flex gap-2">
                <Button onClick={() => setQuoteAction("approve")} className="flex-1"><Check className="h-4 w-4 mr-1" /> Aprovar</Button>
                <Button onClick={() => setQuoteAction("reject")} variant="destructive" className="flex-1"><X className="h-4 w-4 mr-1" /> Rejeitar</Button>
              </div>
            )}
            {quoteAction === "approve" && (
              <div className="space-y-2">
                <Textarea value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} placeholder="Observações (opcional)" rows={2} />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setQuoteAction("")} className="flex-1">Voltar</Button>
                  <Button onClick={approveQuote} disabled={busy} className="flex-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar aprovação"}</Button>
                </div>
              </div>
            )}
            {quoteAction === "reject" && (
              <div className="space-y-2">
                <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motivo *" rows={2} />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setQuoteAction("")} className="flex-1">Voltar</Button>
                  <Button variant="destructive" onClick={rejectQuote} disabled={busy} className="flex-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar recusa"}</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resultado da execução */}
        {os.execution_status === "concluido" && (
          <div className="surface-card rounded-lg p-3 border border-green-500/30 bg-green-500/5 space-y-2">
            <div className="font-semibold">Serviço concluído</div>
            <div className="text-sm">Total: R$ {Number(os.actual_amount_total ?? 0).toFixed(2)} · NF {os.invoice_number ?? "—"}</div>
            {os.warranty_until && <div className="text-xs">Garantia até {format(new Date(os.warranty_until), "dd/MM/yyyy")}</div>}
            {os.final_notes && <div className="text-xs text-muted-foreground">{os.final_notes}</div>}

            {os.payment_status !== "pago" && (
              <div className="border-t border-border pt-2 mt-2">
                <div className="font-medium text-sm mb-2">Registrar pagamento</div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">Valor</Label><Input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={String(os.actual_amount_total ?? "")} /></div>
                  <div><Label className="text-xs">Método</Label>
                    <Select value={payMethod} onValueChange={setPayMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="cartao">Cartão</SelectItem>
                        <SelectItem value="transferencia">Transferência</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Data</Label><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
                </div>
                <Button onClick={markPaid} disabled={busy} size="sm" className="mt-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar pagamento"}</Button>
              </div>
            )}

            {!os.rating && os.payment_status === "pago" && (
              <div className="border-t border-border pt-2 mt-2">
                <div className="font-medium text-sm mb-2">Avaliar serviço</div>
                <div className="flex gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setRating(n)}>
                      <Star className={`h-6 w-6 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
                <Textarea value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} placeholder="Comentário (opcional)" rows={2} />
                <Button onClick={submitRating} disabled={busy} size="sm" className="mt-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar avaliação"}</Button>
              </div>
            )}
            {os.rating && (
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-5 w-5 ${n <= os.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />)}</div>
                {os.rating_comment && <div className="text-xs text-muted-foreground mt-1">{os.rating_comment}</div>}
              </div>
            )}
          </div>
        )}

        {/* Chat */}
        <div className="surface-card rounded-lg p-3">
          <div className="font-semibold mb-2 flex items-center gap-2"><Send className="h-4 w-4" /> Chat com a oficina</div>
          <div className="max-h-64 overflow-y-auto space-y-2 mb-2 pr-1">
            {messages.length === 0 && <div className="text-xs text-muted-foreground">Sem mensagens</div>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender_role === "gestor" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${m.sender_role === "gestor" ? "bg-primary/15 border border-primary/30" : "bg-muted/40 border border-border"}`}>
                  <div className="text-[10px] opacity-70 mb-0.5">{m.sender_role === "gestor" ? "Gestor" : "Oficina"} · {format(new Date(m.created_at), "dd/MM HH:mm")}</div>
                  <div className="whitespace-pre-wrap">{m.message}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMsg()} placeholder="Mensagem..." />
            <Button onClick={sendMsg} disabled={!chatMsg.trim()}><Send className="h-4 w-4" /></Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}