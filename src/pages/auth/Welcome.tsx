import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Truck, Users, Fuel, CheckCircle2, ArrowRight, PartyPopper, Loader2 } from "lucide-react";

export default function Welcome() {
  const { companies, currentCompanyId, refreshCompanies } = useAuth();
  const nav = useNavigate();
  const [confirming, setConfirming] = useState(true);

  // Polling curto pro webhook confirmar status=ativa
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      tries += 1;
      const { data } = await supabase.rpc("get_my_acquisition_state" as any);
      const row: any = Array.isArray(data) ? data[0] : data;
      if (cancelled) return;
      if (row?.is_active) {
        setConfirming(false);
        await refreshCompanies();
        return;
      }
      if (tries < 8) {
        setTimeout(tick, 1500);
      } else {
        setConfirming(false); // libera mesmo assim — webhook pode demorar
      }
    };
    tick();
    return () => { cancelled = true; };
  }, []);

  const company = companies.find((c) => c.id === currentCompanyId) ?? companies[0];

  const steps = [
    { icon: Truck, label: "Cadastre seu primeiro veículo", to: "/app/vehicles" },
    { icon: Users, label: "Cadastre seus motoristas", to: "/app/drivers" },
    { icon: Fuel, label: "Registre seu primeiro abastecimento", to: "/app/fuel" },
  ];

  return (
    <div className="min-h-screen bg-gradient-surface">
      <main className="max-w-3xl mx-auto p-6 lg:p-12 space-y-10 animate-fade-in">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
            <PartyPopper className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl font-bold">
            Bem-vindo{company?.name ? `, ${company.name}` : ""}!
          </h1>
          <p className="text-muted-foreground text-lg">
            {confirming ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Confirmando seu pagamento…
              </span>
            ) : (
              "Sua assinatura está ativa. Vamos colocar sua frota em operação em 3 passos."
            )}
          </p>
        </div>

        <div className="space-y-3">
          {steps.map((s, i) => (
            <button
              key={s.to}
              onClick={() => nav(s.to)}
              className="surface-card rounded-xl p-5 w-full flex items-center gap-4 hover:border-primary/50 transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center text-primary font-mono font-bold">
                {i + 1}
              </div>
              <s.icon className="h-5 w-5 text-primary" />
              <span className="font-medium flex-1">{s.label}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        <div className="text-center">
          <Button
            size="lg"
            disabled={confirming}
            onClick={() => nav("/app")}
            className="bg-gradient-primary text-primary-foreground shadow-glow font-semibold h-12 px-8"
          >
            <CheckCircle2 className="h-5 w-5" /> Acessar o sistema agora
          </Button>
        </div>
      </main>
    </div>
  );
}