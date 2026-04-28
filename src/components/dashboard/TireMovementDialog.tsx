import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { MOVEMENT_TYPES, getLayoutPositions, AxleLayout } from "@/lib/tires";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  tire: any;                 // tire being moved
  vehicles: any[];           // [{id, plate, current_km, layout?, custom_positions?}]
  layouts: Record<string, { layout: AxleLayout; positions: string[] }>;
  onSaved: () => void;
  defaultMovement?: string;
  defaultVehicleId?: string;
}

export default function TireMovementDialog({
  open, onOpenChange, tire, vehicles, layouts, onSaved, defaultMovement, defaultVehicleId,
}: Props) {
  const { currentCompanyId, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({
    movement_type: defaultMovement ?? "instalacao",
    vehicle_id: defaultVehicleId ?? "",
    to_position: "",
    vehicle_km: "",
    tread_mm: "",
    pressure_psi: "",
    cost: "",
    reason: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm((f: any) => ({
      ...f,
      movement_type: defaultMovement ?? "instalacao",
      vehicle_id: defaultVehicleId ?? tire?.current_vehicle_id ?? "",
      to_position: "",
      tread_mm: tire?.current_tread_mm != null ? String(tire.current_tread_mm) : "",
    }));
  }, [open, tire, defaultMovement, defaultVehicleId]);

  const v = vehicles.find((x) => x.id === form.vehicle_id);
  const layoutInfo = v ? layouts[v.id] : null;
  const positions = layoutInfo ? getLayoutPositions(layoutInfo.layout, layoutInfo.positions) : [];

  const needsPosition = ["instalacao", "rodizio"].includes(form.movement_type);
  const needsVehicle = ["instalacao", "remocao", "rodizio", "calibragem", "inspecao"].includes(form.movement_type);

  // Auto-suggest km from vehicle current_km
  useEffect(() => {
    if (v && !form.vehicle_km) {
      setForm((f: any) => ({ ...f, vehicle_km: String(v.current_km ?? "") }));
    }
  }, [v?.id]); // eslint-disable-line

  const submit = async () => {
    if (!currentCompanyId || !tire) return;
    if (needsVehicle && !form.vehicle_id) return toast.error("Selecione o veículo");
    if (needsPosition && !form.to_position) return toast.error("Selecione a posição");

    setBusy(true);

    // Calculate KM run since last installation if removing/recapagem
    let extraKm = 0;
    if (["remocao", "recapagem"].includes(form.movement_type) && tire.current_vehicle_id) {
      const { data: lastInstall } = await supabase
        .from("tire_movements")
        .select("vehicle_km")
        .eq("tire_id", tire.id)
        .eq("movement_type", "instalacao")
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const startKm = lastInstall?.vehicle_km ?? 0;
      const endKm = Number(form.vehicle_km) || 0;
      if (endKm > startKm) extraKm = endKm - startKm;
    }

    const payload: any = {
      company_id: currentCompanyId,
      tire_id: tire.id,
      vehicle_id: form.vehicle_id || null,
      movement_type: form.movement_type,
      from_position: tire.current_position || null,
      to_position: needsPosition ? form.to_position : null,
      vehicle_km: form.vehicle_km ? Number(form.vehicle_km) : null,
      tread_mm: form.tread_mm ? Number(form.tread_mm) : null,
      pressure_psi: form.pressure_psi ? Number(form.pressure_psi) : null,
      cost: form.cost ? Number(form.cost) : null,
      reason: form.reason || null,
      notes: form.notes || null,
      created_by: user?.id ?? null,
    };

    const { error } = await supabase.from("tire_movements").insert(payload);
    if (error) { setBusy(false); return toast.error(error.message); }

    if (extraKm > 0) {
      await supabase.from("tires").update({
        km_accumulated: (tire.km_accumulated ?? 0) + extraKm,
      }).eq("id", tire.id);
    }

    setBusy(false);
    toast.success("Movimentação registrada");
    onSaved(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            Movimentar pneu {tire?.brand} {tire?.size}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Tipo de movimentação</Label>
            <Select value={form.movement_type} onValueChange={(v) => setForm((f: any) => ({ ...f, movement_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MOVEMENT_TYPES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {needsVehicle && (
            <div className="md:col-span-2">
              <Label>Veículo</Label>
              <Select value={form.vehicle_id} onValueChange={(v) => setForm((f: any) => ({ ...f, vehicle_id: v, to_position: "" }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {v && !layoutInfo && needsPosition && (
                <p className="text-[11px] text-warning mt-1">Defina o layout de eixos deste veículo na aba Mapa.</p>
              )}
            </div>
          )}

          {needsPosition && positions.length > 0 && (
            <div className="md:col-span-2">
              <Label>Posição destino</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {positions.map((p) => (
                  <button key={p} type="button"
                    onClick={() => setForm((f: any) => ({ ...f, to_position: p }))}
                    className={`px-3 py-1.5 rounded-md border text-xs font-mono transition ${form.to_position === p ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/40"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div><Label>KM do veículo</Label><Input type="number" value={form.vehicle_km} onChange={(e) => setForm((f: any) => ({ ...f, vehicle_km: e.target.value }))} /></div>
          <div><Label>Sulco medido (mm)</Label><Input type="number" step="0.1" value={form.tread_mm} onChange={(e) => setForm((f: any) => ({ ...f, tread_mm: e.target.value }))} /></div>
          <div><Label>Pressão (PSI)</Label><Input type="number" value={form.pressure_psi} onChange={(e) => setForm((f: any) => ({ ...f, pressure_psi: e.target.value }))} /></div>
          <div><Label>Custo (R$)</Label><Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm((f: any) => ({ ...f, cost: e.target.value }))} /></div>

          <div className="md:col-span-2">
            <Label>Motivo / observação</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy} className="bg-gradient-primary text-primary-foreground">
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}