import {
  ActionError,
  AgentContext,
  actorId,
  contactNote,
  dateOrToday,
  enumValue,
  findDriver,
  findTrip,
  findVehicle,
  optionalNumber,
  optionalString,
  requireDriver,
  requiredNumber,
  requiredString,
  timestampFor,
} from "./helpers.ts";

const FUEL_TYPES = ["gasolina", "etanol", "diesel", "diesel_s10", "flex", "gnv", "eletrico", "hibrido"] as const;
const EXPENSE_CATEGORIES = ["combustivel", "pedagio", "refeicao", "hospedagem", "lavagem", "estacionamento", "manutencao_emergencial", "pneu_emergencial", "transporte_complementar", "comunicacao", "taxa_servico", "mensageria", "taxa_governamental", "outros"] as const;

async function updateVehicleKm(ctx: AgentContext, vehicle: any, km: number | null) {
  if (km !== null && km > Number(vehicle.current_km ?? 0)) {
    const { error } = await ctx.admin.from("vehicles").update({ current_km: km }).eq("company_id", ctx.companyId).eq("id", vehicle.id);
    if (error) throw error;
  }
}

export async function registrarAbastecimento(ctx: AgentContext, params: Record<string, unknown>) {
  const [vehicle, driver, actor] = await Promise.all([findVehicle(ctx, params.placa), requireDriver(ctx), actorId(ctx)]);
  const data = dateOrToday(params);
  const litros = requiredNumber(params, "litros", "os litros", { positive: true, max: 10000 });
  const valor = requiredNumber(params, "valor_total", "o valor total", { positive: true, max: 1_000_000 });
  const km = requiredNumber(params, "km", "o KM", { integer: true, min: 0 });
  const { data: lastFuel, error: lastError } = await ctx.admin.from("fuel_records").select("km_at_fueling").eq("company_id", ctx.companyId).eq("vehicle_id", vehicle.id).order("km_at_fueling", { ascending: false }).limit(1).maybeSingle();
  if (lastError) throw lastError;
  const lastKm = Math.max(Number(vehicle.current_km ?? 0), Number(lastFuel?.km_at_fueling ?? 0));
  if (km < lastKm) throw new ActionError(`O KM informado (${km}) é menor que o último KM registrado (${lastKm}). Confira o valor.`);
  const fuelType = enumValue(params.combustivel ?? vehicle.fuel_type ?? "flex", FUEL_TYPES, "combustível");
  const stationName = optionalString(params, "posto", "posto", 180);
  let station: any = null;
  if (stationName) {
    const result = await ctx.admin.from("fuel_stations").select("id,name,cnpj,city,state").eq("company_id", ctx.companyId).ilike("name", stationName).limit(1).maybeSingle();
    if (result.error) throw result.error;
    station = result.data;
  }
  const { data: created, error } = await ctx.admin.from("fuel_records").insert({
    company_id: ctx.companyId,
    vehicle_id: vehicle.id,
    driver_id: driver.id,
    fueled_at: timestampFor(data),
    fuel_type: fuelType,
    liters: litros,
    price_per_liter: Number((valor / litros).toFixed(4)),
    total_value: valor,
    km_at_fueling: km,
    full_tank: true,
    payment_method: "outro",
    station_name: station?.name ?? stationName,
    station_cnpj: station?.cnpj ?? null,
    fuel_station_id: station?.id ?? null,
    city: optionalString(params, "cidade", "cidade", 120) ?? station?.city ?? null,
    state: station?.state ?? null,
    notes: contactNote(ctx, optionalString(params, "observacao", "observação")),
    created_by: actor,
    source: "agente",
    source_origin: "agente",
  }).select("*").single();
  if (error) throw error;
  await updateVehicleKm(ctx, vehicle, km);
  return created;
}

export async function atualizarKm(ctx: AgentContext, params: Record<string, unknown>) {
  await requireDriver(ctx);
  const vehicle = await findVehicle(ctx, params.placa);
  const km = requiredNumber(params, "km", "o KM", { integer: true, min: 0 });
  if (km < Number(vehicle.current_km ?? 0)) throw new ActionError(`O KM informado (${km}) é menor que o KM atual (${vehicle.current_km}).`);
  const data = dateOrToday(params);
  const { data: updated, error } = await ctx.admin.from("vehicles").update({ current_km: km }).eq("company_id", ctx.companyId).eq("id", vehicle.id).select("id,plate,current_km").single();
  if (error) throw error;
  return { ...updated, data };
}

