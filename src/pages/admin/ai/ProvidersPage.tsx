import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Brain, Plus, Loader2, CheckCircle2, XCircle, Pencil, Wifi, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  checkSecrets, listProviders, testProvider, upsertProvider, timeAgo, type Provider,
} from "@/lib/ai-admin";
import { supabase } from "@/integrations/supabase/client";
import AIAlertsBanner from "./AIAlertsBanner";
import ProviderDialog from "./ProviderDialog";

export default function ProvidersPage() {
  const [items, setItems] = useState<Provider[]>([]);
  const [secrets, setSecrets] = useState<Record<string, boolean>>({});
  const [lastUsed, setLastUsed] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Provider | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await listProviders();
      setItems(list);
      const sec = await checkSecrets(list.map((p) => p.secret_name));
      setSecrets(sec);
      // last used
      const usedMap: Record<string, string | null> = {};
      await Promise.all(
        list.map(async (p) => {
          const { data } = await supabase
            .from("ai_usage_logs")
            .select("created_at")
            .eq("provider_id", p.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          usedMap[p.id] = (data as any)?.created_at ?? null;
        }),
      );
      setLastUsed(usedMap);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar provedores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (p: Provider, next: boolean) => {
    if (!next && p.active) {
      // confirmar
      setConfirmDeactivate(p);
      return;
    }
    try {
      await upsertProvider({ id: p.id, active: next });
      toast.success(next ? "Provedor ativado" : "Provedor desativado");
      load();
    } catch (e: any) { toast.error(e?.message); }
  };

  const doDeactivate = async () => {
    if (!confirmDeactivate) return;
    try {
      await upsertProvider({ id: confirmDeactivate.id, active: false });
      toast.success("Provedor desativado");
      setConfirmDeactivate(null);
      load();
    } catch (e: any) { toast.error(e?.message); }
  };

  const test = async (p: Provider) => {
    setTestingId(p.id);
    try {
      const res = await testProvider(p.id);
      if (res.ok) toast.success(`OK · ${res.latency_ms ?? "?"} ms`);
      else toast.error(`Falhou: ${res.error ?? "erro desconhecido"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no teste");
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" /> Provedores de IA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os provedores que atendem as chamadas de IA do sistema.
          </p>
        </div>
        <Button className="bg-gradient-primary" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar Provedor
        </Button>
      </div>

      <AIAlertsBanner />

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      ) : items.length === 0 ? (
        <div className="surface-card rounded-xl p-12 text-center">
          <Brain className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display font-semibold">Nenhum provedor cadastrado</h3>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => {
            const secretOk = secrets[p.secret_name];
            const warn = p.active && secretOk === false;
            return (
              <div
                key={p.id}
                className={`surface-card rounded-xl p-5 space-y-3 ${warn ? "border-destructive/50" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{p.code}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${p.active ? "text-success" : "text-muted-foreground"}`}>
                      {p.active ? "Ativo" : "Inativo"}
                    </span>
                    <Switch checked={p.active} onCheckedChange={(v) => toggleActive(p, v)} />
                  </div>
                </div>

                {warn && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    Secret <span className="font-mono">{p.secret_name}</span> não está cadastrado.
                  </div>
                )}

                <div className="space-y-1.5 text-xs">
                  <Row label="Prioridade" value={String(p.priority)} />
                  <Row label="Endpoint" value={p.api_endpoint ?? "—"} mono />
                  <Row
                    label="Secret"
                    value={
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono">{p.secret_name}</span>
                        {secretOk === true && <CheckCircle2 className="h-3 w-3 text-success" />}
                        {secretOk === false && <XCircle className="h-3 w-3 text-destructive" />}
                      </span>
                    }
                  />
                  <Row label="Último uso" value={timeAgo(lastUsed[p.id])} />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={testingId === p.id}
                    onClick={() => test(p)}
                  >
                    {testingId === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <><Wifi className="h-3.5 w-3.5 mr-1" /> Testar</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setEditing(p); setDialogOpen(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProviderDialog
        open={dialogOpen}
        provider={editing}
        providers={items}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
      />

      <AlertDialog open={!!confirmDeactivate} onOpenChange={(o) => !o && setConfirmDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar provedor "{confirmDeactivate?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Features que dependem deste provedor podem cair no fallback ou parar de funcionar. Tem certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right truncate ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}