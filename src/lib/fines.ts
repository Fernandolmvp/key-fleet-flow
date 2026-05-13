export type FineStatus =
  | "aviso_recebido"
  | "aguardando_notificacao"
  | "multa_autuada"
  | "aguardando_indicacao"
  | "motorista_indicado"
  | "em_recurso"
  | "recurso_deferido"
  | "recurso_indeferido"
  | "paga_com_desconto"
  | "paga_integral"
  | "vencida"
  | "arquivada"
  | "cancelada";

export type FineRecordType = "aviso" | "multa";
export type FineSeverity = "leve" | "media" | "grave" | "gravissima";

export const FINE_STATUS_LABEL: Record<FineStatus, string> = {
  aviso_recebido: "Aviso recebido",
  aguardando_notificacao: "Aguardando notificação",
  multa_autuada: "Multa autuada",
  aguardando_indicacao: "Aguardando indicação",
  motorista_indicado: "Motorista indicado",
  em_recurso: "Em recurso",
  recurso_deferido: "Recurso deferido",
  recurso_indeferido: "Recurso indeferido",
  paga_com_desconto: "Paga com desconto",
  paga_integral: "Paga integral",
  vencida: "Vencida",
  arquivada: "Arquivada",
  cancelada: "Cancelada",
};

export const FINE_STATUS_TONE: Record<FineStatus, string> = {
  aviso_recebido: "bg-info/15 text-info border-info/30",
  aguardando_notificacao: "bg-info/15 text-info border-info/30",
  multa_autuada: "bg-warning/15 text-warning border-warning/30",
  aguardando_indicacao: "bg-warning/15 text-warning border-warning/30",
  motorista_indicado: "bg-primary/15 text-primary border-primary/30",
  em_recurso: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  recurso_deferido: "bg-success/15 text-success border-success/30",
  recurso_indeferido: "bg-destructive/15 text-destructive border-destructive/30",
  paga_com_desconto: "bg-success/15 text-success border-success/30",
  paga_integral: "bg-success/15 text-success border-success/30",
  vencida: "bg-destructive/15 text-destructive border-destructive/30",
  arquivada: "bg-muted text-muted-foreground border-border",
  cancelada: "bg-muted text-muted-foreground border-border",
};

export const FINE_SEVERITY_LABEL: Record<FineSeverity, string> = {
  leve: "Leve (3 pts)",
  media: "Média (4 pts)",
  grave: "Grave (5 pts)",
  gravissima: "Gravíssima (7 pts)",
};

export const FINE_SEVERITY_DEFAULT_POINTS: Record<FineSeverity, number> = {
  leve: 3, media: 4, grave: 5, gravissima: 7,
};

export const FINE_TYPES: { value: string; label: string }[] = [
  { value: "velocidade", label: "Excesso de velocidade" },
  { value: "estacionamento_irregular", label: "Estacionamento irregular" },
  { value: "sem_cinto", label: "Sem cinto de segurança" },
  { value: "celular_volante", label: "Celular ao volante" },
  { value: "alcool", label: "Sob influência de álcool" },
  { value: "avancar_sinal", label: "Avançar sinal vermelho" },
  { value: "conversao_proibida", label: "Conversão proibida" },
  { value: "faixa_exclusiva", label: "Trafegar em faixa exclusiva" },
  { value: "parada_proibida", label: "Parada em local proibido" },
  { value: "embarque_desembarque", label: "Embarque/desembarque irregular" },
  { value: "outro", label: "Outro" },
];

export const FINE_PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "debito_automatico", label: "Débito automático" },
  { value: "outro", label: "Outro" },
];

export const fmtBRL = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n));

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—";

export const daysUntil = (d: string | null | undefined): number | null => {
  if (!d) return null;
  const target = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000*60*60*24));
};

export type TrafficFine = {
  id: string;
  company_id: string;
  vehicle_id: string;
  driver_id: string | null;
  record_type: FineRecordType;
  status: FineStatus;
  infraction_date: string;
  infraction_time: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  fine_type: string | null;
  fine_code: string | null;
  description: string | null;
  severity: FineSeverity | null;
  equipment: string | null;
  notification_number: string | null;
  notification_received_date: string | null;
  amount: number | null;
  discount_amount: number | null;
  license_points: number;
  due_date: string | null;
  recourse_deadline: string | null;
  driver_indication_deadline: string | null;
  driver_indicated_at: string | null;
  driver_indication_method: string | null;
  recourse_filed_at: string | null;
  recourse_result: string | null;
  recourse_result_date: string | null;
  recourse_notes: string | null;
  recourse_document_url: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  payment_receipt_url: string | null;
  aviso_photo_url: string | null;
  notification_photo_url: string | null;
  additional_photos_urls: string[] | null;
  ai_extracted: any;
  ai_confidence: number | null;
  external_source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};