export async function registrarChecklist(ctx: AgentContext, params: Record<string, unknown>) {
  const [vehicle, driver, actor] = await Promise.all([findVehicle(ctx, params.placa), requireDriver(ctx), actorId(ctx)]);
  const type = enumValue(params.tipo, ["saida", "retorno"] as const, "tipo de checklist");
  const km = optionalNumber(params, "km", "KM", { integer: true, min: 0 });
  if (km !== null && km < Number(vehicle.current_km ?? 0)) throw new ActionError(`O KM informado é menor que o KM atual (${vehicle.current_km}).`);
  if (!Array.isArray(params.itens) || !params.itens.length || params.itens.length > 100) throw new ActionError("Informe uma lista de 1 a 100 itens do checklist.");
  const items = params.itens.map((raw: any, index: number) => {
    if (!raw || typeof raw !== "object") throw new ActionError(`Item ${index + 1} inválido.`);
    if (typeof raw.ok !== "boolean") throw new ActionError(`Informe verdadeiro ou falso em ok para o item ${index + 1}.`);
    return { item: String(raw.item ?? "").trim(), ok: raw.ok, obs: raw.obs ? String(raw.obs).trim() : null };
  });
  for (const [index, item] of items.entries()) if (!item.item) throw new ActionError(`Informe o nome do item ${index + 1}.`);

  const templateName = `Checklist do agente · ${type === "saida" ? "Saída" : "Retorno"}`;
  const existingTemplate = await ctx.admin.from("checklist_templates").select("*").eq("company_id", ctx.companyId).eq("name", templateName).eq("active", true).order("created_at").limit(1).maybeSingle();
  if (existingTemplate.error) throw existingTemplate.error;
  let template = existingTemplate.data;
  if (!template) {
    const created = await ctx.admin.from("checklist_templates").insert({ company_id: ctx.companyId, name: templateName, description: "Itens enviados pelo agente de atendimento.", frequency: "unico", auto_open_os: true, vehicle_type: vehicle.vehicle_type, created_by: actor, source: "agente" }).select("*").single();
    if (created.error) throw created.error;
    template = created.data;
  }
  const existingQuestions = await ctx.admin.from("checklist_questions").select("*").eq("company_id", ctx.companyId).eq("template_id", template.id);
  if (existingQuestions.error) throw existingQuestions.error;
  const questions = [...(existingQuestions.data ?? [])];
  const missing = items.filter((item) => !questions.some((question) => question.label === item.item));
  if (missing.length) {
    const created = await ctx.admin.from("checklist_questions").insert(missing.map((item, index) => ({
      company_id: ctx.companyId,
      template_id: template.id,
      label: item.item,
      question_type: "sim_nao",
      required: true,
      require_photo_when_fail: false,
      require_note_when_fail: false,
      is_critical: true,
      sort_order: questions.length + index,
      source: "agente",
    }))).select("*");
    if (created.error) throw created.error;
    questions.push(...(created.data ?? []));
  }

  const now = new Date().toISOString();
  const failed = items.filter((item) => !item.ok);
  const runInsert = await ctx.admin.from("checklist_runs").insert({
    company_id: ctx.companyId,
    template_id: template.id,
    vehicle_id: vehicle.id,
    driver_id: driver.id,
    due_date: dateOrToday(params),
    status: "em_andamento",
    km_at_check: km,
    notes: contactNote(ctx, optionalString(params, "observacoes", "observações")),
    started_at: now,
    created_by: actor,
    source: "agente",
  }).select("*").single();
  if (runInsert.error) throw runInsert.error;
  const run = runInsert.data;
  const answers = await ctx.admin.from("checklist_answers").insert(items.map((item) => {
    const question = questions.find((candidate) => candidate.label === item.item);
    return {
      company_id: ctx.companyId,
      run_id: run.id,
      question_id: question.id,
      question_label: question.label,
      question_category: question.category,
      question_type: "sim_nao",
      value_bool: item.ok,
      status: item.ok ? "conforme" : "nao_conforme",
      notes: item.obs,
      answered_at: now,
      source: "agente",
    };
  })).select("*");
  if (answers.error) throw answers.error;
  const completed = await ctx.admin.from("checklist_runs").update({
    status: failed.length ? "reprovado" : "concluido",
    total_items: items.length,
    conform_items: items.length - failed.length,
    non_conform_items: failed.length,
    na_items: 0,
    score: Number((((items.length - failed.length) / items.length) * 100).toFixed(2)),
    completed_at: now,
  }).eq("company_id", ctx.companyId).eq("id", run.id).select("*").single();
  if (completed.error) throw completed.error;
  const request = await ctx.admin.from("maintenance_requests").select("*").eq("company_id", ctx.companyId).eq("checklist_run_id", run.id).maybeSingle();
  if (request.error) throw request.error;
  if (request.data) await ctx.admin.from("maintenance_requests").update({ source: "agente" }).eq("company_id", ctx.companyId).eq("id", request.data.id);
  await updateVehicleKm(ctx, vehicle, km);
  return { ...completed.data, itens: answers.data ?? [], alerta_manutencao: request.data ?? null };
}

