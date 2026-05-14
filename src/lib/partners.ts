/** Constantes compartilhadas para Oficinas, Fornecedores e Postos. */

export const WORKSHOP_TYPES: { value: string; label: string }[] = [
  { value: "mecanica_geral", label: "Mecânica geral" },
  { value: "eletrica", label: "Elétrica" },
  { value: "funilaria", label: "Funilaria" },
  { value: "pintura", label: "Pintura" },
  { value: "suspensao", label: "Suspensão" },
  { value: "freios", label: "Freios" },
  { value: "motor", label: "Motor" },
  { value: "cambio", label: "Câmbio" },
  { value: "ar_condicionado", label: "Ar-condicionado" },
  { value: "alinhamento_balanceamento", label: "Alinhamento/Balanceamento" },
  { value: "injecao_eletronica", label: "Injeção eletrônica" },
  { value: "diesel", label: "Diesel" },
  { value: "troca_oleo", label: "Troca de óleo" },
  { value: "revisao", label: "Revisão" },
  { value: "outros", label: "Outros" },
];

export const SUPPLIER_CATEGORIES: { value: string; label: string }[] = [
  { value: "pneus", label: "Pneus" },
  { value: "oleos_lubrificantes", label: "Óleos / Lubrificantes" },
  { value: "pecas_geral", label: "Peças em geral" },
  { value: "baterias", label: "Baterias" },
  { value: "filtros", label: "Filtros" },
  { value: "parafusos_fixadores", label: "Parafusos / Fixadores" },
  { value: "ferramentas", label: "Ferramentas" },
  { value: "epi", label: "EPI" },
  { value: "produtos_limpeza", label: "Produtos de limpeza" },
  { value: "combustivel_atacado", label: "Combustível atacado" },
  { value: "gas", label: "Gás" },
  { value: "documentacao_despachante", label: "Documentação / Despachante" },
  { value: "seguros_diversos", label: "Seguros diversos" },
  { value: "rastreamento", label: "Rastreamento" },
  { value: "gps", label: "GPS" },
  { value: "contabilidade", label: "Contabilidade" },
  { value: "juridico", label: "Jurídico" },
  { value: "marketing", label: "Marketing" },
  { value: "ti_software", label: "TI / Software" },
  { value: "manutencao_predial", label: "Manutenção predial" },
  { value: "servicos_gerais", label: "Serviços gerais" },
  { value: "outros", label: "Outros" },
];

export const STATION_FUEL_TYPES: { value: string; label: string }[] = [
  { value: "gasolina_comum", label: "Gasolina comum" },
  { value: "gasolina_aditivada", label: "Gasolina aditivada" },
  { value: "etanol", label: "Etanol" },
  { value: "diesel_s10", label: "Diesel S10" },
  { value: "diesel_s500", label: "Diesel S500" },
  { value: "gnv", label: "GNV" },
  { value: "eletrica_carregador", label: "Elétrica (carregador)" },
];

export const STATION_PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_debito", label: "Cartão débito" },
  { value: "cartao_credito", label: "Cartão crédito" },
  { value: "pix", label: "PIX" },
  { value: "ticket_log", label: "Ticket Log" },
  { value: "vale_pedagio", label: "Vale Pedágio" },
  { value: "faturado", label: "Faturado" },
];

export const FLEET_CARD_PROVIDERS: { value: string; label: string }[] = [
  { value: "ticket_log", label: "Ticket Log" },
  { value: "vale_combustivel", label: "Vale Combustível" },
  { value: "edenred", label: "Edenred" },
  { value: "goodcard", label: "GoodCard" },
];

export const PAYMENT_TERMS: { value: string; label: string }[] = [
  { value: "a_vista", label: "À vista" },
  { value: "7_dias", label: "7 dias" },
  { value: "15_dias", label: "15 dias" },
  { value: "30_dias", label: "30 dias" },
  { value: "15_30", label: "15/30 dias" },
  { value: "15_30_45", label: "15/30/45 dias" },
  { value: "30_60", label: "30/60 dias" },
  { value: "30_60_90", label: "30/60/90 dias" },
  { value: "faturado_mensal", label: "Faturado mensal" },
];

export const PIX_KEY_TYPES: { value: string; label: string }[] = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave aleatória" },
];

export const INVOICE_TYPES_SERVICE: { value: string; label: string }[] = [
  { value: "nfse", label: "NFS-e (serviço)" },
  { value: "nfe", label: "NF-e (produto)" },
  { value: "recibo", label: "Recibo" },
];

export const INVOICE_TYPES_FUEL: { value: string; label: string }[] = [
  { value: "nfe", label: "NF-e" },
  { value: "cupom", label: "Cupom Fiscal" },
  { value: "nfc-e", label: "NFC-e" },
];

export const PARTNER_STATUS: { value: string; label: string; tone: string }[] = [
  { value: "active", label: "Ativo", tone: "bg-success/15 text-success border-success/30" },
  { value: "inactive", label: "Inativo", tone: "bg-muted/40 text-muted-foreground border-border" },
  { value: "blocked", label: "Bloqueado", tone: "bg-destructive/15 text-destructive border-destructive/30" },
];

export function labelOf<T extends { value: string; label: string }>(list: T[], v: string | null | undefined): string {
  if (!v) return "—";
  return list.find((x) => x.value === v)?.label ?? v;
}