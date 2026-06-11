export const QUESTION_TYPES = [
  { value: "sim_nao", label: "Sim / Não" },
  { value: "multipla_escolha", label: "Múltipla escolha" },
  { value: "numero", label: "Número" },
  { value: "texto", label: "Texto" },
  { value: "foto", label: "Foto" },
  { value: "assinatura", label: "Assinatura" },
] as const;

export const FREQUENCIES = [
  { value: "unico", label: "Único" },
  { value: "diario", label: "Diário" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
] as const;

export const RUN_STATUS_TONE: Record<string, string> = {
  pendente: "bg-muted/40 text-muted-foreground border-border",
  em_andamento: "bg-warning/20 text-warning border-warning/30",
  concluido: "bg-success/20 text-success border-success/30",
  reprovado: "bg-destructive/20 text-destructive border-destructive/30",
  cancelado: "bg-muted text-muted-foreground",
};

export const RUN_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  reprovado: "Reprovado",
  cancelado: "Cancelado",
};

export const ANSWER_STATUS_TONE: Record<string, string> = {
  conforme: "bg-success/20 text-success border-success/30",
  nao_conforme: "bg-destructive/20 text-destructive border-destructive/30",
  nao_aplicavel: "bg-muted/40 text-muted-foreground border-border",
  pendente: "bg-warning/20 text-warning border-warning/30",
};

export const ANSWER_STATUS_LABEL: Record<string, string> = {
  conforme: "Conforme",
  nao_conforme: "Não conforme",
  nao_aplicavel: "N/A",
  pendente: "Pendente",
};

/** Modelo padrão de checklist mensal de manutenção preventiva */
export const DEFAULT_MONTHLY_TEMPLATE = {
  name: "Inspeção Mensal Preventiva",
  description: "Checklist mensal completo de inspeção do veículo. Itens reprovados geram OS automaticamente.",
  frequency: "mensal" as const,
  auto_open_os: true,
  questions: [
    { category: "Motor", label: "Nível do óleo do motor está adequado?", question_type: "sim_nao" },
    { category: "Motor", label: "Há vazamentos visíveis no motor?", question_type: "sim_nao" },
    { category: "Motor", label: "Estado do filtro de ar", question_type: "multipla_escolha", options: ["Bom", "Médio", "Trocar"] },
    { category: "Arrefecimento", label: "Nível do líquido de arrefecimento", question_type: "sim_nao" },
    { category: "Arrefecimento", label: "Mangueiras sem ressecamento ou vazamento?", question_type: "sim_nao" },
    { category: "Freios", label: "Espessura mínima das pastilhas (mm)", question_type: "numero", min_value: 0, max_value: 20 },
    { category: "Freios", label: "Nível do fluido de freio adequado?", question_type: "sim_nao" },
    { category: "Freios", label: "Freio de estacionamento funcional?", question_type: "sim_nao" },
    { category: "Suspensão", label: "Amortecedores sem vazamento e firmes?", question_type: "sim_nao" },
    { category: "Suspensão", label: "Buchas e pivôs sem folga?", question_type: "sim_nao" },
    { category: "Pneus", label: "Calibragem dentro do recomendado?", question_type: "sim_nao" },
    { category: "Pneus", label: "Profundidade mínima de sulco (mm)", question_type: "numero", min_value: 0, max_value: 20 },
    { category: "Pneus", label: "Foto dos 4 pneus", question_type: "foto" },
    { category: "Elétrica", label: "Bateria com terminais limpos e fixos?", question_type: "sim_nao" },
    { category: "Elétrica", label: "Faróis, lanternas e setas funcionando?", question_type: "sim_nao" },
    { category: "Elétrica", label: "Limpadores e esguicho operacionais?", question_type: "sim_nao" },
    { category: "Cabine", label: "Cintos de segurança em bom estado?", question_type: "sim_nao" },
    { category: "Cabine", label: "Buzina e retrovisores ok?", question_type: "sim_nao" },
    { category: "Documentação", label: "CRLV dentro da validade?", question_type: "sim_nao" },
    { category: "Geral", label: "Foto frontal do veículo", question_type: "foto" },
    { category: "Geral", label: "Observações gerais", question_type: "texto", required: false },
    { category: "Geral", label: "Assinatura do responsável", question_type: "assinatura" },
  ],
};

export function monthRefLabel(d: string | Date): string {
  // Importante: strings "YYYY-MM-DD" são interpretadas como UTC pelo
  // construtor de Date, o que joga a data para o dia anterior em fuso BRT
  // (UTC-3) e fazia o rótulo mostrar o mês errado (ex.: "maio" em junho).
  // Parseamos manualmente quando vier no formato esperado.
  if (typeof d === "string") {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    }
  }
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function currentMonthRef(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}