export async function registrarMedicaoPneus(ctx: AgentContext, params: Record<string, unknown>) {
  const [vehicle, driver, actor] = await Promise.all([findVehicle(ctx, params.placa), requireDriver(ctx), actorId(ctx)]);
  const km = optionalNumber(params, "km", "KM", { integer: true, min: 0 });
  if (km !== null && km < Number(vehicle.current_km ?? 0)) throw new ActionError(`O KM informado é menor que o KM atual (${vehicle.current_km}).`);
  if (!Array.isArray(params.medicoes) || !params.medicoes.length || params.medicoes.length > 50) throw new ActionError("Informe uma lista de 1 a 50 medições.");
  const now = new Date().toISOString();
  const results = [];
  for (const [index, raw] of params.medicoes.entries()) {
    if (!raw || typeof raw !== "object") throw new ActionError(`Medição ${index + 1} inválida.`);
    const item: any = raw;
    const position = String(item.posicao ?? "").trim().toUpperCase();
    if (!position) throw new ActionError(`Informe a posição na medição ${index + 1}.`);
    const tread = item.sulco_mm === undefined || item.sulco_mm === null ? null : Number(item.sulco_mm);
    const pressure = item.pressao_psi === undefined || item.pressao_psi === null ? null : Number(item.pressao_psi);
    if (tread === null && pressure === null) throw new ActionError(`Informe sulco ou pressão na posição ${position}.`);
    if (tread !== null && (!Number.isFinite(tread) || tread < 0 || tread > 40)) throw new ActionError(`Sulco inválido na posição ${position}.`);
    if (pressure !== null && (!Number.isFinite(pressure) || pressure < 0 || pressure > 200)) throw new ActionError(`Pressão inválida na posição ${position}.`);
    const found = await ctx.admin.from("tires").select("*").eq("company_id", ctx.companyId).eq("current_vehicle_id", vehicle.id).eq("current_position", position).eq("status", "instalado").limit(1).maybeSingle();
    if (found.error) throw found.error;
    let tire = found.data;
    if (!tire) {
      const created = await ctx.admin.from("tires").insert({
        company_id: ctx.companyId,
        brand: "Não informado",
        model: "Não informado",
        size: "Não informado",
        kind: "novo",
        status: "instalado",
        current_vehicle_id: vehicle.id,
        current_position: position,
        initial_tread_mm: tread,
        current_tread_mm: tread,
        last_pressure_psi: pressure,
        min_tread_mm: 1.6,
        last_measured_at: now,
        measurement_interval_days: 30,
        notes: "Criado automaticamente pela medição enviada pelo agente.",
        created_by: actor,
        source: "agente",
      }).select("*").single();
      if (created.error) throw created.error;
      tire = created.data;
    }
    const movement = await ctx.admin.from("tire_movements").insert({
      company_id: ctx.companyId,
      tire_id: tire.id,
      vehicle_id: vehicle.id,
      movement_type: "inspecao",
      from_position: position,
      occurred_at: now,
      tread_mm: tread,
      pressure_psi: pressure,
      vehicle_km: km ?? vehicle.current_km,
      reason: "Medição pelo agente",
      notes: contactNote(ctx, `Medição enviada por ${driver.full_name}.`),
      created_by: actor,
      source: "agente",
    }).select("*").single();
    if (movement.error) throw movement.error;
    const updated = await ctx.admin.from("tires").update({ current_tread_mm: tread ?? tire.current_tread_mm, last_pressure_psi: pressure ?? tire.last_pressure_psi, last_measured_at: now }).eq("company_id", ctx.companyId).eq("id", tire.id).select("*").single();
    if (updated.error) throw updated.error;
    results.push({ posicao: position, pneu: updated.data, medicao: movement.data });
  }
  await updateVehicleKm(ctx, vehicle, km);
  return { placa: vehicle.plate, data: now, medicoes: results };
}

