import { Sparkles, Wallet, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/ai-credits";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  planRemaining: number;
  planTotal: number;
  extraBalance: number;
  lastResetAt: string | null;
  onBuy: () => void;
}

export default function BalanceCards({ planRemaining, planTotal, extraBalance, lastResetAt, onBuy }: Props) {
  const total = planRemaining + extraBalance;
  const used = Math.max(0, planTotal - planRemaining);
  const pct = planTotal > 0 ? Math.min(100, (used / planTotal) * 100) : 0;
  const nextReset = lastResetAt ? addMonths(new Date(lastResetAt), 1) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="surface-card rounded-xl p-5 border-l-4 border-l-primary">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Saldo do Plano</p>
            <p className="font-display text-3xl font-bold mt-2 text-primary">{formatNumber(planRemaining)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {nextReset ? `Renova em ${format(nextReset, "dd/MM/yyyy", { locale: ptBR })}` : "Aguardando ativação"}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg grid place-items-center bg-primary/10 text-primary">
            <Wallet className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 font-mono">
            {formatNumber(used)} / {formatNumber(planTotal)} usados
          </p>
        </div>
      </div>

      <div className="surface-card rounded-xl p-5 border-l-4 border-l-success">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Tokens Extras</p>
            <p className="font-display text-3xl font-bold mt-2 text-success">{formatNumber(extraBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">Sem prazo de validade</p>
          </div>
          <div className="h-10 w-10 rounded-lg grid place-items-center bg-success/10 text-success">
            <Plus className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="surface-card rounded-xl p-5 border-l-4 border-l-warning bg-gradient-to-br from-warning/5 to-transparent">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Total Disponível</p>
            <p className="font-display text-4xl font-bold mt-2 text-warning">{formatNumber(total)}</p>
            <p className="text-xs text-muted-foreground mt-1">tokens prontos para uso</p>
          </div>
          <div className="h-10 w-10 rounded-lg grid place-items-center bg-warning/10 text-warning">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
      </div>

      <button
        onClick={onBuy}
        className="surface-card rounded-xl p-5 border-l-4 border-l-accent text-left hover:border-accent/80 hover:bg-accent/5 transition-colors group"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Precisa de mais?</p>
            <p className="font-display text-xl font-bold mt-2">Comprar tokens</p>
            <p className="text-xs text-muted-foreground mt-1">Pacotes Bronze, Prata e Ouro</p>
          </div>
          <div className="h-10 w-10 rounded-lg grid place-items-center bg-accent/10 text-accent-foreground group-hover:scale-110 transition-transform">
            <ShoppingCart className="h-5 w-5" />
          </div>
        </div>
      </button>
    </div>
  );
}