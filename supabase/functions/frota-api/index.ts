// FrotaOps - API pública para integrações externas (Central de Agentes de IA).
// Autenticação via Bearer <chave>. Toda resposta segue o formato { ok, dados } ou { ok:false, erro }.
//
// SEGURANÇA:
// - Roda com SERVICE_ROLE: bypassa RLS. O escopo por company_id em cada query é a ÚNICA proteção multi-tenant.
// - Allowlist explícito de rotas: qualquer path fora da lista retorna 404. Sem acesso genérico a "qualquer tabela".
// - DENYLIST implícito: tabelas sensíveis (api_keys, super_admins, role_permissions, user_roles, company_members,
//   companies(escrita), subscriptions/payments/plans/coupons, audit_logs, api_request_logs, profiles, leads,
//   first_access_tokens, email_*, ai_*, *_cache) NÃO têm rota — nunca são lidas nem escritas pela API.
// - Toda escrita checa o escopo da chave (api_keys.scopes). Sem escopo → 403.
// - Toda escrita grava em api_write_audit.
// - Soft-delete: nenhum DELETE físico — vira PATCH (status ou deleted_at).
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
  scopes: string[];
};

function hasScope(ctx: AuthCtx, scope: string): boolean {
  if (!ctx.scopes || ctx.scopes.length === 0) return false;
  if (ctx.scopes.includes("*")) return true;
  if (ctx.scopes.includes(scope)) return true;
  // wildcard por recurso: "veiculos:*"
  const [resource] = scope.split(":");
  if (ctx.scopes.includes(`${resource}:*`)) return true;
  // wildcard por ação: "*:read"
  const [, action] = scope.split(":");
  if (action && ctx.scopes.includes(`*:${action}`)) return true;
  return false;
}

function requireScope(ctx: AuthCtx, scope: string): Response | null {
  return hasScope(ctx, scope) ? null : fail(`Chave de API sem permissão para '${scope}'.`, 403);
}

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
    .select("id, company_id, nome, ativa, scopes")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error) return { error: fail("Erro ao validar chave: " + error.message, 500) };
  if (!data) return { error: fail("Chave de API inválida.", 401) };
  if (!data.ativa) return { error: fail("Chave de API desativada.", 403) };
  admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  const scopes = Array.isArray((data as any).scopes) && (data as any).scopes.length > 0
    ? ((data as any).scopes as string[])
    : ["*"];
  return {
    ctx: {
      admin,
      keyId: data.id as string,
      keyName: data.nome as string,
      companyId: data.company_id as string,
      scopes,
    },
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
  } catch { /* noop */ }
}

async function logWrite(
  ctx: AuthCtx,
  resource: string,
  action: string,
  entityId: string | null,
  payload: unknown,
) {
  try {
    await ctx.admin.from("api_write_audit").insert({
      company_id: ctx.companyId,
      api_key_id: ctx.keyId,
      key_name: ctx.keyName,
      resource,
      action,
      entity_id: entityId,
      payload: payload as any,
    });
  } catch { /* noop */ }
}

function methodNotAllowed(expected: string) {
  return fail(`Método não permitido para esta rota. Use ${expected}.`, 405);
}

async function readJson(req: Request): Promise<any> {
  try { return await req.json(); } catch { return null; }
}

// ============== ENUMS ==============

const VEHICLE_STATUS_VALUES = new Set([
  "ativo","manutencao","vendido","parado","sinistrado","inativo","transferido","roubado_furtado","leiloado",
]);
function normalizeVehicleStatus(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw || raw === "active") return "ativo";
  return VEHICLE_STATUS_VALUES.has(raw) ? raw : "ativo";
}

