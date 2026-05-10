import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json(401, { ok: false, error: "Não autenticado" });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return json(401, { ok: false, error: "Sessão inválida" });
    const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: u.user.id });
    if (!isSA) return json(403, { ok: false, error: "Acesso negado" });

    const { provider_id } = await req.json();
    if (!provider_id) return json(400, { ok: false, error: "provider_id obrigatório" });

    const { data: provider } = await supabase
      .from("ai_providers")
      .select("*")
      .eq("id", provider_id)
      .maybeSingle();
    if (!provider) return json(404, { ok: false, error: "Provedor não encontrado" });

    const apiKey = Deno.env.get(provider.secret_name);
    if (!apiKey) {
      return json(200, { ok: false, error: `Secret ${provider.secret_name} não cadastrado` });
    }
    if (!provider.api_endpoint) {
      return json(200, { ok: false, error: "Provedor sem api_endpoint" });
    }

    // Pega um modelo ativo para o provedor (priorizando o mais barato)
    const { data: modelsData } = await supabase
      .from("ai_models")
      .select("model_id")
      .eq("provider_id", provider_id)
      .eq("active", true)
      .order("input_cost_per_1k_tokens", { ascending: true })
      .limit(1);
    const modelId = modelsData?.[0]?.model_id ?? "google/gemini-2.5-flash";

    const start = Date.now();
    let res: Response;
    try {
      res = await fetch(provider.api_endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 4,
        }),
      });
    } catch (e) {
      return json(200, { ok: false, error: `Falha de rede: ${String((e as any)?.message ?? e)}` });
    }
    const latency = Date.now() - start;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return json(200, { ok: false, status: res.status, latency_ms: latency, error: text.slice(0, 200) });
    }
    return json(200, { ok: true, status: res.status, latency_ms: latency });
  } catch (e) {
    return json(500, { ok: false, error: String((e as any)?.message ?? e) });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}