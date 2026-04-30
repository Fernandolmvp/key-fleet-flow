import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Fuel, Wrench, FileText, UserCog, Undo2, Clock } from "lucide-react";

type EventKind = "status" | "fuel" | "maintenance" | "document";

interface TimelineEvent {
  id: string;
  kind: EventKind;
  created_at: string; // when it was logged in the system
  title: string;
  subtitle?: string;
  meta?: string;
  raw: any;
}

interface Props {
  driverId: string;
  companyId: string;
  driverStatus: string;
}

const KIND_LABEL: Record<EventKind, string> = {
  status: "Status",
  fuel: "Abastecimento",
  maintenance: "Manutenção",
  document: "Documento",
};

const KIND_ICON: Record<EventKind, any> = {
  status: UserCog,
  fuel: Fuel,
  maintenance: Wrench,
  document: FileText,
};

const KIND_TONE: Record<EventKind, string> = {
  status: "bg-primary/15 text-primary border-primary/30",
  fuel: "bg-warning/15 text-warning border-warning/30",
  maintenance: "bg-success/15 text-success border-success/30",
  document: "bg-muted/40 text-foreground border-border",
};

export default function DriverHistoryTab({ driverId, companyId, driverStatus }: Props) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: hist }, { data: fuel }, { data: maint }, { data: docs }] = await Promise.all([
      supabase.from("driver_status_history" as any)
        .select("*").eq("driver_id", driverId).order("created_at", { ascending: false }),
      supabase.from("fuel_records")
        .select("id,fueled_at,liters,total_value,fuel_type,station_name,created_at")
        .eq("driver_id", driverId).order("created_at", { ascending: false }),
      supabase.from("maintenance_records")
        .select("id,service_at,type,category,workshop_name,total_value,created_at")
        .eq("driver_id", driverId).order("created_at", { ascending: false }),
      supabase.from("documents")
        .select("id,doc_type,title,document_number,expires_at,created_at")
        .eq("entity_type", "driver").eq("entity_id", driverId).order("created_at", { ascending: false }),
    ]);

    const all: TimelineEvent[] = [];
    (hist ?? []).forEach((h: any) => {
      const action = !h.previous_status
        ? `Cadastrado como ${h.new_status}`
        : `${h.previous_status} → ${h.new_status}`;
      all.push({
        id: `status:${h.id}`, kind: "status", created_at: h.created_at,
        title: action,
        subtitle: h.reason || undefined,
        meta: h.inactivated_at ? `Inativado em ${new Date(h.inactivated_at).toLocaleDateString("pt-BR")}` :
              h.termination_date ? `Desligamento ${new Date(h.termination_date).toLocaleDateString("pt-BR")}` : undefined,
        raw: h,
      });
    });
    (fuel ?? []).forEach((f: any) => all.push({
      id: `fuel:${f.id}`, kind: "fuel", created_at: f.created_at,
      title: `Abastecimento — ${f.fuel_type ?? ""} ${Number(f.liters).toFixed(2)} L`,
      subtitle: f.station_name || undefined,
      meta: `R$ ${Number(f.total_value || 0).toFixed(2)} · realizado ${new Date(f.fueled_at).toLocaleString("pt-BR")}`,
      raw: f,
    }));
    (maint ?? []).forEach((m: any) => all.push({
      id: `maintenance:${m.id}`, kind: "maintenance", created_at: m.created_at,
      title: `Manutenção ${m.type}${m.category ? ` · ${m.category}` : ""}`,
      subtitle: m.workshop_name || undefined,
      meta: `R$ ${Number(m.total_value || 0).toFixed(2)} · serviço ${new Date(m.service_at).toLocaleString("pt-BR")}`,
      raw: m,
    }));
    (docs ?? []).forEach((d: any) => all.push({
      id: `document:${d.id}`, kind: "document", created_at: d.created_at,
      title: d.title || d.doc_type,
      subtitle: d.document_number || undefined,
      meta: d.expires_at ? `Vence em ${new Date(d.expires_at).toLocaleDateString("pt-BR")}` : undefined,
      raw: d,
    }));

    // ordena pela data/hora real do lançamento (created_at) — desc
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setEvents(all);
    setLoading(false);
  };

  useEffect(() => { if (driverId) load(); }, [driverId]);

  const undo = async (ev: TimelineEvent) => {
    if (!confirm(`Desfazer este lançamento?\n\n${ev.title}`)) return;
    setBusyId(ev.id);
    try {
      if (ev.kind === "fuel") {
        const { error } = await supabase.from("fuel_records").delete().eq("id", ev.raw.id);
        if (error) throw error;
      } else if (ev.kind === "maintenance") {
        const { error } = await supabase.from("maintenance_records").delete().eq("id", ev.raw.id);
        if (error) throw error;
      } else if (ev.kind === "document") {
        const { error } = await supabase.from("documents").delete().eq("id", ev.raw.id);
        if (error) throw error;
      } else if (ev.kind === "status") {
        // Reverte o motorista para o status anterior desta entrada
        const prev = ev.raw.previous_status;
        if (!prev) {
          toast.error("Não há status anterior para reverter (este é o cadastro inicial).");
          setBusyId(null);
          return;
        }
        // procura o registro anterior (mais antigo) para restaurar reason/datas
        const { data: older } = await supabase.from("driver_status_history" as any)
          .select("*").eq("driver_id", driverId)
          .lt("created_at", ev.created_at)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        const prevReason = (older as any)?.reason ?? null;
        const prevInact = (older as any)?.inactivated_at ?? null;
        const prevTerm = (older as any)?.termination_date ?? null;
        const { error: upErr } = await supabase.from("drivers").update({
          status: prev,
          inactive_reason: prevReason,
          inactivated_at: prevInact,
          termination_date: prevTerm,
        }).eq("id", driverId);
        if (upErr) throw upErr;
        // remove o registro desfeito do histórico
        await supabase.from("driver_status_history" as any).delete().eq("id", ev.raw.id);
      }
      toast.success("Lançamento desfeito");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao desfazer");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando histórico...</div>;
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border p-8 text-center text-muted-foreground bg-muted/20">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        Nenhum lançamento registrado ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {events.length} lançamento(s) — ordenados pela data e hora do lançamento no sistema (mais recentes primeiro).
      </p>
      <div className="relative pl-6 border-l-2 border-border space-y-3">
        {events.map((ev) => {
          const Icon = KIND_ICON[ev.kind];
          return (
            <div key={ev.id} className="relative">
              <div className="absolute -left-[31px] top-3 h-4 w-4 rounded-full bg-background border-2 border-primary" />
              <div className="rounded-xl border border-border p-3 bg-card hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-lg grid place-items-center border shrink-0 ${KIND_TONE[ev.kind]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] uppercase">{KIND_LABEL[ev.kind]}</Badge>
                      <span className="text-xs font-mono text-muted-foreground">
                        {new Date(ev.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="font-medium text-sm mt-1 capitalize">{ev.title}</p>
                    {ev.subtitle && <p className="text-xs text-muted-foreground">{ev.subtitle}</p>}
                    {ev.meta && <p className="text-[11px] text-muted-foreground mt-1 font-mono">{ev.meta}</p>}
                  </div>
                  <Button
                    size="sm" variant="ghost"
                    className="text-destructive hover:text-destructive shrink-0"
                    onClick={() => undo(ev)}
                    disabled={busyId === ev.id}
                    title="Desfazer este lançamento"
                  >
                    {busyId === ev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}