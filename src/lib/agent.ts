export const AGENT_COMMANDS = ["ligar", "desligar", "trocar_numero", "reenviar_pendentes"] as const;
export type AgentCommand = (typeof AGENT_COMMANDS)[number];

export type AgentWhatsappStatus =
  | "desligado"
  | "instalando"
  | "iniciando"
  | "aguardando_qr"
  | "conectado"
  | "reconectando"
  | "erro";

export type AgentRuntime = {
  company_id: string;
  whatsapp_status: AgentWhatsappStatus;
  whatsapp_qr: string | null;
  whatsapp_numero: string | null;
  whatsapp_erro: string | null;
  telegram_bot: string | null;
  claude_ok: boolean | null;
  estatisticas: unknown;
  versao: string | null;
  last_seen_at: string | null;
  pending_command: AgentCommand | null;
  updated_at: string;
};

const STATUS_META: Record<AgentWhatsappStatus, { label: string; dot: string }> = {
  desligado: { label: "Desligado", dot: "bg-muted-foreground" },
  instalando: { label: "Instalando", dot: "bg-warning" },
  iniciando: { label: "Iniciando", dot: "bg-warning" },
  aguardando_qr: { label: "Aguardando QR Code", dot: "bg-warning" },
  conectado: { label: "Conectado", dot: "bg-success" },
  reconectando: { label: "Reconectando", dot: "bg-warning" },
  erro: { label: "Erro", dot: "bg-destructive" },
};

export function agentStatusMeta(status: string | null | undefined) {
  return STATUS_META[(status as AgentWhatsappStatus) || "desligado"] ?? STATUS_META.desligado;
}

export function isAgentOffline(lastSeenAt: string | null | undefined, now = Date.now()) {
  if (!lastSeenAt) return true;
  const timestamp = new Date(lastSeenAt).getTime();
  return !Number.isFinite(timestamp) || now - timestamp > 60_000;
}

export function generateAgentKey() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const random = new Uint8Array(40);
  crypto.getRandomValues(random);
  return `fo_agent_${Array.from(random, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function agentApiUrl() {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-api`;
}

export function agentStatistic(stats: unknown, key: string) {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) return "—";
  const value = (stats as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "—";
}
