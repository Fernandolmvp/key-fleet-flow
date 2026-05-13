// Orquestra a chamada de IA: consulta routing no banco, tenta primário,
// faz fallback automático em erro recuperável e registra tudo em ai_usage_logs.
import type { GuardContext } from "./ai-tokens.ts";
import { callLovable } from "./providers/lovable.ts";
import { callGemini } from "./providers/gemini.ts";
import { callClaude } from "./providers/claude.ts";
import { callOpenAI } from "./providers/openai.ts";
import type { ProviderCallArgs, ProviderCallResult } from "./providers/types.ts";

const TIMEOUT_MS = 30_000;

export type CallAiParams = {
  ctx: GuardContext;
  feature: string;
  messages: any[];
  tools?: any[];
  toolChoice?: any;
  timeoutMs?: number;
};

export type CallAiResult = {
  success: boolean;
  data: any | null;
  providerUsed: string | null;
  modelUsed: string | null;
  providerId: string | null;
  modelId: string | null;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  wasFallback: boolean;
  responseTimeMs: number;
  errorMessage: string | null;
  httpStatus: number | null;
};

type RoutingRow = {
  feature: string;
  estimated_tokens: number;
  primary_provider_id: string | null;
  primary_provider_code: string | null;
  primary_provider_secret: string | null;
  primary_provider_endpoint: string | null;
  primary_model_id: string | null;
  primary_model_code: string | null;
  fallback_provider_id: string | null;
  fallback_provider_code: string | null;
  fallback_provider_secret: string | null;
  fallback_provider_endpoint: string | null;
  fallback_model_id: string | null;
  fallback_model_code: string | null;
};

type Target = {
  providerId: string;
  providerCode: string;
  secretName: string;
  endpoint: string | null;
  modelId: string;
  modelCode: string;
};

function dispatcher(code: string): ((a: ProviderCallArgs) => Promise<ProviderCallResult>) | null {
  switch (code) {
    case "lovable": return callLovable;
    case "gemini": return callGemini;
    case "claude": return callClaude;
    case "openai": return callOpenAI;
    default: return null;
  }
}

function isRecoverable(r: ProviderCallResult): boolean {
  if (r.kind === "no_secret" || r.kind === "network" || r.kind === "timeout") return true;
  const s = r.status;
  if (s == null) return true;
  if (s === 402 || s === 429) return true;
  if (s >= 500 && s <= 599) return true;
  return false;
}

