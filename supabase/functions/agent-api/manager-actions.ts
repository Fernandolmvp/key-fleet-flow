import {
  ActionError,
  AgentContext,
  actorId,
  contactNote,
  dateOrToday,
  dateValue,
  enumValue,
  findDriver,
  findTrip,
  findVehicle,
  normalizePlate,
  onlyDigits,
  optionalNumber,
  optionalString,
  requireManager,
  requiredNumber,
  requiredString,
  timestampFor,
} from "./helpers.ts";

const MAINTENANCE_TYPES = ["preventiva", "corretiva", "pneus", "sinistro"] as const;
const DOCUMENT_TYPES = ["crlv", "ipva", "licenciamento", "seguro", "rastreador", "laudo_veiculo", "outro_veiculo", "cnh", "exame_medico", "exame_toxicologico", "curso_mopp", "curso_transporte_passageiros", "outro_motorista"] as const;
const FUEL_TYPES = ["gasolina", "etanol", "diesel", "diesel_s10", "flex", "gnv", "eletrico", "hibrido"] as const;

async function workshopFor(ctx: AgentContext, name: string | null, actor: string) {
  const desired = name || "Não informada";
  const found = await ctx.admin.from("workshops").select("id,name").eq("company_id", ctx.companyId).ilike("name", desired).limit(1).maybeSingle();
  if (found.error) throw found.error;
  if (found.data) return found.data;
  if (name) throw new ActionError(`Oficina ${name} não encontrada nesta empresa.`);
  const created = await ctx.admin.from("workshops").insert({ company_id: ctx.companyId, name: desired, created_by: actor, source: "agente" }).select("id,name").single();
  if (created.error) throw created.error;
  return created.data;
}

export async function agendarManutencao(ctx: AgentContext, params: Record<string, unknown>) {
  requireManager(ctx);
  const [vehicle, actor] = await Promise.all([findVehicle(ctx, params.placa), actorId(ctx)]);
  const type = enumValue(params.tipo, MAINTENANCE_TYPES, "tipo de manutenção");
  const description = requiredString(params, "descricao", "a descrição", 3000);
  const workshopName = optionalString(params, "oficina", "oficina", 180);
  const workshop = workshopName ? await workshopFor(ctx, workshopName, actor) : null;
  const { data, error } = await ctx.admin.from("maintenance_schedules").insert({
    company_id: ctx.companyId,
    vehicle_id: vehicle.id,
    type: type,
    category: type,
    description: contactNote(ctx, description),
    target_date: dateOrToday(params),
    target_km: optionalNumber(params, "km_alvo", "KM alvo", { integer: true, min: 0 }),
    scheduled_workshop_id: workshop?.id ?? null,
    status: "pendente",
    created_by: actor,
    source: "agente",
  }).select("*").single();
  if (error) throw error;
  return data;
}

export async function abrirOrdemServico(ctx: AgentContext, params: Record<string, unknown>) {
  requireManager(ctx);
  const [vehicle, actor] = await Promise.all([findVehicle(ctx, params.placa), actorId(ctx)]);
  const description = requiredString(params, "descricao", "a descrição", 4000);
  const workshop = await workshopFor(ctx, optionalString(params, "oficina", "oficina", 180), actor);
  const { data, error } = await ctx.admin.from("maintenance_work_orders").insert({
    company_id: ctx.companyId,
    vehicle_id: vehicle.id,
    workshop_id: workshop.id,
    origin_type: "manual_gestor",
    title: description.slice(0, 160),
    description: contactNote(ctx, description),
    scheduled_date: dateOrToday(params),
    km_at_scheduling: optionalNumber(params, "km", "KM", { integer: true, min: 0 }) ?? vehicle.current_km,
    quote_amount_total: optionalNumber(params, "valor_estimado", "valor estimado", { min: 0 }),
    quote_status: "pendente",
    execution_status: "aguardando_aprovacao",
    payment_status: "pendente",
    created_by: actor,
    source: "agente",
  }).select("*").single();
  if (error) throw error;
  return data;
}

