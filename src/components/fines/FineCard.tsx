import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, AlertOctagon, MapPin, Calendar, Clock } from "lucide-react";
import {
  FINE_STATUS_LABEL, FINE_STATUS_TONE, FINE_TYPES,
  fmtBRL, fmtDate, daysUntil, type TrafficFine,
} from "@/lib/fines";

type Props = {
  fine: TrafficFine;
  vehicle?: { plate: string; brand: string | null; model: string | null } | null;
  driver?: { full_name: string } | null;
  onOpen: (f: TrafficFine) => void;
};

export default function FineCard({ fine, vehicle, driver, onOpen }: Props) {
  const isAviso = fine.record_type === "aviso";
  const fineTypeLabel = FINE_TYPES.find(t => t.value === fine.fine_type)?.label ?? fine.fine_type ?? "—";
  const dueDays = daysUntil(fine.due_date);
  const recourseDays = daysUntil(fine.recourse_deadline);
  const indicationDays = daysUntil(fine.driver_indication_deadline);

  return (
    <div className={[
      "surface-card rounded-xl p-4 hover:border-primary/40 transition-colors",
      isAviso ? "border-l-4 border-l-info" : "border-l-4 border-l-warning",
    ].join(" ")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={[
            "h-10 w-10 rounded-lg grid place-items-center shrink-0",
            isAviso ? "bg-info/15 text-info" : "bg-warning/15 text-warning",
          ].join(" ")}>
            {isAviso ? <Mail className="h-5 w-5" /> : <AlertOctagon className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {isAviso ? "AVISO" : "MULTA"}
              </span>
              <Badge variant="outline" className={FINE_STATUS_TONE[fine.status]}>
                {FINE_STATUS_LABEL[fine.status]}
              </Badge>
              {fine.notification_number && (
                <span className="text-xs text-muted-foreground font-mono">AIT {fine.notification_number}</span>
              )}
            </div>
            <h3 className="font-semibold mt-1 truncate">
              {vehicle?.plate ?? "Veículo"} · {[vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") || "—"}
            </h3>
            <p className="text-sm text-muted-foreground truncate">{fineTypeLabel}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
              <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(fine.infraction_date)}{fine.infraction_time ? ` ${fine.infraction_time.slice(0,5)}` : ""}</span>
              {(fine.location || fine.city) && (
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[fine.location, fine.city].filter(Boolean).join(" · ")}</span>
              )}
              {driver && (<span>👤 {driver.full_name}</span>)}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          {fine.amount != null && (
            <div className="font-display font-bold text-lg">{fmtBRL(fine.amount)}</div>
          )}
          {fine.discount_amount != null && (
            <div className="text-xs text-muted-foreground">com desconto: {fmtBRL(fine.discount_amount)}</div>
          )}
          {fine.license_points > 0 && (
            <div className="text-xs text-warning mt-1">{fine.license_points} pts CNH</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {!isAviso && dueDays != null && fine.paid_at == null && (
          <Badge variant="outline" className={dueDays < 0 ? "bg-destructive/15 text-destructive border-destructive/30" : dueDays <= 7 ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-muted text-muted-foreground"}>
            <Clock className="h-3 w-3 mr-1" />
            {dueDays < 0 ? `Vencida há ${Math.abs(dueDays)}d` : `Vence em ${dueDays}d`}
          </Badge>
        )}
        {recourseDays != null && recourseDays >= 0 && !fine.recourse_filed_at && (
          <Badge variant="outline" className={recourseDays <= 5 ? "bg-warning/15 text-warning border-warning/30" : "bg-muted text-muted-foreground"}>
            Recurso: {recourseDays}d
          </Badge>
        )}
        {indicationDays != null && indicationDays >= 0 && !fine.driver_indicated_at && (
          <Badge variant="outline" className={indicationDays <= 5 ? "bg-warning/15 text-warning border-warning/30" : "bg-muted text-muted-foreground"}>
            Indicação: {indicationDays}d
          </Badge>
        )}
        {fine.ai_confidence != null && (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            🤖 IA {Math.round(fine.ai_confidence)}%
          </Badge>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => onOpen(fine)}>Ver detalhes</Button>
      </div>
    </div>
  );
}