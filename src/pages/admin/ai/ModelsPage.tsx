import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Cpu, Plus, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  listModels, listProviders, upsertModel, type Model, type Provider,
} from "@/lib/ai-admin";
import AIAlertsBanner from "./AIAlertsBanner";
import ModelDialog from "./ModelDialog";

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Model | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [m, p] = await Promise.all([listModels(), listProviders()]);
      setModels(m); setProviders(p);
    } catch (e: any) { toast.error(e?.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const providerById = useMemo(() => {
    const map: Record<string, Provider> = {};
    providers.forEach((p) => (map[p.id] = p));
    return map;
  }, [providers]);

  const filtered = providerFilter === "all"
    ? models
    : models.filter((m) => m.provider_id === providerFilter);

  const toggle = async (m: Model, next: boolean) => {
    try {
      await upsertModel({ id: m.id, active: next });
      toast.success(next ? "Modelo ativado" : "Modelo desativado");
      load();
    } catch (e: any) { toast.error(e?.message); }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Cpu className="h-6 w-6 text-primary" /> Modelos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre modelos disponíveis e os custos por mil tokens.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos provedores</SelectItem>
              {providers.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button className="bg-gradient-primary" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Modelo
          </Button>
        </div>
      </div>

      <AIAlertsBanner />

      <div className="surface-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Nenhum modelo encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Provedor</th>
                  <th className="text-left px-4 py-3">Model ID</th>
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-right px-4 py-3">Custo in /1k</th>
                  <th className="text-right px-4 py-3">Custo out /1k</th>
                  <th className="text-right px-4 py-3">Max tok</th>
                  <th className="text-center px-4 py-3">Ativo</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const p = providerById[m.provider_id];
                  return (
                    <tr key={m.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3">{p?.name ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{m.model_id}</td>
                      <td className="px-4 py-3">{m.display_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] uppercase">{m.type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{Number(m.input_cost_per_1k_tokens).toFixed(6)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{Number(m.output_cost_per_1k_tokens).toFixed(6)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{m.max_tokens ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <Switch checked={m.active} onCheckedChange={(v) => toggle(m, v)} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ModelDialog
        open={open}
        model={editing}
        providers={providers}
        onClose={() => setOpen(false)}
        onSaved={load}
      />
    </div>
  );
}