export async function relatarProblema(ctx: AgentContext, params: Record<string, unknown>) {
  const [vehicle, driver, actor] = await Promise.all([findVehicle(ctx, params.placa), requireDriver(ctx), actorId(ctx)]);
  const description = requiredString(params, "descricao", "a descrição do problema", 4000);
  const severity = enumValue(params.urgencia ?? "media", ["baixa", "media", "alta", "critica"] as const, "urgência");
  const km = optionalNumber(params, "km", "KM", { integer: true, min: 0 });
  const { data, error } = await ctx.admin.from("maintenance_requests").insert({
    company_id: ctx.companyId,
    vehicle_id: vehicle.id,
    driver_id: driver.id,
    driver_user_id: driver.user_id ?? actor,
    problem_category: "relato_agente",
    problem_description: description,
    severity_self_assessment: severity,
    km_at_report: km,
    gestor_notes: contactNote(ctx),
    status: "pendente_aprovacao",
    source: "agente",
  }).select("*").single();
  if (error) throw error;
  await updateVehicleKm(ctx, vehicle, km);
  return data;
}

export async function registrarDespesaViagem(ctx: AgentContext, params: Record<string, unknown>) {
  const trip = await findTrip(ctx, params.viagem);
  const driver = ctx.contexto.motorista_id ? await requireDriver(ctx) : trip.driver_id ? await findDriver(ctx, trip.driver_id) : await requireDriver(ctx);
  const category = enumValue(params.tipo, EXPENSE_CATEGORIES, "tipo de despesa");
  const amount = requiredNumber(params, "valor", "o valor", { positive: true, max: 1_000_000 });
  const actor = await actorId(ctx);
  const { data, error } = await ctx.admin.from("trip_expenses").insert({
    company_id: ctx.companyId,
    trip_id: trip.id,
    driver_id: driver.id,
    expense_category: category,
    amount,
    expense_date: dateOrToday(params),
    payment_method: "dinheiro_empresa",
    receipt_url: "",
    description: optionalString(params, "descricao", "descrição"),
    notes: contactNote(ctx),
    created_by: actor,
    source: "agente",
  }).select("*").single();
  if (error) throw error;
  return data;
}

export async function solicitarAutorizacaoAbastecimento(ctx: AgentContext, params: Record<string, unknown>) {
  const [vehicle, driver, actor] = await Promise.all([findVehicle(ctx, params.placa), requireDriver(ctx), actorId(ctx)]);
  const liters = optionalNumber(params, "litros_estimados", "litros estimados", { positive: true, max: 10000 });
  const station = optionalString(params, "posto", "posto", 180);
  let stationId = null;
  if (station) {
    const found = await ctx.admin.from("fuel_stations").select("id").eq("company_id", ctx.companyId).ilike("name", station).limit(1).maybeSingle();
    if (found.error) throw found.error;
    stationId = found.data?.id ?? null;
  }
  const { data, error } = await ctx.admin.from("fuel_authorizations").insert({
    company_id: ctx.companyId,
    vehicle_id: vehicle.id,
    driver_id: driver.id,
    requested_by: actor,
    status: "pendente",
    estimated_liters: liters,
    station_name: station,
    fuel_station_id: stationId,
    fuel_type: vehicle.fuel_type,
    km_at_request: vehicle.current_km,
    notes: contactNote(ctx, optionalString(params, "motivo", "motivo")),
    source: "agente",
  }).select("*").single();
  if (error) throw error;
  return data;
}

export const driverActions: Record<string, (ctx: AgentContext, params: Record<string, unknown>) => Promise<any>> = {
  registrar_abastecimento: registrarAbastecimento,
  atualizar_km: atualizarKm,
  registrar_checklist: registrarChecklist,
  registrar_medicao_pneus: registrarMedicaoPneus,
  relatar_problema: relatarProblema,
  registrar_despesa_viagem: registrarDespesaViagem,
  solicitar_autorizacao_abastecimento: solicitarAutorizacaoAbastecimento,
};
