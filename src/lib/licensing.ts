import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type LicensingStatus = "licenciado" | "vencendo" | "vencido" | "sem";

export interface LicensingResult {
  status: LicensingStatus;
  vencimento: Date | null;
  mesAno: string | null; // "MM/AAAA"
  diasRestantes: number | null;
  uf: string;
}

// estado -> categoria -> final (0-9) -> mes (1-12)
export type VehicleCategory = "leve" | "pesado";
export type DetranCalendar = Map<string, Map<VehicleCategory, Map<number, number>>>;

const DEFAULT_UF = "SP";

// Fallback embutido do calendário SP (final da placa -> mês de vencimento).
// Usado como rede de segurança quando o detran_calendar do banco vem vazio
// no client (ex.: timing de auth/sessão).
// Leves = carros, motos, ônibus e reboques. Pesados = caminhões e tratores.
const SP_FALLBACK: Record<VehicleCategory, Record<number, number>> = {
  leve: { 1: 7, 2: 7, 3: 8, 4: 8, 5: 9, 6: 9, 7: 10, 8: 10, 9: 11, 0: 12 },
  pesado: { 1: 9, 2: 9, 3: 10, 4: 10, 5: 10, 6: 11, 7: 11, 8: 11, 9: 12, 0: 12 },
};

/**
 * Detecta se o veículo é "pesado" (caminhão/trator) pelo campo livre
 * `vehicle_type` salvo no cadastro. Tudo o que não casar com caminhão/trator
 * cai em "leve" (carros, motos, ônibus, reboques, utilitários, etc.).
 */
export function vehicleCategoryFromType(
  vehicle_type?: string | null,
): VehicleCategory {
  const s = (vehicle_type || "").toLowerCase();
  if (!s) return "leve";
  if (/(caminh|truck|trator|tractor|cavalo\s*mec)/.test(s)) return "pesado";
  return "leve";
}

let cachedCalendar: DetranCalendar | null = null;
let inflight: Promise<DetranCalendar> | null = null;
const listeners = new Set<(c: DetranCalendar) => void>();

export async function loadDetranCalendar(force = false): Promise<DetranCalendar> {
  if (cachedCalendar && cachedCalendar.size > 0 && !force) return cachedCalendar;
  if (inflight && !force) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase
      .from("detran_calendar")
      .select("estado, final_placa, mes_vencimento");
    const map: DetranCalendar = new Map();
    if (!error && data) {
      for (const row of data as any[]) {
        const uf = String(row.estado).toUpperCase();
        const cat = ((row.categoria as string) || "leve").toLowerCase() as VehicleCategory;
        if (!map.has(uf)) map.set(uf, new Map());
        const ufMap = map.get(uf)!;
        if (!ufMap.has(cat)) ufMap.set(cat, new Map());
        ufMap.get(cat)!.set(Number(row.final_placa), Number(row.mes_vencimento));
      }
    }
    if (error || map.size === 0) {
      console.warn(
        "[detran_calendar] retornou vazio, usando fallback SP",
        error,
      );
    }
    // Only cache non-empty result so we retry next call if it failed/was blocked.
    if (map.size > 0) cachedCalendar = map;
    inflight = null;
    listeners.forEach((fn) => fn(map));
    return map;
  })();
  return inflight;
}

/**
 * Hook React para o calendário do DETRAN.
 * - Recarrega quando o usuário autentica (userId muda) garantindo que a query
 *   não seja disparada antes do auth e bloqueada por RLS.
 * - Compartilha cache entre telas e notifica todas as instâncias quando o
 *   calendário chega.
 */
export function useDetranCalendar(): DetranCalendar {
  const { user } = useAuth();
  const [calendar, setCalendar] = useState<DetranCalendar>(
    () => cachedCalendar ?? new Map()
  );
  useEffect(() => {
    let active = true;
    const onUpdate = (c: DetranCalendar) => { if (active) setCalendar(c); };
    listeners.add(onUpdate);
    loadDetranCalendar().then((c) => { if (active) setCalendar(c); });
    return () => { active = false; listeners.delete(onUpdate); };
  }, [user?.id]);
  return calendar;
}

export function plateLastDigit(plate?: string | null): number | null {
  if (!plate) return null;
  const digits = String(plate).replace(/\D/g, "");
  if (!digits.length) return null;
  return Number(digits[digits.length - 1]);
}