const MAINTENANCE_TYPE_VALUES = new Set(["preventiva","corretiva","pneus","sinistro"]);
const MAINTENANCE_STATUS_VALUES = new Set(["agendada","em_andamento","concluida","cancelada"]);
const MAINTENANCE_REQUEST_STATUSES = new Set([
  "pendente_aprovacao","em_analise","agendada","rejeitada","concluida",
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

const FUEL_TYPE_VALUES = new Set([
  "gasolina","etanol","diesel","diesel_s10","flex","gnv","eletrico","hibrido",
]);
const PAYMENT_METHOD_VALUES = new Set([
  "cartao_frota","dinheiro","pix","credito","debito","faturado","outro",
]);

const DRIVER_STATUS_VALUES = new Set([
  "ativo","inativo","ferias","afastado","desligado","licenca_medica","suspenso",
]);

const DOCUMENT_ENTITY_VALUES = new Set(["vehicle","driver"]);
const DOCUMENT_TYPE_VALUES = new Set([
  "crlv","ipva","licenciamento","seguro","rastreador","laudo_veiculo","outro_veiculo",
  "cnh","exame_medico","exame_toxicologico","curso_mopp","curso_transporte_passageiros","outro_motorista",
]);
const DOCUMENT_STATUS_VALUES = new Set(["valido","vencendo","vencido","sem_validade"]);

const CHECKLIST_RUN_STATUS_VALUES = new Set([
  "pendente","em_andamento","concluido","reprovado","cancelado",
]);

// trips / fines / expenses / workshops / suppliers / work_orders são colunas TEXT (sem enum no banco).
// Mesmo assim, validamos contra um conjunto fechado para evitar lixo.
const TRIP_STATUS_VALUES = new Set([
  "planejada","em_andamento","concluida","cancelada","aguardando_acerto","fechada",
]);
const FINE_STATUS_VALUES = new Set([
  "pendente","indicar_condutor","em_recurso","paga","cancelada","vencida","julgada",
]);
const WORK_ORDER_STATUSES = new Set([
  "rascunho","aguardando_orcamento","orcamento_recebido","aprovada","rejeitada",
  "em_execucao","concluida","faturada","paga","cancelada",
]);

// ============== HANDLERS ==============

async function handleMe(req: Request, ctx: AuthCtx): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed("GET");
  if (!hasScope(ctx, "me:read")) return fail("Chave sem permissão 'me:read'.", 403);
  const { data, error } = await ctx.admin
    .from("companies")
    .select("id, name, cnpj, email, phone, city, state, status")
    .eq("id", ctx.companyId)
    .maybeSingle();
  if (error) return fail(error.message, 500);
  if (!data) return fail("Empresa não encontrada.", 404);

  let plano: string | null = null;
  try {
    const { data: sub } = await ctx.admin
      .from("subscriptions")
      .select("plan_id, status, plans(name)")
      .eq("company_id", ctx.companyId)
      .in("status", ["active", "trialing", "ativa"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    plano = (sub as any)?.plans?.name ?? null;
  } catch { /* noop */ }

  return ok({
    company_id: data.id,
    nome: (data as any).name,
    cnpj: (data as any).cnpj,
    email: (data as any).email,
    telefone: (data as any).phone,
    cidade: (data as any).city,
    uf: (data as any).state,
    status: (data as any).status,
    plano,
    chave: { nome: ctx.keyName, scopes: ctx.scopes },
  });
}

// -------- Veículos --------
async function handleVeiculos(req: Request, _url: URL, ctx: AuthCtx): Promise<Response> {
  if (req.method === "GET") {
    const guard = requireScope(ctx, "veiculos:read"); if (guard) return guard;
    const { data, error } = await ctx.admin
      .from("vehicles")
      .select("id, plate, brand, model, year_model, year_manufacture, current_km, status, fuel_type, chassis, renavam, color")
      .eq("company_id", ctx.companyId)
      .order("plate", { ascending: true });
    if (error) return fail(error.message, 500);
    return ok(data ?? []);
  }
  if (req.method === "POST") {
    const guard = requireScope(ctx, "veiculos:write"); if (guard) return guard;
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
    await logWrite(ctx, "veiculos", "create", (data as any)?.id ?? null, payload);
    return ok(data, 201);
  }
  if (req.method === "PATCH") {
    const guard = requireScope(ctx, "veiculos:write"); if (guard) return guard;
    const body = await readJson(req);
    if (!body?.id) return fail("Campo obrigatório: id.", 400);
    const { id, ...rest } = body;
    delete (rest as any).company_id;
    if ("status" in rest) {
      (rest as Record<string, unknown>).status = normalizeVehicleStatus((rest as Record<string, unknown>).status);
    }
    const { data, error } = await ctx.admin
      .from("vehicles").update(rest).eq("id", id).eq("company_id", ctx.companyId)
      .select("*").maybeSingle();
    if (error) return fail(error.message, 400);
    if (!data) return fail("Veículo não encontrado nesta empresa.", 404);
    await logWrite(ctx, "veiculos", "update", id, rest);
    return ok(data);
  }
  return methodNotAllowed("GET, POST ou PATCH");
}

// -------- Manutenções --------
async function handleManutencoes(req: Request, url: URL, ctx: AuthCtx): Promise<Response> {
  if (req.method === "GET") {
    const guard = requireScope(ctx, "manutencoes:read"); if (guard) return guard;
    const vehicleId = url.searchParams.get("vehicle_id");
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);
    let q = ctx.admin
      .from("maintenance_records")
      .select("id, vehicle_id, driver_id, type, status, category, service_at, km_at_service, next_service_km, next_service_at, workshop_name, workshop_cnpj, labor_value, parts_value, total_value, description, notes")
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
    const guard = requireScope(ctx, "manutencoes:write"); if (guard) return guard;
    const body = await readJson(req);
    if (!body || typeof body !== "object") return fail("Corpo JSON inválido.", 400);
    if (!body.vehicle_id) return fail("Campo obrigatório: vehicle_id.", 400);
    const type = normalizeMaintenanceType(body.type ?? body.tipo);
    if (!type) return fail("Campo 'type' obrigatório. Valores: preventiva, corretiva, pneus, sinistro.", 400);
    const { data: veh, error: vErr } = await ctx.admin
      .from("vehicles").select("id").eq("id", body.vehicle_id).eq("company_id", ctx.companyId).maybeSingle();
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
    const { data, error } = await ctx.admin.from("maintenance_records").insert(payload).select("*").maybeSingle();
    if (error) return fail(error.message, 400);
    await logWrite(ctx, "manutencoes", "create", (data as any)?.id ?? null, payload);
    return ok(data, 201);
  }
  return methodNotAllowed("GET ou POST");
}

async function handleManutencoesAprovar(req: Request, _url: URL, ctx: AuthCtx): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed("POST");
  const guard = requireScope(ctx, "manutencoes:write"); if (guard) return guard;
  const body = await readJson(req);
  if (!body?.id) return fail("Campo obrigatório: id (id da solicitação).", 400);
  const decisao = String(body.decisao ?? body.decision ?? "aprovar").toLowerCase();
  const isReject = decisao === "rejeitar" || decisao === "reject" || decisao === "rejeitada";
  const newStatus = isReject ? "rejeitada" : "agendada";
  if (isReject && !body.rejection_reason) return fail("Para rejeitar, informe 'rejection_reason'.", 400);

  const { data: reqRow, error: reqErr } = await ctx.admin
    .from("maintenance_requests").select("id, status, company_id")
    .eq("id", body.id).eq("company_id", ctx.companyId).maybeSingle();
  if (reqErr) return fail(reqErr.message, 500);
  if (!reqRow) return fail("Solicitação não encontrada nesta empresa.", 404);
  if (!MAINTENANCE_REQUEST_STATUSES.has(reqRow.status as string)) {
    return fail("Status atual inválido: " + reqRow.status, 400);
  }

  const update: Record<string, unknown> = { status: newStatus, reviewed_at: new Date().toISOString() };
  if (isReject) update.rejection_reason = body.rejection_reason;
  else {
    if (body.scheduled_date) update.scheduled_date = body.scheduled_date;
    if (body.scheduled_workshop_id) update.scheduled_workshop_id = body.scheduled_workshop_id;
    if (body.estimated_cost != null) update.estimated_cost = Number(body.estimated_cost) || 0;
    if (body.gestor_notes) update.gestor_notes = body.gestor_notes;
  }

  const { data, error } = await ctx.admin
    .from("maintenance_requests").update(update).eq("id", body.id).eq("company_id", ctx.companyId)
    .select("*").maybeSingle();
  if (error) return fail(error.message, 400);
  await logWrite(ctx, "manutencoes_aprovar", isReject ? "reject" : "approve", body.id, update);
  return ok(data);
}

// -------- Abastecimentos --------
async function handleAbastecimentos(req: Request, url: URL, ctx: AuthCtx): Promise<Response> {
  if (req.method === "GET") {
    const guard = requireScope(ctx, "abastecimentos:read"); if (guard) return guard;
    const vehicleId = url.searchParams.get("vehicle_id");
    const driverId = url.searchParams.get("driver_id");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);
    let q = ctx.admin.from("fuel_records")
      .select("id, vehicle_id, driver_id, fueled_at, station_name, station_cnpj, city, state, fuel_type, liters, price_per_liter, total_value, full_tank, km_at_fueling, payment_method, km_driven, km_per_liter, cost_per_km, notes")
      .eq("company_id", ctx.companyId)
      .order("fueled_at", { ascending: false }).limit(limit);
    if (vehicleId) q = q.eq("vehicle_id", vehicleId);
    if (driverId) q = q.eq("driver_id", driverId);
    if (from) q = q.gte("fueled_at", from);
    if (to) q = q.lte("fueled_at", to);
    const { data, error } = await q;
    if (error) return fail(error.message, 500);
    return ok(data ?? []);
  }
  if (req.method === "POST") {
    const guard = requireScope(ctx, "abastecimentos:write"); if (guard) return guard;
    const body = await readJson(req);
    if (!body || typeof body !== "object") return fail("Corpo JSON inválido.", 400);
    if (!body.vehicle_id) return fail("Campo obrigatório: vehicle_id.", 400);
    if (body.liters == null) return fail("Campo obrigatório: liters.", 400);

    const fuelType = String(body.fuel_type ?? "").trim().toLowerCase();
    if (!FUEL_TYPE_VALUES.has(fuelType)) {
      return fail(`fuel_type inválido. Valores: ${[...FUEL_TYPE_VALUES].join(", ")}.`, 400);
    }
    const payment = String(body.payment_method ?? "outro").trim().toLowerCase();
    if (!PAYMENT_METHOD_VALUES.has(payment)) {
      return fail(`payment_method inválido. Valores: ${[...PAYMENT_METHOD_VALUES].join(", ")}.`, 400);
    }

    const { data: veh, error: vErr } = await ctx.admin
      .from("vehicles").select("id").eq("id", body.vehicle_id).eq("company_id", ctx.companyId).maybeSingle();
    if (vErr) return fail(vErr.message, 500);
    if (!veh) return fail("Veículo não encontrado nesta empresa.", 404);

    const liters = Number(body.liters) || 0;
    const ppl = body.price_per_liter != null ? Number(body.price_per_liter) || 0 : 0;
    const total = body.total_value != null ? Number(body.total_value) || 0 : Number((liters * ppl).toFixed(2));

    const payload: Record<string, unknown> = {
      company_id: ctx.companyId,
      vehicle_id: body.vehicle_id,
      driver_id: body.driver_id ?? null,
      cost_center_id: body.cost_center_id ?? null,
      fueled_at: body.fueled_at ?? new Date().toISOString(),
      station_name: body.station_name ?? null,
      station_cnpj: body.station_cnpj ?? null,
      fuel_station_id: body.fuel_station_id ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      fuel_type: fuelType,
      liters,
      price_per_liter: ppl,
      total_value: total,
      full_tank: body.full_tank ?? false,
      km_at_fueling: body.km_at_fueling ?? null,
      payment_method: payment,
      notes: body.notes ?? null,
      source_origin: "api",
    };
    const { data, error } = await ctx.admin.from("fuel_records").insert(payload).select("*").maybeSingle();
    if (error) return fail(error.message, 400);
    await logWrite(ctx, "abastecimentos", "create", (data as any)?.id ?? null, payload);
    return ok(data, 201);
  }
  if (req.method === "PATCH") {
    const guard = requireScope(ctx, "abastecimentos:write"); if (guard) return guard;
    const body = await readJson(req);
    if (!body?.id) return fail("Campo obrigatório: id.", 400);
    const { id, ...rest } = body;
    delete (rest as any).company_id;
    if ("fuel_type" in rest) {
      const v = String((rest as any).fuel_type ?? "").trim().toLowerCase();
      if (!FUEL_TYPE_VALUES.has(v)) return fail("fuel_type inválido.", 400);
      (rest as any).fuel_type = v;
    }
    if ("payment_method" in rest) {
      const v = String((rest as any).payment_method ?? "").trim().toLowerCase();
      if (!PAYMENT_METHOD_VALUES.has(v)) return fail("payment_method inválido.", 400);
      (rest as any).payment_method = v;
    }
    const { data, error } = await ctx.admin
      .from("fuel_records").update(rest).eq("id", id).eq("company_id", ctx.companyId)
      .select("*").maybeSingle();
    if (error) return fail(error.message, 400);
    if (!data) return fail("Abastecimento não encontrado nesta empresa.", 404);
    await logWrite(ctx, "abastecimentos", "update", id, rest);
    return ok(data);
  }
  return methodNotAllowed("GET, POST ou PATCH");
}

