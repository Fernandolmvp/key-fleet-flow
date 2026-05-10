import { supabase } from "@/integrations/supabase/client";
import { FEATURE_LABELS } from "@/lib/ai-credits";

export type Provider = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  api_endpoint: string | null;
  secret_name: string;
  active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
};

export type Model = {
  id: string;
  provider_id: string;
  model_id: string;
  display_name: string;
  type: string; // text | vision | multimodal
  input_cost_per_1k_tokens: number;
  output_cost_per_1k_tokens: number;
  max_tokens: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Routing = {
  id: string;
  feature: string;
  primary_model_id: string;
  fallback_model_id: string | null;
  estimated_tokens: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type UsageLog = {
  id: string;
  company_id: string;
  user_id: string | null;
  feature: string;
  model: string | null;
  model_id_used: string | null;
  provider_id: string | null;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  source: string;
  success: boolean;
  was_fallback: boolean;
  response_time_ms: number | null;
  error_message: string | null;
  request_id: string | null;
  created_at: string;
};

export const PROVIDER_TONE: Record<string, string> = {
  lovable: "text-primary",
  gemini: "text-success",
  claude: "text-warning",
  openai: "text-foreground",
};

export const featureLabel = (key: string) => FEATURE_LABELS[key] ?? key;

export async function listProviders(): Promise<Provider[]> {
  const { data, error } = await supabase
    .from("ai_providers")
    .select("*")
    .order("priority", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Provider[];
}

export async function listModels(): Promise<Model[]> {
  const { data, error } = await supabase
    .from("ai_models")
    .select("*")
    .order("display_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Model[];
}

export async function listRouting(): Promise<Routing[]> {
  const { data, error } = await supabase
    .from("ai_feature_routing")
    .select("*")
    .order("feature", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Routing[];
}

/** Audit helper: registra mudança em audit_logs (best-effort). */
async function audit(action: string, table: string, recordId: string | null, before: any, after: any) {
  try {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      action,
      table_name: table,
      record_id: recordId,
      user_id: u?.user?.id ?? null,
      changes: { before, after } as any,
    });
  } catch {
    /* noop */
  }
}

export async function upsertProvider(payload: Partial<Provider> & { id?: string }) {
  if (payload.id) {
    const { data: prev } = await supabase.from("ai_providers").select("*").eq("id", payload.id).maybeSingle();
    const { data, error } = await supabase.from("ai_providers").update(payload).eq("id", payload.id).select("*").maybeSingle();
    if (error) throw error;
    await audit("ai_provider_update", "ai_providers", payload.id, prev, data);
    return data as Provider;
  }
  const { data, error } = await supabase.from("ai_providers").insert(payload as any).select("*").maybeSingle();
  if (error) throw error;
  await audit("ai_provider_create", "ai_providers", data?.id ?? null, null, data);
  return data as Provider;
}

export async function upsertModel(payload: Partial<Model> & { id?: string }) {
  if (payload.id) {
    const { data: prev } = await supabase.from("ai_models").select("*").eq("id", payload.id).maybeSingle();
    const { data, error } = await supabase.from("ai_models").update(payload).eq("id", payload.id).select("*").maybeSingle();
    if (error) throw error;
    await audit("ai_model_update", "ai_models", payload.id, prev, data);
    return data as Model;
  }
  const { data, error } = await supabase.from("ai_models").insert(payload as any).select("*").maybeSingle();
  if (error) throw error;
  await audit("ai_model_create", "ai_models", data?.id ?? null, null, data);
  return data as Model;
}

export async function upsertRouting(payload: Partial<Routing> & { id?: string }) {
  if (payload.id) {
    const { data: prev } = await supabase.from("ai_feature_routing").select("*").eq("id", payload.id).maybeSingle();
    const { data, error } = await supabase.from("ai_feature_routing").update(payload).eq("id", payload.id).select("*").maybeSingle();
    if (error) throw error;
    await audit("ai_routing_update", "ai_feature_routing", payload.id, prev, data);
    return data as Routing;
  }
  const { data, error } = await supabase.from("ai_feature_routing").insert(payload as any).select("*").maybeSingle();
  if (error) throw error;
  await audit("ai_routing_create", "ai_feature_routing", data?.id ?? null, null, data);
  return data as Routing;
}

/** Calcula stats agregadas da tabela ai_usage_logs nas últimas N horas. */
export type ProviderHealth = {
  provider_id: string | null;
  total: number;
  errors: number;
  fallback: number;
  errorRate: number;
  fallbackRate: number;
};

export async function getProviderHealthLast24h(): Promise<{
  byProvider: Record<string, ProviderHealth>;
  totalCalls: number;
  totalFallback: number;
  fallbackRate: number;
}> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ai_usage_logs")
    .select("provider_id, success, was_fallback")
    .gte("created_at", since);
  if (error) throw error;
  const byProvider: Record<string, ProviderHealth> = {};
  let totalFallback = 0;
  for (const row of data ?? []) {
    const pid = (row as any).provider_id ?? "unknown";
    const r = (byProvider[pid] ??= {
      provider_id: pid,
      total: 0,
      errors: 0,
      fallback: 0,
      errorRate: 0,
      fallbackRate: 0,
    });
    r.total += 1;
    if (!(row as any).success) r.errors += 1;
    if ((row as any).was_fallback) {
      r.fallback += 1;
      totalFallback += 1;
    }
  }
  Object.values(byProvider).forEach((r) => {
    r.errorRate = r.total ? r.errors / r.total : 0;
    r.fallbackRate = r.total ? r.fallback / r.total : 0;
  });
  const totalCalls = (data ?? []).length;
  return {
    byProvider,
    totalCalls,
    totalFallback,
    fallbackRate: totalCalls ? totalFallback / totalCalls : 0,
  };
}

/** Verifica se os secrets dos provedores ativos existem (via edge function). */
export async function checkSecrets(secretNames: string[]): Promise<Record<string, boolean>> {
  if (secretNames.length === 0) return {};
  try {
    const { data, error } = await supabase.functions.invoke("check-ai-secrets", {
      body: { secret_names: secretNames },
    });
    if (error) throw error;
    return (data?.secrets ?? {}) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export async function testProvider(providerId: string) {
  const { data, error } = await supabase.functions.invoke("test-ai-provider", {
    body: { provider_id: providerId },
  });
  if (error) throw error;
  return data as { ok: boolean; status?: number; latency_ms?: number; error?: string };
}

export const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtNum = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR");

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}