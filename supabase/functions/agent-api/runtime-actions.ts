import { ActionError, AgentContext, enumValue, optionalString } from "./helpers.ts";

const WHATSAPP_STATUSES = ["desligado", "instalando", "iniciando", "aguardando_qr", "conectado", "reconectando", "erro"] as const;

export async function agenteStatus(ctx: AgentContext, params: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    company_id: ctx.companyId,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (params.whatsapp_status !== undefined) payload.whatsapp_status = enumValue(params.whatsapp_status, WHATSAPP_STATUSES, "whatsapp_status");
  for (const [field, max] of [["whatsapp_numero", 40], ["whatsapp_erro", 2000], ["telegram_bot", 200], ["versao", 60]] as const) {
    if (params[field] !== undefined) payload[field] = optionalString(params, field, field, max);
  }
  if (params.whatsapp_qr !== undefined && params.whatsapp_qr !== null) {
    const qr = optionalString(params, "whatsapp_qr", "whatsapp_qr", 2_000_000);
    if (qr && !qr.startsWith("data:image/png;base64,")) throw new ActionError("whatsapp_qr deve ser uma imagem PNG em data URL.");
    payload.whatsapp_qr = qr;
  } else if (params.whatsapp_qr === null) payload.whatsapp_qr = null;
  if (params.claude_ok !== undefined) {
    if (typeof params.claude_ok !== "boolean") throw new ActionError("claude_ok deve ser verdadeiro ou falso.");
    payload.claude_ok = params.claude_ok;
  }
  if (params.estatisticas !== undefined) {
    if (!params.estatisticas || typeof params.estatisticas !== "object" || Array.isArray(params.estatisticas)) throw new ActionError("estatisticas deve ser um objeto.");
    payload.estatisticas = params.estatisticas;
  }

  const { error } = await ctx.admin.from("agent_runtime_status").upsert(payload, { onConflict: "company_id" });
  if (error) throw error;
  const { data, error: readError } = await ctx.admin.from("agent_runtime_status").select("pending_command").eq("company_id", ctx.companyId).single();
  if (readError) throw readError;
  const command = data?.pending_command ?? null;
  if (command) {
    const { error: clearError } = await ctx.admin.from("agent_runtime_status").update({ pending_command: null, updated_at: new Date().toISOString() })
      .eq("company_id", ctx.companyId).eq("pending_command", command);
    if (clearError) throw clearError;
  }
  return { comando: command };
}