// -------- Documentos --------
function parseStorageUrl(fileUrl: string | null): { bucket: string; path: string } | null {
  if (!fileUrl) return null;
  // Aceita /storage/v1/object/(public|sign|authenticated)/<bucket>/<path...>
  const m = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

async function handleDocumentos(req: Request, url: URL, ctx: AuthCtx, restPath: string): Promise<Response> {
  // /documentos/:id/download
  const downloadMatch = restPath.match(/^\/([0-9a-f-]{36})\/download\/?$/i);
  if (downloadMatch) {
    if (req.method !== "GET") return methodNotAllowed("GET");
    const guard = requireScope(ctx, "documentos:read"); if (guard) return guard;
    const docId = downloadMatch[1];
    const { data: doc, error } = await ctx.admin
      .from("documents")
      .select("id, file_url, file_name, mime_type, company_id, deleted_at")
      .eq("id", docId).eq("company_id", ctx.companyId).maybeSingle();
    if (error) return fail(error.message, 500);
    if (!doc || (doc as any).deleted_at) return fail("Documento não encontrado nesta empresa.", 404);
    const parsed = parseStorageUrl((doc as any).file_url);
    if (!parsed) return fail("Documento sem arquivo arquivado.", 404);
    const { data: signed, error: sErr } = await (ctx.admin as any).storage
      .from(parsed.bucket).createSignedUrl(parsed.path, 60 * 5);
    if (sErr || !signed?.signedUrl) return fail("Falha ao gerar link: " + (sErr?.message ?? "desconhecido"), 500);
    return ok({
      id: (doc as any).id,
      file_name: (doc as any).file_name,
      mime_type: (doc as any).mime_type,
      signed_url: signed.signedUrl,
      expires_in_seconds: 300,
    });
  }

  // /documentos/analisar
  if (restPath === "/analisar" || restPath === "/analisar/") {
    if (req.method !== "POST") return methodNotAllowed("POST");
    const guard = requireScope(ctx, "documentos:write"); if (guard) return guard;
    const body = await readJson(req);
    if (!body) return fail("Corpo JSON inválido.", 400);
    const type = String(body.type ?? body.doc_type ?? "document");

    let fileBase64: string | null = body.file_base64 ?? body.fileBase64 ?? null;
    let mimeType: string = body.mime_type ?? body.mimeType ?? "application/octet-stream";

    if (body.document_id && !fileBase64) {
      const { data: doc, error } = await ctx.admin
        .from("documents").select("file_url, mime_type, company_id, deleted_at")
        .eq("id", body.document_id).eq("company_id", ctx.companyId).maybeSingle();
      if (error) return fail(error.message, 500);
      if (!doc || (doc as any).deleted_at) return fail("Documento não encontrado.", 404);
      const parsed = parseStorageUrl((doc as any).file_url);
      if (!parsed) return fail("Documento sem arquivo arquivado.", 404);
      const { data: dl, error: dErr } = await (ctx.admin as any).storage.from(parsed.bucket).download(parsed.path);
      if (dErr || !dl) return fail("Falha ao baixar arquivo: " + (dErr?.message ?? "desconhecido"), 500);
      const buf = new Uint8Array(await (dl as Blob).arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      fileBase64 = btoa(bin);
      mimeType = (doc as any).mime_type ?? mimeType;
    }
    if (!fileBase64) return fail("Informe document_id ou file_base64.", 400);

    const { data: extracted, error: fErr } = await ctx.admin.functions.invoke("extract-document", {
      body: { type, fileBase64, mimeType },
    });
    if (fErr) return fail("Falha na extração: " + fErr.message, 500);
    await logWrite(ctx, "documentos", "analyze", body.document_id ?? null, { type, source: body.document_id ? "id" : "base64" });
    return ok(extracted);
  }

  // Coleção /documentos
  if (restPath === "" || restPath === "/") {
    if (req.method === "GET") {
      const guard = requireScope(ctx, "documentos:read"); if (guard) return guard;
      const entityType = url.searchParams.get("entity_type");
      const docType = url.searchParams.get("doc_type");
      const entityId = url.searchParams.get("entity_id");
      const vencimento = url.searchParams.get("vencimento"); // 'vencidos' | 'vencendo' | 'validos'
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 200) || 200, 500);
      let q = ctx.admin.from("documents")
        .select("id, entity_type, entity_id, doc_type, title, document_number, issuer, issue_date, expires_at, status, file_name, mime_type, notes, created_at")
        .eq("company_id", ctx.companyId)
        .is("deleted_at", null)
        .order("expires_at", { ascending: true, nullsFirst: false })
        .limit(limit);
      if (entityType && DOCUMENT_ENTITY_VALUES.has(entityType)) q = q.eq("entity_type", entityType);
      if (entityId) q = q.eq("entity_id", entityId);
      if (docType && DOCUMENT_TYPE_VALUES.has(docType)) q = q.eq("doc_type", docType);
      if (vencimento === "vencidos") q = q.eq("status", "vencido");
      else if (vencimento === "vencendo") q = q.eq("status", "vencendo");
      else if (vencimento === "validos") q = q.eq("status", "valido");
      const { data, error } = await q;
      if (error) return fail(error.message, 500);
      return ok(data ?? []);
    }
    if (req.method === "POST") {
      const guard = requireScope(ctx, "documentos:write"); if (guard) return guard;
      const body = await readJson(req);
      if (!body) return fail("Corpo JSON inválido.", 400);
      const entityType = String(body.entity_type ?? "");
      const docType = String(body.doc_type ?? "");
      if (!DOCUMENT_ENTITY_VALUES.has(entityType)) return fail("entity_type inválido: vehicle | driver.", 400);
      if (!DOCUMENT_TYPE_VALUES.has(docType)) return fail("doc_type inválido.", 400);
      if (!body.entity_id) return fail("entity_id obrigatório.", 400);
      // Valida entidade pertence à empresa
      const table = entityType === "vehicle" ? "vehicles" : "drivers";
      const { data: ent } = await ctx.admin.from(table).select("id").eq("id", body.entity_id).eq("company_id", ctx.companyId).maybeSingle();
      if (!ent) return fail(`${entityType} não pertence a esta empresa.`, 404);
      const status = body.status && DOCUMENT_STATUS_VALUES.has(body.status) ? body.status : "sem_validade";
      const payload: Record<string, unknown> = {
        company_id: ctx.companyId,
        entity_type: entityType,
        entity_id: body.entity_id,
        doc_type: docType,
        title: body.title ?? null,
        document_number: body.document_number ?? null,
        issuer: body.issuer ?? null,
        issue_date: body.issue_date ?? null,
        expires_at: body.expires_at ?? null,
        status,
        file_url: body.file_url ?? null,
        file_name: body.file_name ?? null,
        mime_type: body.mime_type ?? null,
        ai_extracted: body.ai_extracted ?? {},
        ai_validation: body.ai_validation ?? {},
        notes: body.notes ?? null,
      };
      const { data, error } = await ctx.admin.from("documents").insert(payload).select("*").maybeSingle();
      if (error) return fail(error.message, 400);
      await logWrite(ctx, "documentos", "create", (data as any)?.id ?? null, payload);
      return ok(data, 201);
    }
    if (req.method === "PATCH") {
      const guard = requireScope(ctx, "documentos:write"); if (guard) return guard;
      const body = await readJson(req);
      if (!body?.id) return fail("Campo obrigatório: id.", 400);
      const { id, ...rest } = body;
      delete (rest as any).company_id;
      // soft-delete via campo `remover: true`
      if ((rest as any).remover === true) {
        (rest as any).deleted_at = new Date().toISOString();
        delete (rest as any).remover;
      }
      if ("status" in rest && !DOCUMENT_STATUS_VALUES.has((rest as any).status)) {
        return fail("status inválido.", 400);
      }
      const { data, error } = await ctx.admin
        .from("documents").update(rest).eq("id", id).eq("company_id", ctx.companyId)
        .select("*").maybeSingle();
      if (error) return fail(error.message, 400);
      if (!data) return fail("Documento não encontrado.", 404);
      await logWrite(ctx, "documentos", "update", id, rest);
      return ok(data);
    }
    return methodNotAllowed("GET, POST ou PATCH");
  }

  // /documentos/vencimentos
  if (restPath === "/vencimentos" || restPath === "/vencimentos/") {
    if (req.method !== "GET") return methodNotAllowed("GET");
    const guard = requireScope(ctx, "documentos:read"); if (guard) return guard;
    const { data, error } = await ctx.admin.from("documents")
      .select("id, entity_type, entity_id, doc_type, title, expires_at, status")
      .eq("company_id", ctx.companyId).is("deleted_at", null)
      .in("status", ["vencendo", "vencido"])
      .order("expires_at", { ascending: true });
    if (error) return fail(error.message, 500);
    return ok(data ?? []);
  }

  return fail("Rota não encontrada: /documentos" + restPath, 404);
}

