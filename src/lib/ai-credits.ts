export const FEATURE_LABELS: Record<string, string> = {
  apolice_pdf: "Importação de Apólice",
  cupom_fiscal: "Leitura de Cupom Fiscal",
  cnh: "Validação de CNH",
  crlv: "Leitura de CRLV",
  analise_consumo: "Análise de Consumo",
  extract_document: "Extração de Documento",
  extract_insurance_policy: "Extração de Apólice",
  review_insurance_policy: "Revisão de Apólice",
};

export function formatFeature(key?: string | null): string {
  if (!key) return "Outras";
  return FEATURE_LABELS[key] ?? key;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.round(n)));
}

export function formatSource(s?: string | null): string {
  switch (s) {
    case "plan": return "Plano";
    case "extra": return "Extra";
    case "mixed": return "Plano + Extra";
    case "free": return "Gratuito";
    case "blocked": return "Bloqueado";
    default: return s ?? "—";
  }
}