import type { LucideIcon } from "lucide-react";
import { Bell, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  features: string[];
};

export default function ModulePlaceholder({ icon: Icon, title, subtitle, features }: Props) {
  return (
    <div className="min-h-[70vh] grid place-items-center">
      <div className="surface-card rounded-3xl p-10 lg:p-14 max-w-2xl w-full text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-40 pointer-events-none" />
        <div className="relative space-y-6">
          <div className="h-20 w-20 mx-auto rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
            <Icon className="h-10 w-10 text-primary-foreground" />
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Disponível em breve
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-3xl lg:text-4xl font-bold">{title}</h1>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>

          <ul className="text-left space-y-2.5 max-w-md mx-auto pt-2">
            {features.map((f) => (
              <li key={f} className="flex gap-2.5 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground/90">{f}</span>
              </li>
            ))}
          </ul>

          <div className="pt-3">
            <Button variant="ghost" className="gap-2" disabled>
              <Bell className="h-4 w-4" />
              Receber notificação quando lançar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}