// -------- Motoristas --------
async function handleMotoristas(req: Request, _url: URL, ctx: AuthCtx): Promise<Response> {
  if (req.method === "GET") {
    const guard = requireScope(ctx, "motoristas:read"); if (guard) return guard;
    const { data, error } = await ctx.admin.from("drivers")
      .select("id, full_name, cpf, phone, email, cnh_number, cnh_category, cnh_expires_at, medical_exam_expires_at, status, branch_id")
      .eq("company_id", ctx.companyId).order("full_name", { ascending: true });
    if (error) return fail(error.message, 500);
    return ok(data ?? []);
  }
  if (req.method === "POST") {
    const guard = requireScope(ctx, "motoristas:write"); if (guard) return guard;
    const body = await readJson(req);
    if (!body?.full_name) return fail("Campo obrigatório: full_name.", 400);
    const status = body.status && DRIVER_STATUS_VALUES.has(body.status) ? body.status : "ativo";
    const payload: Record<string, unknown> = {
      company_id: ctx.companyId,
      branch_id: body.branch_id ?? null,
      full_name: body.full_name,
      cpf: body.cpf ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      cnh_number: body.cnh_number ?? null,
      cnh_category: body.cnh_category ?? null,
      cnh_expires_at: body.cnh_expires_at ?? null,
      medical_exam_expires_at: body.medical_exam_expires_at ?? null,
      address: body.address ?? null,
      birth_date: body.birth_date ?? null,
      notes: body.notes ?? null,
      status,
    };
    const { data, error } = await ctx.admin.from("drivers").insert(payload).select("*").maybeSingle();
    if (error) return fail(error.message, 400);
    await logWrite(ctx, "motoristas", "create", (data as any)?.id ?? null, payload);
    return ok(data, 201);
  }
  if (req.method === "PATCH") {
    const guard = requireScope(ctx, "motoristas:write"); if (guard) return guard;
    const body = await readJson(req);
    if (!body?.id) return fail("Campo obrigatório: id.", 400);
    const { id, ...rest } = body;
    delete (rest as any).company_id;
    if ((rest as any).remover === true) {
      (rest as any).status = "desligado";
      delete (rest as any).remover;
    }
    if ("status" in rest && !DRIVER_STATUS_VALUES.has((rest as any).status)) {
      return fail(`status inválido. Valores: ${[...DRIVER_STATUS_VALUES].join(", ")}.`, 400);
    }
    const { data, error } = await ctx.admin
      .from("drivers").update(rest).eq("id", id).eq("company_id", ctx.companyId)
      .select("*").maybeSingle();
    if (error) return fail(error.message, 400);
    if (!data) return fail("Motorista não encontrado.", 404);
    await logWrite(ctx, "motoristas", "update", id, rest);
    return ok(data);
  }
  return methodNotAllowed("GET, POST ou PATCH");
}

