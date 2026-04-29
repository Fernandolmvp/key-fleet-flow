export const DOC_TYPE_LABELS: Record<string, string> = {
  // veículo
  crlv: "CRLV",
  ipva: "IPVA",
  licenciamento: "Licenciamento",
  seguro: "Apólice de Seguro",
  rastreador: "Rastreador",
  laudo_veiculo: "Laudo veicular",
  outro_veiculo: "Outro (veículo)",
  // motorista
  cnh: "CNH",
  exame_medico: "Exame Médico",
  exame_toxicologico: "Exame Toxicológico",
  curso_mopp: "Curso MOPP",
  curso_transporte_passageiros: "Transporte de Passageiros",
  outro_motorista: "Outro (motorista)",
};

export const VEHICLE_DOC_TYPES = [
  "crlv","ipva","licenciamento","seguro","rastreador","laudo_veiculo","outro_veiculo",
] as const;

export const DRIVER_DOC_TYPES = [
  "cnh","exame_medico","exame_toxicologico","curso_mopp","curso_transporte_passageiros","outro_motorista",
] as const;

export type DocStatus = "valido" | "vencendo" | "vencido" | "sem_validade";

export const STATUS_LABEL: Record<DocStatus, string> = {
  valido: "Válido",
  vencendo: "Vence em breve",
  vencido: "Vencido",
  sem_validade: "Sem validade",
};

export const STATUS_COLOR: Record<DocStatus, string> = {
  valido: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  vencendo: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  vencido: "bg-destructive/15 text-destructive border-destructive/30",
  sem_validade: "bg-muted/30 text-muted-foreground border-border",
};