async function tryProvider(target: Target, params: CallAiParams): Promise<{ result: ProviderCallResult; ms: number }> {
  const fn = dispatcher(target.providerCode);
  const start = Date.now();
  if (!fn) {
    return {
      result: {
        ok: false, status: null, kind: "http",
        error: `unknown_provider_code: ${target.providerCode}`,
        data: null, tokens: { input: 0, output: 0, total: 0 },
      },
      ms: 0,
    };
  }
  const secret = Deno.env.get(target.secretName) ?? "";
  if (!secret) {
    return {
      result: {
        ok: false, status: null, kind: "no_secret",
        error: `secret_not_configured: ${target.secretName}`,
        data: null, tokens: { input: 0, output: 0, total: 0 },
      },
      ms: 0,
    };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), params.timeoutMs ?? TIMEOUT_MS);
  try {
    const result = await fn({
      secret,
      model: target.modelCode,
      endpoint: target.endpoint,
      messages: params.messages,
      tools: params.tools,
      toolChoice: params.toolChoice,
      signal: ac.signal,
    });
    return { result, ms: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

function targetFromRow(row: RoutingRow, kind: "primary" | "fallback"): Target | null {
  if (kind === "primary") {
    if (!row.primary_provider_id || !row.primary_provider_code || !row.primary_provider_secret || !row.primary_model_id || !row.primary_model_code) return null;
    return {
      providerId: row.primary_provider_id,
      providerCode: row.primary_provider_code,
      secretName: row.primary_provider_secret,
      endpoint: row.primary_provider_endpoint,
      modelId: row.primary_model_id,
      modelCode: row.primary_model_code,
    };
  }
  if (!row.fallback_provider_id || !row.fallback_provider_code || !row.fallback_provider_secret || !row.fallback_model_id || !row.fallback_model_code) return null;
  return {
    providerId: row.fallback_provider_id,
    providerCode: row.fallback_provider_code,
    secretName: row.fallback_provider_secret,
    endpoint: row.fallback_provider_endpoint,
    modelId: row.fallback_model_id,
    modelCode: row.fallback_model_code,
  };
}

async function logAttempt(
  ctx: GuardContext,
  feature: string,
  target: Target | null,
  result: ProviderCallResult,
  wasFallback: boolean,
  responseTimeMs: number,
  reqIdSuffix: string,
) {
  const requestId = `${ctx.requestId}:${reqIdSuffix}`;
  try {
    await ctx.supabase.rpc("consume_ai_tokens", {
      _company_id: ctx.companyId,
      _user_id: ctx.userId,
      _tokens_used: Math.max(0, (result.tokens.total | 0)),
      _feature: feature,
      _model: target?.modelCode ?? null,
      _tokens_input: Math.max(0, result.tokens.input | 0),
      _tokens_output: Math.max(0, result.tokens.output | 0),
      _success: result.ok,
      _error: result.error,
      _request_id: requestId,
      _provider_id: target?.providerId ?? null,
      _model_id_used: target?.modelId ?? null,
      _was_fallback: wasFallback,
      _response_time_ms: responseTimeMs || null,
    });
  } catch (e) {
    console.error("[ai-router] log:error", { requestId, feature, error: String((e as any)?.message ?? e) });
  }
}

export async function callAi(params: CallAiParams): Promise<CallAiResult> {
  const { ctx, feature } = params;

  // 1) Resolve routing
  const { data: routing, error: routingErr } = await ctx.supabase.rpc(
    "get_routing_for_feature",
    { _feature: feature },
  );
  if (routingErr || !routing || (Array.isArray(routing) && routing.length === 0)) {
    console.error("[ai-router] no-routing", { feature, err: routingErr?.message });
    const empty: ProviderCallResult = {
      ok: false, status: null, kind: "http",
      error: `routing_not_found: ${feature}`,
      data: null, tokens: { input: 0, output: 0, total: 0 },
    };
    await logAttempt(ctx, feature, null, empty, false, 0, "noroute");
    return buildResult(empty, null, false, 0);
  }
  const row = (Array.isArray(routing) ? routing[0] : routing) as RoutingRow;

  const primary = targetFromRow(row, "primary");
  const fallback = targetFromRow(row, "fallback");

  if (!primary) {
    const r: ProviderCallResult = {
      ok: false, status: null, kind: "http",
      error: `routing_invalid_primary: ${feature}`,
      data: null, tokens: { input: 0, output: 0, total: 0 },
    };
    await logAttempt(ctx, feature, null, r, false, 0, "noprimary");
    return buildResult(r, null, false, 0);
  }

  // 2) Try primary
  console.log("[ai-router] primary:start", { feature, provider: primary.providerCode, model: primary.modelCode });
  const { result: primRes, ms: primMs } = await tryProvider(primary, params);
  console.log("[ai-router] primary:done", { feature, provider: primary.providerCode, status: primRes.status, ms: primMs, ok: primRes.ok, kind: primRes.kind });

  if (primRes.ok) {
    await logAttempt(ctx, feature, primary, primRes, false, primMs, "p");
    return buildResult(primRes, primary, false, primMs);
  }

  // 3) Decide fallback
  if (!fallback || !isRecoverable(primRes)) {
    await logAttempt(ctx, feature, primary, primRes, false, primMs, "p");
    return buildResult(primRes, primary, false, primMs);
  }

  // Log primary failure (not idempotent-merged with fallback — distinct request id suffix)
  await logAttempt(ctx, feature, primary, primRes, false, primMs, "p");

  // 4) Try fallback
  console.log("[ai-router] fallback:start", { feature, provider: fallback.providerCode, model: fallback.modelCode });
  const { result: fbRes, ms: fbMs } = await tryProvider(fallback, params);
  console.log("[ai-router] fallback:done", { feature, provider: fallback.providerCode, status: fbRes.status, ms: fbMs, ok: fbRes.ok, kind: fbRes.kind });

  await logAttempt(ctx, feature, fallback, fbRes, true, fbMs, "f");
  return buildResult(fbRes, fallback, true, fbMs);
}

function buildResult(
  r: ProviderCallResult,
  target: Target | null,
  wasFallback: boolean,
  ms: number,
): CallAiResult {
  return {
    success: r.ok,
    data: r.data,
    providerUsed: target?.providerCode ?? null,
    modelUsed: target?.modelCode ?? null,
    providerId: target?.providerId ?? null,
    modelId: target?.modelId ?? null,
    tokensInput: r.tokens.input,
    tokensOutput: r.tokens.output,
    tokensTotal: r.tokens.total,
    wasFallback,
    responseTimeMs: ms,
    errorMessage: r.error,
    httpStatus: r.status,
  };
}