// -------- Viagens --------
async function handleViagens(req: Request, url: URL, ctx: AuthCtx): Promise<Response> {
  if (req.method === "GET") {
    const guard = requireScope(ctx, "viagens:read"); if (guard) return guard;
    const vehicleId = url.searchParams.get("vehicle_id");
    const driverId = url.searchParams.get("driver_id");
    const status = url.searchParams.get("status");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);
    let q = ctx.admin.from("trips")
      .select("id, trip_code, title, trip_type, vehicle_id, driver_id, origin_city, origin_state, destination_city, destination_state, scheduled_start_date, scheduled_end_date, actual_start_at, actual_end_at, km_at_start, km_at_end, status, budget_total")
      .eq("company_id", ctx.companyId)
      .order("scheduled_start_date", { ascending: false, nullsFirst: false }).limit(limit);
    if (vehicleId) q = q.eq("vehicle_id", vehicleId);
    if (driverId) q = q.eq("driver_id", driverId);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return fail(error.message, 500);
    return ok(data ?? []);
  }
  if (req.method === "POST") {
    const guard = requireScope(ctx, "viagens:write"); if (guard) return guard;
    const body = await readJson(req);
    if (!body?.vehicle_id || !body?.driver_id) return fail("Campos obrigatórios: vehicle_id, driver_id.", 400);
    const status = body.status && TRIP_STATUS_VALUES.has(body.status) ? body.status : "planejada";
    const payload: Record<string, unknown> = {
      company_id: ctx.companyId,
      vehicle_id: body.vehicle_id,
      driver_id: body.driver_id,
      title: body.title ?? null,
      description: body.description ?? null,
      trip_type: body.trip_type ?? null,
      origin_city: body.origin_city ?? null,
      origin_state: body.origin_state ?? null,
      destination_city: body.destination_city ?? null,
      destination_state: body.destination_state ?? null,
      estimated_km: body.estimated_km ?? null,
      scheduled_start_date: body.scheduled_start_date ?? null,
      scheduled_end_date: body.scheduled_end_date ?? null,
      budget_total: body.budget_total ?? null,
      budget_by_category: body.budget_by_category ?? {},
      notes: body.notes ?? null,
      status,
    };
    const { data, error } = await ctx.admin.from("trips").insert(payload).select("*").maybeSingle();
    if (error) return fail(error.message, 400);
    await logWrite(ctx, "viagens", "create", (data as any)?.id ?? null, payload);
    return ok(data, 201);
  }
  if (req.method === "PATCH") {
    const guard = requireScope(ctx, "viagens:write"); if (guard) return guard;
    const body = await readJson(req);
    if (!body?.id) return fail("Campo obrigatório: id.", 400);
    const { id, ...rest } = body;
    delete (rest as any).company_id;
    if ("status" in rest && !TRIP_STATUS_VALUES.has((rest as any).status)) {
      return fail(`status inválido. Valores: ${[...TRIP_STATUS_VALUES].join(", ")}.`, 400);
    }
    const { data, error } = await ctx.admin
      .from("trips").update(rest).eq("id", id).eq("company_id", ctx.companyId)
      .select("*").maybeSingle();
    if (error) return fail(error.message, 400);
    if (!data) return fail("Viagem não encontrada.", 404);
    await logWrite(ctx, "viagens", "update", id, rest);
    return ok(data);
  }
  return methodNotAllowed("GET, POST ou PATCH");
}

