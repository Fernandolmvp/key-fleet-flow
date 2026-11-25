import {
  ActionError,
  AgentContext,
  addDays,
  dateValue,
  fetchAll,
  findVehicle,
  fineWithDisplayStatus,
  normalizePlate,
  numberValue,
  onlyDigits,
  optionalNumber,
  optionalString,
  requireDriver,
  requiredString,
  timestampFor,
  todaySaoPaulo,
  tripWithDisplayStatus,
} from "./helpers.ts";

export async function ping(ctx: AgentContext) {
  const { data, error } = await ctx.admin.from("companies").select("name").eq("id", ctx.companyId).single();
  if (error) throw error;
  return { empresa: data.name };
}

export async function identificarMotorista(ctx: AgentContext, params: Record<string, unknown>) {
  const cpf = onlyDigits(params.cpf);
  const telefone = onlyDigits(params.telefone);
  if (!cpf && !telefone) throw new ActionError("Informe o CPF ou o telefone do motorista.");
  const { data, error } = await ctx.admin.from("drivers").select("*").eq("company_id", ctx.companyId);
  if (error) throw error;
  const driver = (data ?? []).find((item: any) => (cpf && onlyDigits(item.cpf) === cpf) || (telefone && onlyDigits(item.phone) === telefone));
  if (!driver) throw new ActionError("Motorista não encontrado.");
  const vehicles = await driverVehicles(ctx, [driver]);
  return {
    motorista_id: driver.id,
    nome: driver.full_name,
    cnh_validade: driver.cnh_expires_at,
    veiculos: (vehicles[driver.id] ?? []).map((vehicle: any) => vehicle.plate),
  };
}

async function driverVehicles(ctx: AgentContext, drivers: any[]) {
  const ids = drivers.map((driver) => driver.assigned_vehicle_id).filter(Boolean);
  if (!ids.length) return {} as Record<string, any[]>;
  const { data, error } = await ctx.admin.from("vehicles").select("id,plate,brand,model,status").eq("company_id", ctx.companyId).in("id", ids);
  if (error) throw error;
  const result: Record<string, any[]> = {};
  for (const driver of drivers) result[driver.id] = (data ?? []).filter((vehicle: any) => vehicle.id === driver.assigned_vehicle_id);
  return result;
}

export async function consultarVeiculo(ctx: AgentContext, params: Record<string, unknown>) {
  const vehicle = await findVehicle(ctx, params.placa);
  const today = todaySaoPaulo();
  const [schedules, documents, links] = await Promise.all([
    ctx.admin.from("maintenance_schedules").select("*").eq("company_id", ctx.companyId).eq("vehicle_id", vehicle.id)
      .in("status", ["pendente", "proxima", "vencida"]).order("target_date", { ascending: true, nullsFirst: false }).limit(10),
    ctx.admin.from("documents").select("id,entity_type,doc_type,title,document_number,expires_at,status,file_url,file_name").eq("company_id", ctx.companyId)
      .eq("entity_type", "vehicle").eq("entity_id", vehicle.id).is("deleted_at", null).order("expires_at", { ascending: true, nullsFirst: false }),
    ctx.admin.from("insurance_policy_vehicles").select("policy_id,included_at,removed_at").eq("company_id", ctx.companyId).eq("vehicle_id", vehicle.id).is("removed_at", null),
  ]);
  for (const result of [schedules, documents, links]) if (result.error) throw result.error;
  const policyIds = (links.data ?? []).map((link: any) => link.policy_id);
  const policies = policyIds.length ? await ctx.admin.from("insurance_policies").select("id,policy_number,insurer_name,start_date,end_date,status,coverage_summary,coverage_type,total_value")
    .eq("company_id", ctx.companyId).in("id", policyIds).eq("status", "ativa") : { data: [], error: null };
  if (policies.error) throw policies.error;
  return {
    veiculo: vehicle,
    proxima_manutencao: (schedules.data ?? [])[0] ?? null,
    manutencoes_agendadas: schedules.data ?? [],
    documentos: documents.data ?? [],
    seguro_vigente: (policies.data ?? []).find((policy: any) => (!policy.start_date || policy.start_date <= today) && (!policy.end_date || policy.end_date >= today)) ?? null,
    apolices_ativas: policies.data ?? [],
  };
}

