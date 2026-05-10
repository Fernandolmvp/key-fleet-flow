import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  checkSecrets, getProviderHealthLast24h, listProviders, type Provider,
} from "@/lib/ai-admin";

type Alert = { tone: "red" | "yellow" | "green"; message: string };

export default function AIAlertsBanner() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const providers = await listProviders();
        const activeProviders = providers.filter((p) => p.active);
        const health = await getProviderHealthLast24h();
        const secrets = await checkSecrets(activeProviders.map((p) => p.secret_name));
        const a: Alert[] = [];

        // Secrets faltando
        const missing = activeProviders.filter((p) => secrets[p.secret_name] === false);
        for (const p of missing) {
          a.push({
            tone: "yellow",
            message: `Provedor ativo "${p.name}" sem secret cadastrado: ${p.secret_name}.`,
          });
        }

        // Erros >20%
        for (const p of activeProviders) {
          const h = health.byProvider[p.id];
          if (h && h.total >= 5 && h.errorRate > 0.2) {
            a.push({
              tone: "red",
              message: `Provedor "${p.name}" com ${(h.errorRate * 100).toFixed(0)}% de erro nas últimas 24h (${h.errors}/${h.total}).`,
            });
          }
        }

        // Fallback alto
        if (health.totalCalls >= 10 && health.fallbackRate > 0.3) {
          a.push({
            tone: "yellow",
            message: `Fallback acionado em ${(health.fallbackRate * 100).toFixed(0)}% das chamadas (${health.totalFallback}/${health.totalCalls}). Verifique provedor primário.`,
          });
        }

        if (a.length === 0) {
          a.push({ tone: "green", message: "Tudo funcionando normalmente. Nenhum alerta nas últimas 24h." });
        }
        setAlerts(a);
      } catch {
        setAlerts([]);
      }
    })();
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => {
        const Icon = a.tone === "red" ? XCircle : a.tone === "yellow" ? AlertTriangle : CheckCircle2;
        return (
          <div
            key={i}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
              a.tone === "red" && "border-destructive/40 bg-destructive/10 text-destructive",
              a.tone === "yellow" && "border-warning/40 bg-warning/10 text-warning",
              a.tone === "green" && "border-success/40 bg-success/10 text-success",
            )}
          >
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{a.message}</span>
          </div>
        );
      })}
    </div>
  );
}