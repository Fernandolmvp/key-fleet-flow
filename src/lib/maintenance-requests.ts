export const PROBLEM_CATEGORIES = [
  { value: "motor", label: "Motor", icon: "🛠️" },
  { value: "freios", label: "Freios", icon: "🛑" },
  { value: "suspensao", label: "Suspensão", icon: "🌊" },
  { value: "eletrica", label: "Elétrica", icon: "⚡" },
  { value: "ar_condicionado", label: "Ar Condicionado", icon: "❄️" },
  { value: "pneu", label: "Pneu", icon: "🛞" },
  { value: "embreagem", label: "Embreagem", icon: "🔄" },
  { value: "cambio", label: "Câmbio", icon: "⚙️" },
  { value: "direcao", label: "Direção", icon: "🎮" },
  { value: "escape", label: "Escape", icon: "💨" },
  { value: "combustivel", label: "Combustível", icon: "⛽" },
  { value: "painel", label: "Painel", icon: "📊" },
  { value: "vidros_eletricos", label: "Vidros/Trava", icon: "🪟" },
  { value: "ar_alarme", label: "Alarme", icon: "🚨" },
  { value: "carroceria", label: "Carroceria", icon: "🛡️" },
  { value: "outros", label: "Outros", icon: "❓" },
] as const;

export const SEVERITY_LEVELS = [
  { value: "baixa", label: "Baixa", desc: "Anda normalmente, mas precisa rever", color: "bg-success/20 text-success border-success/30", dot: "bg-success" },
  { value: "media", label: "Média", desc: "Anda mas está atrapalhando o trabalho", color: "bg-warning/20 text-warning border-warning/30", dot: "bg-warning" },
  { value: "alta", label: "Alta", desc: "Não recomendo dirigir, é arriscado", color: "bg-orange-500/20 text-orange-500 border-orange-500/30", dot: "bg-orange-500" },
  { value: "critica", label: "Crítica", desc: "Veículo parado, não dá pra usar", color: "bg-destructive/20 text-destructive border-destructive/30", dot: "bg-destructive" },
] as const;

export const MR_STATUS: Record<string, { label: string; color: string }> = {
  pendente_aprovacao: { label: "Pendente análise", color: "bg-warning/20 text-warning border-warning/30" },
  em_analise: { label: "Em análise", color: "bg-warning/20 text-warning border-warning/30" },
  aprovada_agendamento: { label: "Aprovada", color: "bg-primary/20 text-primary border-primary/30" },
  agendada: { label: "Agendada", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  em_execucao: { label: "Em execução", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  concluida: { label: "Concluída", color: "bg-success/20 text-success border-success/30" },
  rejeitada: { label: "Rejeitada", color: "bg-destructive/20 text-destructive border-destructive/30" },
  cancelada: { label: "Cancelada", color: "bg-muted text-muted-foreground border-border" },
};

export function getProblemCategory(value: string) {
  return PROBLEM_CATEGORIES.find((p) => p.value === value);
}

export function getSeverity(value: string) {
  return SEVERITY_LEVELS.find((s) => s.value === value);
}