export async function historicoAbastecimentos(ctx: AgentContext, params: Record<string, unknown>) {
  const vehicle = await findVehicle(ctx, params.placa);
  const limit = optionalNumber(params, "limite", "limite", { integer: true, min: 1, max: 50 }) ?? 10;
  const { data, error } = await ctx.admin.from("fuel_records").select("id,fueled_at,station_name,city,fuel_type,liters,price_per_liter,total_value,km_at_fueling,km_driven,km_per_liter,driver_id,notes")
    .eq("company_id", ctx.companyId).eq("vehicle_id", vehicle.id).order("fueled_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((record: any) => ({
    ...record,
    km_por_litro: record.km_per_liter ?? (record.km_driven && record.liters ? Number((record.km_driven / record.liters).toFixed(2)) : null),
  }));
}

export async function listarPostos(ctx: AgentContext, params: Record<string, unknown>) {
  const cidade = optionalString(params, "cidade", "cidade", 120);
  let query = ctx.admin.from("fuel_stations").select("id,name,trade_name,brand,city,state,phone,fuel_types,active,preferred").eq("company_id", ctx.companyId).order("name");
  if (cidade) query = query.ilike("city", `%${cidade}%`);
  const { data, error } = await query.limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function minhasViagens(ctx: AgentContext, params: Record<string, unknown>) {
  const driver = await requireDriver(ctx);
  const status = optionalString(params, "status", "status", 40);
  let query = ctx.admin.from("trips").select("*").eq("company_id", ctx.companyId).eq("driver_id", driver.id).order("scheduled_start_date", { ascending: false }).limit(100);
  if (status && status !== "acerto_pendente") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  const trips = (data ?? []).map((trip: any) => tripWithDisplayStatus(trip));
  return status === "acerto_pendente" ? trips.filter((trip: any) => trip.status_acerto === "acerto_pendente") : trips;
}

export async function resumoFrota(ctx: AgentContext) {
  const { data, error } = await ctx.admin.rpc("agent_dashboard_summary", { p_company_id: ctx.companyId });
  if (error) throw error;
  return data;
}

export async function listarAlertas(ctx: AgentContext, params: Record<string, unknown>) {
  const type = optionalString(params, "tipo", "tipo", 40);
  const today = todaySaoPaulo();
  const alerts: any[] = [];
  if (!type || type === "multas") {
    const { data, error } = await ctx.admin.from("traffic_fines").select("id,vehicle_id,due_date,amount,description,notification_number,status,paid_at").eq("company_id", ctx.companyId).lt("due_date", today).limit(500);
    if (error) throw error;
    for (const fine of data ?? []) {
      if (fineWithDisplayStatus(fine, today).status_calculado === "vencida") alerts.push({ id: `multa:${fine.id}`, tipo: "multas", severidade: "alta", data: fine.due_date, titulo: "Multa vencida", descricao: fine.description || fine.notification_number || "Multa com vencimento em atraso", registro_id: fine.id, veiculo_id: fine.vehicle_id });
    }
  }
  if (!type || type === "viagens" || type === "acertos") {
    const { data, error } = await ctx.admin.from("trips").select("*").eq("company_id", ctx.companyId).in("status", ["programada", "planejada", "em_andamento", "aguardando_acerto", "acerto_pendente"]).lt("scheduled_end_date", today).limit(500);
    if (error) throw error;
    for (const trip of data ?? []) alerts.push({ id: `viagem:${trip.id}`, tipo: "acertos", severidade: "media", data: trip.scheduled_end_date, titulo: "Acerto de viagem pendente", descricao: `${trip.trip_code || "Viagem"} · ${trip.title}`, registro_id: trip.id, viagem_id: trip.id });
  }
  if (!type || type === "manutencoes") {
    const [schedules, orders] = await Promise.all([
      ctx.admin.from("maintenance_schedules").select("id,vehicle_id,category,description,target_date,status").eq("company_id", ctx.companyId).in("status", ["pendente", "proxima", "vencida"]).lt("target_date", today).limit(500),
      ctx.admin.from("maintenance_work_orders").select("id,vehicle_id,title,scheduled_date,execution_status,os_number").eq("company_id", ctx.companyId).not("execution_status", "in", "(concluido,cancelado)").lt("scheduled_date", today).limit(500),
    ]);
    if (schedules.error) throw schedules.error;
    if (orders.error) throw orders.error;
    for (const item of schedules.data ?? []) alerts.push({ id: `agenda:${item.id}`, tipo: "manutencoes", severidade: "alta", data: item.target_date, titulo: "Manutenção vencida", descricao: item.description || item.category, registro_id: item.id, veiculo_id: item.vehicle_id });
    for (const item of orders.data ?? []) alerts.push({ id: `os:${item.id}`, tipo: "manutencoes", severidade: "alta", data: item.scheduled_date, titulo: `OS ${item.os_number || item.id} em atraso`, descricao: item.title, registro_id: item.id, veiculo_id: item.vehicle_id });
  }
  if (!type || type === "documentos") {
    const { data, error } = await ctx.admin.from("documents").select("id,entity_type,entity_id,doc_type,title,expires_at,status").eq("company_id", ctx.companyId).is("deleted_at", null).lt("expires_at", today).limit(500);
    if (error) throw error;
    for (const document of data ?? []) alerts.push({ id: `documento:${document.id}`, tipo: "documentos", severidade: "alta", data: document.expires_at, titulo: "Documento vencido", descricao: document.title || document.doc_type, registro_id: document.id, entidade_id: document.entity_id });
  }
  return alerts.sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

export async function listarDocumentosVencendo(ctx: AgentContext, params: Record<string, unknown>) {
  const days = optionalNumber(params, "dias", "dias", { integer: true, min: 0, max: 365 }) ?? 30;
  const today = todaySaoPaulo();
  const { data, error } = await ctx.admin.from("documents").select("id,entity_type,entity_id,doc_type,title,document_number,expires_at,status,file_url").eq("company_id", ctx.companyId)
    .is("deleted_at", null).not("expires_at", "is", null).lte("expires_at", addDays(today, days)).order("expires_at").limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function listarManutencoes(ctx: AgentContext, params: Record<string, unknown>) {
  const status = optionalString(params, "status", "status", 40);
  const vehicle = params.placa ? await findVehicle(ctx, params.placa) : null;
  let schedulesQuery = ctx.admin.from("maintenance_schedules").select("*").eq("company_id", ctx.companyId).order("target_date", { ascending: true, nullsFirst: false }).limit(200);
  let ordersQuery = ctx.admin.from("maintenance_work_orders").select("*").eq("company_id", ctx.companyId).order("scheduled_date", { ascending: false }).limit(200);
  if (vehicle) {
    schedulesQuery = schedulesQuery.eq("vehicle_id", vehicle.id);
    ordersQuery = ordersQuery.eq("vehicle_id", vehicle.id);
  }
  if (status) {
    schedulesQuery = schedulesQuery.eq("status", status);
    ordersQuery = ordersQuery.eq("execution_status", status);
  }
  const [schedules, orders] = await Promise.all([schedulesQuery, ordersQuery]);
  if (schedules.error) throw schedules.error;
  if (orders.error) throw orders.error;
  return { agendamentos: schedules.data ?? [], ordens_servico: orders.data ?? [] };
}

export async function listarMultas(ctx: AgentContext, params: Record<string, unknown>) {
  const status = optionalString(params, "status", "status", 40);
  const vehicle = params.placa ? await findVehicle(ctx, params.placa) : null;
  let query = ctx.admin.from("traffic_fines").select("*").eq("company_id", ctx.companyId).order("infraction_date", { ascending: false }).limit(200);
  if (vehicle) query = query.eq("vehicle_id", vehicle.id);
  if (status && status !== "vencida") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  const fines = (data ?? []).map((fine: any) => fineWithDisplayStatus(fine));
  return status ? fines.filter((fine: any) => fine.status_calculado === status) : fines;
}

export async function listarViagens(ctx: AgentContext, params: Record<string, unknown>) {
  const status = optionalString(params, "status", "status", 40);
  let query = ctx.admin.from("trips").select("*").eq("company_id", ctx.companyId).order("scheduled_start_date", { ascending: false }).limit(200);
  if (status && status !== "acerto_pendente") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  const trips = (data ?? []).map((trip: any) => tripWithDisplayStatus(trip));
  return status === "acerto_pendente" ? trips.filter((trip: any) => trip.status_acerto === "acerto_pendente") : trips;
}

export async function buscarMotorista(ctx: AgentContext, params: Record<string, unknown>) {
  const search = requiredString(params, "busca", "a busca", 120);
  const digits = onlyDigits(search);
  const { data, error } = await ctx.admin.from("drivers").select("*").eq("company_id", ctx.companyId).ilike("full_name", `%${search}%`).limit(20);
  if (error) throw error;
  let drivers = data ?? [];
  if (digits) {
    const all = await ctx.admin.from("drivers").select("*").eq("company_id", ctx.companyId);
    if (all.error) throw all.error;
    const byDigits = (all.data ?? []).filter((driver: any) => onlyDigits(driver.cpf).includes(digits) || onlyDigits(driver.phone).includes(digits));
    drivers = [...new Map([...drivers, ...byDigits].map((driver) => [driver.id, driver])).values()];
  }
  if (!drivers.length) throw new ActionError("Motorista não encontrado.");
  const vehicles = await driverVehicles(ctx, drivers);
  const result = [];
  for (const driver of drivers) {
    const [fines, trips] = await Promise.all([
      ctx.admin.from("traffic_fines").select("id,infraction_date,due_date,amount,status,description").eq("company_id", ctx.companyId).eq("driver_id", driver.id).order("infraction_date", { ascending: false }).limit(20),
      ctx.admin.from("trips").select("id,trip_code,title,status,scheduled_start_date,scheduled_end_date").eq("company_id", ctx.companyId).eq("driver_id", driver.id).order("scheduled_start_date", { ascending: false }).limit(20),
    ]);
    if (fines.error) throw fines.error;
    if (trips.error) throw trips.error;
    result.push({ motorista_id: driver.id, nome: driver.full_name, cpf: driver.cpf, telefone: driver.phone, cnh_numero: driver.cnh_number, cnh_categoria: driver.cnh_category, cnh_validade: driver.cnh_expires_at, status: driver.status, veiculos: vehicles[driver.id] ?? [], multas: fines.data ?? [], viagens: trips.data ?? [] });
  }
  return result.length === 1 ? result[0] : result;
}

export async function consultarSeguro(ctx: AgentContext, params: Record<string, unknown>) {
  const vehicle = params.placa ? await findVehicle(ctx, params.placa) : null;
  let linksQuery = ctx.admin.from("insurance_policy_vehicles").select("policy_id,vehicle_id,included_at,removed_at").eq("company_id", ctx.companyId).is("removed_at", null);
  if (vehicle) linksQuery = linksQuery.eq("vehicle_id", vehicle.id);
  const { data: links, error } = await linksQuery;
  if (error) throw error;
  const policyIds = [...new Set((links ?? []).map((link: any) => link.policy_id))];
  if (!policyIds.length) return [];
  const { data: policies, error: policyError } = await ctx.admin.from("insurance_policies").select("*").eq("company_id", ctx.companyId).in("id", policyIds).order("end_date");
  if (policyError) throw policyError;
  return (policies ?? []).map((policy: any) => ({ ...policy, veiculo_ids: (links ?? []).filter((link: any) => link.policy_id === policy.id).map((link: any) => link.vehicle_id) }));
}

export async function relatorioCustos(ctx: AgentContext, params: Record<string, unknown>) {
  const today = todaySaoPaulo();
  const inicio = params.inicio ? dateValue(params.inicio, "início") : `${today.slice(0, 7)}-01`;
  const fim = params.fim ? dateValue(params.fim, "fim") : today;
  if (fim < inicio) throw new ActionError("A data final deve ser igual ou posterior à inicial.");
  const vehicle = params.placa ? await findVehicle(ctx, params.placa) : null;
  const filterVehicle = (query: any) => vehicle ? query.eq("vehicle_id", vehicle.id) : query;
  const [fuel, maintenance, fines, expenses, trips] = await Promise.all([
    fetchAll((from, to) => filterVehicle(ctx.admin.from("fuel_records").select("id,vehicle_id,fueled_at,total_value,liters,km_driven").eq("company_id", ctx.companyId).gte("fueled_at", timestampFor(inicio)).lte("fueled_at", `${fim}T23:59:59-03:00`)).range(from, to)),
    fetchAll((from, to) => filterVehicle(ctx.admin.from("maintenance_records").select("id,vehicle_id,service_at,total_value").eq("company_id", ctx.companyId).gte("service_at", inicio).lte("service_at", fim)).range(from, to)),
    fetchAll((from, to) => filterVehicle(ctx.admin.from("traffic_fines").select("id,vehicle_id,infraction_date,amount,paid_amount").eq("company_id", ctx.companyId).gte("infraction_date", inicio).lte("infraction_date", fim)).range(from, to)),
    fetchAll((from, to) => filterVehicle(ctx.admin.from("vehicle_expenses").select("id,vehicle_id,expense_date,amount").eq("company_id", ctx.companyId).gte("expense_date", inicio).lte("expense_date", fim)).range(from, to)),
    fetchAll((from, to) => filterVehicle(ctx.admin.from("trips").select("id,vehicle_id").eq("company_id", ctx.companyId)).range(from, to)),
  ]);
  const tripIds = trips.map((trip) => trip.id);
  const tripExpenses = tripIds.length ? await fetchAll((from, to) => ctx.admin.from("trip_expenses").select("id,trip_id,expense_date,amount").eq("company_id", ctx.companyId).in("trip_id", tripIds).gte("expense_date", inicio).lte("expense_date", fim).range(from, to)) : [];
  const tripVehicle = Object.fromEntries(trips.map((trip) => [trip.id, trip.vehicle_id]));
  const sum = (rows: any[], field = "total_value") => rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
  const totals: Record<string, number> = {};
  const addCost = (vehicleId: string, amount: number) => { if (vehicleId) totals[vehicleId] = (totals[vehicleId] ?? 0) + amount; };
  for (const row of fuel) addCost(row.vehicle_id, Number(row.total_value ?? 0));
  for (const row of maintenance) addCost(row.vehicle_id, Number(row.total_value ?? 0));
  for (const row of fines) addCost(row.vehicle_id, Number(row.paid_amount ?? row.amount ?? 0));
  for (const row of expenses) addCost(row.vehicle_id, Number(row.amount ?? 0));
  for (const row of tripExpenses) addCost(tripVehicle[row.trip_id], Number(row.amount ?? 0));
  const vehicles = (await ctx.admin.from("vehicles").select("id,plate,brand,model").eq("company_id", ctx.companyId));
  if (vehicles.error) throw vehicles.error;
  const labels = Object.fromEntries((vehicles.data ?? []).map((item: any) => [item.id, item]));
  const consumption: Record<string, { litros: number; km: number }> = {};
  for (const row of fuel) {
    consumption[row.vehicle_id] ??= { litros: 0, km: 0 };
    consumption[row.vehicle_id].litros += Number(row.liters ?? 0);
    consumption[row.vehicle_id].km += Number(row.km_driven ?? 0);
  }
  return {
    periodo: { inicio, fim },
    totais: {
      combustivel: sum(fuel),
      manutencao: sum(maintenance),
      multas: fines.reduce((total, fine) => total + Number(fine.paid_amount ?? fine.amount ?? 0), 0),
      despesas: sum(expenses, "amount") + sum(tripExpenses, "amount"),
    },
    top_5_veiculos: Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, total]) => ({ veiculo: labels[id] ?? { id }, total })),
    ranking_km_litro: Object.entries(consumption).map(([id, values]) => ({ veiculo: labels[id] ?? { id }, km_por_litro: values.litros ? Number((values.km / values.litros).toFixed(2)) : null, litros: values.litros, km: values.km })).sort((a, b) => (b.km_por_litro ?? 0) - (a.km_por_litro ?? 0)),
  };
}

