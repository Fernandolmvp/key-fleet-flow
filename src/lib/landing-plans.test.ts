import { describe, expect, it } from "vitest";
import { landingHighlights, landingPlans } from "./landing-plans";

describe("landing plans", () => {
  it("publishes the four plans with the agreed prices and vehicle limits", () => {
    expect(
      landingPlans.map((p) => [p.slug, p.name, p.priceLabel, p.limitLabel]),
    ).toEqual([
      ["starter", "Starter", "R$ 149", "até 10 veículos"],
      ["pro", "Pro", "R$ 349", "até 30 veículos"],
      ["business", "Business", "R$ 749", "até 100 veículos"],
      ["enterprise", "Enterprise", "Sob consulta", "limite de veículos personalizado"],
    ]);
  });

  it("sends every plan action to the demo booking page", () => {
    for (const plan of landingPlans) {
      expect(plan.demoPath).toBe("/agendar");
    }
  });

  it("shows a monthly suffix only on plans with a published price", () => {
    for (const plan of landingPlans) {
      if (plan.priceLabel === "Sob consulta") {
        expect(plan.priceSuffix).toBeUndefined();
      } else {
        expect(plan.priceSuffix).toBe("/mês");
      }
    }
  });
});

describe("landing results strip", () => {
  it("keeps every highlight free of numeric indicators", () => {
    expect(landingHighlights.length).toBeGreaterThan(0);
    for (const phrase of landingHighlights) {
      expect(phrase).not.toMatch(/[0-9]/);
      expect(phrase).not.toContain("%");
    }
  });
});
