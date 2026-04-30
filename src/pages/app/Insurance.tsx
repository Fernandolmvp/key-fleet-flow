import InsurancePanel from "@/components/dashboard/InsurancePanel";
import { ShieldCheck } from "lucide-react";

export default function Insurance() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
          <ShieldCheck className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Seguros</h1>
          <p className="text-sm text-muted-foreground">Apólices, vínculos com veículos e vencimentos.</p>
        </div>
      </div>
      <InsurancePanel />
    </div>
  );
}