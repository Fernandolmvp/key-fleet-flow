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