export interface SubscriptionBilling {
  stripe_subscription_id: string | null;
  cancel_at_period_end: boolean;
  status: string;
}

export type BillingMode = "automatic_card" | "manual" | "ending" | "unknown";

/** Subscription linkage, not status or a historical payment, establishes recurring billing. */
export function subscriptionBillingMode(subscription: SubscriptionBilling | null): BillingMode {
  if (!subscription || subscription.status === "trial" || subscription.status === "expirada") return "unknown";
  if (subscription.stripe_subscription_id) {
    if (subscription.cancel_at_period_end || subscription.status === "cancelada") return "ending";
    return "automatic_card";
  }
  return "manual";
}

export function manualPaymentLabel(method?: string | null): string {
  const labels: Record<string, string> = { pix: "Pix", boleto: "boleto", transferencia: "transferência", cartao: "cartão", dinheiro: "dinheiro", outro: "método combinado" };
  return method ? labels[method] ?? "método combinado" : "método combinado";
}
export interface PlanPriceSource { id: string; name: string; monthly_price: number | string | null }

/** Plan name and price both come from the plans table row of the subscription's plan. */
export function displayedPlan(planId: string | null | undefined, plans: PlanPriceSource[], fallbackName?: string | null) {
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return { name: fallbackName ?? "—", priceLabel: null as string | null };
  const price = plan.monthly_price == null ? null : Number(plan.monthly_price);
  const priceLabel = price == null || !Number.isFinite(price) || price <= 0
    ? "Sob consulta"
    : `${price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} / mês`;
  return { name: plan.name, priceLabel };
}

/** A pending payment overrides an "active" label; other stored statuses stay as they are. */
export function displayedSubscriptionStatus(status: string, periodEnd: string | null | undefined, today: Date = new Date()) {
  const pastDue = !!periodEnd && new Date(`${periodEnd.slice(0, 10)}T23:59:59`) < today;
  const pending = status === "aguardando_pagamento" || ((status === "ativa" || status === "atrasada") && pastDue);
  return { pending: pending || status === "suspensa", statusKey: pending ? "pagamento_pendente" : status };
}