export async function concluirManutencao(ctx: AgentContext, params: Record<string, unknown>) {
  requireManager(ctx);
  const reference = requiredString(params, "referencia", "o número da OS ou a placa", 80);
  const actor = await actorId(ctx);
  const finalValue = optionalNumber(params, "valor_final", "valor final", { min: 0 });
  const km = optionalNumber(params, "km", "KM", { integer: true, min: 0 });
  const date = dateOrToday(params);
  const notes = contactNote(ctx, optionalString(params, "observacao", "observação"));
  const numericReference = onlyDigits(reference);
  let order: any = null;
  if (numericReference) {
    const found = await ctx.admin.from("maintenance_work_orders").select("*").eq("company_id", ctx.companyId).eq("os_number", Number(numericReference)).limit(1).maybeSingle();
    if (found.error) throw found.error;
    order = found.data;
  }
  if (!order) {
    const vehicle = await findVehicle(ctx, reference);
    const found = await ctx.admin.from("maintenance_work_orders").select("*").eq("company_id", ctx.companyId).eq("vehicle_id", vehicle.id).not("execution_status", "in", "(concluido,cancelado)").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (found.error) throw found.error;
    order = found.data;
    if (!order) {
      const record = await ctx.admin.from("maintenance_records").insert({
        company_id: ctx.companyId,
        vehicle_id: vehicle.id,
        type: "corretiva",
        status: "concluida",
        service_at: date,
        km_at_service: km ?? vehicle.current_km,
        total_value: finalValue ?? 0,
        description: `Manutenção concluída pelo agente para ${vehicle.plate}.`,
        notes,
        created_by: actor,
        source: "agente",
      }).select("*").single();
      if (record.error) throw record.error;
      return { ordem_servico: null, manutencao: record.data };
    }
  }
  const updated = await ctx.admin.from("maintenance_work_orders").update({
    execution_status: "concluido",
    execution_completed_at: timestampFor(date),
    actual_amount_total: finalValue,
    km_at_completion: km,
    final_notes: notes,
    updated_by: actor,
  }).eq("company_id", ctx.companyId).eq("id", order.id).select("*").single();
  if (updated.error) throw updated.error;
  let recordId = updated.data.maintenance_record_id;
  if (!recordId) {
    const refreshed = await ctx.admin.from("maintenance_work_orders").select("maintenance_record_id").eq("company_id", ctx.companyId).eq("id", order.id).single();
    if (refreshed.error) throw refreshed.error;
    recordId = refreshed.data.maintenance_record_id;
  }
  if (recordId) await ctx.admin.from("maintenance_records").update({ source: "agente", notes }).eq("company_id", ctx.companyId).eq("id", recordId);
  return { ordem_servico: updated.data, manutencao_id: recordId };
}

async function driverByReference(ctx: AgentContext, reference: string | null) {
  if (!reference) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference)) {
    const byId = await ctx.admin.from("drivers").select("*").eq("company_id", ctx.companyId).eq("id", reference).maybeSingle();
    if (byId.error) throw byId.error;
    if (byId.data) return byId.data;
  }
  const byName = await ctx.admin.from("drivers").select("*").eq("company_id", ctx.companyId).ilike("full_name", `%${reference}%`).limit(1).maybeSingle();
  if (byName.error) throw byName.error;
  if (!byName.data) throw new ActionError(`Motorista ${reference} não encontrado.`);
  return byName.data;
}

export async function registrarMulta(ctx: AgentContext, params: Record<string, unknown>) {
  requireManager(ctx);
  const [vehicle, actor] = await Promise.all([findVehicle(ctx, params.placa), actorId(ctx)]);
  const driver = await driverByReference(ctx, optionalString(params, "motorista", "motorista", 180));
  const { data, error } = await ctx.admin.from("traffic_fines").insert({
    company_id: ctx.companyId,
    vehicle_id: vehicle.id,
    driver_id: driver?.id ?? null,
    notification_number: optionalString(params, "auto_infracao", "auto de infração", 120),
    infraction_date: params.data_infracao ? dateValue(params.data_infracao, "data da infração") : dateOrToday(params),
    amount: requiredNumber(params, "valor", "o valor", { positive: true, max: 1_000_000 }),
    description: optionalString(params, "descricao", "descrição", 3000),
    due_date: optionalString(params, "vencimento", "vencimento", 10) ? dateValue(params.vencimento, "vencimento") : null,
    status: "pendente",
    notes: contactNote(ctx, optionalString(params, "orgao", "órgão", 180) ? `Órgão: ${optionalString(params, "orgao", "órgão", 180)}` : null),
    created_by: actor,
    source: "agente",
  }).select("*").single();
  if (error) throw error;
  return data;
}

export async function registrarDespesaVeiculo(ctx: AgentContext, params: Record<string, unknown>) {
  requireManager(ctx);
  const [vehicle, actor] = await Promise.all([findVehicle(ctx, params.placa), actorId(ctx)]);
  const description = optionalString(params, "descricao", "descrição", 2000);
  const supplier = optionalString(params, "fornecedor", "fornecedor", 180);
  const { data, error } = await ctx.admin.from("vehicle_expenses").insert({
    company_id: ctx.companyId,
    vehicle_id: vehicle.id,
    expense_category: requiredString(params, "tipo", "o tipo de despesa", 100),
    amount: requiredNumber(params, "valor", "o valor", { positive: true, max: 1_000_000 }),
    expense_date: dateOrToday(params),
    description: [description, supplier ? `Fornecedor: ${supplier}` : null].filter(Boolean).join("\n"),
    paid: false,
    created_by: actor,
    source: "agente",
  }).select("*").single();
  if (error) throw error;
  return data;
}