export async function listarAprovacoes(ctx: AgentContext) {
  const [fuel, maintenance, orders, expenses] = await Promise.all([
    ctx.admin.from("fuel_authorizations").select("id,vehicle_id,driver_id,estimated_liters,estimated_value,station_name,requested_at,status").eq("company_id", ctx.companyId).eq("status", "pendente"),
    ctx.admin.from("maintenance_requests").select("id,vehicle_id,problem_description,severity_self_assessment,requested_at,status").eq("company_id", ctx.companyId).eq("status", "pendente_aprovacao"),
    ctx.admin.from("maintenance_work_orders").select("id,os_number,vehicle_id,title,quote_amount_total,scheduled_date,quote_status").eq("company_id", ctx.companyId).in("quote_status", ["pendente", "enviado"]),
    ctx.admin.from("trip_expenses").select("id,trip_id,expense_category,amount,description,expense_date,reimbursement_status").eq("company_id", ctx.companyId).eq("reimbursement_status", "aguardando_aprovacao"),
  ]);
  for (const result of [fuel, maintenance, orders, expenses]) if (result.error) throw result.error;
  return [
    ...(fuel.data ?? []).map((item: any) => ({ ...item, id: item.id, tipo: "autorizacao_abastecimento" })),
    ...(maintenance.data ?? []).map((item: any) => ({ ...item, id: item.id, tipo: "solicitacao_manutencao" })),
    ...(orders.data ?? []).map((item: any) => ({ ...item, id: item.id, tipo: "orcamento_os" })),
    ...(expenses.data ?? []).map((item: any) => ({ ...item, id: item.id, tipo: "reembolso_viagem" })),
  ];
}

