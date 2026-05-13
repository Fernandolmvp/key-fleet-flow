import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  FINE_TYPES, FINE_SEVERITY_DEFAULT_POINTS,
  type FineRecordType, type FineSeverity, type TrafficFine,
} from "@/lib/fines";

type Props = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  onSaved: () => void;
  fine?: TrafficFine | null;
  initialData?: any | null; // dados extraídos pela IA (chaves PT)
  initialPhotoUrl?: string | null;
  aiConfidence?: number | null;
};

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export default function FineFormDialog({ open, onClose, companyId, onSaved, fine, initialData, initialPhotoUrl, aiConfidence }: Props) {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const ai = initialData ?? {};
  const aiTipo = (ai.tipo === "aviso") ? "aviso" : (ai.tipo === "notificacao" ? "multa" : null);
  const initialRecord: FineRecordType = (fine?.record_type ?? aiTipo ?? "multa") as FineRecordType;

  const [form, setForm] = useState<any>({
    record_type: initialRecord,
    vehicle_id: fine?.vehicle_id ?? "",
    driver_id: fine?.driver_id ?? "",
    infraction_date: fine?.infraction_date ?? ai.data_infracao ?? new Date().toISOString().slice(0,10),
    infraction_time: fine?.infraction_time ?? ai.hora_infracao ?? "",
    location: fine?.location ?? ai.local ?? "",
    city: fine?.city ?? ai.cidade ?? "",
    state: fine?.state ?? ai.estado ?? "",
    fine_type: fine?.fine_type ?? ai.tipo_infracao ?? "",
    fine_code: fine?.fine_code ?? ai.codigo_ctb ?? "",
    description: fine?.description ?? ai.descricao ?? "",
    severity: (fine?.severity ?? ai.gravidade ?? "") as FineSeverity | "",
    equipment: fine?.equipment ?? ai.equipamento ?? "",
    notification_number: fine?.notification_number ?? ai.numero_ait ?? "",
    notification_received_date: fine?.notification_received_date ?? "",
    amount: fine?.amount ?? ai.valor ?? "",
    discount_amount: fine?.discount_amount ?? ai.valor_desconto ?? "",
    license_points: fine?.license_points ?? ai.pontos_cnh ?? (ai.gravidade ? FINE_SEVERITY_DEFAULT_POINTS[ai.gravidade as FineSeverity] : 0),
    due_date: fine?.due_date ?? ai.data_vencimento ?? "",
    recourse_deadline: fine?.recourse_deadline ?? ai.prazo_recurso ?? "",
    driver_indication_deadline: fine?.driver_indication_deadline ?? ai.prazo_indicacao ?? "",
    notes: fine?.notes ?? "",
  });

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data: vs } = await supabase.from("vehicles")
        .select("id,plate,brand,model").eq("company_id", companyId).order("plate");
      setVehicles(vs ?? []);
      const { data: ds } = await supabase.from("drivers")
        .select("id,full_name").eq("company_id", companyId).order("full_name");
      setDrivers(ds ?? []);

      // Se IA trouxe placa, tenta auto-selecionar
      if (!fine?.vehicle_id && ai?.placa && vs?.length) {
        const target = norm(String(ai.placa));
        const match = vs.find((v: any) => norm(v.plate) === target);
        if (match) setForm((f: any) => ({ ...f, vehicle_id: match.id }));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, open]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const computeStatus = (rt: FineRecordType): string => {
    if (rt === "aviso") return "aviso_recebido";
    if (form.notification_number || form.amount) return "aguardando_indicacao";
    return "multa_autuada";
  };

  const save = async () => {
    if (!form.vehicle_id) { toast({ title: "Selecione o veículo", variant: "destructive" }); return; }
    if (!form.infraction_date) { toast({ title: "Informe a data da infração", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload: any = {
        company_id: companyId,
        vehicle_id: form.vehicle_id,
        driver_id: form.driver_id || null,
        record_type: form.record_type,
        status: fine?.status ?? computeStatus(form.record_type),
        infraction_date: form.infraction_date,
        infraction_time: form.infraction_time || null,
        location: form.location || null,
        city: form.city || null,
        state: form.state || null,
        fine_type: form.fine_type || null,
        fine_code: form.fine_code || null,
        description: form.description || null,
        severity: form.severity || null,
        equipment: form.equipment || null,
        notification_number: form.notification_number || null,
        notification_received_date: form.notification_received_date || null,
        amount: form.amount === "" ? null : Number(form.amount),
        discount_amount: form.discount_amount === "" ? null : Number(form.discount_amount),
        license_points: Number(form.license_points || 0),
        due_date: form.due_date || null,
        recourse_deadline: form.recourse_deadline || null,
        driver_indication_deadline: form.driver_indication_deadline || null,
        notes: form.notes || null,
      };
      if (!fine) {
        payload.created_by = user?.id ?? null;
        if (initialData) {
          payload.ai_extracted = initialData;
          payload.ai_confidence = aiConfidence ?? initialData?.confianca_extracao ?? null;
          payload.external_source = "ia_foto";
          if (initialPhotoUrl) {
            if (form.record_type === "aviso") payload.aviso_photo_url = initialPhotoUrl;
            else payload.notification_photo_url = initialPhotoUrl;
          }
        }
        const { error } = await supabase.from("traffic_fines").insert(payload);
        if (error) throw error;
        toast({ title: "Registro criado" });
      } else {
        payload.updated_by = user?.id ?? null;
        const { error } = await supabase.from("traffic_fines").update(payload).eq("id", fine.id);
        if (error) throw error;
        toast({ title: "Registro atualizado" });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {fine ? "Editar registro" : "Novo registro"}
            {aiConfidence != null && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                🤖 IA — confiança {Math.round(aiConfidence)}%
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={form.record_type} onValueChange={(v) => set("record_type", v)}>
          <TabsList>
            <TabsTrigger value="aviso">📬 Aviso</TabsTrigger>
            <TabsTrigger value="multa">🚓 Notificação / Multa</TabsTrigger>
          </TabsList>

          {/* Comum: dados da infração */}
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            <div>
              <Label>Veículo *</Label>
              <Select value={form.vehicle_id} onValueChange={(v) => set("vehicle_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.plate} — {[v.brand,v.model].filter(Boolean).join(" ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motorista (opcional)</Label>
              <Select value={form.driver_id || "_none"} onValueChange={(v) => set("driver_id", v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Não definido —</SelectItem>
                  {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data da infração *</Label>
              <Input type="date" value={form.infraction_date} onChange={e => set("infraction_date", e.target.value)} />
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={form.infraction_time} onChange={e => set("infraction_time", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Local</Label>
              <Input value={form.location} onChange={e => set("location", e.target.value)} placeholder="Av. Paulista, 1000" />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={form.city} onChange={e => set("city", e.target.value)} />
            </div>
            <div>
              <Label>UF</Label>
              <Input maxLength={2} value={form.state} onChange={e => set("state", e.target.value.toUpperCase())} />
            </div>
            <div>
              <Label>Tipo de infração</Label>
              <Select value={form.fine_type || "_none"} onValueChange={(v) => set("fine_type", v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {FINE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Código CTB</Label>
              <Input value={form.fine_code} onChange={e => set("fine_code", e.target.value)} placeholder="501-00" />
            </div>
            <div>
              <Label>Gravidade</Label>
              <Select value={form.severity || "_none"} onValueChange={(v) => {
                const sev = v === "_none" ? "" : v;
                set("severity", sev);
                if (sev) set("license_points", FINE_SEVERITY_DEFAULT_POINTS[sev as FineSeverity]);
              }}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  <SelectItem value="leve">Leve</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="grave">Grave</SelectItem>
                  <SelectItem value="gravissima">Gravíssima</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Equipamento</Label>
              <Input value={form.equipment} onChange={e => set("equipment", e.target.value)} placeholder="radar, agente..." />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.description} onChange={e => set("description", e.target.value)} />
            </div>
          </div>

          <TabsContent value="multa" className="mt-4">
            <h4 className="font-semibold text-sm text-muted-foreground mb-2">Dados da notificação oficial</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Nº AIT</Label>
                <Input value={form.notification_number} onChange={e => set("notification_number", e.target.value)} />
              </div>
              <div>
                <Label>Data de recebimento da notificação</Label>
                <Input type="date" value={form.notification_received_date} onChange={e => set("notification_received_date", e.target.value)} />
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} />
              </div>
              <div>
                <Label>Valor com desconto (R$)</Label>
                <Input type="number" step="0.01" value={form.discount_amount} onChange={e => set("discount_amount", e.target.value)} />
              </div>
              <div>
                <Label>Pontos na CNH</Label>
                <Input type="number" min={0} value={form.license_points} onChange={e => set("license_points", e.target.value)} />
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} />
              </div>
              <div>
                <Label>Prazo de recurso</Label>
                <Input type="date" value={form.recourse_deadline} onChange={e => set("recourse_deadline", e.target.value)} />
              </div>
              <div>
                <Label>Prazo de indicação do motorista</Label>
                <Input type="date" value={form.driver_indication_deadline} onChange={e => set("driver_indication_deadline", e.target.value)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="aviso" className="mt-4">
            <p className="text-sm text-muted-foreground">
              Aviso é a comunicação inicial recebida pelo proprietário, ainda sem AIT, valor ou prazos.
              Quando chegar a notificação oficial, abra este registro e use <strong>Converter em Multa</strong>.
            </p>
          </TabsContent>
        </Tabs>

        <div className="mt-4">
          <Label>Observações internas</Label>
          <Textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}