export async function registrarDocumento(ctx: AgentContext, params: Record<string, unknown>) {
  requireManager(ctx);
  const actor = await actorId(ctx);
  const type = enumValue(params.tipo, DOCUMENT_TYPES, "tipo de documento");
  const driverRef = optionalString(params, "motorista", "motorista", 180);
  if (!params.placa && !driverRef) throw new ActionError("Informe a placa ou o motorista do documento.");
  const vehicle = params.placa ? await findVehicle(ctx, params.placa) : null;
  const driver = await driverByReference(ctx, driverRef);
  const entityType = vehicle ? "vehicle" : "driver";
  const entityId = vehicle?.id ?? driver?.id;
  const { data, error } = await ctx.admin.from("documents").insert({
    company_id: ctx.companyId,
    entity_type: entityType,
    entity_id: entityId,
    doc_type: type,
    title: `${type.toUpperCase()} · ${vehicle?.plate ?? driver?.full_name}`,
    document_number: optionalString(params, "numero", "número", 120),
    expires_at: dateValue(params.validade, "validade"),
    notes: contactNote(ctx),
    created_by: actor,
    source: "agente",
  }).select("*").single();
  if (error) throw error;
  return data;
}

export async function finalizarAcertoViagem(ctx: AgentContext, params: Record<string, unknown>) {
  requireManager(ctx);
  const trip = await findTrip(ctx, params.viagem);
  const { data, error } = await ctx.admin.from("trips").update({
    status: "finalizada",
    settlement_date: dateOrToday(params),
    settlement_notes: contactNote(ctx, optionalString(params, "observacao", "observação")),
  }).eq("company_id", ctx.companyId).eq("id", trip.id).select("*").single();
  if (error) throw error;
  return data;
}

export async function decidirAprovacao(ctx: AgentContext, params: Record<string, unknown>) {
  requireManager(ctx);
  const id = requiredString(params, "id", "o item da aprovação", 60);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ActionError("ID de aprovação inválido.");
  const decision = enumValue(params.decisao, ["aprovar", "recusar"] as const, "decisão");
  const reason = optionalString(params, "motivo", "motivo", 2000);
  if (decision === "recusar" && !reason) throw new ActionError("Informe o motivo da recusa.");
  const actor = await actorId(ctx);

  const fuel = await ctx.admin.from("fuel_authorizations").select("id,status").eq("company_id", ctx.companyId).eq("id", id).maybeSingle();
  if (fuel.error) throw fuel.error;
  if (fuel.data) {
    if (fuel.data.status !== "pendente") throw new ActionError("Esta solicitação já foi decidida.");
    const { data, error } = await ctx.admin.from("fuel_authorizations").update({ status: decision === "aprovar" ? "aprovada" : "recusada", approved_by: actor, notes: contactNote(ctx, reason) }).eq("company_id", ctx.companyId).eq("id", id).select("*").single();
    if (error) throw error;
    return { tipo: "autorizacao_abastecimento", item: data };
  }
  const maintenance = await ctx.admin.from("maintenance_requests").select("id,status").eq("company_id", ctx.companyId).eq("id", id).maybeSingle();
  if (maintenance.error) throw maintenance.error;
  if (maintenance.data) {
    if (maintenance.data.status !== "pendente_aprovacao") throw new ActionError("Esta solicitação já foi decidida.");
    const { data, error } = await ctx.admin.from("maintenance_requests").update({ status: decision === "aprovar" ? "agendada" : "rejeitada", reviewed_at: new Date().toISOString(), reviewed_by: actor, rejection_reason: decision === "recusar" ? reason : null, gestor_notes: contactNote(ctx, reason) }).eq("company_id", ctx.companyId).eq("id", id).select("*").single();
    if (error) throw error;
    return { tipo: "solicitacao_manutencao", item: data };
  }
  const order = await ctx.admin.from("maintenance_work_orders").select("id,quote_status").eq("company_id", ctx.companyId).eq("id", id).maybeSingle();
  if (order.error) throw order.error;
  if (order.data) {
    if (!["pendente", "enviado"].includes(order.data.quote_status)) throw new ActionError("Este orçamento já foi decidido.");
    const { data, error } = await ctx.admin.from("maintenance_work_orders").update({
      quote_status: decision === "aprovar" ? "aprovado" : "rejeitado",
      execution_status: decision === "aprovar" ? "aprovado_aguardando_inicio" : "aguardando_aprovacao",
      quote_approved_by: decision === "aprovar" ? actor : null,
      quote_approved_at: decision === "aprovar" ? new Date().toISOString() : null,
      quote_rejected_reason: decision === "recusar" ? reason : null,
      quote_approval_notes: contactNote(ctx, reason),
    }).eq("company_id", ctx.companyId).eq("id", id).select("*").single();
    if (error) throw error;
    return { tipo: "orcamento_os", item: data };
  }
  const expense = await ctx.admin.from("trip_expenses").select("id,reimbursement_status").eq("company_id", ctx.companyId).eq("id", id).maybeSingle();
  if (expense.error) throw expense.error;
  if (expense.data) {
    if (expense.data.reimbursement_status !== "aguardando_aprovacao") throw new ActionError("Este reembolso já foi decidido.");
    const { data, error } = await ctx.admin.from("trip_expenses").update({
      reimbursement_status: decision === "aprovar" ? "aprovado" : "rejeitado",
      reimbursement_approved_at: decision === "aprovar" ? new Date().toISOString() : null,
      reimbursement_approved_by: decision === "aprovar" ? actor : null,
      reimbursement_rejection_reason: decision === "recusar" ? reason : null,
    }).eq("company_id", ctx.companyId).eq("id", id).select("*").single();
    if (error) throw error;
    return { tipo: "reembolso_viagem", item: data };
  }
  throw new ActionError("Aprovação não encontrada nesta empresa.");
}