export async function conferirCobrancaPosto(ctx: AgentContext, params: Record<string, unknown>) {
  const posto = requiredString(params, "posto", "o posto", 180);
  const today = todaySaoPaulo();
  const inicio = params.inicio ? dateValue(params.inicio, "início") : `${today.slice(0, 7)}-01`;
  const fim = params.fim ? dateValue(params.fim, "fim") : today;
  const chargeItems = params.itens_cobranca === undefined ? [] : params.itens_cobranca;
  if (!Array.isArray(chargeItems)) throw new ActionError("itens_cobranca deve ser uma lista.");
  const { data, error } = await ctx.admin.from("fuel_records").select("id,vehicle_id,fueled_at,liters,total_value,km_at_fueling,station_name,notes").eq("company_id", ctx.companyId)
    .ilike("station_name", `%${posto}%`).gte("fueled_at", timestampFor(inicio)).lte("fueled_at", `${fim}T23:59:59-03:00`).order("fueled_at");
  if (error) throw error;
  const records = data ?? [];
  const vehicleIds = [...new Set(records.map((record: any) => record.vehicle_id))];
  const vehicles = vehicleIds.length ? await ctx.admin.from("vehicles").select("id,plate").eq("company_id", ctx.companyId).in("id", vehicleIds) : { data: [], error: null };
  if (vehicles.error) throw vehicles.error;
  const plates = Object.fromEntries((vehicles.data ?? []).map((item: any) => [item.id, item.plate]));
  const lancados = records.map((record: any) => ({ ...record, placa: plates[record.vehicle_id] ?? null }));
  const used = new Set<string>();
  const divergencias: any[] = [];
  const faltandoNoSistema: any[] = [];
  for (const raw of chargeItems) {
    if (!raw || typeof raw !== "object") throw new ActionError("Cada item da cobrança deve ser um objeto.");
    const item: any = raw;
    const plate = normalizePlate(item.placa);
    const date = item.data ? dateValue(item.data) : null;
    const match = lancados.find((record: any) => !used.has(record.id)
      && (!plate || normalizePlate(record.placa) === plate)
      && (!date || String(record.fueled_at).slice(0, 10) === date)
      && (item.km === undefined || Number(record.km_at_fueling) === Number(item.km)));
    if (!match) {
      faltandoNoSistema.push(item);
      continue;
    }
    used.add(match.id);
    const litersDifferent = item.litros !== undefined && Math.abs(Number(match.litros) - Number(item.litros)) > 0.01;
    const valueDifferent = (item.valor_total ?? item.valor) !== undefined && Math.abs(Number(match.total_value) - Number(item.valor_total ?? item.valor)) > 0.01;
    if (litersDifferent || valueDifferent) divergencias.push({ tipo: "valores_divergentes", cobranca: item, lancamento: match });
  }
  const faltandoNaCobranca = chargeItems.length ? lancados.filter((record: any) => !used.has(record.id)) : [];
  const totalLancado = lancados.reduce((total: number, record: any) => total + Number(record.total_value ?? 0), 0);
  if (params.valor_total_cobrado !== undefined) {
    const charged = numberValue(params.valor_total_cobrado, "valor_total_cobrado", { min: 0 });
    if (Math.abs(charged - totalLancado) > 0.01) divergencias.push({ tipo: "total_divergente", valor_total_cobrado: charged, total_lancado: totalLancado, diferenca: Number((charged - totalLancado).toFixed(2)) });
  }
  return {
    lancados,
    total_lancado: Number(totalLancado.toFixed(2)),
    divergencias,
    faltando_no_sistema: faltandoNoSistema,
    faltando_na_cobranca: faltandoNaCobranca,
  };
}

export const readActions: Record<string, (ctx: AgentContext, params: Record<string, unknown>) => Promise<any>> = {
  ping: (ctx) => ping(ctx),
  identificar_motorista: identificarMotorista,
  consultar_veiculo: consultarVeiculo,
  historico_abastecimentos: historicoAbastecimentos,
  listar_postos: listarPostos,
  minhas_viagens: minhasViagens,
  resumo_frota: (ctx) => resumoFrota(ctx),
  listar_alertas: listarAlertas,
  listar_documentos_vencendo: listarDocumentosVencendo,
  listar_manutencoes: listarManutencoes,
  listar_multas: listarMultas,
  listar_viagens: listarViagens,
  buscar_motorista: buscarMotorista,
  consultar_seguro: consultarSeguro,
  relatorio_custos: relatorioCustos,
  listar_aprovacoes: (ctx) => listarAprovacoes(ctx),
  conferir_cobranca_posto: conferirCobrancaPosto,
};
