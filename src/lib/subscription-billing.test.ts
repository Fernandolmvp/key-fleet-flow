import { describe, expect, it } from "vitest";
import { subscriptionBillingMode } from "./subscription-billing";

describe("subscription billing presentation", () => {
  it("uses linked recurring subscriptions for automatic card billing", () => {
    expect(subscriptionBillingMode({ stripe_subscription_id: "sub_test", cancel_at_period_end: false, status: "ativa" })).toBe("automatic_card");
  });
  it("does not infer automatic card billing from active or overdue status", () => {
    for (const status of ["ativa", "atrasada", "suspensa", "aguardando_pagamento"]) {
      expect(subscriptionBillingMode({ stripe_subscription_id: null, cancel_at_period_end: false, status })).toBe("manual");
    }
  });
  it("does not promise renewal for canceled or ending card subscriptions", () => {
    expect(subscriptionBillingMode({ stripe_subscription_id: "sub_test", cancel_at_period_end: true, status: "ativa" })).toBe("ending");
    expect(subscriptionBillingMode({ stripe_subscription_id: "sub_test", cancel_at_period_end: false, status: "cancelada" })).toBe("ending");
  });
  it("makes no billing claim for missing subscription or trial", () => {
    expect(subscriptionBillingMode(null)).toBe("unknown");
    for (const status of ["trial", "expirada"]) expect(subscriptionBillingMode({ stripe_subscription_id: null, cancel_at_period_end: false, status })).toBe("unknown");
  });
});