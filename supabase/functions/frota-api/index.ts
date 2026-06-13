// FrotaOps - API pública para integrações externas (Central de Agentes de IA).
// Autenticação via Bearer <chave>. Toda resposta segue o formato { ok, dados } ou { ok:false, erro }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function ok(dados: unknown, status = 200) {
  return new Response(JSON.stringify({ ok: true, dados }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function fail(erro: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, erro }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type AuthCtx = {
  admin: ReturnType<typeof createClient>;
  keyId: string;
  keyName: string;
  companyId: string;
};

async function authenticate(req: Request): Promise<{ ctx: AuthCtx } | { error: Response }> {
  const header = req.headers.get("Authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return { error: fail("Chave de API ausente. Use o header Authorization: Bearer <chave>.", 401) };
  const raw = m[1].trim();
  if (!raw) return { error: fail("Chave de API vazia.", 401) };
  const hash = await sha256Hex(raw);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data, error } = await admin
    .from("api_keys")
    .select("id, company_id, nome, ativa")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error) return { error: fail("Erro ao validar chave: " + error.message, 500) };
  if (!data) return { error: fail("Chave de API inválida.", 401) };
  if (!data.ativa) return { error: fail("Chave de API desativada.", 403) };
  admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  return {
    ctx: { admin, keyId: data.id as string, keyName: data.nome as string, companyId: data.company_id as string },
  };
}

async function logRequest(
  admin: ReturnType<typeof createClient>,
  keyId: string | null,
  companyId: string | null,
  keyName: string | null,
  method: string,
  path: string,
  status: number,
  error?: string | null,
) {
  try {
    await admin.from("api_request_logs").insert({
      api_key_id: keyId,
      company_id: companyId,
      key_name: keyName,
      method,
      path,
      status,
      error: error ?? null,
    });
  } catch {
    /* noop */
  }
}

function methodNotAllowed(expected: string) {
  return fail(`Método não permitido para esta rota. Use ${expected}.`, 405);
}

async function readJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// ============== HANDLERS ==============

async function handleVeiculos(req: Request, url: URL, ctx: AuthCtx): Promise<Response> {
  if (req.method === "GET") {
    const { data, error } = await ctx.admin
      .from("vehicles")
      .select("id, plate, brand, model, year_model, year_manufacture, current_km, status, fuel_type")
      .eq("company_id", ctx.companyId)
      .order("plate", { ascending: true });
    if (error) return fail(error.message, 500);
    return ok(data ?? []);
  }
  if (req.method === "POST") {
    const body = await readJson(req);
    if (!body || typeof body !== "object") return fail("Corpo JSON inválido.", 400);
    if (!body.plate || !body.model) return fail("Campos obrigatórios: plate, model.", 400);
    const payload: Record<string, unknown> = {
      company_id: ctx.companyId,
      plate: String(body.plate).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7),
      brand: body.brand ?? null,
      model: body.model,
      year_model: body.year_model ?? body.ano ?? null,
      year_manufacture: body.year_manufacture ?? null,
      current_km: body.current_km ?? body.km ?? 0,
      status: body.status ?? "active",
      fuel_type: body.fuel_type ?? null,
    };
    const { data, error } = await ctx.admin.from("vehicles").insert(payload).select("*").maybeSingle();
    if (error) return fail(error.message, 400);
    return ok(data, 201);
  }
  if (req.method === "PATCH") {
    const body = await readJson(req);
    if (!body?.id) return fail("Campo obrigatório: id.", 400);
    const { id, ...rest } = body;
    delete (rest as any).company_id;
    const { data, error } = await ctx.admin
      .from("vehicles")
      .update(rest)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .select("*")
      .maybeSingle();
    if (error) return fail(error.message, 400);
    if (!data) return fail("Veículo não encontrado nesta empresa.", 404);
    return ok(data);
  }
  return methodNotAllowed("GET, POST ou PATCH");
}

// ============== ROUTER ==============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // Caminho relativo após "/frota-api"
  const path = url.pathname.replace(/^.*\/frota-api/, "") || "/";

  try {
    // Rota pública: health
    if (path === "/health" || path === "/") {
      if (req.method !== "GET") return methodNotAllowed("GET");
      return ok({ status: "ok", service: "frota-api", time: new Date().toISOString() });
    }

    // Demais rotas exigem autenticação
    const auth = await authenticate(req);
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    let response: Response;
    if (path === "/veiculos") {
      response = await handleVeiculos(req, url, ctx);
    } else {
      response = fail("Rota não encontrada: " + path, 404);
    }

    const body = await response.clone().json().catch(() => ({}));
    logRequest(
      ctx.admin,
      ctx.keyId,
      ctx.companyId,
      ctx.keyName,
      req.method,
      path,
      response.status,
      body?.ok === false ? body?.erro ?? null : null,
    );
    return response;
  } catch (e) {
    return fail("Erro interno: " + String((e as Error)?.message ?? e), 500);
  }
});