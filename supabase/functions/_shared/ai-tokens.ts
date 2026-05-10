// Helpers para interceptar chamadas de IA: verifica saldo, registra consumo e
// garante idempotência via request_id. Usado pelas edge functions que chamam
// o Lovable AI Gateway.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Estimativas conservadoras por feature — usadas APENAS para o pré-bloqueio.
// O débito real usa os tokens reportados pelo provedor (usage.total_tokens).
export const FEATURE_MIN_TOKENS: Record<string, number> = {
  // extract-document — Gemini Flash, imagens/PDF curtos
  crlv: 1500,
  cnh: 1500,
  leitura_placa: 800,
  leitura_hodometro: 800,
  nota_manutencao: 2500,
  nota_pneu: 2500,
  documento_generico: 2000,
  cupom_fiscal: 2500,
  // extract-insurance-policy / review-insurance-policy — Gemini Pro, PDFs longos
  extract_insurance_policy: 8000,
  review_insurance_policy: 8000,
};

export type GuardContext = {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  companyId: string;
  requestId: string;
};

export type GuardError = {
  status: number;
  body: { error: string; code?: string };
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-request-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

export function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

/**
 * Valida o usuário, descobre a empresa atual e verifica se há saldo suficiente
 * para a feature antes de chamar a IA. Retorna contexto OU um erro pronto p/ HTTP.
 */
export async function guardAiCall(
  req: Request,
  feature: string,
): Promise<{ ctx: GuardContext } | { err: GuardError }> {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth) return { err: { status: 401, body: { error: "Não autenticado" } } };

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } },
  });

  const { data: userResp, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userResp?.user) {
    return { err: { status: 401, body: { error: "Sessão inválida" } } };
  }
  const userId = userResp.user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_company_id")
    .eq("id", userId)
    .maybeSingle();

  let companyId = profile?.current_company_id as string | null | undefined;
  if (!companyId) {
    const { data: member } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    companyId = member?.company_id as string | undefined;
  }
  if (!companyId) {
    return { err: { status: 400, body: { error: "Empresa não encontrada para o usuário" } } };
  }

  const required = FEATURE_MIN_TOKENS[feature] ?? 1000;
  const { data: enough, error: balErr } = await supabase.rpc("has_enough_ai_tokens", {
    _company_id: companyId,
    _required: required,
  });
  if (balErr) {
    console.error("has_enough_ai_tokens error", balErr);
    return { err: { status: 500, body: { error: "Falha ao verificar créditos" } } };
  }
  if (!enough) {
    // registra tentativa bloqueada (best-effort, não falha a request)
    try {
      await supabase.rpc("consume_ai_tokens", {
        _company_id: companyId,
        _user_id: userId,
        _tokens_used: 0,
        _feature: feature,
        _model: null,
        _tokens_input: 0,
        _tokens_output: 0,
        _success: false,
        _error: "insufficient_tokens_preflight",
        _request_id: null,
      });
    } catch (_) { /* ignore */ }
    return {
      err: {
        status: 402,
        body: {
          error: "Créditos de IA insuficientes. Compre um pacote para continuar.",
          code: "insufficient_tokens",
        },
      },
    };
  }

  const requestId =
    req.headers.get("x-request-id") ||
    req.headers.get("X-Request-Id") ||
    crypto.randomUUID();

  return { ctx: { supabase, userId, companyId, requestId } };
}

/** Extrai tokens reais da resposta do Lovable AI Gateway (formato OpenAI). */
export function extractTokensFromResponse(payload: any): {
  total: number;
  input: number;
  output: number;
} {
  const u = payload?.usage ?? {};
  const input = Number(u.prompt_tokens ?? u.input_tokens ?? 0) || 0;
  const output = Number(u.completion_tokens ?? u.output_tokens ?? 0) || 0;
  const total = Number(u.total_tokens ?? input + output) || 0;
  return { total, input, output };
}

/** Registra (debita) o uso real após a chamada IA. Idempotente por request_id. */
export async function registerAiUsage(
  ctx: GuardContext,
  args: {
    feature: string;
    model: string | null;
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    success: boolean;
    error?: string | null;
    /** sub-id para distinguir múltiplas chamadas IA dentro do mesmo request */
    callIndex?: number;
  },
): Promise<void> {
  const reqId =
    args.callIndex && args.callIndex > 0
      ? `${ctx.requestId}:${args.callIndex}`
      : ctx.requestId;

  const { error } = await ctx.supabase.rpc("consume_ai_tokens", {
    _company_id: ctx.companyId,
    _user_id: ctx.userId,
    _tokens_used: Math.max(0, args.tokensTotal | 0),
    _feature: args.feature,
    _model: args.model,
    _tokens_input: Math.max(0, args.tokensInput | 0),
    _tokens_output: Math.max(0, args.tokensOutput | 0),
    _success: args.success,
    _error: args.error ?? null,
    _request_id: reqId,
  });
  if (error) {
    // não derruba a resposta para o cliente, mas loga para auditoria
    console.error("[ai-tokens] registerAiUsage failed", error, {
      feature: args.feature,
      tokensTotal: args.tokensTotal,
      requestId: reqId,
    });
  }
}

/** Mapeia o `type` do extract-document → feature name padronizada. */
export function featureForDocType(type: string): string {
  switch (type) {
    case "vehicle": return "crlv";
    case "driver": return "cnh";
    case "plate": return "leitura_placa";
    case "odometer": return "leitura_hodometro";
    case "maintenance_invoice": return "nota_manutencao";
    case "tire_invoice": return "nota_pneu";
    case "document": return "documento_generico";
    case "fuel_receipt": return "cupom_fiscal";
    default: return "documento_generico";
  }
}