export const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  pendente: { label: "Aguardando orçamento", color: "bg-muted/40 text-muted-foreground border-muted" },
  em_elaboracao: { label: "Em elaboração", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  enviado: { label: "Orçamento enviado", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  aprovado: { label: "Aprovado", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  rejeitado: { label: "Rejeitado", color: "bg-destructive/10 text-destructive border-destructive/30" },
  expirado: { label: "Expirado", color: "bg-muted/40 text-muted-foreground border-muted" },
};

export const EXEC_STATUS: Record<string, { label: string; color: string }> = {
  aguardando_aprovacao: { label: "Aguardando aprovação", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  aprovado_aguardando_inicio: { label: "Aprovada", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  em_execucao: { label: "Em execução", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  aguardando_pecas: { label: "Aguardando peças", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  concluido: { label: "Concluída", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  cancelado: { label: "Cancelada", color: "bg-muted/40 text-muted-foreground border-muted" },
  problema_relatado: { label: "Problema relatado", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

export const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  parcial: { label: "Parcial", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  pago: { label: "Pago", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  em_recurso: { label: "Em recurso", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

export const PRIORITY_LEVELS: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-muted/40 text-muted-foreground border-muted" },
  normal: { label: "Normal", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  alta: { label: "Alta", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  urgente: { label: "Urgente", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

export type QuoteItem = { description: string; qty: number; unit_price: number; total: number };