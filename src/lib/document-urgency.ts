export type UrgencyBucket = "atrasado" | "a_vencer" | "pendente" | "em_dia";
export const URGENCY_ORDER: UrgencyBucket[] = ["atrasado", "a_vencer", "pendente", "em_dia"];
export const URGENCY_LABEL: Record<UrgencyBucket, string> = {
  atrasado: "Atrasados", a_vencer: "A vencer", pendente: "Pendentes", em_dia: "Em dia",
};
export const SOON_DAYS = 30;

export interface Urgency { bucket: UrgencyBucket; days: number | null }

/**
 * Urgência de uma entidade (veículo/motorista) a partir dos dias restantes de cada prazo
 * (negativo = vencido). `missing` indica documento não anexado ou sem data de vencimento.
 */
export function entityUrgency(deadlines: (number | null | undefined)[], missing: boolean): Urgency {
  const days = deadlines.filter((d): d is number => d != null && Number.isFinite(d));
  const worst = days.length ? Math.min(...days) : null;
  if (worst != null && worst < 0) return { bucket: "atrasado", days: worst };
  if (worst != null && worst <= SOON_DAYS) return { bucket: "a_vencer", days: worst };
  if (missing || worst == null) return { bucket: "pendente", days: worst };
  return { bucket: "em_dia", days: worst };
}

/** Atrasados (mais atrasado primeiro) → a vencer (mais próximo) → pendentes → em dia. Estável pelo desempate. */
export function compareUrgency(a: Urgency, b: Urgency): number {
  const o = URGENCY_ORDER.indexOf(a.bucket) - URGENCY_ORDER.indexOf(b.bucket);
  if (o) return o;
  return (a.days ?? Infinity) - (b.days ?? Infinity);
}

export function sortByUrgency<T>(items: T[], urgency: (t: T) => Urgency, tieBreak: (t: T) => string): T[] {
  return items
    .map((item) => ({ item, u: urgency(item), k: tieBreak(item) }))
    .sort((a, b) => compareUrgency(a.u, b.u) || a.k.localeCompare(b.k))
    .map((x) => x.item);
}

export function countByBucket(us: Urgency[]): Record<UrgencyBucket, number> {
  const c: Record<UrgencyBucket, number> = { atrasado: 0, a_vencer: 0, pendente: 0, em_dia: 0 };
  us.forEach((u) => { c[u.bucket]++; });
  return c;
}

export function overdueText(days: number | null | undefined): string | null {
  if (days == null || days >= 0) return null;
  const n = Math.abs(days);
  return `Vencido há ${n} ${n === 1 ? "dia" : "dias"}`;
}

export function daysBetween(dateIso: string | null | undefined, todayIso: string): number | null {
  if (!dateIso) return null;
  const a = Date.parse(dateIso.slice(0, 10) + "T00:00:00");
  const b = Date.parse(todayIso.slice(0, 10) + "T00:00:00");
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

/** Ordenação de alertas: vencidos (mais antigo primeiro), depois a vencer (mais próximo), depois sem data. */
export function compareAlerts(
  a: { severity: string; date: string | null; title: string },
  b: { severity: string; date: string | null; title: string },
): number {
  return Number(b.severity === "high") - Number(a.severity === "high")
    || (a.date ?? "9999").localeCompare(b.date ?? "9999")
    || a.title.localeCompare(b.title);
}

export function localTodayIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
