import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { upsertRouting, type Model, type Provider, type Routing } from "@/lib/ai-admin";

export default function RoutingDialog({
  open, routing, models, providers, onClose, onSaved,
}: {
  open: boolean;
  routing: Routing | null;
  models: Model[];
  providers: Provider[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [feature, setFeature] = useState("");
  const [primaryId, setPrimaryId] = useState("");
  const [fallbackId, setFallbackId] = useState<string>("none");
  const [estimated, setEstimated] = useState("1000");
  const [saving, setSaving] = useState(false);

  const activeModels = models.filter((m) => m.active);

  useEffect(() => {
    if (open) {
      setFeature(routing?.feature ?? "");
      setPrimaryId(routing?.primary_model_id ?? activeModels[0]?.id ?? "");
      setFallbackId(routing?.fallback_model_id ?? "none");
      setEstimated(String(routing?.estimated_tokens ?? 1000));
    }
  }, [open, routing]);

  const providerLabel = (m: Model) => providers.find((p) => p.id === m.provider_id)?.name ?? "?";

  const save = async () => {
    if (!feature.trim() || !primaryId) {
      toast.error("Feature e modelo primário são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      await upsertRouting({
        id: routing?.id,
        feature: feature.trim(),
        primary_model_id: primaryId,
        fallback_model_id: fallbackId === "none" ? null : fallbackId,
        estimated_tokens: Math.max(1, Number(estimated) || 1000),
      });
      toast.success("Roteamento salvo");
      onSaved(); onClose();
    } catch (e: any) { toast.error(e?.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{routing ? "Editar roteamento" : "Novo roteamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Feature</label>
            <Input value={feature} onChange={(e) => setFeature(e.target.value)} placeholder="ex: extract_insurance_policy" disabled={!!routing} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Modelo primário</label>
            <Select value={primaryId} onValueChange={setPrimaryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {activeModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{providerLabel(m)} · {m.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Modelo fallback (opcional)</label>
            <Select value={fallbackId} onValueChange={setFallbackId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem fallback —</SelectItem>
                {activeModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{providerLabel(m)} · {m.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Estimativa de tokens</label>
            <Input type="number" value={estimated} onChange={(e) => setEstimated(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}