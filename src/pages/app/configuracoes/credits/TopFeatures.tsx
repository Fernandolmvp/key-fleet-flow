import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { formatFeature, formatNumber } from "@/lib/ai-credits";

interface Log { feature: string; tokens_total: number; created_at: string; }

export default function TopFeatures({ logs }: { logs: Log[] }) {
  const top = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const acc = new Map<string, { calls: number; tokens: number }>();
    for (const l of logs) {
      if (new Date(l.created_at) < monthStart) continue;
      const cur = acc.get(l.feature) ?? { calls: 0, tokens: 0 };
      cur.calls += 1;
      cur.tokens += l.tokens_total || 0;
      acc.set(l.feature, cur);
    }
    return Array.from(acc.entries())
      .map(([feature, v]) => ({ feature, ...v }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 5);
  }, [logs]);

  return (
    <div className="surface-card rounded-xl p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-4 w-4 text-warning" />
        <h3 className="font-display font-semibold">Top funcionalidades do mês</h3>
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem uso registrado neste mês.</p>
      ) : (
        <ol className="space-y-3">
          {top.map((t, i) => (
            <li key={t.feature} className="flex items-center gap-3">
              <span className={`h-7 w-7 grid place-items-center rounded-full text-xs font-bold ${
                i === 0 ? "bg-warning/20 text-warning" : "bg-muted/40 text-muted-foreground"
              }`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{formatFeature(t.feature)}</p>
                <p className="text-xs text-muted-foreground">{t.calls} chamada{t.calls > 1 ? "s" : ""}</p>
              </div>
              <p className="font-mono text-sm text-primary">{formatNumber(t.tokens)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}