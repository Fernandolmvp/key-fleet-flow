export const FEATURE_LABELS: Record<string, string> = {
  // Apólices
  extract_insurance_policy: "Importação de Apólice",
  review_insurance_policy: "Revisão de Apólice",
  apolice_pdf: "Importação de Apólice",
  // Documentos de motorista / veículo
  crlv: "Leitura de CRLV",
  cnh: "Validação de CNH",
  // Abastecimento
  leitura_placa: "Leitura de Placa",
  leitura_hodometro: "Leitura de Hodômetro",
  cupom_fiscal: "Cupom Fiscal",
  // Manutenção / pneus
  nota_manutencao: "Nota de Manutenção",
  nota_pneu: "Nota de Pneu",
  // Genéricos
  documento_generico: "Documento",
  extract_document: "Documento",
  analise_consumo: "Análise de Consumo",
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