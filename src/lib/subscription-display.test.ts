import { describe, it, expect } from "vitest";
import { displayedPlan, displayedSubscriptionStatus } from "./subscription-billing";

const plans = [
  { id: "s", name: "Starter", monthly_price: "149.00" },
  { id: "p", name: "Pro", monthly_price: 349 },
  { id: "b", name: "Business", monthly_price: 749 },
  { id: "e", name: "Enterprise", monthly_price: null },
];

describe("plano exibido", () => {
  it("Enterprise aparece como sob consulta, não com o valor gravado", () => {
    expect(displayedPlan("e", plans)).toEqual({ name: "Enterprise", priceLabel: "Sob consulta" });
  });
  it("Starter, Pro e Business usam o preço da tabela", () => {
    expect(displayedPlan("s", plans).priceLabel).toContain("149,00");
    expect(displayedPlan("p", plans).priceLabel).toContain("349,00");
    expect(displayedPlan("b", plans).priceLabel).toContain("749,00");
  });
});

describe("status exibido", () => {
  const today = new Date("2026-11-20T12:00:00");
  it("ativa com vencimento passado vira pagamento pendente", () => {
    expect(displayedSubscriptionStatus("ativa", "2026-10-28", today).statusKey).toBe("pagamento_pendente");
  });
  it("ativa em dia continua ativa", () => {
    expect(displayedSubscriptionStatus("ativa", "2026-11-20", today)).toEqual({ pending: false, statusKey: "ativa" });
  });
  it("cancelada vencida não vira pendente", () => {
    expect(displayedSubscriptionStatus("cancelada", "2026-06-11", today).pending).toBe(false);
  });
});
