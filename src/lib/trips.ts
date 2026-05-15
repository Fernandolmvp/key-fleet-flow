/** Constantes, labels e helpers para o módulo de Viagens. */

export const TRIP_STATUS = [
  { value: "programada", label: "Programada", color: "bg-muted text-muted-foreground" },
  { value: "em_andamento", label: "Em andamento", color: "bg-primary/15 text-primary border border-primary/40" },
  { value: "aguardando_acerto", label: "Aguardando acerto", color: "bg-warning/15 text-warning border border-warning/40" },
  { value: "acerto_pendente", label: "Acerto pendente", color: "bg-warning/15 text-warning border border-warning/40" },
  { value: "finalizada", label: "Finalizada", color: "bg-success/15 text-success border border-success/40" },
  { value: "cancelada", label: "Cancelada", color: "bg-destructive/15 text-destructive border border-destructive/40" },
] as const;

export const TRIP_TYPES = [
  { value: "entrega", label: "Entrega" },
  { value: "coleta", label: "Coleta" },
  { value: "transporte_passageiros", label: "Transporte de passageiros" },
  { value: "visita_comercial", label: "Visita comercial" },
  { value: "manutencao_externa", label: "Manutenção externa" },
  { value: "treinamento", label: "Treinamento" },
  { value: "outros", label: "Outros" },
] as const;

export const EXPENSE_CATEGORIES = [
  { value: "combustivel", label: "Combustível", icon: "⛽" },
  { value: "pedagio", label: "Pedágio", icon: "🛣️" },
  { value: "refeicao", label: "Refeição", icon: "🍴" },
  { value: "hospedagem", label: "Hospedagem", icon: "🏨" },
  { value: "lavagem", label: "Lavagem", icon: "🧽" },
  { value: "estacionamento", label: "Estacionamento", icon: "🅿️" },
  { value: "manutencao_emergencial", label: "Manutenção emergencial", icon: "🔧" },
  { value: "pneu_emergencial", label: "Pneu emergencial", icon: "🛞" },
  { value: "transporte_complementar", label: "Transporte complementar", icon: "🚖" },
  { value: "comunicacao", label: "Comunicação", icon: "📱" },
  { value: "taxa_servico", label: "Taxa de serviço", icon: "💼" },
  { value: "mensageria", label: "Mensageria", icon: "📦" },
  { value: "taxa_governamental", label: "Taxa governamental", icon: "🏛️" },
  { value: "outros", label: "Outros", icon: "📁" },
] as const;

export const PAYMENT_METHODS = [
  { value: "dinheiro_empresa", label: "Dinheiro da empresa (adiantamento)", group: "empresa" },
  { value: "cartao_empresa", label: "Cartão da empresa", group: "empresa" },
  { value: "pix_empresa", label: "PIX da empresa", group: "empresa" },
  { value: "vale_refeicao", label: "Vale-refeição", group: "vale" },
  { value: "vale_combustivel", label: "Vale-combustível", group: "vale" },
  { value: "dinheiro_proprio", label: "Meu dinheiro (reembolsar)", group: "proprio" },
  { value: "cartao_proprio", label: "Meu cartão (reembolsar)", group: "proprio" },
  { value: "pix_proprio", label: "Meu PIX (reembolsar)", group: "proprio" },
] as const;

export const REIMBURSEMENT_STATUS = [
  { value: "nao_aplicavel", label: "—" },
  { value: "aguardando_aprovacao", label: "Aguardando aprovação", color: "bg-warning/15 text-warning border border-warning/40" },
  { value: "aprovado", label: "Aprovado", color: "bg-success/15 text-success border border-success/40" },
  { value: "rejeitado", label: "Rejeitado", color: "bg-destructive/15 text-destructive border border-destructive/40" },
  { value: "pago", label: "Pago", color: "bg-primary/15 text-primary border border-primary/40" },
] as const;

export const ADVANCE_PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "deposito", label: "Depósito" },
  { value: "transferencia", label: "Transferência" },
] as const;

export const COMPANY_PM_TYPES = [
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "cartao_corporativo", label: "Cartão corporativo" },
  { value: "vale_combustivel", label: "Vale-combustível" },
  { value: "vale_refeicao", label: "Vale-refeição" },
  { value: "pix", label: "PIX" },
  { value: "conta_corrente", label: "Conta corrente" },
] as const;

export function labelOf<T extends readonly { value: string; label: string }[]>(list: T, value: string | null | undefined): string {
  if (!value) return "—";
  return list.find((i) => i.value === value)?.label ?? value;
}

export function formatBRL(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function tripBalance(trip: any): number {
  const adv = Number(trip?.total_advance_cash ?? 0);
  const cash = Number(trip?.total_spent_cash ?? 0);
  return Math.max(adv - cash, 0);
}

export function paymentGroup(method: string | null | undefined): "empresa" | "vale" | "proprio" | "" {
  return (PAYMENT_METHODS.find((p) => p.value === method)?.group as any) ?? "";
}

export function categoryIcon(cat: string | null | undefined): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === cat)?.icon ?? "📁";
}

export type Trip = any;
export type TripExpense = any;
export type TripAdvance = any;
export type CompanyPaymentMethod = any;