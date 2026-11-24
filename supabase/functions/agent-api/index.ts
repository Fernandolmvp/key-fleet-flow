import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
import { actionHandler } from "./actions.ts";
import { ActionError, databaseError } from "./helpers.ts";

const cors = {
  ...corsHeaders,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  action: z.string().trim().min(1).max(100),
  params: z.record(z.unknown()).default({}),
  contexto: z.object({
    canal: z.string().max(80).optional(),
    contato_id: z.string().max(160).optional(),
    contato_nome: z.string().max(180).optional(),
    motorista_id: z.string().uuid().optional(),
    nivel: z.enum(["motorista", "gestor"]).optional(),
  }).passthrough().default({}),
});

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function failure(error: string, status = 200) {
  return response({ ok: false, error }, status);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return failure("Método não permitido. Use POST com JSON.");

  const rawKey = req.headers.get("x-agent-key")?.trim() ?? "";
  if (!/^fo_agent_[A-Za-z0-9]{40}$/.test(rawKey)) return failure("Chave do agente ausente ou inválida.", 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const hash = await sha256Hex(rawKey);
  const { data: key, error: keyError } = await admin
    .from("agent_api_keys")
    .select("id,company_id")
    .eq("key_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (keyError) {
    console.error("agent-api key lookup", keyError.message);
    return failure("Não foi possível validar a chave agora.", 401);
  }
  if (!key) return failure("Chave do agente inválida ou revogada.", 401);

  await admin.from("agent_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);
  const { data: allowed, error: rateError } = await admin.rpc("agent_api_rate_limit", { p_key_id: key.id, p_limit: 120 });
  if (rateError) {
    console.error("agent-api rate limit", rateError.message);
    return failure("Não foi possível validar o limite de requisições. Tente novamente.");
  }
  if (!allowed) return failure("Limite de 120 requisições por minuto atingido. Aguarde um minuto e tente novamente.");

  let body: z.infer<typeof BodySchema>;
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Corpo da requisição inválido.";
      await admin.from("agent_actions_log").insert({ company_id: key.company_id, action: "requisicao_invalida", ok: false, error: message });
      return failure(`Requisição inválida: ${message}`);
    }
    body = parsed.data;
  } catch {
    await admin.from("agent_actions_log").insert({ company_id: key.company_id, action: "requisicao_invalida", ok: false, error: "JSON inválido" });
    return failure("Corpo da requisição deve ser um JSON válido.");
  }

  const handler = actionHandler(body.action);
  if (!handler) {
    const error = `Ação não suportada: ${body.action}`;
    await admin.from("agent_actions_log").insert({ company_id: key.company_id, action: body.action, params: body.params, contexto: body.contexto, ok: false, error });
    return failure(error);
  }

  try {
    const data = await handler({ admin, keyId: key.id, companyId: key.company_id, contexto: body.contexto }, body.params);
    if (body.action !== "agente_status") {
      await admin.from("agent_actions_log").insert({ company_id: key.company_id, action: body.action, params: body.params, contexto: body.contexto, ok: true });
    }
    return response({ ok: true, data });
  } catch (cause) {
    const translated = databaseError(cause);
    const error = cause instanceof ActionError
      ? cause.message
      : translated instanceof ActionError
        ? translated.message
        : "Não foi possível concluir a ação. Revise os dados e tente novamente.";
    if (!(cause instanceof ActionError)) console.error(`agent-api ${body.action}`, translated.message);
    if (body.action !== "agente_status") {
      await admin.from("agent_actions_log").insert({ company_id: key.company_id, action: body.action, params: body.params, contexto: body.contexto, ok: false, error });
    }
    return failure(error);
  }
});
