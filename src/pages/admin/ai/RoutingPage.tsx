import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Workflow, Plus, Loader2, Pencil, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  featureLabel, listModels, listProviders, listRouting, upsertRouting,
  type Model, type Provider, type Routing,
} from "@/lib/ai-admin";
import { supabase } from "@/integrations/supabase/client";
import AIAlertsBanner from "./AIAlertsBanner";
import RoutingDialog from "./RoutingDialog";

export default function RoutingPage() {
  const [items, setItems] = useState<Routing[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [averages, setAverages] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Routing | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, m, p] = await Promise.all([listRouting(), listModels(), listProviders()]);
      setItems(r); setModels(m); setProviders(p);

      // média real de tokens por feature (últimos 30 dias, success=true)
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data: logs } = await supabase
        .from("ai_usage_logs")
        .select("feature, tokens_total, success")
        .gte("created_at", since)
        .eq("success", true);
      const sums: Record<string, { sum: number; n: number }> = {};
      (logs ?? []).forEach((row: any) => {
        const f = row.feature;
        const s = (sums[f] ??= { sum: 0, n: 0 });
        s.sum += Number(row.tokens_total) || 0;
        s.n += 1;
      });
      const avg: Record<string, number> = {};
      Object.entries(sums).forEach(([k, v]) => { avg[k] = v.n ? Math.round(v.sum / v.n) : 0; });
      setAverages(avg);
    } catch (e: any) { toast.error(e?.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const modelById = useMemo(() => Object.fromEntries(models.map((m) => [m.id, m])), [models]);
  const providerOf = (modelId: string | null | undefined) => {
    if (!modelId) return null;
    const m = modelById[modelId];
    if (!m) return null;
    return providers.find((p) => p.id === m.provider_id) ?? null;
  };

  const toggle = async (r: Routing, next: boolean) => {
    try {
      await upsertRouting({ id: r.id, active: next });
      toast.success(next ? "Roteamento ativado" : "Roteamento desativado");
      load();
    } catch (e: any) { toast.error(e?.message); }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Workflow className="h-6 w-6 text-primary" /> Roteamento por Feature
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina qual modelo atende cada feature de IA, com fallback opcional.
          </p>
        </div>
        <Button className="bg-gradient-primary" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Roteamento
        </Button>
      </div>

      <AIAlertsBanner />

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      ) : items.length === 0 ? (
        <div className="surface-card rounded-xl p-12 text-center">
          <Workflow className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display font-semibold">Nenhum roteamento configurado</h3>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((r) => {
            const primaryModel = modelById[r.primary_model_id];
            const primaryProvider = providerOf(r.primary_model_id);
            const fallbackModel = r.fallback_model_id ? modelById[r.fallback_model_id] : null;
            const fallbackProvider = providerOf(r.fallback_model_id);
            const avg = averages[r.feature];
            const drift = avg ? Math.abs(avg - r.estimated_tokens) / r.estimated_tokens : 0;
            const showSuggestion = avg && drift > 0.3;
            return (
              <div key={r.id} className="surface-card rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display font-semibold">{featureLabel(r.feature)}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.feature}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${r.active ? "text-success" : "text-muted-foreground"}`}>
                      {r.active ? "Ativo" : "Inativo"}
                    </span>
                    <Switch checked={r.active} onCheckedChange={(v) => toggle(r, v)} />
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <Row label="Primário" value={primaryModel ? `${primaryProvider?.name ?? "?"} · ${primaryModel.display_name}` : "—"} />
                  <Row label="Fallback" value={fallbackModel ? `${fallbackProvider?.name ?? "?"} · ${fallbackModel.display_name}` : "— sem fallback —"} />
                  <Row
                    label="Estimativa"
                    value={
                      <span className="flex items-center gap-1.5">
                        {r.estimated_tokens.toLocaleString("pt-BR")} tok
                        {avg ? (
                          <span className="text-muted-foreground">· média real {avg.toLocaleString("pt-BR")}</span>
                        ) : null}
                        {avg && !showSuggestion && <CheckCircle2 className="h-3 w-3 text-success" />}
                      </span>
                    }
                  />
                </div>

                {showSuggestion && (
                  <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    Estimativa fora da média real. Sugerido: {avg.toLocaleString("pt-BR")} tok.
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(r); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RoutingDialog
        open={open}
        routing={editing}
        models={models}
        providers={providers}
        onClose={() => setOpen(false)}
        onSaved={load}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}