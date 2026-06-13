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

const VEHICLE_STATUS_VALUES = new Set([
  "ativo",
  "manutencao",
  "vendido",
  "parado",
  "sinistrado",
  "inativo",
  "transferido",
  "roubado_furtado",
  "leiloado",
]);

function normalizeVehicleStatus(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw || raw === "active") return "ativo";
  return VEHICLE_STATUS_VALUES.has(raw) ? raw : "ativo";
}

const MAINTENANCE_TYPE_VALUES = new Set(["preventiva", "corretiva", "pneus", "sinistro"]);
const MAINTENANCE_STATUS_VALUES = new Set(["agendada", "em_andamento", "concluida", "cancelada"]);
const MAINTENANCE_REQUEST_STATUSES = new Set([
  "pendente_aprovacao",
  "em_analise",
  "agendada",
  "rejeitada",
  "concluida",
]);

function normalizeMaintenanceType(value: unknown): string | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  return MAINTENANCE_TYPE_VALUES.has(raw) ? raw : null;
}
function normalizeMaintenanceStatus(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "concluida";
  return MAINTENANCE_STATUS_VALUES.has(raw) ? raw : "concluida";
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
      status: normalizeVehicleStatus(body.status),
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
    if ("status" in rest) {
      (rest as Record<string, unknown>).status = normalizeVehicleStatus((rest as Record<string, unknown>).status);
    }
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

// -------- Manutenções --------

async function handleManutencoes(req: Request, url: URL, ctx: AuthCtx): Promise<Response> {
  if (req.method === "GET") {
    const vehicleId = url.searchParams.get("vehicle_id");
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);
    let q = ctx.admin
      .from("maintenance_records")
      .select(
        "id, vehicle_id, driver_id, type, status, category, service_at, km_at_service, next_service_km, next_service_at, workshop_name, workshop_cnpj, labor_value, parts_value, total_value, description, notes",
      )
      .eq("company_id", ctx.companyId)
      .order("service_at", { ascending: false })
      .limit(limit);
    if (vehicleId) q = q.eq("vehicle_id", vehicleId);
    if (status) q = q.eq("status", normalizeMaintenanceStatus(status));
    if (from) q = q.gte("service_at", from);
    if (to) q = q.lte("service_at", to);
    const { data, error } = await q;
    if (error) return fail(error.message, 500);
    return ok(data ?? []);
  }
  if (req.method === "POST") {
    const body = await readJson(req);
    if (!body || typeof body !== "object") return fail("Corpo JSON inválido.", 400);
    if (!body.vehicle_id) return fail("Campo obrigatório: vehicle_id.", 400);
    const type = normalizeMaintenanceType(body.type ?? body.tipo);
    if (!type) {
      return fail("Campo 'type' obrigatório. Valores aceitos: preventiva, corretiva, pneus, sinistro.", 400);
    }
    // Garante que o veículo pertence à empresa da chave
    const { data: veh, error: vErr } = await ctx.admin
      .from("vehicles")
      .select("id")
      .eq("id", body.vehicle_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle();
    if (vErr) return fail(vErr.message, 500);
    if (!veh) return fail("Veículo não encontrado nesta empresa.", 404);

    const labor = Number(body.labor_value ?? 0) || 0;
    const parts = Number(body.parts_value ?? 0) || 0;
    const total = body.total_value != null ? Number(body.total_value) || 0 : labor + parts;

    const payload: Record<string, unknown> = {
      company_id: ctx.companyId,
      vehicle_id: body.vehicle_id,
      driver_id: body.driver_id ?? null,
      cost_center_id: body.cost_center_id ?? null,
      type,
      status: normalizeMaintenanceStatus(body.status ?? "concluida"),
      category: body.category ?? null,
      service_at: body.service_at ?? new Date().toISOString(),
      km_at_service: body.km_at_service ?? null,
      next_service_km: body.next_service_km ?? null,
      next_service_at: body.next_service_at ?? null,
      workshop_name: body.workshop_name ?? null,
      workshop_cnpj: body.workshop_cnpj ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      parts: Array.isArray(body.parts) ? body.parts : [],
      labor_value: labor,
      parts_value: parts,
      total_value: total,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      description: body.description ?? null,
      notes: body.notes ?? null,
    };
    const { data, error } = await ctx.admin
      .from("maintenance_records")
      .insert(payload)
      .select("*")
      .maybeSingle();
    if (error) return fail(error.message, 400);
    return ok(data, 201);
  }
  return methodNotAllowed("GET ou POST");
}

async function handleManutencoesAprovar(req: Request, _url: URL, ctx: AuthCtx): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed("POST");
  const body = await readJson(req);
  if (!body?.id) return fail("Campo obrigatório: id (id da solicitação de manutenção).", 400);
  const decisao = String(body.decisao ?? body.decision ?? "aprovar").toLowerCase();
  const isReject = decisao === "rejeitar" || decisao === "reject" || decisao === "rejeitada";
  const newStatus = isReject ? "rejeitada" : "agendada";
  if (isReject && !body.rejection_reason) {
    return fail("Para rejeitar, informe 'rejection_reason'.", 400);
  }

  // Verifica que a solicitação pertence à empresa
  const { data: reqRow, error: reqErr } = await ctx.admin
    .from("maintenance_requests")
    .select("id, status, company_id")
    .eq("id", body.id)
    .eq("company_id", ctx.companyId)
    .maybeSingle();
  if (reqErr) return fail(reqErr.message, 500);
  if (!reqRow) return fail("Solicitação não encontrada nesta empresa.", 404);
  if (!MAINTENANCE_REQUEST_STATUSES.has(reqRow.status as string)) {
    return fail("Status atual inválido: " + reqRow.status, 400);
  }

  const update: Record<string, unknown> = {
    status: newStatus,
    reviewed_at: new Date().toISOString(),
  };
  if (isReject) {
    update.rejection_reason = body.rejection_reason;
  } else {
    if (body.scheduled_date) update.scheduled_date = body.scheduled_date;
    if (body.scheduled_workshop_id) update.scheduled_workshop_id = body.scheduled_workshop_id;
    if (body.estimated_cost != null) update.estimated_cost = Number(body.estimated_cost) || 0;
    if (body.gestor_notes) update.gestor_notes = body.gestor_notes;
  }

  const { data, error } = await ctx.admin
    .from("maintenance_requests")
    .update(update)
    .eq("id", body.id)
    .eq("company_id", ctx.companyId)
    .select("*")
    .maybeSingle();
  if (error) return fail(error.message, 400);
  return ok(data);
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
    } else if (path === "/me") {
      response = await handleMe(req, ctx);
    } else if (path === "/manutencoes") {
      response = await handleManutencoes(req, url, ctx);
    } else if (path === "/manutencoes/aprovar") {
      response = await handleManutencoesAprovar(req, url, ctx);
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