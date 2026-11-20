import type { AxleLayout } from "@/lib/tires";

export const LEGAL_TREAD_MM = 1.6;
export const NEAR_LIMIT_MARGIN_MM = 1;

/** Aceita vírgula ou ponto decimal. Retorna null para vazio, NaN para inválido. */
export function parseTread(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (s === "") return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  const n = Number(s);
  return n > 40 ? NaN : n;
}

export function treadLevel(mm: number | null, min = LEGAL_TREAD_MM): "ok" | "atencao" | "critico" | null {
  if (mm == null || !Number.isFinite(mm)) return null;
  if (mm <= Math.max(min, LEGAL_TREAD_MM)) return "critico";
  if (mm <= Math.max(min, LEGAL_TREAD_MM) + NEAR_LIMIT_MARGIN_MM) return "atencao";
  return "ok";
}

export function isAboveLast(mm: number | null, last: number | null | undefined): boolean {
  return mm != null && Number.isFinite(mm) && last != null && mm > last;
}

/** Layout padrão (somente exibição) quando o veículo não tem layout salvo. */
export function defaultLayoutForVehicleType(type?: string | null): AxleLayout {
  const t = (type ?? "").toLowerCase();
  if (/moto/.test(t)) return "moto_2";
  if (/carreta|cavalo|semirreboque/.test(t)) return "carreta_18";
  if (/caminh|truck/.test(t)) return "truck_6";
  return "carro_4";
}

export function positionLabel(pos: string): string {
  const [unit, code] = pos.includes("-") ? pos.split("-") : ["", pos];
  const prefix = unit === "C" ? "Cavalo · " : unit === "R" ? "Reboque · " : "";
  const fixed: Record<string, string> = {
    DE: "Dianteira esquerda", DD: "Dianteira direita", DI: "Dianteira",
    TR: "Traseira", TE: "Traseira esquerda", TD: "Traseira direita", EST: "Estepe",
    TDE: "Traseira 1 esquerda", TDD: "Traseira 1 direita",
    TTE: "Traseira 2 esquerda", TTD: "Traseira 2 direita",
  };
  if (fixed[code]) return prefix + fixed[code];
  const m = code.match(/^(\d+)([DE])([DIE])$/);
  if (m) {
    const side = m[2] === "E" ? "esq." : "dir.";
    const inner = m[3] === "I" ? "interna" : "externa";
    return `${prefix}Eixo ${Number(m[1]) + 1} ${side} ${inner}`;
  }
  return prefix + code;
}

/** Lado: -1 esquerda, 1 direita, 0 centro. Ordem: esquerda externa → direita externa. */
function sideOrder(code: string): number {
  if (["DE", "TE", "TDE", "TTE"].includes(code)) return 0;
  if (["DD", "TD", "TDD", "TTD"].includes(code)) return 3;
  const m = code.match(/^\d+([DE])([DIE])$/);
  if (m) {
    if (m[1] === "E") return m[2] === "I" ? 1 : 0;
    return m[2] === "I" ? 2 : 3;
  }
  return 1.5;
}

export function groupPositionsByAxle(positions: string[]): { axle: string; positions: string[] }[] {
  const groups: { axle: string; positions: string[] }[] = [];
  for (const p of positions) {
    const [unit, code] = p.includes("-") ? p.split("-") : ["", p];
    const axle = code === "EST" ? "Estepe"
      : /^\d/.test(code) ? `Eixo ${Number(code.match(/^\d+/)![0]) + 1}`
      : ["DI", "DD", "DE"].includes(code) ? "Dianteiro"
      : ["TTD", "TTE"].includes(code) ? "Traseiro 2"
      : ["TDD", "TDE"].includes(code) ? "Traseiro 1" : "Traseiro";
    const key = (unit === "C" ? "Cavalo · " : unit === "R" ? "Reboque · " : "") + axle;
    let g = groups.find((x) => x.axle === key);
    if (!g) groups.push((g = { axle: key, positions: [] }));
    g.positions.push(p);
  }
  for (const g of groups) {
    g.positions.sort((a, b) => sideOrder(a.split("-").pop()!) - sideOrder(b.split("-").pop()!));
  }
  // estepe sempre por último
  return [...groups.filter((g) => !g.axle.endsWith("Estepe")), ...groups.filter((g) => g.axle.endsWith("Estepe"))];
}

export const normalizePlateInput = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);

export function buildAutomaticTire(input: {
  companyId: string;
  vehicleId: string;
  position: string;
  treadMm: number;
  measuredAt: string;
  createdBy?: string | null;
}) {
  return {
    company_id: input.companyId,
    brand: "Não informado",
    model: "Não informado",
    size: "Não informado",
    kind: "novo" as const,
    status: "instalado" as const,
    current_vehicle_id: input.vehicleId,
    current_position: input.position,
    initial_tread_mm: input.treadMm,
    current_tread_mm: input.treadMm,
    min_tread_mm: LEGAL_TREAD_MM,
    last_measured_at: input.measuredAt,
    measurement_interval_days: 30,
    notes: "Criado automaticamente pela medição de sulco.",
    created_by: input.createdBy ?? null,
  };
}
