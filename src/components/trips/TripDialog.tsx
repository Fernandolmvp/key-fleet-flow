import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TRIP_TYPES } from "@/lib/trips";
import { toast } from "sonner";

export default function TripDialog({
  open, onOpenChange, drivers, vehicles, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; drivers: any[]; vehicles: any[]; onSaved: () => void }) {
  const { currentCompanyId, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({
    title: "", description: "", trip_type: "entrega",
    driver_id: "", vehicle_id: "",
    origin_city: "", origin_state: "", destination_city: "", destination_state: "",
    scheduled_start_date: new Date().toISOString().slice(0, 10),
    scheduled_end_date: "",
    estimated_km: "", budget_total: "",
  });

  useEffect(() => {
    if (open) setF((p: any) => ({ ...p, title: "", destination_city: "", destination_state: "" }));
  }, [open]);

  const save = async () => {
    if (!currentCompanyId || !f.title || !f.driver_id || !f.scheduled_start_date) {
      return toast.error("Preencha título, motorista e data de início.");
    }
    setBusy(true);
    const { error } = await supabase.from("trips").insert({
      company_id: currentCompanyId,
      title: f.title, description: f.description || null,
      trip_type: f.trip_type,
      driver_id: f.driver_id, vehicle_id: f.vehicle_id || null,
      origin_city: f.origin_city || null, origin_state: f.origin_state || null,
      destination_city: f.destination_city || null, destination_state: f.destination_state || null,
      scheduled_start_date: f.scheduled_start_date,
      scheduled_end_date: f.scheduled_end_date || null,
      estimated_km: f.estimated_km ? Number(f.estimated_km) : null,
      budget_total: f.budget_total ? Number(f.budget_total) : null,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Viagem programada!");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Nova viagem</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Título *</Label>
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex: Entrega São Paulo" />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={f.trip_type} onValueChange={(v) => setF({ ...f, trip_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TRIP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Motorista *</Label>
            <Select value={f.driver_id} onValueChange={(v) => setF({ ...f, driver_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Veículo</Label>
            <Select value={f.vehicle_id} onValueChange={(v) => setF({ ...f, vehicle_id: v })}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.plate}{v.model ? ` · ${v.model}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Origem (cidade)</Label><Input value={f.origin_city} onChange={(e) => setF({ ...f, origin_city: e.target.value })} /></div>
          <div><Label>UF origem</Label><Input maxLength={2} value={f.origin_state} onChange={(e) => setF({ ...f, origin_state: e.target.value.toUpperCase() })} /></div>
          <div><Label>Destino (cidade)</Label><Input value={f.destination_city} onChange={(e) => setF({ ...f, destination_city: e.target.value })} /></div>
          <div><Label>UF destino</Label><Input maxLength={2} value={f.destination_state} onChange={(e) => setF({ ...f, destination_state: e.target.value.toUpperCase() })} /></div>
          <div><Label>Início *</Label><Input type="date" value={f.scheduled_start_date} onChange={(e) => setF({ ...f, scheduled_start_date: e.target.value })} /></div>
          <div><Label>Término previsto</Label><Input type="date" value={f.scheduled_end_date} onChange={(e) => setF({ ...f, scheduled_end_date: e.target.value })} /></div>
          <div><Label>KM estimado</Label><Input type="number" value={f.estimated_km} onChange={(e) => setF({ ...f, estimated_km: e.target.value })} /></div>
          <div><Label>Orçamento total (R$)</Label><Input type="number" step="0.01" value={f.budget_total} onChange={(e) => setF({ ...f, budget_total: e.target.value })} /></div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>Programar viagem</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}