// -------- Despesas (vehicle_expenses + trip_expenses) --------
async function handleDespesas(req: Request, url: URL, ctx: AuthCtx): Promise<Response> {
  const scope = url.searchParams.get("escopo") ?? "veiculo"; // 'veiculo' | 'viagem'
  if (req.method === "GET") {
    const guard = requireScope(ctx, "despesas:read"); if (guard) return guard;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);
    if (scope === "viagem") {
      const tripId = url.searchParams.get("trip_id");
      let q = ctx.admin.from("trip_expenses")
        .select("id, trip_id, driver_id, expense_date, expense_category, description, amount, city, state, supplier_name, payment_method, reimbursement_status")
        .eq("company_id", ctx.companyId).order("expense_date", { ascending: false }).limit(limit);
      if (tripId) q = q.eq("trip_id", tripId);
      if (from) q = q.gte("expense_date", from);
      if (to) q = q.lte("expense_date", to);
      const { data, error } = await q;
      if (error) return fail(error.message, 500);
      return ok(data ?? []);
    }
    const vehicleId = url.searchParams.get("vehicle_id");
    let q = ctx.admin.from("vehicle_expenses")
      .select("id, vehicle_id, expense_date, expense_category, amount, description, paid, due_date")
      .eq("company_id", ctx.companyId).order("expense_date", { ascending: false }).limit(limit);
    if (vehicleId) q = q.eq("vehicle_id", vehicleId);
    if (from) q = q.gte("expense_date", from);
    if (to) q = q.lte("expense_date", to);
    const { data, error } = await q;
    if (error) return fail(error.message, 500);
    return ok(data ?? []);
  }
  if (req.method === "POST") {
    const guard = requireScope(ctx, "despesas:write"); if (guard) return guard;
    const body = await readJson(req);
    if (!body) return fail("Corpo JSON inválido.", 400);
    if (scope === "viagem") {
      if (!body.trip_id || !body.amount) return fail("Campos obrigatórios (viagem): trip_id, amount.", 400);
      const { data: trip } = await ctx.admin.from("trips").select("id").eq("id", body.trip_id).eq("company_id", ctx.companyId).maybeSingle();
      if (!trip) return fail("Viagem não pertence a esta empresa.", 404);
      const payload: Record<string, unknown> = {
        company_id: ctx.companyId, trip_id: body.trip_id, driver_id: body.driver_id ?? null,
        expense_date: body.expense_date ?? new Date().toISOString().slice(0,10),
        expense_category: body.expense_category ?? "outros",
        description: body.description ?? null, amount: Number(body.amount) || 0,
        city: body.city ?? null, state: body.state ?? null,
        supplier_name: body.supplier_name ?? null, supplier_document: body.supplier_document ?? null,
        payment_method: body.payment_method ?? null,
        notes: body.notes ?? null,
      };
      const { data, error } = await ctx.admin.from("trip_expenses").insert(payload).select("*").maybeSingle();
      if (error) return fail(error.message, 400);
      await logWrite(ctx, "despesas_viagem", "create", (data as any)?.id ?? null, payload);
      return ok(data, 201);
    }
    if (!body.vehicle_id || !body.amount) return fail("Campos obrigatórios (veículo): vehicle_id, amount.", 400);
    const { data: veh } = await ctx.admin.from("vehicles").select("id").eq("id", body.vehicle_id).eq("company_id", ctx.companyId).maybeSingle();
    if (!veh) return fail("Veículo não pertence a esta empresa.", 404);
    const payload: Record<string, unknown> = {
      company_id: ctx.companyId, vehicle_id: body.vehicle_id,
      expense_date: body.expense_date ?? new Date().toISOString().slice(0,10),
      expense_category: body.expense_category ?? "outros",
      amount: Number(body.amount) || 0,
      description: body.description ?? null,
      receipt_url: body.receipt_url ?? null,
      paid: body.paid ?? false,
      due_date: body.due_date ?? null,
    };
    const { data, error } = await ctx.admin.from("vehicle_expenses").insert(payload).select("*").maybeSingle();
    if (error) return fail(error.message, 400);
    await logWrite(ctx, "despesas_veiculo", "create", (data as any)?.id ?? null, payload);
    return ok(data, 201);
  }
  return methodNotAllowed("GET ou POST");
}

