import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PROBLEM_CATEGORIES, SEVERITY_LEVELS, MR_STATUS } from "@/lib/maintenance-requests";
import { Loader2, Wrench, Calendar, MapPin, Image as ImageIcon, X, Check, AlertTriangle, ClipboardPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function ManutencaoSolicitacoes() {
  const { currentCompanyId } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pendentes");
  const [selected, setSelected] = useState<any | null>(null);

  const load = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    let q = supabase
      .from("maintenance_requests")
      .select("*, vehicles(plate, brand, model), drivers(full_name)")
      .eq("company_id", currentCompanyId)
      .order("requested_at", { ascending: false });
    if (filter === "pendentes") q = q.in("status", ["pendente_aprovacao", "em_analise"]);
    else if (filter !== "todas") q = q.eq("status", filter);
    const { data } = await q;
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [currentCompanyId, filter]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wrench className="h-6 w-6 text-primary" /> Solicitações de manutenção</h1>
          <p className="text-sm text-muted-foreground">Reportes feitos pelos motoristas</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendentes">Pendentes</SelectItem>
            <SelectItem value="aprovada_agendamento">Aprovadas</SelectItem>
            <SelectItem value="agendada">Agendadas</SelectItem>
            <SelectItem value="concluida">Concluídas</SelectItem>
            <SelectItem value="rejeitada">Rejeitadas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <div className="surface-card rounded-xl p-12 text-center text-muted-foreground">Nenhuma solicitação</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((r) => {
            const cat = PROBLEM_CATEGORIES.find((c) => c.value === r.problem_category);
            const sev = SEVERITY_LEVELS.find((s) => s.value === r.severity_self_assessment);
            const st = MR_STATUS[r.status] ?? { label: r.status, color: "bg-muted" };
            return (
              <button key={r.id} onClick={() => setSelected(r)} className="surface-card rounded-xl p-4 text-left hover:border-primary/50 transition-all">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{cat?.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold">{cat?.label}</span>
                      {sev && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sev.color}`}>{sev.label}</span>}
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${st.color} ml-auto`}>{st.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{r.problem_description}</div>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                      <span>{r.vehicles?.plate} · {r.vehicles?.brand} {r.vehicles?.model}</span>
                      <span>· {r.drivers?.full_name ?? "—"}</span>
                      <span>· {format(new Date(r.requested_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                      {r.photos_urls?.length > 0 && <span>· 📸 {r.photos_urls.length}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <RequestDetailDialog request={selected} onClose={() => setSelected(null)} onChanged={load} />
    </div>
  );
}

function RequestDetailDialog({ request, onClose, onChanged }: { request: any | null; onClose: () => void; onChanged: () => void }) {
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"" | "approve" | "reject">("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [workshopId, setWorkshopId] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [notes, setNotes] = useState("");
  const [rejection, setRejection] = useState("");

  useEffect(() => {
    if (!request) return;
    setMode(""); setNotes(""); setRejection(""); setScheduledDate(""); setWorkshopId(""); setEstimatedCost("");
    (async () => {
      const { data: ws } = await supabase.from("workshops").select("id, name").eq("company_id", request.company_id);
      setWorkshops(ws ?? []);
      // signed urls for photos
      const urls: string[] = [];
      for (const p of request.photos_urls ?? []) {
        const { data } = await supabase.storage.from("maintenance-requests").createSignedUrl(p, 3600);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      setPhotoUrls(urls);
    })();
  }, [request]);

  const notify = async (type: string, title: string, message: string) => {
    await supabase.from("driver_notifications").insert({
      company_id: request.company_id,
      driver_user_id: request.driver_user_id,
      vehicle_id: request.vehicle_id,
      notification_type: type, title, message,
      related_id: request.id, related_type: "maintenance_request",
    });
  };

  const approve = async () => {
    if (!scheduledDate) { toast.error("Informe a data"); return; }
    setBusy(true);
    const { error } = await supabase.from("maintenance_requests").update({
      status: "agendada",
      scheduled_date: scheduledDate,
      scheduled_workshop_id: workshopId || null,
      estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
      gestor_notes: notes || null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", request.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await notify("manutencao_agendada", "Manutenção agendada", `Sua solicitação foi aprovada e agendada para ${format(new Date(scheduledDate), "dd/MM/yyyy")}`);
    toast.success("Aprovada e agendada"); onChanged(); onClose();
  };

  const reject = async () => {
    if (!rejection.trim()) { toast.error("Justifique a recusa"); return; }
    setBusy(true);
    const { error } = await supabase.from("maintenance_requests").update({
      status: "rejeitada", rejection_reason: rejection, reviewed_at: new Date().toISOString(),
    }).eq("id", request.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await notify("manutencao_rejeitada", "Solicitação rejeitada", rejection);
    toast.success("Rejeitada"); onChanged(); onClose();
  };

  if (!request) return null;
  const cat = PROBLEM_CATEGORIES.find((c) => c.value === request.problem_category);
  const sev = SEVERITY_LEVELS.find((s) => s.value === request.severity_self_assessment);

  return (
    <Dialog open={!!request} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{cat?.icon}</span> {cat?.label}
            {sev && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sev.color}`}>{sev.label}</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Veículo</div><div>{request.vehicles?.plate} · {request.vehicles?.brand} {request.vehicles?.model}</div></div>
            <div><div className="text-xs text-muted-foreground">Motorista</div><div>{request.drivers?.full_name ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">KM no reporte</div><div>{request.km_at_report ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Data</div><div>{format(new Date(request.requested_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div></div>
          </div>
          <div className="surface-card rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">Descrição</div>
            <div className="text-sm">{request.problem_description}</div>
          </div>
          {request.reported_latitude && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {request.reported_latitude}, {request.reported_longitude}
              <a href={`https://maps.google.com/?q=${request.reported_latitude},${request.reported_longitude}`} target="_blank" rel="noreferrer" className="text-primary underline ml-2">Ver no mapa</a>
            </div>
          )}
          {photoUrls.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Fotos</div>
              <div className="grid grid-cols-3 gap-2">
                {photoUrls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border border-border block">
                    <img src={u} className="w-full h-full object-cover" alt="" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {request.status === "agendada" && (
            <div className="surface-card rounded-lg p-3 border border-cyan-500/30 bg-cyan-500/5">
              <div className="text-xs text-cyan-400 font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> Agendada para {format(new Date(request.scheduled_date), "dd/MM/yyyy")}</div>
              {request.gestor_notes && <div className="text-xs text-muted-foreground mt-1">{request.gestor_notes}</div>}
            </div>
          )}
          {request.rejection_reason && (
            <div className="surface-card rounded-lg p-3 border border-destructive/30 bg-destructive/5">
              <div className="text-xs text-destructive font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Rejeitada</div>
              <div className="text-xs mt-1">{request.rejection_reason}</div>
            </div>
          )}

          {request.status === "agendada" && (
            <CreateOSButton request={request} workshops={workshops} onDone={() => { onChanged(); onClose(); }} />
          )}

          {["pendente_aprovacao", "em_analise"].includes(request.status) && (
            <div className="border-t border-border pt-4">
              {!mode && (
                <div className="flex gap-2">
                  <Button onClick={() => setMode("approve")} className="flex-1"><Check className="h-4 w-4 mr-1" /> Aprovar e agendar</Button>
                  <Button onClick={() => setMode("reject")} variant="destructive" className="flex-1"><X className="h-4 w-4 mr-1" /> Rejeitar</Button>
                </div>
              )}
              {mode === "approve" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Data agendada *</Label><Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} /></div>
                    <div><Label>Custo estimado</Label><Input type="number" step="0.01" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} placeholder="0,00" /></div>
                  </div>
                  <div>
                    <Label>Oficina</Label>
                    <Select value={workshopId} onValueChange={setWorkshopId}>
                      <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                      <SelectContent>
                        {workshops.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Notas internas</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setMode("")} className="flex-1">Voltar</Button>
                    <Button onClick={approve} disabled={busy} className="flex-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar agendamento"}</Button>
                  </div>
                </div>
              )}
              {mode === "reject" && (
                <div className="space-y-3">
                  <div><Label>Justificativa *</Label><Textarea value={rejection} onChange={(e) => setRejection(e.target.value)} rows={3} placeholder="Explique ao motorista..." /></div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setMode("")} className="flex-1">Voltar</Button>
                    <Button variant="destructive" onClick={reject} disabled={busy} className="flex-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar recusa"}</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateOSButton({ request, workshops, onDone }: { request: any; workshops: any[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [workshopId, setWorkshopId] = useState(request.scheduled_workshop_id ?? "");
  const [scheduledDate, setScheduledDate] = useState(request.scheduled_date ?? "");
  const [priority, setPriority] = useState("normal");
  const [title, setTitle] = useState(request.problem_description?.slice(0, 80) ?? "Manutenção corretiva");

  // Verifica se já existe OS
  const [existing, setExisting] = useState<any | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("maintenance_work_orders")
        .select("id, os_number, execution_status").eq("maintenance_request_id", request.id).maybeSingle();
      setExisting(data);
    })();
  }, [request.id]);

  const create = async () => {
    if (!workshopId || !scheduledDate) { toast.error("Oficina e data são obrigatórias"); return; }
    setBusy(true);
    const { error } = await supabase.from("maintenance_work_orders").insert({
      company_id: request.company_id,
      workshop_id: workshopId,
      vehicle_id: request.vehicle_id,
      driver_id: request.driver_id,
      origin_type: "corretiva",
      maintenance_request_id: request.id,
      title,
      description: request.problem_description,
      problem_category: request.problem_category ? [request.problem_category] : [],
      priority,
      scheduled_date: scheduledDate,
      km_at_scheduling: request.km_at_report,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("OS criada e enviada à oficina"); setOpen(false); onDone();
  };

  if (existing) {
    return (
      <div className="surface-card rounded-lg p-3 border border-primary/30 bg-primary/5 text-xs">
        OS <strong>{existing.os_number}</strong> já criada · status: {existing.execution_status}
      </div>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-full"><ClipboardPlus className="h-4 w-4 mr-1" /> Criar OS para a oficina</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Criar Ordem de Serviço</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label>Oficina *</Label>
              <Select value={workshopId} onValueChange={setWorkshopId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {workshops.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Data *</Label><Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} /></div>
              <div><Label>Prioridade</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={create} disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar OS"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}