import { describe, it, expect } from "vitest";
import { parseTread, treadLevel, isAboveLast, groupPositionsByAxle, defaultLayoutForVehicleType } from "./tread-measurement";

describe("tread measurement", () => {
  it("aceita vírgula e ponto", () => {
    expect(parseTread("3,5")).toBe(3.5);
    expect(parseTread("3.5")).toBe(3.5);
    expect(parseTread("")).toBeNull();
    expect(parseTread("abc")).toBeNaN();
  });
  it("vermelho em 1,6 mm ou menos", () => {
    expect(treadLevel(1.6)).toBe("critico");
    expect(treadLevel(1.7)).toBe("atencao");
    expect(treadLevel(2.6)).toBe("atencao");
    expect(treadLevel(2.7)).toBe("ok");
  });
  it("avisa quando maior que a última medição", () => {
    expect(isAboveLast(5, 4)).toBe(true);
    expect(isAboveLast(4, 4)).toBe(false);
    expect(isAboveLast(5, null)).toBe(false);
  });
  it("organiza carro com esquerda antes da direita e estepe por último", () => {
    const g = groupPositionsByAxle(["DD", "DE", "TD", "TE", "EST"]);
    expect(g.map((x) => x.positions)).toEqual([["DE", "DD"], ["TE", "TD"], ["EST"]]);
  });
  it("layout padrão por tipo", () => {
    expect(defaultLayoutForVehicleType("moto")).toBe("moto_2");
    expect(defaultLayoutForVehicleType("caminhao")).toBe("truck_6");
    expect(defaultLayoutForVehicleType(null)).toBe("carro_4");
  });
});
