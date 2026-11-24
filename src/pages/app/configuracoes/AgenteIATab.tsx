import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  MessageCircle,
  Play,
  PlugZap,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentCommand, useAgentRuntimeStatus } from "@/hooks/useAgentRuntimeStatus";
import {
  agentApiUrl,
  agentStatistic,
  agentStatusMeta,
  generateAgentKey,
  isAgentOffline,
  sha256Hex,
  type AgentCommand,
} from "@/lib/agent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type AgentKey = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type AgentAction = {
  id: string;
  action: string;
  params: unknown;
  contexto: unknown;
  ok: boolean;
  error: string | null;
  created_at: string;
};

const COMMAND_LABELS: Record<AgentCommand, string> = {
  ligar: "Ligar WhatsApp",
  desligar: "Desligar",
  trocar_numero: "Trocar número",
  reenviar_pendentes: "Reenviar lançamentos pendentes",
};

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "Nunca";
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Não foi possível copiar. Selecione e copie manualmente.");
  }
}

export default function AgenteIATab({ companyId }: { companyId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const runtimeQuery = useAgentRuntimeStatus(companyId);
  const sendCommand = useAgentCommand(companyId);
  const [keyName, setKeyName] = useState("Agente WhatsApp");
  const [freshKeys, setFreshKeys] = useState<Record<string, string>>({});
  const [latestFreshKey, setLatestFreshKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [commandRunning, setCommandRunning] = useState<AgentCommand | null>(null);

  const keysQuery = useQuery({
    queryKey: ["agent-api-keys", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_api_keys")
        .select("id,name,key_prefix,created_at,last_used_at,revoked_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AgentKey[];
    },
  });

  const actionsQuery = useQuery({
    queryKey: ["agent-actions-log", companyId],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_actions_log")
        .select("id,action,params,contexto,ok,error,created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as AgentAction[];
    },
  });

  const runtime = runtimeQuery.data;
  const status = agentStatusMeta(runtime?.whatsapp_status);
  const offline = isAgentOffline(runtime?.last_seen_at);
  const apiUrl = agentApiUrl();
  const qr = runtime?.whatsapp_qr?.startsWith("data:image/png;base64,") ? runtime.whatsapp_qr : null;

  const generateKey = async () => {
    const name = keyName.trim();
    if (!name) {
      toast.error("Informe um nome para identificar a chave.");
      return;
    }
    setGenerating(true);
    try {
      const raw = generateAgentKey();
      const key_hash = await sha256Hex(raw);
      const { data, error } = await supabase
        .from("agent_api_keys")
        .insert({
          company_id: companyId,
          name,
          key_hash,
          key_prefix: raw.slice(0, 8),
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      setFreshKeys((current) => ({ ...current, [data.id]: raw }));
      setLatestFreshKey(raw);
      await queryClient.invalidateQueries({ queryKey: ["agent-api-keys", companyId] });
      toast.success("Chave gerada. Copie agora: ela não será mostrada novamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar a chave.");
    } finally {
      setGenerating(false);
    }
  };

  const revokeKey = async (key: AgentKey) => {
    if (!window.confirm(`Revogar a chave “${key.name}”? O agente deixará de acessar com ela.`)) return;
    const { error } = await supabase
      .from("agent_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .eq("id", key.id)
      .is("revoked_at", null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFreshKeys((current) => {
      const next = { ...current };
      delete next[key.id];
      return next;
    });
    await queryClient.invalidateQueries({ queryKey: ["agent-api-keys", companyId] });
    toast.success("Chave revogada.");
  };

  const testKey = async (key: AgentKey) => {
    const raw = freshKeys[key.id];
    if (!raw) return;
    setTestingId(key.id);
    try {
      const { data, error } = await supabase.functions.invoke("agent-api", {
        headers: { "x-agent-key": raw },
        body: { action: "ping", params: {}, contexto: { canal: "painel" } },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "O teste não retornou uma confirmação.");
      toast.success(`Conexão confirmada: ${data.data?.empresa || "empresa conectada"}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agent-api-keys", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["agent-actions-log", companyId] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao testar a chave.");
    } finally {
      setTestingId(null);
    }
  };

  const runCommand = async (command: AgentCommand) => {
    if (command === "trocar_numero" && !window.confirm("Trocar o número desconecta o WhatsApp atual e solicita um novo QR Code. Continuar?")) return;
    setCommandRunning(command);
    try {
      await sendCommand(command);
      toast.success(`Comando “${COMMAND_LABELS[command]}” enviado ao motor do agente.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o comando.");
    } finally {
      setCommandRunning(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="surface-card rounded-xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-lg bg-primary/10 grid place-items-center shrink-0">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">WhatsApp do agente</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <span className={cn("h-2.5 w-2.5 rounded-full", status.dot)} aria-hidden="true" />
                <span className="font-medium">{status.label}</span>
                {runtime?.whatsapp_numero && <span className="text-muted-foreground">· {runtime.whatsapp_numero}</span>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Último contato do motor: {dateTime(runtime?.last_seen_at ?? null)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {runtime?.telegram_bot && <Badge variant="outline">Telegram: {runtime.telegram_bot}</Badge>}
            {runtime?.claude_ok !== null && runtime?.claude_ok !== undefined && (
              <Badge variant="outline" className={runtime.claude_ok ? "text-success" : "text-destructive"}>
                IA {runtime.claude_ok ? "conectada" : "indisponível"}
              </Badge>
            )}
            {runtime?.versao && <Badge variant="outline">versão {runtime.versao}</Badge>}
          </div>
        </div>

        {offline && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Motor do agente offline — abra o atalho ABRIR AGENTE FROTAOPS no computador.</span>
          </div>
        )}
        {runtime?.whatsapp_erro && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {runtime.whatsapp_erro}
          </div>
        )}

        {runtime?.whatsapp_status === "aguardando_qr" && qr && (
          <div className="grid gap-5 rounded-lg border border-border p-4 md:grid-cols-[240px_1fr] md:items-center">
            <img
              src={qr}
              alt="QR Code para conectar o WhatsApp do agente"
              className="h-60 w-60 rounded-lg bg-destructive-foreground p-2 object-contain"
            />
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2"><Smartphone className="h-4 w-4 text-primary" /> Conecte pelo celular</h4>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Abra o WhatsApp no celular do agente → ⋮ → Aparelhos conectados → Conectar aparelho → aponte para o código.
              </p>
              <p className="text-xs text-muted-foreground">O código é atualizado automaticamente a cada 5 segundos.</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(["ligar", "desligar", "trocar_numero", "reenviar_pendentes"] as AgentCommand[]).map((command) => {
            const Icon = command === "ligar" ? PlugZap : command === "desligar" ? Power : command === "trocar_numero" ? RotateCcw : RefreshCw;
            return (
              <Button
                key={command}
                type="button"
                size="sm"
                variant={command === "desligar" || command === "trocar_numero" ? "outline" : "default"}
                disabled={commandRunning !== null}
                onClick={() => runCommand(command)}
                className="gap-2"
              >
                {commandRunning === command ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                {COMMAND_LABELS[command]}
              </Button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["contatos", "Contatos"],
            ["mensagens_hoje", "Mensagens hoje"],
            ["lancamentos_hoje", "Lançamentos hoje"],
            ["pendentes", "Pendentes"],
          ].map(([key, label]) => (
            <div key={key} className="rounded-lg border border-border bg-background/30 p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-1 font-display text-xl font-semibold">{agentStatistic(runtime?.estatisticas, key)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card rounded-xl p-4 sm:p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center shrink-0">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold">Chaves do agente</h3>
            <p className="text-sm text-muted-foreground">Cada chave acessa somente esta empresa. Revogue uma chave exposta imediatamente.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Endereço da API</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={apiUrl} className="font-mono text-xs" />
            <Button type="button" variant="outline" onClick={() => copyText(apiUrl, "Endereço")} className="gap-2">
              <Copy className="h-4 w-4" /> Copiar
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="agent-key-name">Nome da chave</Label>
            <Input id="agent-key-name" value={keyName} onChange={(event) => setKeyName(event.target.value)} maxLength={80} />
          </div>
          <Button type="button" onClick={generateKey} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Gerar chave
          </Button>
        </div>

        {latestFreshKey && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-2">
            <Label className="text-xs uppercase tracking-wide text-primary">Nova chave — mostrada apenas uma vez</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={latestFreshKey} className="font-mono text-xs" />
              <Button type="button" variant="secondary" onClick={() => copyText(latestFreshKey, "Chave")} className="gap-2">
                <Copy className="h-4 w-4" /> Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Guarde no motor do agente. Ao sair ou atualizar a página, somente o prefixo continuará visível.</p>
          </div>
        )}

        <div className="space-y-3">
          {keysQuery.isLoading ? (
            <div className="py-6 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : keysQuery.data?.length ? (
            keysQuery.data.map((key) => (
              <div key={key.id} className="rounded-lg border border-border p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{key.name}</span>
                    <Badge variant="outline" className={key.revoked_at ? "text-muted-foreground" : "text-success"}>
                      {key.revoked_at ? "Revogada" : "Ativa"}
                    </Badge>
                  </div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{key.key_prefix}…</div>
                  <div className="mt-1 text-xs text-muted-foreground">Criada em {dateTime(key.created_at)} · último uso: {dateTime(key.last_used_at)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!!key.revoked_at || !freshKeys[key.id] || testingId !== null}
                    title={!freshKeys[key.id] ? "Por segurança, o teste fica disponível logo após gerar a chave" : "Testar esta chave com ping"}
                    onClick={() => testKey(key)}
                    className="gap-2"
                  >
                    {testingId === key.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Testar
                  </Button>
                  {!key.revoked_at && (
                    <Button type="button" size="sm" variant="outline" onClick={() => revokeKey(key)} className="text-destructive">
                      Revogar
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhuma chave criada ainda.</p>
          )}
        </div>
      </section>

      <section className="surface-card rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-display font-semibold">Últimas ações do agente</h3>
            <p className="text-sm text-muted-foreground">As 50 chamadas mais recentes, exceto as atualizações automáticas de status.</p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actionsQuery.data?.map((action) => (
                <TableRow key={action.id}>
                  <TableCell className="whitespace-nowrap text-xs">{dateTime(action.created_at)}</TableCell>
                  <TableCell className="font-mono text-xs">{action.action}</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center gap-1 text-xs", action.ok ? "text-success" : "text-destructive")}>
                      {action.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {action.ok ? "Sucesso" : "Erro"}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-52 max-w-md">
                    {action.error && <p className="text-xs text-destructive">{action.error}</p>}
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Parâmetros e contexto</summary>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-2 font-mono text-[10px]">
                        {JSON.stringify({ params: action.params, contexto: action.contexto }, null, 2)}
                      </pre>
                    </details>
                  </TableCell>
                </TableRow>
              ))}
              {!actionsQuery.isLoading && !actionsQuery.data?.length && (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Nenhuma ação registrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
