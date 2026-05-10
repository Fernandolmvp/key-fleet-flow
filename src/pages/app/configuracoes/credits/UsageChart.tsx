import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatNumber } from "@/lib/ai-credits";

interface Log { created_at: string; tokens_total: number; }

export default function UsageChart({ logs }: { logs: Log[] }) {
  const { data, total } = useMemo(() => {
    const days: { date: Date; key: string; label: string; tokens: number }[] = [];
    const today = startOfDay(new Date());
    for (let i = 29; i >= 0; i--) {
      const d = subDays(today, i);
      days.push({ date: d, key: format(d, "yyyy-MM-dd"), label: format(d, "dd/MM"), tokens: 0 });
    }
    const map = new Map(days.map(d => [d.key, d]));
    let total = 0;
    for (const l of logs) {
      const k = format(startOfDay(new Date(l.created_at)), "yyyy-MM-dd");
      const day = map.get(k);
      if (day) { day.tokens += l.tokens_total || 0; total += l.tokens_total || 0; }
    }
    return { data: days, total };
  }, [logs]);

  return (
    <div className="surface-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold">Consumo nos últimos 30 dias</h3>
          <p className="text-xs text-muted-foreground">Tokens consumidos por dia</p>
        </div>
        <p className="font-display text-2xl font-bold text-primary">{formatNumber(total)}</p>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={4} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} width={40} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(_, items) => {
                const d = (items?.[0]?.payload as any)?.date as Date | undefined;
                return d ? format(d, "dd 'de' MMM", { locale: ptBR }) : "";
              }}
              formatter={(v: any) => [formatNumber(Number(v)), "tokens"]}
            />
            <Bar dataKey="tokens" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}