function lastDayOfMonth(year: number, month1to12: number): Date {
  // month is 1-12; new Date(y, m, 0) yields last day of month m
  return new Date(year, month1to12, 0);
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Calcula vencimento e status do licenciamento.
 * - licensing_year é o exercício pago (X). Mantém legal até último dia do mês da placa em X+1.
 * - status: 'vencido' se hoje > vencimento; 'vencendo' se faltam <= 30 dias OU
 *   estamos dentro do mês de vencimento; senão 'licenciado'.
 * - 'sem' quando não há exercício ou final/placa/calendário indisponível.
 */
export function computeLicensingStatus(opts: {
  licensing_year: number | null | undefined;
  plate: string | null | undefined;
  uf?: string | null;
  calendar: DetranCalendar;
  today?: Date;
  vehicle_type?: string | null;
  category?: VehicleCategory;
}): LicensingResult {
  const uf = (opts.uf || DEFAULT_UF).toUpperCase();
  const today = opts.today ?? new Date();
  today.setHours(0, 0, 0, 0);

  if (!opts.licensing_year) {
    return { status: "sem", vencimento: null, mesAno: null, diasRestantes: null, uf };
  }
  const final = plateLastDigit(opts.plate);
  if (final === null) {
    return { status: "sem", vencimento: null, mesAno: null, diasRestantes: null, uf };
  }
  const cat: VehicleCategory =
    opts.category ?? vehicleCategoryFromType(opts.vehicle_type);
  const ufMap = opts.calendar.get(uf) ?? opts.calendar.get(DEFAULT_UF);
  // Tenta categoria pedida; se não houver, cai para "leve" do banco.
  let mes: number | undefined =
    ufMap?.get(cat)?.get(final) ?? ufMap?.get("leve")?.get(final);
  // Fallback embutido para SP quando o banco não tem a UF ou veio vazio.
  if (!mes && uf === "SP") {
    mes = SP_FALLBACK[cat][final] ?? SP_FALLBACK.leve[final];
  }
  if (!mes) {
    return { status: "sem", vencimento: null, mesAno: null, diasRestantes: null, uf };
  }

  // O exercício pago (licensing_year) define o ANO de vencimento:
  // CRLV exercício 2026 com placa final 2 vence em 31/julho/2026.
  const yearDue = Number(opts.licensing_year);
  const vencimento = lastDayOfMonth(yearDue, mes);
  const mesAno = `${pad2(mes)}/${yearDue}`;
  const diff = Math.round((vencimento.getTime() - today.getTime()) / 86_400_000);

  let status: LicensingStatus;
  if (today.getTime() > vencimento.getTime()) {
    status = "vencido";
  } else {
    const sameMonth =
      today.getFullYear() === yearDue && today.getMonth() + 1 === mes;
    if (sameMonth || diff <= 30) status = "vencendo";
    else status = "licenciado";
  }

  return { status, vencimento, mesAno, diasRestantes: diff, uf };
}

export function licensingBadgeText(
  r: LicensingResult,
  licensingYear?: number | null,
  compact = false,
): string {
  if (r.status === "sem") return "Sem exercício";
  const yr = licensingYear ?? null;
  const exerc = yr ? (compact ? ` · ${yr}` : ` · Exerc. ${yr}`) : "";
  const shortMesAno = (() => {
    if (!r.mesAno) return "";
    const [mm, yyyy] = r.mesAno.split("/");
    return `${mm}/${yyyy.slice(-2)}`;
  })();
  if (r.status === "licenciado") return `${compact ? "Lic." : "Licenciado"}${exerc}`;
  if (r.status === "vencendo") return `Vence ${compact ? shortMesAno : r.mesAno}${exerc}`;
  return `Vencido ${compact ? shortMesAno : r.mesAno}${exerc}`;
}

export function licensingTooltip(r: LicensingResult): string {
  if (r.status === "sem") return "Sem exercício de licenciamento informado";
  if (!r.vencimento) return "";
  const d = r.vencimento.toLocaleDateString("pt-BR");
  if (r.status === "licenciado") return `Licenciado até ${d} (${r.mesAno})`;
  if (r.status === "vencendo") return `Vence em ${d} (${r.mesAno})`;
  return `Vencido em ${d} (${r.mesAno})`;
}

export function licensingBadgeClass(r: LicensingResult): string {
  if (r.status === "licenciado") return "border-success/40 text-success bg-success/10";
  if (r.status === "vencendo") return "border-warning/40 text-warning bg-warning/10";
  if (r.status === "vencido") return "border-destructive/40 text-destructive bg-destructive/10";
  return "border-border text-muted-foreground bg-muted/30";
}