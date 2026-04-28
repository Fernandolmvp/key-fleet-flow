import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  tone?: "default" | "success" | "warning" | "destructive" | "primary";
  hint?: string;
}

const toneRing: Record<string, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  primary: "text-primary",
};

export default function KpiCard({ label, value, icon: Icon, trend, tone = "default", hint }: Props) {
  return (
    <div className="surface-card rounded-xl p-5 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
          <p className={cn("font-display text-3xl font-bold mt-2", toneRing[tone])}>{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className={cn("h-10 w-10 rounded-lg grid place-items-center bg-muted/40", toneRing[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && <p className="text-xs mt-3 font-mono text-muted-foreground">{trend}</p>}
    </div>
  );
}