export function daysUntil(dateISO: string | null | undefined): number | null {
  if (!dateISO) return null;
  const d = new Date(dateISO + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calendário brasileiro de Licenciamento Anual (Denatran — base nacional).
 * Cada final de placa tem um mês-limite para o licenciamento do ano corrente.
 * Observação: alguns estados usam calendários próprios; este é o calendário-padrão
 * de referência. O dia-limite considerado é o último dia útil do mês (usamos dia 30/31).
 */
export const LICENSING_MONTH_BY_PLATE_END: Record<string, number> = {
  "1": 4,   // Abril
  "2": 5,   // Maio
  "3": 6,   // Junho
  "4": 7,   // Julho
  "5": 8,   // Agosto
  "6": 9,   // Setembro
  "7": 10,  // Outubro
  "8": 11,  // Novembro
  "9": 11,  // Novembro
  "0": 12,  // Dezembro
};

export const MONTH_LABEL_PT = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Extrai o último dígito numérico da placa (suporta Mercosul). */
export function plateLastDigit(plate?: string | null): string | null {
  if (!plate) return null;
  const digits = plate.replace(/\D/g, "");
  return digits.length ? digits[digits.length - 1] : null;
}

/**
 * Avalia o status de licenciamento do veículo no ano corrente
 * com base no final da placa e no calendário brasileiro.
 * Se houver `crlvExpiresAt` (vencimento real informado no documento),
 * ele tem prioridade.
 */
export type LicensingInfo = {
  status: "licenciado" | "vence_em_breve" | "atrasado" | "indefinido";
  dueDate: Date | null;
  monthLabel: string | null;
  daysLeft: number | null;
  message: string;
};

export function evaluateLicensing(opts: {
  plate?: string | null;
  crlvExpiresAt?: string | null;
}): LicensingInfo {
  const { plate, crlvExpiresAt } = opts;

  // Se há data real do CRLV, usa-a
  if (crlvExpiresAt) {
    const due = new Date(crlvExpiresAt + "T00:00:00");
    const dl = daysUntil(crlvExpiresAt)!;
    if (dl < 0) return {
      status: "atrasado", dueDate: due, monthLabel: MONTH_LABEL_PT[due.getMonth() + 1],
      daysLeft: dl, message: `Licenciamento vencido há ${Math.abs(dl)} dias.`,
    };
    if (dl <= 30) return {
      status: "vence_em_breve", dueDate: due, monthLabel: MONTH_LABEL_PT[due.getMonth() + 1],
      daysLeft: dl, message: `Licenciamento vence em ${dl} dias.`,
    };
    return {
      status: "licenciado", dueDate: due, monthLabel: MONTH_LABEL_PT[due.getMonth() + 1],
      daysLeft: dl, message: `Licenciado até ${due.toLocaleDateString("pt-BR")}.`,
    };
  }

  const last = plateLastDigit(plate);
  if (!last) return { status: "indefinido", dueDate: null, monthLabel: null, daysLeft: null, message: "Placa inválida — calendário não pôde ser aplicado." };

  const month = LICENSING_MONTH_BY_PLATE_END[last];
  const year = new Date().getFullYear();
  // último dia do mês
  const due = new Date(year, month, 0);
  const dueISO = due.toISOString().slice(0, 10);
  const dl = daysUntil(dueISO)!;
  const monthLabel = MONTH_LABEL_PT[month];

  if (dl < 0) {
    return {
      status: "atrasado", dueDate: due, monthLabel, daysLeft: dl,
      message: `Pelo final ${last}, o licenciamento ${year} venceu em ${monthLabel} (sem CRLV anexado).`,
    };
  }
  if (dl <= 30) {
    return {
      status: "vence_em_breve", dueDate: due, monthLabel, daysLeft: dl,
      message: `Pelo final ${last}, o prazo é ${monthLabel}/${year} (em ${dl} dias).`,
    };
  }
  return {
    status: "licenciado", dueDate: due, monthLabel, daysLeft: dl,
    message: `Pelo calendário, prazo ${monthLabel}/${year} (em ${dl} dias).`,
  };
}

export const LICENSING_LABEL: Record<LicensingInfo["status"], string> = {
  licenciado: "Licenciado",
  vence_em_breve: "Vence em breve",
  atrasado: "Atrasado",
  indefinido: "Indefinido",
};

export const LICENSING_COLOR: Record<LicensingInfo["status"], string> = {
  licenciado: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  vence_em_breve: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  atrasado: "bg-destructive/15 text-destructive border-destructive/30",
  indefinido: "bg-muted/30 text-muted-foreground border-border",
};

/**
 * Validação cruzada: confere se os dados extraídos batem com a entidade vinculada.
 */
export function crossValidate(opts: {
  entityType: "vehicle" | "driver";
  extracted: Record<string, any>;
  vehiclePlate?: string | null;
  driverCpf?: string | null;
  driverName?: string | null;
}): { ok: boolean; warning: string | null; details: Record<string, any> } {
  const { entityType, extracted, vehiclePlate, driverCpf, driverName } = opts;
  const norm = (s?: string | null) => (s || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  if (entityType === "vehicle" && extracted.plate && vehiclePlate) {
    const a = norm(extracted.plate);
    const b = norm(vehiclePlate);
    if (a !== b) {
      return {
        ok: false,
        warning: `Placa do documento (${extracted.plate}) não corresponde ao veículo cadastrado (${vehiclePlate}).`,
        details: { docPlate: a, vehiclePlate: b },
      };
    }
  }
  if (entityType === "driver") {
    if (extracted.cpf && driverCpf) {
      const a = (extracted.cpf || "").replace(/\D/g, "");
      const b = (driverCpf || "").replace(/\D/g, "");
      if (a && b && a !== b) {
        return {
          ok: false,
          warning: `CPF do documento (${extracted.cpf}) não corresponde ao motorista cadastrado.`,
          details: { docCpf: a, driverCpf: b },
        };
      }
    } else if (extracted.full_name && driverName) {
      const a = norm(extracted.full_name);
      const b = norm(driverName);
      if (a && b && !a.includes(b.slice(0, 6)) && !b.includes(a.slice(0, 6))) {
        return {
          ok: false,
          warning: `Nome no documento (${extracted.full_name}) parece diferente do motorista (${driverName}).`,
          details: { docName: a, driverName: b },
        };
      }
    }
  }
  return { ok: true, warning: null, details: {} };
}