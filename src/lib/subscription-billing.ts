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