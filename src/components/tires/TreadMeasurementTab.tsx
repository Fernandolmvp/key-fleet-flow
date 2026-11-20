import { useMemo, useRef, useState, KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AxleLayout, getLayoutPositions } from "@/lib/tires";
import {
  parseTread, treadLevel, isAboveLast, groupPositionsByAxle, positionLabel,
  defaultLayoutForVehicleType, normalizePlateInput, buildAutomaticTire,
} from "@/lib/tread-measurement";

interface Props {
  tires: any[];
  vehicles: { id: string; plate: string; brand?: string; model?: string; current_km?: number | null; vehicle_type?: string | null }[];
  layouts: Record<string, { layout: AxleLayout; positions: string[] }>;
  onSaved: () => void | Promise<void>;
}

export default function TreadMeasurementTab({ tires, vehicles, layouts, onSaved }: Props) {
  const { currentCompanyId, user } = useAuth();
  const [plate, setPlate] = useState("");
  const [showSug, setShowSug] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const plateRef = useRef<HTMLInputElement>(null);
  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const suggestions = useMemo(() => {
    const q = normalizePlateInput(plate);
    if (!q) return [];
    return vehicles.filter((v) => normalizePlateInput(v.plate).includes(q)).slice(0, 8);
  }, [plate, vehicles]);

  const positions = useMemo(() => {
    if (!vehicle) return [];
    const l = layouts[vehicle.id];
    if (l) return getLayoutPositions(l.layout, l.positions);
    return getLayoutPositions(defaultLayoutForVehicleType(vehicle.vehicle_type));
  }, [vehicle, layouts]);

  const installed = useMemo(() => {
    const map: Record<string, any> = {};
    tires.filter((t) => t.status === "instalado" && t.current_vehicle_id === vehicleId && t.current_position)
      .forEach((t) => { map[t.current_position] = t; });
    return map;
  }, [tires, vehicleId]);

  const groups = useMemo(() => groupPositionsByAxle(positions), [positions]);
  const order = groups.flatMap((g) => g.positions);

  const selectVehicle = (v: Props["vehicles"][number]) => {
    setVehicleId(v.id); setPlate(v.plate); setShowSug(false); setValues({});
    setTimeout(() => {
      const first = groupPositionsByAxle(getPositionsFor(v)).flatMap((g) => g.positions)[0];
      if (first) fieldRefs.current[first]?.focus();
    }, 50);
  };
  const getPositionsFor = (v: Props["vehicles"][number]) => {
    const l = layouts[v.id];
    return l ? getLayoutPositions(l.layout, l.positions) : getLayoutPositions(defaultLayoutForVehicleType(v.vehicle_type));
  };

  const confirmPlate = () => {
    const q = normalizePlateInput(plate);
    const exact = vehicles.find((v) => normalizePlateInput(v.plate) === q);
    if (exact) return selectVehicle(exact);
    if (suggestions.length === 1) return selectVehicle(suggestions[0]);
    toast.error(q ? "Placa não encontrada na frota" : "Digite a placa");
  };

  const onFieldKey = (e: KeyboardEvent<HTMLInputElement>, pos: string) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const i = order.indexOf(pos);
    if (i < order.length - 1) fieldRefs.current[order[i + 1]]?.focus();
    else save();
  };

  const save = async () => {
    if (busy || !currentCompanyId || !vehicle) return;
    const entries: { tire?: any; pos: string; mm: number }[] = [];
    for (const pos of order) {
      const mm = parseTread(values[pos] ?? "");
      if (mm == null) continue;
      if (Number.isNaN(mm)) {
        fieldRefs.current[pos]?.focus();
        return toast.error(`Valor inválido em ${positionLabel(pos)}`);
      }
      entries.push({ tire: installed[pos], pos, mm });
    }
    if (!entries.length) return toast.error("Informe ao menos uma medição");
    setBusy(true);
    const now = new Date().toISOString();
    const missing = entries.filter((e) => !e.tire);
    const createdByPosition: Record<string, string> = {};

    if (missing.length) {
      const { data: created, error: createError } = await supabase.from("tires").insert(missing.map((e) => buildAutomaticTire({
        companyId: currentCompanyId,
        vehicleId: vehicle.id,
        position: e.pos,
        treadMm: e.mm,
        measuredAt: now,
        createdBy: user?.id,
      }))).select("id,current_position");
      if (createError) {
        setBusy(false);
        return toast.error(`Não foi possível criar os pneus das posições vazias: ${createError.message}`);
      }
      (created ?? []).forEach((t) => { if (t.current_position) createdByPosition[t.current_position] = t.id; });
    }

    const tireIdFor = (e: { tire?: any; pos: string }) => e.tire?.id ?? createdByPosition[e.pos];
    if (entries.some((e) => !tireIdFor(e))) {
      setBusy(false);
      await onSaved();
      return toast.error("Os pneus foram criados, mas não foi possível identificá-los. Recarregue e tente salvar novamente.");
    }

    const { error } = await supabase.from("tire_movements").insert(entries.map((e) => ({
      company_id: currentCompanyId, tire_id: tireIdFor(e), vehicle_id: vehicle.id,
      movement_type: "inspecao" as const, from_position: e.pos, to_position: null,
      occurred_at: now, tread_mm: e.mm, vehicle_km: vehicle.current_km ?? null,
      reason: "Medição de sulco", created_by: user?.id ?? null,
    })));
    if (error) {
      setBusy(false);
      if (missing.length) await onSaved();
      return toast.error(missing.length
        ? `Os pneus foram criados, mas as medições não foram salvas. Tente salvar novamente: ${error.message}`
        : error.message);
    }
    const results = await Promise.all(entries.filter((e) => e.tire).map((e) => supabase.from("tires")
      .update({ current_tread_mm: e.mm, last_measured_at: now })
      .eq("id", e.tire.id).eq("company_id", currentCompanyId)));
    setBusy(false);
    if (results.some((r) => r.error)) toast.error("Medições registradas, mas alguns pneus não tiveram o resumo atualizado");
    else toast.success(`${entries.length} medição(ões) salvas para ${vehicle.plate}${missing.length ? `; ${missing.length} pneu(s) criado(s) automaticamente` : ""}`);
    setValues({}); setVehicleId(""); setPlate("");
    onSaved();
    setTimeout(() => plateRef.current?.focus(), 50);
  };

  const warnings = order.filter((p) => isAboveLast(parseTread(values[p] ?? ""), installed[p]?.current_tread_mm));

  return (
    <div className="space-y-4">
      <div className="surface-card rounded-xl p-4 space-y-2">
        <Label htmlFor="tread-plate">Placa do veículo</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="tread-plate" ref={plateRef} autoFocus autoComplete="off" inputMode="text"
            className="pl-9 font-mono uppercase text-lg h-12" placeholder="ABC1D23"
            value={plate}
            onChange={(e) => { setPlate(e.target.value.toUpperCase()); setShowSug(true); if (vehicleId) setVehicleId(""); }}
            onFocus={() => setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmPlate(); } }}
          />
          {showSug && !vehicleId && suggestions.length > 0 && (
            <ul role="listbox" className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-64 overflow-auto">
              {suggestions.map((v) => (
                <li key={v.id}>
                  <button type="button" role="option" aria-selected={false}
                    className="w-full text-left px-3 py-3 hover:bg-muted/50 flex gap-2 items-center"
                    onMouseDown={(e) => { e.preventDefault(); selectVehicle(v); }}>
                    <span className="font-mono font-semibold">{v.plate}</span>
                    <span className="text-xs text-muted-foreground truncate">{v.brand} {v.model}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {plate && !vehicleId && suggestions.length === 0 && (
          <p className="text-xs text-destructive">Nenhum veículo da frota com essa placa.</p>
        )}
      </div>

      {vehicle && (
        <form className="surface-card rounded-xl p-4 space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-mono font-semibold">{vehicle.plate}</div>
              <div className="text-xs text-muted-foreground">{vehicle.brand} {vehicle.model} · Medição de hoje ({new Date().toLocaleDateString("pt-BR")})</div>
            </div>
            {!layouts[vehicle.id] && <Badge variant="outline">Layout padrão pelo tipo do veículo</Badge>}
          </div>

          {groups.map((g) => (
            <div key={g.axle}>
              <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2">{g.axle}</div>
              <div className={cn("grid gap-2", g.positions.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : g.positions.length === 1 ? "grid-cols-1 max-w-[50%] mx-auto" : "grid-cols-2")}>
                {g.positions.map((p) => {
                  const tire = installed[p];
                  const raw = values[p] ?? "";
                  const mm = parseTread(raw);
                  const level = treadLevel(mm, tire?.min_tread_mm ?? undefined);
                  const above = isAboveLast(mm, tire?.current_tread_mm);
                  return (
                    <div key={p} className={cn("rounded-lg border p-2 space-y-1",
                      level === "critico" ? "border-destructive bg-destructive/10"
                      : level === "atencao" ? "border-warning bg-warning/10"
                      : !tire ? "border-dashed border-border bg-muted/20" : "border-border")}>
                      <Label htmlFor={`tread-${p}`} className="text-xs leading-tight block">{positionLabel(p)}</Label>
                      <Input
                        id={`tread-${p}`} ref={(el) => { fieldRefs.current[p] = el; }}
                        inputMode="decimal" enterKeyHint={order.indexOf(p) === order.length - 1 ? "done" : "next"}
                        autoComplete="off" placeholder="mm"
                        className={cn("h-11 text-lg font-mono", Number.isNaN(mm) && "border-destructive")}
                        value={raw}
                        onChange={(e) => setValues((s) => ({ ...s, [p]: e.target.value.replace(/[^\d.,]/g, "") }))}
                        onKeyDown={(e) => onFieldKey(e, p)}
                      />
                      <div className="text-[11px] text-muted-foreground">
                        Último: <span className="font-mono">{tire?.current_tread_mm != null ? `${String(tire.current_tread_mm).replace(".", ",")} mm` : "—"}</span>
                      </div>
                      {!tire && <div className="text-[11px] text-muted-foreground">Sem pneu cadastrado · será criado ao salvar</div>}
                      {level === "critico" && <div className="text-[11px] text-destructive font-medium">No limite legal (≤ 1,6 mm)</div>}
                      {level === "atencao" && <div className="text-[11px] text-warning font-medium">Perto do limite</div>}
                      {above && <div className="text-[11px] text-warning font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Maior que a última</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {warnings.length > 0 && (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <span>Valor maior que a última medição em: {warnings.map(positionLabel).join(", ")}. Confira antes de salvar.</span>
            </div>
          )}

          <Button type="submit" className="w-full sm:w-auto h-11" disabled={busy || order.length === 0}>
            <Save className="h-4 w-4 mr-2" />{busy ? "Salvando..." : "Salvar medições"}
          </Button>
        </form>
      )}
    </div>
  );
}
