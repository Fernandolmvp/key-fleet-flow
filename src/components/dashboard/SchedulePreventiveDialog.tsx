import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  vehicleId: string | null;
  vehiclePlate?: string;
  targetKm?: number | null;
  onSaved: () => void;
}

export default function SchedulePreventiveDialog({ open, onOpenChange, vehicleId, vehiclePlate, targetKm, onSaved }: Props) {
  const { currentCompanyId, user } = useAuth();
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("09:00");
  const [workshopId, setWorkshopId] = useState<string>("none");
  const [workshops, setWorkshops] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate("");
    setTime("09:00");
    setWorkshopId("none");
    if (!currentCompanyId) return;
    supabase
      .from("workshops")
      .select("id,name,trade_name")
      .eq("company_id", currentCompanyId)
      .eq("status", "ativa" as any)
      .then(({ data }) => setWorkshops((data ?? []).map((w: any) => ({ id: w.id, name: w.trade_name || w.name }))));
  }, [open, currentCompanyId]);

  const submit = async () => {
    if (!currentCompanyId || !vehicleId) return;
    if (!date) return toast.error("Escolha a data");
    setBusy(true);
    const desc = targetKm ? `Preventiva ~${targetKm.toLocaleString("pt-BR")}km` : "Preventiva agendada";
    const { error } = await supabase.from("maintenance_schedules").insert({
      company_id: currentCompanyId,
      vehicle_id: vehicleId,
      type: "preventiva",
      category: "Preventiva",
      description: desc,
      target_km: targetKm ?? null,
      target_date: date,
      scheduled_time: time || null,
      scheduled_workshop_id: workshopId !== "none" ? workshopId : null,
      status: "pendente",
      created_by: user?.id ?? null,
    } as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Preventiva agendada");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar preventiva {vehiclePlate ? `· ${vehiclePlate}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {targetKm != null && (
            <div className="text-xs text-muted-foreground">KM alvo: <span className="font-mono">{targetKm.toLocaleString("pt-BR")}</span></div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hora</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Oficina (opcional)</Label>
            <Select value={workshopId} onValueChange={setWorkshopId}>
              <SelectTrigger><SelectValue placeholder="Sem oficina definida" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem oficina definida</SelectItem>
                {workshops.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy} className="bg-gradient-primary text-primary-foreground">
            {busy ? "Agendando..." : "Confirmar agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}