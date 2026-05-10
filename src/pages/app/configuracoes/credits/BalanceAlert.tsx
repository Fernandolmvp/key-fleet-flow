import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  totalAvailable: number;
  planTotal: number;
}

export default function BalanceAlert({ totalAvailable, planTotal }: Props) {
  if (planTotal <= 0) return null;

  if (totalAvailable === 0) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
        <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-destructive">Saldo zerado</p>
          <p className="text-sm text-destructive/80">
            A IA está bloqueada até a próxima compra ou renovação do plano.
          </p>
        </div>
      </div>
    );
  }

  const pct = (totalAvailable / planTotal) * 100;

  if (pct < 20) {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-warning">Saldo baixo</p>
          <p className="text-sm text-warning/80">
            Restam menos de 20% dos tokens do plano. Considere comprar tokens extras para evitar interrupções.
          </p>
        </div>
      </div>
    );
  }

  if (pct > 50) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/10 p-4 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-success">Tudo certo</p>
          <p className="text-sm text-success/80">
            Saldo confortável para o consumo do mês.
          </p>
        </div>
      </div>
    );
  }

  return null;
}