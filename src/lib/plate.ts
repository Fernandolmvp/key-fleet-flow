/**
 * Normaliza placa para formato Mercosul (AAA9A99) para comparação.
 * Placa antiga AAA9999: converte 5º dígito (0-9) → letra (A-J).
 * Mercosul AAA9A99: mantém. Outro tamanho: devolve só A-Z0-9 maiúsculo.
 */
export function normalizePlate(p?: string | null): string {
  if (!p) return "";
  const s = String(p).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length !== 7) return s;
  if (/[A-Z]/.test(s[4])) return s;
  if (/^[A-Z]{3}[0-9]{4}$/.test(s)) {
    return s.slice(0, 4) + String.fromCharCode(65 + Number(s[4])) + s.slice(5);
  }
  return s;
}

export const normChassis = (c?: string | null) =>
  String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export const normRenavam = (r?: string | null) =>
  String(r || "").replace(/[^0-9]/g, "");

/**
 * Valida placa brasileira no formato antigo (LLL9999) ou Mercosul (LLL9L99).
 * Normaliza para A-Z0-9 maiúsculas antes de validar.
 */
export function isValidPlate(p?: string | null): boolean {
  const s = String(p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length !== 7) return false;
  // Mercosul: 3 letras + 1 dígito + 1 letra + 2 dígitos
  if (/^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(s)) return true;
  // Antigo: 3 letras + 4 dígitos
  if (/^[A-Z]{3}[0-9]{4}$/.test(s)) return true;
  return false;
}

/** Match entre veículo e dados extraídos da apólice (placa/chassi/renavam). */
export function matchPlateOrVin(
  a: { plate?: string | null; chassis?: string | null; renavam?: string | null },
  b: { plate?: string | null; chassis?: string | null; renavam?: string | null },
): "plate" | "chassis" | "renavam" | null {
  const ap = normalizePlate(a.plate);
  const bp = normalizePlate(b.plate);
  if (ap && bp && ap === bp) return "plate";
  const ach = normChassis(a.chassis);
  const bch = normChassis(b.chassis);
  if (ach && bch && (ach === bch || ach.slice(-8) === bch.slice(-8))) return "chassis";
  const ar = normRenavam(a.renavam);
  const br = normRenavam(b.renavam);
  if (ar && br && ar === br) return "renavam";
  return null;
}