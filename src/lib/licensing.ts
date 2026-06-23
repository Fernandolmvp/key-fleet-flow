import { supabase } from "@/integrations/supabase/client";

export type LicensingStatus = "licenciado" | "vencendo" | "vencido" | "sem";

export interface LicensingResult {
  status: LicensingStatus;
  vencimento: Date | null;
  mesAno: string | null; // "MM/AAAA"
  diasRestantes: number | null;
  uf: string;
}

// estado -> final (0-9) -> mes (1-12)
export type DetranCalendar = Map<string, Map<number, number>>;

const DEFAULT_UF = "SP";

let cachedCalendar: DetranCalendar | null = null;
let inflight: Promise<DetranCalendar> | null = null;

export async function loadDetranCalendar(force = false): Promise<DetranCalendar> {
  if (cachedCalendar && !force) return cachedCalendar;
  if (inflight && !force) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase
      .from("detran_calendar")
      .select("estado, final_placa, mes_vencimento");
    const map: DetranCalendar = new Map();
    if (!error && data) {
      for (const row of data as any[]) {
        const uf = String(row.estado).toUpperCase();
        if (!map.has(uf)) map.set(uf, new Map());
        map.get(uf)!.set(Number(row.final_placa), Number(row.mes_vencimento));
      }
    }
    cachedCalendar = map;
    inflight = null;
    return map;
  })();
  return inflight;
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
  const ufMap = opts.calendar.get(uf) ?? opts.calendar.get(DEFAULT_UF);
  if (!ufMap) {
    return { status: "sem", vencimento: null, mesAno: null, diasRestantes: null, uf };
  }
  const mes = ufMap.get(final);
  if (!mes) {
    return { status: "sem", vencimento: null, mesAno: null, diasRestantes: null, uf };
  }

  const yearNext = Number(opts.licensing_year) + 1;
  const vencimento = lastDayOfMonth(yearNext, mes);
  const mesAno = `${pad2(mes)}/${yearNext}`;
  const diff = Math.round((vencimento.getTime() - today.getTime()) / 86_400_000);

  let status: LicensingStatus;
  if (today.getTime() > vencimento.getTime()) {
    status = "vencido";
  } else {
    const sameMonth =
      today.getFullYear() === yearNext && today.getMonth() + 1 === mes;
    if (sameMonth || diff <= 30) status = "vencendo";
    else status = "licenciado";
  }

  return { status, vencimento, mesAno, diasRestantes: diff, uf };
}

export function licensingBadgeText(r: LicensingResult): string {
  if (r.status === "sem") return "Sem exercício";
  if (r.status === "licenciado") return "Licenciado";
  if (r.status === "vencendo") return `Vence ${r.mesAno}`;
  return `Vencido ${r.mesAno}`;
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