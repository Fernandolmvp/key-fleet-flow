import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, Wrench, FileText, Siren, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import MotoristaBottomNav from "@/components/motorista/MotoristaBottomNav";
import NotificationBell from "@/components/motorista/NotificationBell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addMonths, endOfMonth, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type Event = { id: string; type: string; date: string; title: string; vehicle_id: string | null; meta: any };

const TYPE_META: Record<string, { color: string; icon: any; label: string }> = {
  maintenance_preventive: { color: "bg-primary/30 text-primary border-primary/40", icon: Wrench, label: "Preventiva" },
  maintenance_corrective: { color: "bg-orange-500/30 text-orange-400 border-orange-500/40", icon: Wrench, label: "Corretiva" },
  maintenance_request: { color: "bg-orange-500/30 text-orange-400 border-orange-500/40", icon: Wrench, label: "Reparo" },
  document_expiring: { color: "bg-destructive/30 text-destructive border-destructive/40", icon: FileText, label: "Documento" },
  driver_document_expiring: { color: "bg-destructive/30 text-destructive border-destructive/40", icon: FileText, label: "Documento" },
  fine_due: { color: "bg-red-700/30 text-red-400 border-red-700/40", icon: Siren, label: "Multa" },
  checklist: { color: "bg-success/30 text-success border-success/40", icon: ClipboardCheck, label: "Checklist" },
};

export default function MotoristaCalendario() {
  const { user } = useAuth();
  const [view, setView] = useState<"mes" | "lista">("mes");
  const [cursor, setCursor] = useState(new Date());
  const [vehicleFilter, setVehicleFilter] = useState<"current" | "all" | string>("current");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [currentVehicleId, setCurrentVehicleId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: drv } = await supabase.from("drivers").select("assigned_vehicle_id, company_id").eq("user_id", user.id).maybeSingle();
      if (drv?.company_id) {
        const { data: vs } = await supabase.from("vehicles").select("id, plate, brand, model").eq("company_id", drv.company_id);
        setVehicles(vs ?? []);
      }
      setCurrentVehicleId(drv?.assigned_vehicle_id ?? null);
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      setLoading(true);
      const start = startOfMonth(cursor);
      const end = endOfMonth(addMonths(cursor, 1));
      let vId: string | null = null;
      if (vehicleFilter === "current") vId = currentVehicleId;
      else if (vehicleFilter !== "all") vId = vehicleFilter;
      const { data, error } = await supabase.rpc("get_driver_calendar_events", {
        p_driver_user_id: user.id,
        p_vehicle_id: vId,
        p_start_date: format(start, "yyyy-MM-dd"),
        p_end_date: format(end, "yyyy-MM-dd"),
      });
      if (!error) setEvents((data as any) ?? []);
      setLoading(false);
    })();
  }, [user, cursor, vehicleFilter, currentVehicleId]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of events) {
      if (!e.date) continue;
      const key = format(parseISO(e.date), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const dayEvents = (d: Date) => eventsByDay.get(format(d, "yyyy-MM-dd")) ?? [];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/motorista" className="p-1.5 -ml-1.5 rounded hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-semibold flex-1">Calendário</h1>
        <NotificationBell />
      </header>

      <div className="p-4 space-y-3">
        <Select value={vehicleFilter} onValueChange={(v) => setVehicleFilter(v as any)}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Veículo atual{currentVehicleId ? "" : " (nenhum)"}</SelectItem>
            <SelectItem value="all">Todos que eu dirigi</SelectItem>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <button onClick={() => setView("mes")} className={`flex-1 py-2 rounded-lg text-sm font-medium ${view === "mes" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Mês</button>
          <button onClick={() => setView("lista")} className={`flex-1 py-2 rounded-lg text-sm font-medium ${view === "lista" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Lista</button>
        </div>

        {view === "mes" && (
          <div className="surface-card rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <button onClick={() => setCursor(addMonths(cursor, -1))} className="p-2 rounded hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
              <div className="font-semibold capitalize">{format(cursor, "MMMM yyyy", { locale: ptBR })}</div>
              <button onClick={() => setCursor(addMonths(cursor, 1))} className="p-2 rounded hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-7 text-[10px] text-center text-muted-foreground py-1 border-b border-border uppercase">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {loading ? (
                <div className="col-span-7 py-12 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : days.map((d, i) => {
                const evs = dayEvents(d);
                const inMonth = isSameMonth(d, cursor);
                const isToday = isSameDay(d, new Date());
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(d)}
                    className={`aspect-square border-r border-b border-border/40 p-1 flex flex-col items-center justify-start text-xs ${
                      inMonth ? "" : "opacity-30"
                    } ${isToday ? "bg-primary/10" : ""}`}
                  >
                    <div className={`text-[11px] ${isToday ? "font-bold text-primary" : ""}`}>{format(d, "d")}</div>
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {evs.slice(0, 3).map((e, idx) => {
                        const m = TYPE_META[e.type] ?? { color: "bg-muted" };
                        return <div key={idx} className={`h-1.5 w-1.5 rounded-full ${m.color.split(" ")[0]}`} />;
                      })}
                      {evs.length > 3 && <div className="text-[8px] text-muted-foreground">+{evs.length - 3}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {view === "lista" && (
          <div className="space-y-3">
            {loading ? (
              <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : events.length === 0 ? (
              <div className="surface-card rounded-xl p-8 text-center text-sm text-muted-foreground">
                <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhum evento no período
              </div>
            ) : (
              [...events].sort((a, b) => a.date.localeCompare(b.date)).map((e) => {
                const m = TYPE_META[e.type] ?? { color: "bg-muted text-foreground border-border", icon: CalendarIcon, label: e.type };
                const Icon = m.icon;
                return (
                  <div key={e.id + e.type} className="surface-card rounded-xl p-3 flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-lg grid place-items-center border ${m.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</div>
                      <div className="font-medium text-sm">{e.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{format(parseISO(e.date), "EEE, dd 'de' MMM", { locale: ptBR })}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {selectedDay && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur" onClick={() => setSelectedDay(null)}>
          <div className="absolute inset-x-0 bottom-0 bg-background rounded-t-2xl border-t border-border max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border sticky top-0 bg-background">
              <div className="font-semibold capitalize">{format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })}</div>
            </div>
            <div className="p-4 space-y-2">
              {dayEvents(selectedDay).length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-6">Nenhum evento</div>
              ) : dayEvents(selectedDay).map((e) => {
                const m = TYPE_META[e.type] ?? { color: "bg-muted text-foreground border-border", icon: CalendarIcon, label: e.type };
                const Icon = m.icon;
                return (
                  <div key={e.id + e.type} className="surface-card rounded-xl p-3 flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-lg grid place-items-center border ${m.color}`}><Icon className="h-5 w-5" /></div>
                    <div className="flex-1">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</div>
                      <div className="font-medium text-sm">{e.title}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <MotoristaBottomNav />
    </div>
  );
}