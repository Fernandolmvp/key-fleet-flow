export type AgentContext = {
  admin: any;
  keyId: string;
  companyId: string;
  contexto: Record<string, unknown>;
  actorId?: string | null;
};

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export function requiredString(params: Record<string, unknown>, field: string, label = field, max = 500): string {
  const value = typeof params[field] === "string" ? params[field].trim() : "";
  if (!value) throw new ActionError(`Informe ${label}.`);
  if (value.length > max) throw new ActionError(`${label} deve ter no máximo ${max} caracteres.`);
  return value;
}

export function optionalString(params: Record<string, unknown>, field: string, label = field, max = 2000): string | null {
  if (params[field] === undefined || params[field] === null || params[field] === "") return null;
  if (typeof params[field] !== "string") throw new ActionError(`${label} deve ser um texto.`);
  const value = (params[field] as string).trim();
  if (value.length > max) throw new ActionError(`${label} deve ter no máximo ${max} caracteres.`);
  return value || null;
}

export function numberValue(value: unknown, label: string, options: { positive?: boolean; integer?: boolean; min?: number; max?: number } = {}): number {
  const normalized = typeof value === "string" ? value.trim().replace(",", ".") : value;
  const parsed = typeof normalized === "number" ? normalized : Number(normalized);
  if (!Number.isFinite(parsed)) throw new ActionError(`${label} deve ser um número válido.`);
  if (options.positive && parsed <= 0) throw new ActionError(`${label} deve ser maior que zero.`);
  if (options.integer && !Number.isInteger(parsed)) throw new ActionError(`${label} deve ser um número inteiro.`);
  if (options.min !== undefined && parsed < options.min) throw new ActionError(`${label} deve ser no mínimo ${options.min}.`);
  if (options.max !== undefined && parsed > options.max) throw new ActionError(`${label} deve ser no máximo ${options.max}.`);
  return parsed;
}

export function requiredNumber(params: Record<string, unknown>, field: string, label = field, options = {}): number {
  if (params[field] === undefined || params[field] === null || params[field] === "") throw new ActionError(`Informe ${label}.`);
  return numberValue(params[field], label, options);
}

export function optionalNumber(params: Record<string, unknown>, field: string, label = field, options = {}): number | null {
  if (params[field] === undefined || params[field] === null || params[field] === "") return null;
  return numberValue(params[field], label, options);
}

export function todaySaoPaulo(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function dateValue(value: unknown, label = "data"): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ActionError(`${label} deve estar no formato AAAA-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ActionError(`${label} não é uma data válida.`);
  }
  return value;
}

export function dateOrToday(params: Record<string, unknown>, field = "data"): string {
  return params[field] ? dateValue(params[field], field) : todaySaoPaulo();
}

export function timestampFor(date: string): string {
  return `${date}T12:00:00-03:00`;
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function enumValue(value: unknown, allowed: readonly string[], label: string, fallback?: string): string {
  const normalized = value === undefined || value === null || value === "" ? fallback : String(value).trim().toLowerCase();
  if (!normalized || !allowed.includes(normalized)) {
    throw new ActionError(`${label} inválido. Valores aceitos: ${allowed.join(", ")}.`);
  }
  return normalized;
}

export function normalizePlate(value: unknown): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

export function onlyDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export async function findVehicle(ctx: AgentContext, plateInput: unknown): Promise<any> {
  const plate = normalizePlate(plateInput);
  if (!plate) throw new ActionError("Informe a placa.");
  const dashed = plate.length === 7 ? `${plate.slice(0, 3)}-${plate.slice(3)}` : plate;
  const { data, error } = await ctx.admin
    .from("vehicles")
    .select("*")
    .eq("company_id", ctx.companyId)
    .or(`plate.eq.${plate},plate.eq.${dashed},normalized_plate.eq.${plate}`)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ActionError(`Placa ${plate} não encontrada na frota.`);
  return data;
}

export async function findDriver(ctx: AgentContext, driverId: unknown): Promise<any> {
  const id = typeof driverId === "string" ? driverId : "";
  if (!id) throw new ActionError("Motorista não identificado. Use identificar_motorista antes desta ação.");
  const { data, error } = await ctx.admin
    .from("drivers")
    .select("*")
    .eq("company_id", ctx.companyId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ActionError("Motorista não encontrado nesta empresa.");
  return data;
}

export function requireDriver(ctx: AgentContext): Promise<any> {
  return findDriver(ctx, ctx.contexto.motorista_id);
}

export function requireManager(ctx: AgentContext) {
  if (ctx.contexto.nivel !== "gestor") {
    throw new ActionError("Esta ação exige autorização de gestor.");
  }
}

export async function actorId(ctx: AgentContext): Promise<string> {
  if (ctx.actorId) return ctx.actorId;
  const { data, error } = await ctx.admin
    .from("company_members")
    .select("user_id")
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.user_id) throw new ActionError("A empresa precisa ter um usuário responsável para receber lançamentos do agente.");
  ctx.actorId = data.user_id;
  return data.user_id;
}

export function contactNote(ctx: AgentContext, note?: string | null): string | null {
  const contact = typeof ctx.contexto.contato_nome === "string" ? ctx.contexto.contato_nome.trim() : "";
  const parts = [note?.trim(), contact ? `Lançado pelo agente para ${contact}.` : "Lançado pelo agente."].filter(Boolean);
  return parts.join("\n");
}

export async function findTrip(ctx: AgentContext, codeInput: unknown): Promise<any> {
  const code = String(codeInput ?? "").trim().toUpperCase();
  if (!code) throw new ActionError("Informe o código da viagem (VG).");
  const { data, error } = await ctx.admin
    .from("trips")
    .select("*")
    .eq("company_id", ctx.companyId)
    .eq("trip_code", code)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ActionError(`Viagem ${code} não encontrada.`);
  return data;
}

export function tripWithDisplayStatus(trip: any, today = todaySaoPaulo()) {
  const status_acerto = ["programada", "planejada", "em_andamento"].includes(trip.status) && trip.scheduled_end_date && trip.scheduled_end_date.slice(0, 10) < today
    ? "acerto_pendente"
    : trip.status;
  return { ...trip, status_acerto };
}

export function fineWithDisplayStatus(fine: any, today = todaySaoPaulo()) {
  const open = !fine.paid_at && !["paga", "paga_com_desconto", "paga_integral", "cancelada", "arquivada", "recurso_deferido"].includes(fine.status);
  return { ...fine, status_calculado: open && fine.due_date && fine.due_date.slice(0, 10) < today ? "vencida" : fine.status };
}

export async function fetchAll(queryPage: (from: number, to: number) => Promise<any>): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await queryPage(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export function databaseError(error: any): Error {
  const message = String(error?.message ?? "");
  if (error?.code === "23505") return new ActionError("Já existe um registro com esses dados.");
  if (/quilometr|odometr|\bkm\b/i.test(message)) return new ActionError("O KM informado é menor que o último KM registrado para este veículo. Confira o valor.");
  if (error?.code === "23514") return new ActionError("Um dos valores informados não é aceito pelo sistema. Revise os dados.");
  if (error?.code === "23503") return new ActionError("Um cadastro relacionado não foi encontrado nesta empresa.");
  return new Error(message || "Não foi possível concluir a operação.");
}