// -------- Multas --------
async function handleMultas(req: Request, url: URL, ctx: AuthCtx): Promise<Response> {
  if (req.method === "GET") {
    const guard = requireScope(ctx, "multas:read"); if (guard) return guard;
    const vehicleId = url.searchParams.get("vehicle_id");
    const status = url.searchParams.get("status");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);
    let q = ctx.admin.from("traffic_fines")
      .select("id, vehicle_id, driver_id, infraction_date, location, city, state, fine_type, fine_code, description, severity, amount, due_date, status, paid_at, paid_amount, notification_number")
      .eq("company_id", ctx.companyId).order("infraction_date", { ascending: false }).limit(limit);
    if (vehicleId) q = q.eq("vehicle_id", vehicleId);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return fail(error.message, 500);
    return ok(data ?? []);
  }
  if (req.method === "POST") {
    const guard = requireScope(ctx, "multas:write"); if (guard) return guard;
    const body = await readJson(req);
    if (!body?.vehicle_id || !body?.infraction_date || body?.amount == null) {
      return fail("Campos obrigatórios: vehicle_id, infraction_date, amount.", 400);
    }
    const { data: veh } = await ctx.admin.from("vehicles").select("id").eq("id", body.vehicle_id).eq("company_id", ctx.companyId).maybeSingle();
    if (!veh) return fail("Veículo não pertence a esta empresa.", 404);
    const status = body.status && FINE_STATUS_VALUES.has(body.status) ? body.status : "pendente";
    const payload: Record<string, unknown> = {
      company_id: ctx.companyId,
      vehicle_id: body.vehicle_id, driver_id: body.driver_id ?? null,
      infraction_date: body.infraction_date, infraction_time: body.infraction_time ?? null,
      location: body.location ?? null, city: body.city ?? null, state: body.state ?? null,
      fine_type: body.fine_type ?? null, fine_code: body.fine_code ?? null,
      description: body.description ?? null, severity: body.severity ?? null,
      notification_number: body.notification_number ?? null,
      amount: Number(body.amount) || 0,
      due_date: body.due_date ?? null,
      status,
      notes: body.notes ?? null,
    };
    const { data, error } = await ctx.admin.from("traffic_fines").insert(payload).select("*").maybeSingle();
    if (error) return fail(error.message, 400);
    await logWrite(ctx, "multas", "create", (data as any)?.id ?? null, payload);
    return ok(data, 201);
  }
  if (req.method === "PATCH") {
    const guard = requireScope(ctx, "multas:write"); if (guard) return guard;
    const body = await readJson(req);
    if (!body?.id) return fail("Campo obrigatório: id.", 400);
    const { id, ...rest } = body;
    delete (rest as any).company_id;
    if ("status" in rest && !FINE_STATUS_VALUES.has((rest as any).status)) {
      return fail(`status inválido. Valores: ${[...FINE_STATUS_VALUES].join(", ")}.`, 400);
    }
    const { data, error } = await ctx.admin
      .from("traffic_fines").update(rest).eq("id", id).eq("company_id", ctx.companyId)
      .select("*").maybeSingle();
    if (error) return fail(error.message, 400);
    if (!data) return fail("Multa não encontrada.", 404);
    await logWrite(ctx, "multas", "update", id, rest);
    return ok(data);
  }
  return methodNotAllowed("GET, POST ou PATCH");
}

// -------- Checklists --------
async function handleChecklists(req: Request, url: URL, ctx: AuthCtx): Promise<Response> {
  if (req.method === "GET") {
    const guard = requireScope(ctx, "checklists:read"); if (guard) return guard;
    const vehicleId = url.searchParams.get("vehicle_id");
    const status = url.searchParams.get("status");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);
    let q = ctx.admin.from("checklist_runs")
      .select("id, template_id, vehicle_id, driver_id, reference_month, due_date, status, total_items, conform_items, non_conform_items, na_items, score, started_at, completed_at")
      .eq("company_id", ctx.companyId).order("created_at", { ascending: false }).limit(limit);
    if (vehicleId) q = q.eq("vehicle_id", vehicleId);
    if (status && CHECKLIST_RUN_STATUS_VALUES.has(status)) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return fail(error.message, 500);
    return ok(data ?? []);
  }
  if (req.method === "POST") {
    const guard = requireScope(ctx, "checklists:write"); if (guard) return guard;
    const body = await readJson(req);
    if (!body?.template_id || !body?.vehicle_id) return fail("Campos obrigatórios: template_id, vehicle_id.", 400);
    const { data: veh } = await ctx.admin.from("vehicles").select("id").eq("id", body.vehicle_id).eq("company_id", ctx.companyId).maybeSingle();
    if (!veh) return fail("Veículo não pertence a esta empresa.", 404);
    const status = body.status && CHECKLIST_RUN_STATUS_VALUES.has(body.status) ? body.status : "pendente";
    const payload: Record<string, unknown> = {
      company_id: ctx.companyId,
      template_id: body.template_id, vehicle_id: body.vehicle_id, driver_id: body.driver_id ?? null,
      reference_month: body.reference_month ?? null, due_date: body.due_date ?? null,
      status, total_items: body.total_items ?? 0,
      conform_items: body.conform_items ?? 0, non_conform_items: body.non_conform_items ?? 0,
      na_items: body.na_items ?? 0, km_at_check: body.km_at_check ?? null,
      notes: body.notes ?? null,
    };
    const { data, error } = await ctx.admin.from("checklist_runs").insert(payload).select("*").maybeSingle();
    if (error) return fail(error.message, 400);
    await logWrite(ctx, "checklists", "create", (data as any)?.id ?? null, payload);
    return ok(data, 201);
  }
  return methodNotAllowed("GET ou POST");
}