export async function cadastrarMotorista(ctx: AgentContext, params: Record<string, unknown>) {
  requireManager(ctx);
  const cpf = onlyDigits(requiredString(params, "cpf", "o CPF", 20));
  if (cpf.length !== 11) throw new ActionError("CPF deve conter 11 dígitos.");
  const actor = await actorId(ctx);
  const { data, error } = await ctx.admin.from("drivers").insert({
    company_id: ctx.companyId,
    full_name: requiredString(params, "nome", "o nome", 180),
    cpf,
    phone: optionalString(params, "telefone", "telefone", 30),
    cnh_number: optionalString(params, "cnh_numero", "número da CNH", 40),
    cnh_category: optionalString(params, "cnh_categoria", "categoria da CNH", 10),
    cnh_expires_at: params.cnh_validade ? dateValue(params.cnh_validade, "validade da CNH") : null,
    notes: contactNote(ctx),
    status: "ativo",
    source: "agente",
  }).select("*").single();
  if (error) throw error;
  return data;
}

export async function cadastrarVeiculo(ctx: AgentContext, params: Record<string, unknown>) {
  requireManager(ctx);
  const plate = normalizePlate(requiredString(params, "placa", "a placa", 12));
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)) throw new ActionError("Placa inválida. Use o formato antigo ou Mercosul.");
  const { data: limit, error: limitError } = await ctx.admin.rpc("get_company_vehicle_limit", { _company_id: ctx.companyId });
  if (limitError) throw limitError;
  const { count, error: countError } = await ctx.admin.from("vehicles").select("id", { count: "exact", head: true }).eq("company_id", ctx.companyId);
  if (countError) throw countError;
  if (limit !== null && Number(count ?? 0) >= Number(limit)) throw new ActionError(`O limite de ${limit} veículos do plano foi atingido.`);
  const { data, error } = await ctx.admin.from("vehicles").insert({
    company_id: ctx.companyId,
    plate,
    normalized_plate: plate,
    brand: optionalString(params, "marca", "marca", 100) ?? "Não informada",
    model: requiredString(params, "modelo", "o modelo", 140),
    year_manufacture: optionalNumber(params, "ano", "ano", { integer: true, min: 1900, max: 2100 }),
    year_model: optionalNumber(params, "ano", "ano", { integer: true, min: 1900, max: 2100 }),
    vehicle_type: optionalString(params, "tipo", "tipo", 60),
    fuel_type: params.combustivel ? enumValue(params.combustivel, FUEL_TYPES, "combustível") : null,
    current_km: optionalNumber(params, "km", "KM", { integer: true, min: 0 }) ?? 0,
    renavam: optionalString(params, "renavam", "RENAVAM", 30),
    status: "ativo",
    source: "agente",
  }).select("*").single();
  if (error) throw error;
  return data;
}

export const managerActions: Record<string, (ctx: AgentContext, params: Record<string, unknown>) => Promise<any>> = {
  agendar_manutencao: agendarManutencao,
  abrir_ordem_servico: abrirOrdemServico,
  concluir_manutencao: concluirManutencao,
  registrar_multa: registrarMulta,
  registrar_despesa_veiculo: registrarDespesaVeiculo,
  registrar_documento: registrarDocumento,
  finalizar_acerto_viagem: finalizarAcertoViagem,
  decidir_aprovacao: decidirAprovacao,
  cadastrar_motorista: cadastrarMotorista,
  cadastrar_veiculo: cadastrarVeiculo,
};
