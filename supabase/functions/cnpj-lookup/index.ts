import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TTL_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const cnpj = String(body?.cnpj ?? "").replace(/\D/g, "");
    if (cnpj.length !== 14) {
      return new Response(JSON.stringify({ ok: false, error: "CNPJ inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache lookup
    const { data: cached } = await supabase.from("cnpj_cache").select("payload, fetched_at").eq("cnpj", cnpj).maybeSingle();
    if (cached) {
      const ageMs = Date.now() - new Date(cached.fetched_at as string).getTime();
      if (ageMs < TTL_DAYS * 86400_000) {
        return new Response(JSON.stringify({ ok: true, result: mapPayload(cached.payload), cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // BrasilAPI is free and reliable
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ ok: false, error: `Receita: ${r.status} ${txt.slice(0, 120)}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payload = await r.json();

    await supabase.from("cnpj_cache").upsert({ cnpj, payload, fetched_at: new Date().toISOString() });

    return new Response(JSON.stringify({ ok: true, result: mapPayload(payload), cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function mapPayload(p: any) {
  return {
    legalName: p?.razao_social ?? null,
    tradeName: p?.nome_fantasia ?? null,
    email: p?.email ?? null,
    phone: p?.ddd_telefone_1 ?? null,
    zipCode: p?.cep ? String(p.cep).replace(/\D/g, "") : null,
    street: [p?.descricao_tipo_de_logradouro, p?.logradouro].filter(Boolean).join(" ") || null,
    number: p?.numero ?? null,
    complement: p?.complemento ?? null,
    neighborhood: p?.bairro ?? null,
    city: p?.municipio ?? null,
    state: p?.uf ?? null,
    cnaeCode: p?.cnae_fiscal ? String(p.cnae_fiscal) : null,
    simplesNacional: p?.opcao_pelo_simples ?? null,
    status: p?.descricao_situacao_cadastral ?? null,
    raw: p,
  };
}