/** Pure helpers for tire stock/allocation operations. */
export interface MovementLite {
  tire_id: string;
  movement_type: string;
  vehicle_id: string | null;
  vehicle_km: number | null;
  occurred_at: string;
}

const BASELINE = new Set(["instalacao", "rodizio"]);

/** KM rodado pelo pneu desde a última instalação/rodízio no veículo atual. Nunca negativo. */
export function kmSinceBaseline(movements: MovementLite[], tireId: string, vehicleId: string, currentKm: number | null | undefined): number {
  if (currentKm == null || !Number.isFinite(currentKm)) return 0;
  const base = movements
    .filter((m) => m.tire_id === tireId && m.vehicle_id === vehicleId && BASELINE.has(m.movement_type) && m.vehicle_km != null)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
  if (!base) return 0;
  return Math.max(0, Math.round(currentKm - Number(base.vehicle_km)));
}

export function freePositions(positions: string[], occupied: Record<string, unknown>): string[] {
  return positions.filter((p) => !occupied[p]);
}

export interface BatchCommon {
  brand: string; model?: string; size: string; kind: string;
  tread_mm?: number | null; price?: number | null; supplier?: string; dot?: string;
  invoice_number?: string; invoice_url?: string; purchase_date?: string;
}

/** Monta N pneus em estoque com dados comuns; seriais opcionais (um por linha/virgula). */
export function buildBatchTires(companyId: string, qty: number, common: BatchCommon, serialsText = "", userId?: string) {
  const n = Math.max(0, Math.min(200, Math.floor(qty)));
  const serials = serialsText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  return Array.from({ length: n }, (_, i) => ({
    company_id: companyId,
    created_by: userId ?? null,
    brand: common.brand.trim(),
    model: common.model?.trim() || null,
    size: common.size.trim(),
    kind: common.kind as any,
    status: "estoque" as const,
    serial: serials[i] ?? null,
    dot: common.dot?.trim() || null,
    initial_tread_mm: common.tread_mm ?? null,
    current_tread_mm: common.tread_mm ?? null,
    min_tread_mm: 1.6,
    purchase_price: common.price ?? null,
    supplier: common.supplier?.trim() || null,
    invoice_number: common.invoice_number?.trim() || null,
    invoice_url: common.invoice_url || null,
    purchase_date: common.purchase_date || null,
  }));
}

export const KIND_LABEL: Record<string, string> = { novo: "Novo", recapado: "Recapado", remold: "Remold", usado: "Usado" };
