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
import { upsertModel, type Model, type Provider } from "@/lib/ai-admin";

export default function ModelDialog({
  open, model, providers, onClose, onSaved,
}: {
  open: boolean;
  model: Model | null;
  providers: Provider[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [providerId, setProviderId] = useState("");
  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [type, setType] = useState("text");
  const [inputCost, setInputCost] = useState("0");
  const [outputCost, setOutputCost] = useState("0");
  const [maxTokens, setMaxTokens] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setProviderId(model?.provider_id ?? providers[0]?.id ?? "");
      setModelId(model?.model_id ?? "");
      setDisplayName(model?.display_name ?? "");
      setType(model?.type ?? "text");
      setInputCost(String(model?.input_cost_per_1k_tokens ?? 0));
      setOutputCost(String(model?.output_cost_per_1k_tokens ?? 0));
      setMaxTokens(model?.max_tokens ? String(model.max_tokens) : "");
    }
  }, [open, model, providers]);

  const save = async () => {
    if (!providerId || !modelId.trim() || !displayName.trim()) {
      toast.error("Provedor, model_id e nome são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      await upsertModel({
        id: model?.id,
        provider_id: providerId,
        model_id: modelId.trim(),
        display_name: displayName.trim(),
        type,
        input_cost_per_1k_tokens: Number(inputCost) || 0,
        output_cost_per_1k_tokens: Number(outputCost) || 0,
        max_tokens: maxTokens ? Number(maxTokens) : null,
      });
      toast.success(model ? "Modelo atualizado" : "Modelo criado");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{model ? "Editar modelo" : "Novo modelo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Provedor</label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Model ID</label>
              <Input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="gemini-2.5-pro" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">text</SelectItem>
                  <SelectItem value="vision">vision</SelectItem>
                  <SelectItem value="multimodal">multimodal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Display name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Custo in /1k</label>
              <Input type="number" step="0.000001" value={inputCost} onChange={(e) => setInputCost(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Custo out /1k</label>
              <Input type="number" step="0.000001" value={outputCost} onChange={(e) => setOutputCost(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Max tokens</label>
              <Input type="number" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} />
            </div>
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