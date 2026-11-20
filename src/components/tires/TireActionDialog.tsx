import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getLayoutPositions, AxleLayout } from "@/lib/tires";
import { kmSinceBaseline, freePositions, MovementLite } from "@/lib/tire-ops";
import { parseTread, defaultLayoutForVehicleType, positionLabel } from "@/lib/tread-measurement";
import { localTodayIso } from "@/lib/document-urgency";

export type TireAction = "instalacao" | "rodizio" | "remocao" | "recapagem" | "descarte";

export const ACTION_TITLE: Record<TireAction, string> = {
  instalacao: "Instalar pneu",
  rodizio: "Rodízio",
  remocao: "Remover para estoque",
  recapagem: "Enviar para recapagem",
  descarte: "Descartar pneu",
};

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  action: TireAction;
  tire?: any | null;
  vehicleId?: string | null;
  position?: string | null;
  tires: any[];
  vehicles: any[];
  layouts: Record<string, { layout: AxleLayout; positions: string[] }>;
  onSaved: () => void;
}

export function positionsForVehicle(v: any, layouts: Props["layouts"]): string[] {
  if (!v) return [];
  const l = layouts[v.id];
  return l ? getLayoutPositions(l.layout, l.positions) : getLayoutPositions(defaultLayoutForVehicleType(v.vehicle_type));
}

