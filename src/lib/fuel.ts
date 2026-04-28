export const ANOMALY_LABEL: Record<string, string> = {
  km_regressivo: "KM regressivo",
  consumo_alto: "Consumo elevado",
  consumo_baixo: "Consumo muito baixo",
  tanque_excedido: "Litros > capacidade do tanque",
  duplicado: "Possível duplicado",
  valor_atipico: "Valor/litro atípico",
  horario_suspeito: "Horário suspeito (00h-05h)",
  cidade_incomum: "Cidade incomum",
};

export const SEVERITY_TONE: Record<string, string> = {
  alta: "bg-destructive/20 text-destructive border-destructive/40",
  media: "bg-warning/20 text-warning border-warning/40",
  baixa: "bg-info/20 text-info border-info/40",
};

export const FUELS = ["gasolina","etanol","diesel","diesel_s10","flex","gnv","eletrico","hibrido"];
export const PAYMENTS = ["cartao_frota","dinheiro","pix","credito","debito","faturado","outro"];

export const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n));

export const fmtNum = (n: number | null | undefined, opts: Intl.NumberFormatOptions = {}) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR", opts).format(Number(n));
