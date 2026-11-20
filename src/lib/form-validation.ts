import { z } from "zod";
import { isValidPlate, normalizePlate } from "./plate";

export const fuelDriverSchema = z.string({ required_error: "Selecione um motorista" })
  .trim().uuid("Selecione um motorista");

/** Advisory only: company suffixes must not prevent saving a person's name. */
export function looksLikeCompanyName(name: string): boolean {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return /(?:^|[^A-Z0-9])(?:LTDA|ME|EIRELI)(?=$|[^A-Z0-9])/.test(normalized);
}

/** Equivalent old/Mercosul plates, one changed character, or one adjacent transposition. */
export function areSimilarPlates(left: string, right: string): boolean {
  if (!isValidPlate(left) || !isValidPlate(right)) return false;
  const a = normalizePlate(left), b = normalizePlate(right);
  const differences = [...a].map((character, i) => character === b[i] ? -1 : i).filter((i) => i >= 0);
  if (differences.length <= 1) return true;
  const [first, second] = differences;
  return differences.length === 2 && second === first + 1 && a[first] === b[second] && a[second] === b[first];
}

export function similarRegisteredPlates<T extends { id: string; plate: string }>(plate: string, rows: T[], editingId?: string): T[] {
  return rows.filter((row) => row.id !== editingId && areSimilarPlates(plate, row.plate));
}