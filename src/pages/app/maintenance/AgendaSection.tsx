import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  List as ListIcon,
  Filter,
  AlertTriangle,
  ExternalLink,
  MapPin,
  Wrench,
  Sparkles,
  Disc,
  FileSearch,
  FileBadge,
  Clock,
  X,
} from "lucide-react";
import {
  ALL_AGENDA_TYPES,
  AgendaEvent,
  AgendaEventType,
  TYPE_META,
  loadAgendaEvents,
} from "@/lib/agenda";
import { supabase } from "@/integrations/supabase/client";

type Mode = "month" | "week" | "list";

export interface UrgentPendency {
  vehicle_id: string;
  plate: string;
  nextKm: number;
  remaining: number;
  overdue: boolean;
}

interface AgendaSectionProps {
  urgentPendencies?: UrgentPendency[];
  onSchedule?: (p: UrgentPendency) => void;
  onQuickRegister?: (p: UrgentPendency) => void;
}

const TYPE_ICON: Record<AgendaEventType, any> = {
  preventiva: Wrench,
  corretiva: Wrench,
  vistoria: FileSearch,
  licenciamento: FileBadge,
  lavagem: Sparkles,
  pneu: Disc,
  outros: CalendarDays,
};

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const startOfWeek = (d: Date) => {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const fmtBRL = (v?: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AgendaSection({ urgentPendencies = [], onSchedule, onQuickRegister }: AgendaSectionProps = {}) {
  const { currentCompanyId } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("month");
  const [listFocus, setListFocus] = useState<"range" | "today">("range");
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => {
      const mob = window.innerWidth < 768;
      setIsMobile(mob);
      if (mob && mode === "month") setMode("list");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [cursor, setCursor] = useState<Date>(new Date());
  const [listRange, setListRange] = useState<"7" | "30" | "90" | "this_month" | "next_month">("30");
  const [types, setTypes] = useState<Set<AgendaEventType>>(new Set(ALL_AGENDA_TYPES));
  const [vehicleQ, setVehicleQ] = useState("");
  const [workshopId, setWorkshopId] = useState<string>("all");
  const [workshops, setWorkshops] = useState<{ id: string; name: string }[]>([]);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AgendaEvent | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Compute fetch range based on mode
  const fetchRange = useMemo(() => {
    if (mode === "month") {
      const s = startOfMonth(cursor);
      const e = endOfMonth(cursor);
      return { from: fmtDate(s), to: fmtDate(e) };
    }
    if (mode === "week") {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      return { from: fmtDate(s), to: fmtDate(e) };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (listFocus === "today") {
      return { from: fmtDate(today), to: fmtDate(today) };
    }
    let s = today;
    let e = today;
    if (listRange === "7") e = addDays(today, 7);
    else if (listRange === "30") e = addDays(today, 30);
    else if (listRange === "90") e = addDays(today, 90);
    else if (listRange === "this_month") {
      s = startOfMonth(today);
      e = endOfMonth(today);
    } else if (listRange === "next_month") {
      const nm = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      s = startOfMonth(nm);
      e = endOfMonth(nm);
    }
    return { from: fmtDate(s), to: fmtDate(e) };
  }, [mode, cursor, listRange, listFocus]);

  useEffect(() => {
    if (!currentCompanyId) return;
    supabase
      .from("workshops")
      .select("id,name,trade_name")
      .eq("company_id", currentCompanyId)
      .eq("status", "ativa" as any)
      .then(({ data }) => {
        setWorkshops((data ?? []).map((w: any) => ({ id: w.id, name: w.trade_name || w.name })));
      });
  }, [currentCompanyId]);

  useEffect(() => {
    if (!currentCompanyId) return;
    setLoading(true);
    loadAgendaEvents(currentCompanyId, fetchRange.from, fetchRange.to)
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [currentCompanyId, fetchRange.from, fetchRange.to]);

  const filtered = useMemo(() => {
    const q = vehicleQ.trim().toLowerCase();
    return events.filter((e) => {
      if (!types.has(e.type)) return false;
      if (q) {
        const blob = `${e.vehicle_plate} ${e.vehicle_model ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (workshopId !== "all" && e.workshop_id !== workshopId) return false;
      return true;
    });
  }, [events, types, vehicleQ, workshopId]);

  const todayISO = fmtDate(new Date());
  const overdueCount = filtered.filter((e) => e.date < todayISO && !e.status_done).length;
  const countsByType = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach((e) => (m[e.type] = (m[e.type] ?? 0) + 1));
    return m;
  }, [filtered]);

  const toggleType = (t: AgendaEventType) => {
    const next = new Set(types);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setTypes(next);
  };
  const resetFilters = () => {
    setTypes(new Set(ALL_AGENDA_TYPES));
    setVehicleQ("");
    setWorkshopId("all");
  };

  const openEvent = (ev: AgendaEvent) => setSelected(ev);

  const FiltersContent = (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium mb-2 text-muted-foreground">Tipos de evento</p>
        <div className="flex flex-wrap gap-2">
          {ALL_AGENDA_TYPES.map((t) => {
            const active = types.has(t);
            const meta = TYPE_META[t];
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`text-xs px-2 py-1 rounded-md border transition ${
                  active ? meta.chipClass : "bg-muted/30 text-muted-foreground border-border opacity-60"
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium mb-2 text-muted-foreground">Veículo</p>
        <Input
          placeholder="Placa ou modelo..."
          value={vehicleQ}
          onChange={(e) => setVehicleQ(e.target.value)}
          className="h-9"
        />
      </div>
      <div>
        <p className="text-xs font-medium mb-2 text-muted-foreground">Local de execução</p>
        <Select value={workshopId} onValueChange={setWorkshopId}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os locais</SelectItem>
            {workshops.map((w) => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button variant="outline" size="sm" onClick={resetFilters} className="w-full">
        <X className="h-3 w-3 mr-1" /> Limpar filtros
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* URGENT PENDENCIES — top of agenda */}
      {urgentPendencies.length > 0 && (
        <div className="surface-card rounded-xl p-4 border border-warning/40 bg-warning/5">
          <h3 className="font-display font-semibold text-sm flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" /> Validar urgente — sem data ({urgentPendencies.length})
          </h3>
          <p className="text-[11px] text-muted-foreground mt-1">Veículos vencidos ou prestes a vencer a preventiva, sem agendamento aberto. Agende ou registre agora.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {urgentPendencies.map((p) => (
              <div
                key={p.vehicle_id}
                className={`rounded-lg p-3 border flex items-center justify-between gap-2 ${
                  p.overdue
                    ? "bg-destructive/10 border-destructive/40"
                    : "bg-warning/10 border-warning/40"
                }`}
              >
                <div className="min-w-0">
                  <div className="font-mono text-primary font-semibold">{p.plate}</div>
                  <div className={`text-[11px] ${p.overdue ? "text-destructive" : "text-warning"}`}>
                    {p.overdue
                      ? `${Math.abs(p.remaining).toLocaleString("pt-BR")} km vencidos`
                      : `Faltam ${p.remaining.toLocaleString("pt-BR")} km`}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Alvo ~{p.nextKm.toLocaleString("pt-BR")} km</div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => onSchedule?.(p)}>
                    <CalendarDays className="h-3 w-3 mr-1" /> Agendar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onQuickRegister?.(p)}>
                    <Wrench className="h-3 w-3 mr-1" /> Registrar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className="surface-card rounded-xl p-4">
        {isMobile ? (
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)}>
              <Filter className="h-4 w-4 mr-2" /> Filtros
            </Button>
            <span className="text-xs text-muted-foreground">{filtered.length} evento(s)</span>
          </div>
        ) : (
          FiltersContent
        )}
      </div>

      {/* Mode switcher + summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-border bg-card overflow-hidden">
          {!isMobile && (
            <button
              onClick={() => setMode("month")}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${mode === "month" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"}`}
            >
              <CalendarDays className="h-4 w-4" /> Mês
            </button>
          )}
          <button
            onClick={() => setMode("week")}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${mode === "week" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"}`}
          >
            <CalendarRange className="h-4 w-4" /> Semana
          </button>
          <button
            onClick={() => setMode("list")}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${mode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"}`}
          >
            <ListIcon className="h-4 w-4" /> Lista
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-mono font-semibold">{filtered.length}</span>
          {Object.entries(countsByType).map(([t, n]) => (
            <Badge key={t} className={`border ${TYPE_META[t as AgendaEventType].chipClass}`}>
              {TYPE_META[t as AgendaEventType].label}: {n}
            </Badge>
          ))}
          {overdueCount > 0 && (
            <Badge className="border bg-destructive/20 text-destructive border-destructive/40">
              <AlertTriangle className="h-3 w-3 mr-1" /> {overdueCount} vencido(s)
            </Badge>
          )}
        </div>
      </div>

      {/* MONTH VIEW */}
      {mode === "month" && (
        <MonthView cursor={cursor} setCursor={setCursor} events={filtered} onOpen={openEvent} />
      )}

      {/* WEEK VIEW */}
      {mode === "week" && (
        <WeekView cursor={cursor} setCursor={setCursor} events={filtered} onOpen={openEvent} />
      )}

      {/* LIST VIEW */}
      {mode === "list" && (
        <div className="space-y-3">
          <div className="surface-card rounded-xl p-3 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md border border-border bg-card overflow-hidden">
              <button
                onClick={() => setListFocus("today")}
                className={`px-3 py-1 text-xs ${listFocus === "today" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"}`}
              >
                Hoje / Dia
              </button>
              <button
                onClick={() => setListFocus("range")}
                className={`px-3 py-1 text-xs ${listFocus === "range" ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"}`}
              >
                Período
              </button>
            </div>
            <span className="text-xs text-muted-foreground">Período:</span>
            <Select value={listRange} onValueChange={(v: any) => setListRange(v)} disabled={listFocus === "today"}>
              <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Próximos 7 dias</SelectItem>
                <SelectItem value="30">Próximos 30 dias</SelectItem>
                <SelectItem value="90">Próximos 90 dias</SelectItem>
                <SelectItem value="this_month">Este mês</SelectItem>
                <SelectItem value="next_month">Próximo mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ListView
            events={
              listFocus === "today"
                ? [...filtered].sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"))
                : filtered
            }
            onOpen={openEvent}
            loading={loading}
          />
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Badge className={`border ${TYPE_META[selected.type].chipClass}`}>
                    {TYPE_META[selected.type].label}
                  </Badge>
                  <Badge variant="outline" className="capitalize">{selected.status?.replace(/_/g, " ")}</Badge>
                </div>
                <SheetTitle className="font-display">
                  {selected.vehicle_plate} <span className="text-muted-foreground text-sm font-normal">{selected.vehicle_model}</span>
                </SheetTitle>
                <SheetDescription className="text-foreground/80">{selected.description}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="font-mono">{new Date(selected.date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</div>
                    {selected.time && <div className="text-xs text-muted-foreground">{selected.time}</div>}
                  </div>
                </div>
                {(selected.local_name || selected.local_address) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{selected.local_name ?? "Local não informado"}</div>
                      {selected.local_address && <div className="text-xs text-muted-foreground">{selected.local_address}</div>}
                    </div>
                  </div>
                )}
                {selected.estimated_value != null && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Valor estimado: </span>
                    <span className="font-mono font-semibold">{fmtBRL(selected.estimated_value)}</span>
                  </div>
                )}
                <Button
                  className="w-full bg-gradient-primary text-primary-foreground"
                  onClick={() => {
                    nav(selected.url);
                    setSelected(null);
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" /> Abrir registro
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Mobile filters drawer */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{FiltersContent}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ---------- MONTH VIEW ---------- */
function MonthView({
  cursor,
  setCursor,
  events,
  onOpen,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  events: AgendaEvent[];
  onOpen: (e: AgendaEvent) => void;
}) {
  const first = startOfMonth(cursor);
  const gridStart = addDays(first, -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const byDate = useMemo(() => {
    const m = new Map<string, AgendaEvent[]>();
    events.forEach((e) => {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    });
    return m;
  }, [events]);
  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const today = new Date();

  return (
    <div className="surface-card rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Hoje</Button>
          <Button size="icon" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="font-display text-lg capitalize">{monthLabel}</div>
        <div className="w-24" />
      </div>
      <div className="grid grid-cols-7 text-xs text-muted-foreground border-b border-border">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="p-2 text-center font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const iso = fmtDate(d);
          const evs = byDate.get(iso) ?? [];
          const otherMonth = d.getMonth() !== cursor.getMonth();
          const isToday = sameDay(d, today);
          return (
            <div
              key={i}
              className={`min-h-[110px] border-r border-b border-border p-1.5 text-xs ${otherMonth ? "bg-muted/10 text-muted-foreground/60" : ""}`}
            >
              <div className={`text-right font-mono mb-1 ${isToday ? "text-primary font-bold" : ""}`}>{d.getDate()}</div>
              <div className="space-y-1">
                {evs.slice(0, 4).map((e) => {
                  const Icon = TYPE_ICON[e.type];
                  return (
                    <button
                      key={e.id}
                      onClick={() => onOpen(e)}
                      className={`w-full text-left px-1.5 py-0.5 rounded border text-[10px] flex items-center gap-1 truncate ${TYPE_META[e.type].chipClass}`}
                    >
                      <Icon className="h-2.5 w-2.5 shrink-0" />
                      <span className="font-mono truncate">{e.vehicle_plate}</span>
                    </button>
                  );
                })}
                {evs.length > 4 && (
                  <Popover>
                    <PopoverTrigger className="text-[10px] text-primary hover:underline">
                      +{evs.length - 4} mais
                    </PopoverTrigger>
                    <PopoverContent className="w-64 space-y-1">
                      {evs.slice(4).map((e) => {
                        const Icon = TYPE_ICON[e.type];
                        return (
                          <button
                            key={e.id}
                            onClick={() => onOpen(e)}
                            className={`w-full text-left px-2 py-1 rounded border text-xs flex items-center gap-1 ${TYPE_META[e.type].chipClass}`}
                          >
                            <Icon className="h-3 w-3" /> <span className="font-mono">{e.vehicle_plate}</span> <span className="truncate text-[10px] opacity-80">{e.description}</span>
                          </button>
                        );
                      })}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- WEEK VIEW ---------- */
function WeekView({
  cursor,
  setCursor,
  events,
  onOpen,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  events: AgendaEvent[];
  onOpen: (e: AgendaEvent) => void;
}) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();

  return (
    <div className="surface-card rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setCursor(addDays(cursor, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Esta semana</Button>
          <Button size="icon" variant="ghost" onClick={() => setCursor(addDays(cursor, 7))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="font-display text-sm">
          {days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — {days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
        </div>
        <div className="w-24" />
      </div>
      <div className="grid grid-cols-7 min-h-[400px]">
        {days.map((d) => {
          const iso = fmtDate(d);
          const evs = events.filter((e) => e.date === iso);
          const isToday = sameDay(d, today);
          return (
            <div key={iso} className="border-r border-border last:border-r-0 p-2">
              <div className={`text-xs font-medium mb-2 pb-2 border-b border-border ${isToday ? "text-primary" : ""}`}>
                <div className="uppercase text-[10px] text-muted-foreground">{d.toLocaleDateString("pt-BR", { weekday: "short" })}</div>
                <div className="font-mono text-base">{d.getDate()}</div>
              </div>
              <div className="space-y-1.5">
                {evs.map((e) => {
                  const Icon = TYPE_ICON[e.type];
                  return (
                    <button
                      key={e.id}
                      onClick={() => onOpen(e)}
                      className={`w-full text-left p-2 rounded border text-xs ${TYPE_META[e.type].chipClass}`}
                    >
                      {e.time && <div className="font-mono text-[10px] opacity-80">{e.time}</div>}
                      <div className="flex items-center gap-1 font-semibold">
                        <Icon className="h-3 w-3" /> {e.vehicle_plate}
                      </div>
                      <div className="text-[10px] opacity-80 truncate">{e.vehicle_model}</div>
                      {e.local_name && <div className="text-[10px] opacity-70 truncate">{e.local_name}</div>}
                    </button>
                  );
                })}
                {evs.length === 0 && <div className="text-[10px] text-muted-foreground/60 italic">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- LIST VIEW ---------- */
function ListView({
  events,
  onOpen,
  loading,
}: {
  events: AgendaEvent[];
  onOpen: (e: AgendaEvent) => void;
  loading: boolean;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const totalPages = Math.ceil(events.length / pageSize) || 1;
  const slice = events.slice(page * pageSize, (page + 1) * pageSize);

  if (loading) return <div className="surface-card rounded-xl p-12 text-center text-muted-foreground">Carregando...</div>;
  if (events.length === 0)
    return (
      <div className="surface-card rounded-xl p-12 text-center">
        <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-display font-semibold">Nenhum evento agendado no período</h3>
        <p className="text-sm text-muted-foreground mt-1">Eventos aparecerão aqui quando tiverem data futura preenchida.</p>
      </div>
    );

  return (
    <div className="surface-card rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data / hora</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Local</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Valor est.</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slice.map((e) => {
            const Icon = TYPE_ICON[e.type];
            return (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">
                  {new Date(e.date + "T00:00:00").toLocaleDateString("pt-BR")}
                  {e.time && <div className="text-[10px] text-muted-foreground">{e.time}</div>}
                </TableCell>
                <TableCell>
                  <div className="font-mono text-primary">{e.vehicle_plate}</div>
                  <div className="text-[10px] text-muted-foreground">{e.vehicle_model}</div>
                </TableCell>
                <TableCell>
                  <Badge className={`border ${TYPE_META[e.type].chipClass}`}>
                    <Icon className="h-3 w-3 mr-1" /> {TYPE_META[e.type].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm max-w-xs truncate">{e.description}</TableCell>
                <TableCell className="text-xs">{e.local_name ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize text-[10px]">{(e.status ?? "").replace(/_/g, " ")}</Badge></TableCell>
                <TableCell className="text-right font-mono text-xs">{fmtBRL(e.estimated_value)}</TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => onOpen(e)}>Ver</Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-3 border-t border-border text-xs">
          <span className="text-muted-foreground">Página {page + 1} de {totalPages}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}