export default function TireActionDialog({ open, onOpenChange, action, tire, vehicleId, position, tires, vehicles, layouts, onSaved }: Props) {
  const { currentCompanyId, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [plate, setPlate] = useState("");
  const [pos, setPos] = useState("");
  const [tireId, setTireId] = useState("");
  const [search, setSearch] = useState("");
  const [createNew, setCreateNew] = useState(false);
  const [nb, setNb] = useState({ brand: "", size: "", kind: "novo" });
  const [km, setKm] = useState("");
  const [tread, setTread] = useState("");
  const [date, setDate] = useState(localTodayIso());

  const vehicle = useMemo(() => {
    const id = vehicleId ?? tire?.current_vehicle_id;
    if (id) return vehicles.find((v) => v.id === id) ?? null;
    const p = plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return vehicles.find((v) => String(v.plate).replace(/[^A-Z0-9]/gi, "").toUpperCase() === p) ?? null;
  }, [vehicleId, tire, plate, vehicles]);

  useEffect(() => {
    if (!open) return;
    setPlate(""); setPos(position ?? ""); setTireId(tire?.id ?? ""); setSearch(""); setCreateNew(false);
    setNb({ brand: "", size: "", kind: "novo" }); setDate(localTodayIso());
    setTread(tire?.current_tread_mm != null ? String(tire.current_tread_mm).replace(".", ",") : "");
  }, [open, tire, position]);

  useEffect(() => { setKm(vehicle?.current_km != null ? String(vehicle.current_km) : ""); }, [vehicle?.id, open]);

  const occupied = useMemo(() => {
    const m: Record<string, any> = {};
    if (vehicle) tires.filter((t) => t.status === "instalado" && t.current_vehicle_id === vehicle.id && t.current_position)
      .forEach((t) => { m[t.current_position] = t; });
    return m;
  }, [tires, vehicle]);
  const allPos = positionsForVehicle(vehicle, layouts);
  const free = freePositions(allPos, occupied);
  const stock = tires.filter((t) => t.status === "estoque" &&
    [t.brand, t.model, t.size, t.serial, t.dot].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase()));

  const needsPlate = action === "instalacao" && !vehicleId;
  const needsTire = action === "instalacao" && !tire;

  const baselines = async (ids: string[]): Promise<MovementLite[]> => {
    const { data, error } = await supabase.from("tire_movements")
      .select("tire_id,movement_type,vehicle_id,vehicle_km,occurred_at")
      .in("tire_id", ids).in("movement_type", ["instalacao", "rodizio"]);
    if (error) throw error;
    return (data ?? []) as MovementLite[];
  };

  const save = async () => {
    if (!currentCompanyId) return;
    if (!vehicle) return toast.error("Informe uma placa válida");
    const kmNum = km.trim() === "" ? null : Number(km.replace(/\./g, "").replace(",", "."));
    if (kmNum != null && (!Number.isFinite(kmNum) || kmNum < 0)) return toast.error("KM inválido");
    const treadNum = tread.trim() === "" ? null : parseTread(tread);
    if (tread.trim() !== "" && treadNum == null) return toast.error("Sulco inválido");
    const occurred_at = new Date(`${date}T12:00:00`).toISOString();
    const base = { company_id: currentCompanyId, created_by: user?.id ?? null, vehicle_id: vehicle.id, vehicle_km: kmNum, occurred_at };
    setBusy(true);
    try {
      if (action === "instalacao") {
        if (!pos) throw new Error("Escolha a posição");
        if (occupied[pos]) throw new Error("Essa posição já está ocupada");
        let id = tire?.id ?? tireId;
        if (!id && createNew) {
          if (!nb.brand.trim() || !nb.size.trim()) throw new Error("Informe marca e medida");
          const { data, error } = await supabase.from("tires").insert({
            company_id: currentCompanyId, created_by: user?.id ?? null, brand: nb.brand.trim(), size: nb.size.trim(),
            kind: nb.kind as any, status: "estoque", initial_tread_mm: treadNum, current_tread_mm: treadNum, min_tread_mm: 1.6,
          }).select("id").single();
          if (error) throw error;
          id = data.id;
        }
        if (!id) throw new Error("Escolha um pneu do estoque");
        const { error } = await supabase.from("tire_movements").insert({ ...base, tire_id: id, movement_type: "instalacao", to_position: pos, tread_mm: treadNum });
        if (error) throw error;
        if (treadNum != null) await supabase.from("tires").update({ last_measured_at: occurred_at }).eq("id", id);
      } else if (action === "rodizio") {
        if (!pos || pos === tire.current_position) throw new Error("Escolha a nova posição");
        const other = occupied[pos];
        const mvs = await baselines(other ? [tire.id, other.id] : [tire.id]);
        const add = (t: any) => kmSinceBaseline(mvs, t.id, vehicle.id, kmNum);
        for (const t of other ? [tire, other] : [tire]) {
          const { error } = await supabase.from("tires").update({ km_accumulated: Number(t.km_accumulated ?? 0) + add(t) }).eq("id", t.id);
          if (error) throw error;
        }
        // Move first to a temporary-free state: tire A to pos, then B to A's old position.
        const from = tire.current_position;
        const r1 = await supabase.from("tire_movements").insert({ ...base, tire_id: tire.id, movement_type: "rodizio", from_position: from, to_position: pos });
        if (r1.error) throw r1.error;
        if (other) {
          const r2 = await supabase.from("tire_movements").insert({ ...base, tire_id: other.id, movement_type: "rodizio", from_position: pos, to_position: from });
          if (r2.error) throw r2.error;
        }
      } else {
        const mvs = await baselines([tire.id]);
        const add = kmSinceBaseline(mvs, tire.id, vehicle.id, kmNum);
        const { error: e1 } = await supabase.from("tires").update({ km_accumulated: Number(tire.km_accumulated ?? 0) + add }).eq("id", tire.id);
        if (e1) throw e1;
        const { error } = await supabase.from("tire_movements").insert({
          ...base, tire_id: tire.id, movement_type: action, from_position: tire.current_position,
          tread_mm: action === "descarte" ? null : treadNum,
        });
        if (error) throw error;
      }
      toast.success(`${ACTION_TITLE[action]}: registrado`);
      onOpenChange(false); onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar");
    } finally { setBusy(false); }
  };

  const rotationTargets = allPos.filter((p) => p !== tire?.current_position);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{ACTION_TITLE[action]}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {tire && (
            <div className="text-sm rounded-md bg-muted/30 p-2">
              <span className="font-medium">{tire.brand} {tire.model ?? ""}</span> · <span className="font-mono">{tire.size}</span>
              {tire.serial && <span className="text-muted-foreground"> · {tire.serial}</span>}
              {tire.current_position && vehicle && <div className="text-xs text-muted-foreground">{vehicle.plate} · {positionLabel(tire.current_position)}</div>}
            </div>
          )}
          {needsPlate && (
            <div>
              <Label>Placa</Label>
              <Input list="tire-action-plates" value={plate} onChange={(e) => { setPlate(e.target.value.toUpperCase()); setPos(""); }} placeholder="ABC1D23" autoFocus />
              <datalist id="tire-action-plates">{vehicles.map((v) => <option key={v.id} value={v.plate}>{v.brand} {v.model}</option>)}</datalist>
              {plate && !vehicle && <p className="text-xs text-destructive mt-1">Placa não encontrada</p>}
            </div>
          )}
          {action === "instalacao" && !position && vehicle && (
            <div>
              <Label>Posição livre</Label>
              {free.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma posição livre neste veículo.</p> : (
                <Select value={pos} onValueChange={setPos}>
                  <SelectTrigger><SelectValue placeholder="Escolher posição" /></SelectTrigger>
                  <SelectContent>{free.map((p) => <SelectItem key={p} value={p}>{positionLabel(p)} ({p})</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          )}
          {action === "instalacao" && position && vehicle && (
            <p className="text-sm">Posição: <span className="font-medium">{positionLabel(position)}</span> <span className="font-mono text-xs text-muted-foreground">({position})</span> · {vehicle.plate}</p>
          )}
          {needsTire && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{createNew ? "Cadastrar e instalar" : "Pneu do estoque"}</Label>
                <Button type="button" size="sm" variant="link" className="h-auto p-0" onClick={() => { setCreateNew(!createNew); setTireId(""); }}>
                  {createNew ? "Escolher do estoque" : "Cadastrar e instalar"}
                </Button>
              </div>
              {createNew ? (
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Marca" value={nb.brand} onChange={(e) => setNb({ ...nb, brand: e.target.value })} />
                  <Input placeholder="Medida" value={nb.size} onChange={(e) => setNb({ ...nb, size: e.target.value })} />
                </div>
              ) : (
                <>
                  <Input placeholder="Buscar marca, medida, serial..." value={search} onChange={(e) => setSearch(e.target.value)} />
                  <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
                    {stock.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Nenhum pneu em estoque encontrado.</p> :
                      stock.slice(0, 50).map((t) => (
                        <button key={t.id} type="button" onClick={() => { setTireId(t.id); if (t.current_tread_mm != null) setTread(String(t.current_tread_mm).replace(".", ",")); }}
                          className={`w-full text-left p-2 text-sm hover:bg-muted/40 ${tireId === t.id ? "bg-primary/10" : ""}`}>
                          <span className="font-medium">{t.brand} {t.model ?? ""}</span> · <span className="font-mono text-xs">{t.size}</span>
                          <span className="text-xs text-muted-foreground"> {t.serial ?? ""} {t.current_tread_mm != null ? `· ${t.current_tread_mm} mm` : ""}</span>
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}
          {action === "rodizio" && (
            <div>
              <Label>Nova posição</Label>
              <Select value={pos} onValueChange={setPos}>
                <SelectTrigger><SelectValue placeholder="Escolher posição" /></SelectTrigger>
                <SelectContent>{rotationTargets.map((p) => (
                  <SelectItem key={p} value={p}>{positionLabel(p)} ({p}) {occupied[p] ? `· trocar com ${occupied[p].brand} ${occupied[p].serial ?? ""}` : "· vazia"}</SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><Label>KM do veículo</Label><Input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} /></div>
            <div><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            {action !== "rodizio" && action !== "descarte" && (
              <div><Label>Sulco (mm)</Label><Input inputMode="decimal" value={tread} onChange={(e) => setTread(e.target.value)} placeholder="Ex.: 8,5" /></div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
