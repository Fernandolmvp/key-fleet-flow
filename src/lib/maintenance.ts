export const MAINT_TYPES = [
  { value: "preventiva", label: "Preventiva" },
  { value: "corretiva", label: "Corretiva" },
  { value: "pneus", label: "Pneus" },
  { value: "sinistro", label: "Sinistro" },
] as const;

export const MAINT_STATUS = [
  { value: "agendada", label: "Agendada" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
] as const;

export const MAINT_CATEGORIES = [
  "Troca de óleo",
  "Filtros",
  "Freios",
  "Suspensão",
  "Motor",
  "Elétrica",
  "Câmbio",
  "Arrefecimento",
  "Pneus",
  "Alinhamento/Balanceamento",
  "Funilaria/Pintura",
  "Vidros",
  "Revisão geral",
  "Outros",
] as const;

export const SCHEDULE_STATUS_TONE: Record<string, string> = {
  pendente: "bg-muted/40 text-muted-foreground border-border",
  proxima: "bg-warning/20 text-warning border-warning/30",
  vencida: "bg-destructive/20 text-destructive border-destructive/30",
  concluida: "bg-success/20 text-success border-success/30",
};

export const STATUS_TONE: Record<string, string> = {
  agendada: "bg-primary/20 text-primary border-primary/30",
  em_andamento: "bg-warning/20 text-warning border-warning/30",
  concluida: "bg-success/20 text-success border-success/30",
  cancelada: "bg-muted text-muted-foreground",
};

export const TYPE_TONE: Record<string, string> = {
  preventiva: "bg-primary/20 text-primary border-primary/30",
  corretiva: "bg-warning/20 text-warning border-warning/30",
  pneus: "bg-accent/20 text-accent border-accent/30",
  sinistro: "bg-destructive/20 text-destructive border-destructive/30",
};

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
