import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FIPE_BASE = "https://parallelum.com.br/fipe/api/v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function vehicleKind(t?: string | null): "carros" | "motos" | "caminhoes" {
  const s = (t ?? "").toLowerCase();
  if (s.includes("moto")) return "motos";
  if (s.includes("caminh") || s.includes("truck")) return "caminhoes";
  return "carros";
}

function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function tokenize(s: string): string[] {
  return norm(s)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

// Aliases comuns de modelos truncados/codificados em cadastros (RENAVAM/Detran)
const MODEL_ALIASES: Record<string, string> = {
  kgoo: "kangoo",
  enduran: "endurance",
  endur: "endurance",
  freed: "freedom",
  advent: "adventure",
  attract: "attractive",
  highl: "highline",
  comfortl: "comfortline",
  trendl: "trendline",
};

function expandAliases(tokens: string[]): string[] {
  return tokens.map((t) => MODEL_ALIASES[t] ?? t);
}

function scoreModel(queryTokens: string[], candidate: string): number {
  const ct = tokenize(candidate);
  if (ct.length === 0) return 0;
  let score = 0;
  // bônus forte se a primeira palavra (família) bate
  const q0 = queryTokens[0];
  const c0 = ct[0];
  if (q0 && c0) {
    if (q0 === c0) score += 10;
    else if (c0.startsWith(q0) || q0.startsWith(c0)) score += 6;
  }
  for (const t of queryTokens) {
    if (ct.includes(t)) score += 3;
    else if (ct.some((c) => c.startsWith(t) || t.startsWith(c))) score += 1;
  }
  return score;
}

async function fetchJson(url: string) {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`FIPE ${r.status} em ${url}`);
  return r.json();
}

async function cachedFetch(supa: any, key: string, fn: () => Promise<any>) {
  const { data: cached } = await supa.from("fipe_cache").select("payload, fetched_at").eq("cache_key", key).maybeSingle();
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) return cached.payload;
  const payload = await fn();
  await supa.from("fipe_cache").upsert({ cache_key: key, payload, fetched_at: new Date().toISOString() });
  return payload;
}

async function lookup(supa: any, kind: string, brand: string, model: string, year: number | null) {
  const brands: any[] = await cachedFetch(supa, `brands:${kind}`, () => fetchJson(`${FIPE_BASE}/${kind}/marcas`));
  const nb = norm(brand);
  const brandMatch =
    brands.find((b: any) => norm(b.nome) === nb) ||
    brands.find((b: any) => {
      const n = norm(b.nome);
      return n === nb || n.split(/[\s\-]+/).includes(nb) || nb.split(/[\s\-]+/).includes(n);
    }) ||
    brands.find((b: any) => norm(b.nome).includes(nb) || nb.includes(norm(b.nome)));
  if (!brandMatch) throw new Error(`Marca "${brand}" não localizada na FIPE`);
  const models: any = await cachedFetch(supa, `models:${kind}:${brandMatch.codigo}`, () => fetchJson(`${FIPE_BASE}/${kind}/marcas/${brandMatch.codigo}/modelos`));
  const modelList: any[] = models.modelos ?? models;
  const queryTokens = expandAliases(tokenize(model));
  if (queryTokens.length === 0) throw new Error(`Modelo "${model}" inválido`);
  // Score todos os candidatos
  const scored = modelList
    .map((m: any) => ({ m, s: scoreModel(queryTokens, m.nome) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  if (scored.length === 0 || scored[0].s < 6) {
    throw new Error(`Modelo "${model}" não localizado para ${brandMatch.nome}`);
  }
  const modelMatch = scored[0].m;
  const years: any[] = await cachedFetch(supa, `years:${kind}:${brandMatch.codigo}:${modelMatch.codigo}`, () =>
    fetchJson(`${FIPE_BASE}/${kind}/marcas/${brandMatch.codigo}/modelos/${modelMatch.codigo}/anos`),
  );
  let yearMatch = years[0];
  if (year) {
    const exact =
      years.find((y: any) => String(y.codigo).startsWith(String(year))) ||
      years.find((y: any) => String(y.nome).startsWith(String(year)));
    if (exact) {
      yearMatch = exact;
    } else {
      // fallback: ano mais próximo
      const withDist = years
        .map((y: any) => {
          const yr = parseInt(String(y.codigo).split("-")[0], 10);
          return { y, d: isNaN(yr) ? 9999 : Math.abs(yr - year) };
        })
        .sort((a, b) => a.d - b.d);
      if (withDist[0]) yearMatch = withDist[0].y;
    }
  }
  const detail: any = await cachedFetch(supa, `value:${kind}:${brandMatch.codigo}:${modelMatch.codigo}:${yearMatch.codigo}`, () =>
    fetchJson(`${FIPE_BASE}/${kind}/marcas/${brandMatch.codigo}/modelos/${modelMatch.codigo}/anos/${yearMatch.codigo}`),
  );
  const valueStr: string = detail.Valor ?? "";
  const value = Number(valueStr.replace(/[^\d,]/g, "").replace(",", "."));
  return {
    fipe_code: detail.CodigoFipe as string,
    fipe_value: value,
    reference_month: detail.MesReferencia as string,
    fipe_brand_code: String(brandMatch.codigo),
    fipe_model_code: String(modelMatch.codigo),
    fipe_year_code: String(yearMatch.codigo),
    matched: { brand: brandMatch.nome, model: modelMatch.nome, year: yearMatch.nome },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: auth } = await userClient.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const { vehicle_id, brand: bIn, model: mIn, year: yIn, kind: kIn, save = true } = body ?? {};

    let vehicle: any = null;
    if (vehicle_id) {
      const { data } = await supa.from("vehicles").select("*").eq("id", vehicle_id).maybeSingle();
      if (!data) return new Response(JSON.stringify({ error: "vehicle_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      vehicle = data;
    }

    const brand = (bIn ?? vehicle?.brand ?? "").trim();
    const model = (mIn ?? vehicle?.model ?? "").trim();
    const year = yIn ?? vehicle?.year_model ?? vehicle?.year_manufacture ?? null;
    const kind = kIn ?? vehicleKind(vehicle?.vehicle_type);
    if (!brand || !model) return new Response(JSON.stringify({ error: "missing_brand_or_model" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const result = await lookup(supa, kind, brand, model, year ? Number(year) : null);

    if (vehicle && save) {
      const prev = vehicle.fipe_value ? Number(vehicle.fipe_value) : null;
      const dep = prev && prev > 0 ? Number((((result.fipe_value - prev) / prev) * 100).toFixed(2)) : null;
      await supa.from("vehicles").update({
        fipe_code: result.fipe_code,
        fipe_brand_code: result.fipe_brand_code,
        fipe_model_code: result.fipe_model_code,
        fipe_year_code: result.fipe_year_code,
        fipe_value: result.fipe_value,
        fipe_value_updated_at: new Date().toISOString(),
        fipe_reference_month: result.reference_month,
      }).eq("id", vehicle.id);
      await supa.from("vehicle_fipe_history").insert({
        company_id: vehicle.company_id,
        vehicle_id: vehicle.id,
        fipe_code: result.fipe_code,
        fipe_value: result.fipe_value,
        reference_month: result.reference_month,
        queried_by: userId,
        depreciation_pct: dep,
        source: "api",
      });
      (result as any).depreciation_pct = dep;
    }

    return new Response(JSON.stringify({ ok: true, ...result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "fipe_error" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});