// -------- Cadastros read-only: postos, oficinas, fornecedores --------
async function handleReadOnlyList(
  req: Request, ctx: AuthCtx, table: string, scope: string, columns: string, orderBy = "created_at",
): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed("GET");
  const guard = requireScope(ctx, scope); if (guard) return guard;
  const { data, error } = await ctx.admin.from(table)
    .select(columns).eq("company_id", ctx.companyId).order(orderBy, { ascending: false });
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

// -------- Ordens de serviço --------
async function handleOrdens(req: Request, url: URL, ctx: AuthCtx): Promise<Response> {
  if (req.method === "GET") {
    const guard = requireScope(ctx, "ordens:read"); if (guard) return guard;
    const vehicleId = url.searchParams.get("vehicle_id");
    const status = url.searchParams.get("status");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);
    let q = ctx.admin.from("maintenance_work_orders")
      .select("id, os_number, vehicle_id, workshop_id, title, description, priority, scheduled_date, quote_status, execution_status, quote_amount_total, km_at_scheduling, created_at")
      .eq("company_id", ctx.companyId).order("created_at", { ascending: false }).limit(limit);
    if (vehicleId) q = q.eq("vehicle_id", vehicleId);
    if (status) q = q.eq("execution_status", status);
    const { data, error } = await q;
    if (error) return fail(error.message, 500);
    return ok(data ?? []);
  }
  if (req.method === "POST") {
    const guard = requireScope(ctx, "ordens:write"); if (guard) return guard;
    const body = await readJson(req);
    if (!body?.vehicle_id || !body?.title) return fail("Campos obrigatórios: vehicle_id, title.", 400);
    const { data: veh } = await ctx.admin.from("vehicles").select("id").eq("id", body.vehicle_id).eq("company_id", ctx.companyId).maybeSingle();
    if (!veh) return fail("Veículo não pertence a esta empresa.", 404);
    const payload: Record<string, unknown> = {
      company_id: ctx.companyId,
      vehicle_id: body.vehicle_id,
      workshop_id: body.workshop_id ?? null,
      driver_id: body.driver_id ?? null,
      origin_type: body.origin_type ?? "manual",
      title: body.title,
      description: body.description ?? null,
      priority: body.priority ?? "media",
      scheduled_date: body.scheduled_date ?? null,
      km_at_scheduling: body.km_at_scheduling ?? null,
      quote_status: body.quote_status ?? "pendente",
      execution_status: body.execution_status ?? "rascunho",
    };
    const { data, error } = await ctx.admin.from("maintenance_work_orders").insert(payload).select("*").maybeSingle();
    if (error) return fail(error.message, 400);
    await logWrite(ctx, "ordens", "create", (data as any)?.id ?? null, payload);
    return ok(data, 201);
  }
  if (req.method === "PATCH") {
    const guard = requireScope(ctx, "ordens:write"); if (guard) return guard;
    const body = await readJson(req);
    if (!body?.id) return fail("Campo obrigatório: id.", 400);
    const { id, ...rest } = body;
    delete (rest as any).company_id;
    if ("execution_status" in rest && !WORK_ORDER_STATUSES.has((rest as any).execution_status)) {
      return fail(`execution_status inválido. Valores: ${[...WORK_ORDER_STATUSES].join(", ")}.`, 400);
    }
    const { data, error } = await ctx.admin
      .from("maintenance_work_orders").update(rest).eq("id", id).eq("company_id", ctx.companyId)
      .select("*").maybeSingle();
    if (error) return fail(error.message, 400);
    if (!data) return fail("Ordem não encontrada.", 404);
    await logWrite(ctx, "ordens", "update", id, rest);
    return ok(data);
  }
  return methodNotAllowed("GET, POST ou PATCH");
}

// ============== ROUTER ==============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/frota-api/, "") || "/";

  try {
    // Rota pública: health
    if (path === "/health" || path === "/") {
      if (req.method !== "GET") return methodNotAllowed("GET");
      return ok({ status: "ok", service: "frota-api", time: new Date().toISOString() });
    }

    // Auth
    const auth = await authenticate(req);
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    let response: Response;
    if (path === "/me") response = await handleMe(req, ctx);
    else if (path === "/veiculos") response = await handleVeiculos(req, url, ctx);
    else if (path === "/manutencoes") response = await handleManutencoes(req, url, ctx);
    else if (path === "/manutencoes/aprovar") response = await handleManutencoesAprovar(req, url, ctx);
    else if (path === "/abastecimentos") response = await handleAbastecimentos(req, url, ctx);
    else if (path.startsWith("/documentos")) {
      response = await handleDocumentos(req, url, ctx, path.slice("/documentos".length));
    }
    else if (path === "/motoristas") response = await handleMotoristas(req, url, ctx);
    else if (path === "/viagens") response = await handleViagens(req, url, ctx);
    else if (path === "/despesas") response = await handleDespesas(req, url, ctx);
    else if (path === "/multas") response = await handleMultas(req, url, ctx);
    else if (path === "/checklists") response = await handleChecklists(req, url, ctx);
    else if (path === "/postos") {
      response = await handleReadOnlyList(req, ctx, "fuel_stations", "postos:read",
        "id, name, cnpj, brand, city, state, active, preferred, rating");
    }
    else if (path === "/oficinas") {
      response = await handleReadOnlyList(req, ctx, "workshops", "oficinas:read",
        "id, status, document_type, workshop_type, invoice_type");
    }
    else if (path === "/fornecedores") {
      response = await handleReadOnlyList(req, ctx, "suppliers", "fornecedores:read",
        "id, status, supplier_category, document_type, invoice_type");
    }
    else if (path === "/ordens") response = await handleOrdens(req, url, ctx);
    else response = fail("Rota não encontrada: " + path, 404);

    const body = await response.clone().json().catch(() => ({}));
    logRequest(
      ctx.admin, ctx.keyId, ctx.companyId, ctx.keyName,
      req.method, path, response.status,
      body?.ok === false ? body?.erro ?? null : null,
    );
    return response;
  } catch (e) {
    return fail("Erro interno: " + String((e as Error)?.message ?? e), 500);
  }
});
