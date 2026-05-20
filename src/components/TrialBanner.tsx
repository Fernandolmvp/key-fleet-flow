import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, X } from "lucide-react";
import { useTrialStatus } from "@/hooks/useTrialStatus";

const KEY = "trial_banner_dismissed";

export function TrialBanner() {
  const { loading, isExempt, daysRemaining, subscriptionStatus } = useTrialStatus();
  const [dismissed, setDismissed] = useState<boolean>(() => sessionStorage.getItem(KEY) === "1");

  if (loading || isExempt) return null;
  if (subscriptionStatus !== "trial") return null;
  if (daysRemaining === null) return null;

  const critical = daysRemaining <= 3;
  const canDismiss = !critical;
  if (dismissed && canDismiss) return null;

  const tone =
    daysRemaining <= 2
      ? "bg-destructive text-destructive-foreground"
      : daysRemaining <= 7
      ? "bg-warning text-warning-foreground"
      : "bg-primary text-primary-foreground";

  return (
    <div className={`${tone} px-4 py-2 text-sm flex items-center justify-center gap-3 shadow-sm`}>
      <Clock className="h-4 w-4 shrink-0" />
      <span className="font-medium">
        Trial: {daysRemaining} dia{daysRemaining === 1 ? "" : "s"} restante{daysRemaining === 1 ? "" : "s"} — assine agora para não perder acesso.
      </span>
      <Link
        to="/app/assinatura"
        className="rounded-md bg-background/15 hover:bg-background/25 border border-current/40 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide"
      >
        Ver planos
      </Link>
      {canDismiss && (
        <button
          aria-label="Fechar"
          onClick={() => { sessionStorage.setItem(KEY, "1"); setDismissed(true); }}
          className="ml-2 opacity-80 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}