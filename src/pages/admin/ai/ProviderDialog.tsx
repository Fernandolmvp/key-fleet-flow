import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { upsertProvider, type Provider } from "@/lib/ai-admin";

export default function ProviderDialog({
  open, provider, providers, onClose, onSaved,
}: {
  open: boolean;
  provider: Provider | null;
  providers: Provider[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [secretName, setSecretName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(100);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(provider?.name ?? "");
      setCode(provider?.code ?? "");
      setEndpoint(provider?.api_endpoint ?? "");
      setSecretName(provider?.secret_name ?? "");
      setDescription(provider?.description ?? "");
      setPriority(provider?.priority ?? 100);
    }
  }, [open, provider]);

  const save = async () => {
    if (!name.trim() || !code.trim() || !secretName.trim()) {
      toast.error("Nome, code e secret_name são obrigatórios");
      return;
    }
    const dup = providers.find((p) => p.code.toLowerCase() === code.trim().toLowerCase() && p.id !== provider?.id);
    if (dup) { toast.error("Já existe provedor com esse code"); return; }
    setSaving(true);
    try {
      await upsertProvider({
        id: provider?.id,
        name: name.trim(),
        code: code.trim().toLowerCase(),
        api_endpoint: endpoint.trim() || null,
        secret_name: secretName.trim(),
        description: description.trim() || null,
        priority,
      });
      toast.success(provider ? "Provedor atualizado" : "Provedor criado");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{provider ? "Editar provedor" : "Novo provedor"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Google Gemini" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Code (único)</label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="gemini" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Prioridade</label>
              <Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Endpoint</label>
            <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Secret name</label>
            <Input value={secretName} onChange={(e) => setSecretName(e.target.value)} placeholder="GEMINI_API_KEY" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Descrição</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
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