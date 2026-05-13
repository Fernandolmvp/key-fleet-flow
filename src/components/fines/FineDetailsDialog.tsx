import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, AlertOctagon, FileText, UserCheck, Gavel, Receipt, Pencil, ExternalLink, ArrowRight } from "lucide-react";
import {
  FINE_STATUS_LABEL, FINE_STATUS_TONE, FINE_TYPES,
  fmtBRL, fmtDate, type TrafficFine,
} from "@/lib/fines";
import FineFormDialog from "./FineFormDialog";
import { ConvertAvisoDialog, IndicateDriverDialog, RecourseDialog, PaymentDialog } from "./FineActionDialogs";

type Props = {
  open: boolean; onClose: () => void;
  fine: TrafficFine; companyId: string;
  vehicle?: any; driver?: any;
  onChanged: () => void;
};

function TimelineStep({ icon: Icon, title, date, done, current, color }: any) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`h-8 w-8 rounded-full grid place-items-center border-2 ${done ? `bg-${color}/20 border-${color} text-${color}` : current ? "bg-primary/20 border-primary text-primary" : "bg-muted border-border text-muted-foreground"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="pb-4 flex-1">
        <div className={`text-sm font-medium ${done || current ? "" : "text-muted-foreground"}`}>{title}</div>
        {date && <div className="text-xs text-muted-foreground">{fmtDate(date)}</div>}
      </div>
    </div>
  );
}

export default function FineDetailsDialog({ open, onClose, fine, companyId, vehicle, driver, onChanged }: Props) {
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [indicating, setIndicating] = useState(false);
  const [recourseOpen, setRecourseOpen] = useState<null | "open" | "result">(null);
  const [paying, setPaying] = useState(false);

  const isAviso = fine.record_type === "aviso";
  const fineTypeLabel = FINE_TYPES.find(t => t.value === fine.fine_type)?.label ?? fine.fine_type;
  const isPaid = fine.status === "paga_com_desconto" || fine.status === "paga_integral";
  const isClosed = isPaid || fine.status === "recurso_deferido" || fine.status === "arquivada" || fine.status === "cancelada";

  const refresh = () => { onChanged(); };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {isAviso ? <Mail className="h-5 w-5 text-info" /> : <AlertOctagon className="h-5 w-5 text-warning" />}
              {isAviso ? "Aviso de Infração" : "Multa de Trânsito"}
              <Badge variant="outline" className={FINE_STATUS_TONE[fine.status]}>
                {FINE_STATUS_LABEL[fine.status]}
              </Badge>
              {fine.notification_number && <span className="text-sm font-mono text-muted-foreground">AIT {fine.notification_number}</span>}
            </DialogTitle>
          </DialogHeader>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Coluna esquerda: dados */}
            <div className="md:col-span-2 space-y-4">
              <div className="surface-card rounded-lg p-4 space-y-2">
                <h3 className="font-semibold">{vehicle?.plate ?? "—"} · {[vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") || "—"}</h3>
                {driver && <p className="text-sm text-muted-foreground">Motorista indicado: <strong className="text-foreground">{driver.full_name}</strong></p>}
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Infração:</span> {fineTypeLabel ?? "—"}</div>
                  <div><span className="text-muted-foreground">Código CTB:</span> {fine.fine_code ?? "—"}</div>
                  <div><span className="text-muted-foreground">Data:</span> {fmtDate(fine.infraction_date)} {fine.infraction_time?.slice(0,5) ?? ""}</div>
                  <div><span className="text-muted-foreground">Gravidade:</span> {fine.severity ?? "—"}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Local:</span> {[fine.location, fine.city, fine.state].filter(Boolean).join(", ") || "—"}</div>
                  <div><span className="text-muted-foreground">Equipamento:</span> {fine.equipment ?? "—"}</div>
                  <div><span className="text-muted-foreground">Pontos CNH:</span> {fine.license_points}</div>
                </div>
                {fine.description && <p className="text-sm pt-2 border-t border-border">{fine.description}</p>}
              </div>

              {!isAviso && (
                <div className="surface-card rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-sm">Notificação e prazos</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Valor:</span> {fmtBRL(fine.amount)}</div>
                    <div><span className="text-muted-foreground">Com desconto:</span> {fmtBRL(fine.discount_amount)}</div>
                    <div><span className="text-muted-foreground">Recebido em:</span> {fmtDate(fine.notification_received_date)}</div>
                    <div><span className="text-muted-foreground">Vencimento:</span> {fmtDate(fine.due_date)}</div>
                    <div><span className="text-muted-foreground">Prazo recurso:</span> {fmtDate(fine.recourse_deadline)}</div>
                    <div><span className="text-muted-foreground">Prazo indicação:</span> {fmtDate(fine.driver_indication_deadline)}</div>
                  </div>
                </div>
              )}

              {(fine.recourse_filed_at || fine.recourse_result) && (
                <div className="surface-card rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-sm">Recurso</h4>
                  <div className="text-sm">Protocolado em: {fmtDate(fine.recourse_filed_at)}</div>
                  {fine.recourse_result && <div className="text-sm">Resultado: <strong>{fine.recourse_result}</strong> em {fmtDate(fine.recourse_result_date)}</div>}
                  {fine.recourse_notes && <p className="text-xs text-muted-foreground whitespace-pre-line">{fine.recourse_notes}</p>}
                </div>
              )}

              {isPaid && (
                <div className="surface-card rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-sm">Pagamento</h4>
                  <div className="text-sm">Pago em {fmtDate(fine.paid_at)} — {fmtBRL(fine.paid_amount)} ({fine.payment_method})</div>
                </div>
              )}

              {/* Anexos */}
              <div className="flex flex-wrap gap-2">
                {fine.aviso_photo_url && <Button variant="outline" size="sm" asChild><a href={fine.aviso_photo_url} target="_blank" rel="noreferrer"><FileText className="h-3 w-3 mr-1" /> Aviso <ExternalLink className="h-3 w-3 ml-1" /></a></Button>}
                {fine.notification_photo_url && <Button variant="outline" size="sm" asChild><a href={fine.notification_photo_url} target="_blank" rel="noreferrer"><FileText className="h-3 w-3 mr-1" /> Notificação <ExternalLink className="h-3 w-3 ml-1" /></a></Button>}
                {fine.recourse_document_url && <Button variant="outline" size="sm" asChild><a href={fine.recourse_document_url} target="_blank" rel="noreferrer"><FileText className="h-3 w-3 mr-1" /> Recurso <ExternalLink className="h-3 w-3 ml-1" /></a></Button>}
                {fine.payment_receipt_url && <Button variant="outline" size="sm" asChild><a href={fine.payment_receipt_url} target="_blank" rel="noreferrer"><Receipt className="h-3 w-3 mr-1" /> Comprovante <ExternalLink className="h-3 w-3 ml-1" /></a></Button>}
              </div>

              {fine.notes && (
                <div className="surface-card rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-1">Observações</h4>
                  <p className="text-sm whitespace-pre-line">{fine.notes}</p>
                </div>
              )}
            </div>

            {/* Coluna direita: timeline + ações */}
            <div className="space-y-4">
              <div className="surface-card rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-3">Linha do tempo</h4>
                <TimelineStep icon={Mail} title="Aviso recebido" date={isAviso ? fine.created_at : null} done={isAviso || !!fine.aviso_photo_url} color="info" />
                <TimelineStep icon={AlertOctagon} title="Notificação oficial" date={fine.notification_received_date} done={!isAviso} current={isAviso} color="warning" />
                <TimelineStep icon={UserCheck} title="Motorista indicado" date={fine.driver_indicated_at} done={!!fine.driver_indicated_at} color="primary" />
                <TimelineStep icon={Gavel} title="Recurso" date={fine.recourse_filed_at} done={!!fine.recourse_result} current={fine.status === "em_recurso"} color={fine.recourse_result === "deferido" ? "success" : "destructive"} />
                <TimelineStep icon={Receipt} title="Pagamento" date={fine.paid_at} done={isPaid} color="success" />
              </div>

              <div className="surface-card rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm mb-1">Ações</h4>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setEditing(true)}><Pencil className="h-3 w-3 mr-2" /> Editar</Button>
                {isAviso && <Button size="sm" className="w-full justify-start" onClick={() => setConverting(true)}><ArrowRight className="h-3 w-3 mr-2" /> Converter em Multa</Button>}
                {!isAviso && !isClosed && !fine.driver_indicated_at && (
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setIndicating(true)}><UserCheck className="h-3 w-3 mr-2" /> Indicar motorista</Button>
                )}
                {!isAviso && !isClosed && !fine.recourse_filed_at && (
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setRecourseOpen("open")}><Gavel className="h-3 w-3 mr-2" /> Entrar com recurso</Button>
                )}
                {fine.recourse_filed_at && !fine.recourse_result && (
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setRecourseOpen("result")}><Gavel className="h-3 w-3 mr-2" /> Atualizar resultado</Button>
                )}
                {!isAviso && !isPaid && fine.status !== "recurso_deferido" && (
                  <Button size="sm" className="w-full justify-start" onClick={() => setPaying(true)}><Receipt className="h-3 w-3 mr-2" /> Marcar como paga</Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {editing && <FineFormDialog open={editing} onClose={() => setEditing(false)} companyId={companyId} fine={fine} onSaved={refresh} />}
      {converting && <ConvertAvisoDialog open={converting} onClose={() => setConverting(false)} fine={fine} onSaved={refresh} />}
      {indicating && <IndicateDriverDialog open={indicating} onClose={() => setIndicating(false)} fine={fine} companyId={companyId} onSaved={refresh} />}
      {recourseOpen && <RecourseDialog open={!!recourseOpen} onClose={() => setRecourseOpen(null)} fine={fine} mode={recourseOpen} onSaved={refresh} />}
      {paying && <PaymentDialog open={paying} onClose={() => setPaying(false)} fine={fine} onSaved={refresh} />}
    </>
  );
}