import { describe, it, expect } from "vitest";
import { tripSettlementBalance, tripCostPerKm, tripResult, tripDrivenKm, tripTab, settlementLabel } from "./trip-finance";

const fmt = (v: number) => `R$ ${v.toFixed(2)}`;

describe("acerto da viagem", () => {
  it("adiantamento maior que gasto em dinheiro: motorista devolve", () => {
    const b = tripSettlementBalance({ total_advance_cash: 1000, total_spent_cash: 700 });
    expect(b).toBe(300);
    expect(settlementLabel(b, fmt)).toBe("Motorista devolve R$ 300.00");
  });
  it("gasto do bolso do motorista: empresa reembolsa", () => {
    const b = tripSettlementBalance({ total_advance_cash: 200, total_spent_cash: 200, total_reimbursable: 150 });
    expect(settlementLabel(b, fmt)).toBe("Empresa reembolsa R$ 150.00");
  });
});

describe("custo por km e resultado", () => {
  it("usa hodômetro real e soma todas as despesas", () => {
    expect(tripCostPerKm({ km_at_start: 1000, km_at_end: 1500, total_spent_cash: 300, total_spent_card: 200 })).toBe(1);
  });
  it("sem km real não calcula, mesmo com km estimado", () => {
    expect(tripDrivenKm({ km_at_start: 1000, km_at_end: null })).toBeNull();
    expect(tripCostPerKm({ total_spent_cash: 100 })).toBeNull();
  });
  it("resultado = frete − custos; sem frete fica vazio; frete zero conta", () => {
    expect(tripResult({ freight_value: 2000, total_spent_cash: 500, total_spent_card: 300 })).toBe(1200);
    expect(tripResult({ total_spent_cash: 500 })).toBeNull();
    expect(tripResult({ freight_value: 0, total_spent_cash: 50 })).toBe(-50);
  });
});

describe("abas", () => {
  it("agrupa status gravados nas abas pedidas", () => {
    expect(tripTab("programada")).toBe("planejada");
    expect(tripTab("finalizada")).toBe("concluida");
    expect(tripTab("aguardando_acerto")).toBe("acerto_pendente");
    expect(tripTab("acerto_pendente")).toBe("acerto_pendente");
  });
});
