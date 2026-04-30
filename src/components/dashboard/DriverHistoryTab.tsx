import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCog, Undo2, Clock, KeyRound, LogIn } from "lucide-react";

type EventKind = "status" | "access";

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
  access: "Acesso",
};

const KIND_ICON: Record<EventKind, any> = {
  status: UserCog,
  access: KeyRound,
};

const KIND_TONE: Record<EventKind, string> = {
  status: "bg-primary/15 text-primary border-primary/30",
  access: "bg-success/15 text-success border-success/30",
};

export default function DriverHistoryTab({ driverId, companyId, driverStatus }: Props) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: hist }, { data: drv }] = await Promise.all([
      supabase.from("driver_status_history" as any)
        .select("*").eq("driver_id", driverId).order("created_at", { ascending: false }),
      supabase.from("drivers")
        .select("onboarded_at,phone_verified_at,email_verified_at,user_id")
        .eq("id", driverId).maybeSingle(),
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

    // Eventos de acesso ao sistema
    if (drv?.onboarded_at) {
      all.push({
        id: `access:onboarded`, kind: "access", created_at: drv.onboarded_at,
        title: "Primeiro acesso concluído",
        subtitle: "Identidade confirmada e contato validado",
        meta: drv.user_id ? "Conta de acesso vinculada" : undefined,
        raw: { kind: "onboarded" },
      });
    }
    if (drv?.phone_verified_at) {
      all.push({
        id: `access:phone`, kind: "access", created_at: drv.phone_verified_at,
        title: "Telefone verificado (SMS)",
        raw: { kind: "phone_verified" },
      });
    }
    if (drv?.email_verified_at) {
      all.push({
        id: `access:email`, kind: "access", created_at: drv.email_verified_at,
        title: "Email verificado",
        raw: { kind: "email_verified" },
      });
    }

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
      if (ev.kind === "access") {
        toast.info("Eventos de acesso não podem ser desfeitos por aqui.");
        setBusyId(null);
        return;
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
        {events.length} evento(s) — cadastro do motorista e acessos ao sistema, ordenados pela data/hora do lançamento.
        Abastecimentos, manutenções e documentos têm registro próprio em seus módulos.
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
                  {ev.kind !== "access" && <Button
                    size="sm" variant="ghost"
                    className="text-destructive hover:text-destructive shrink-0"
                    onClick={() => undo(ev)}
                    disabled={busyId === ev.id}
                    title="Desfazer este lançamento"
                  >
                    {busyId === ev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                  </Button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}