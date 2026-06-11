import { useEffect, useState } from "react";
import { Lock, LogOut, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { useTrialStatus } from "@/hooks/useTrialStatus";

const fmtBRL = (v: number | null | undefined) =>
  v == null ? "a combinar" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function TrialExpiredGate() {
  const { signOut, user, currentCompanyId } = useAuth();
  const { trialEndsAt } = useTrialStatus();
  const [plans, setPlans] = useState<any[]>([]);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: sub }] = await Promise.all([
        supabase.from("plans").select("*").eq("active", true).order("sort_order"),
        currentCompanyId
          ? supabase.from("subscriptions").select("trial_plan_snapshot").eq("company_id", currentCompanyId).order("created_at", { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      setPlans(p ?? []);
      setSnapshot((sub as any)?.trial_plan_snapshot ?? null);
      setLoading(false);
    })();
  }, [currentCompanyId]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b border-border flex items-center justify-end px-6">
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </header>
      <main className="flex-1 grid place-items-center px-6 py-10">
        <div className="w-full max-w-5xl space-y-8 text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-destructive/15 grid place-items-center">
            <Lock className="h-10 w-10 text-destructive" />
          </div>
          <div className="space-y-3">
            <h1 className="font-display text-4xl font-bold">Seu período de teste terminou</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Você teve 21 dias gratuitos para experimentar todos os módulos do FrotaOps. Para continuar usando a plataforma, ative uma assinatura abaixo.
            </p>
            <p className="text-sm text-success">
              <CheckCircle2 className="h-4 w-4 inline mr-1" />
              Todos os seus dados estão preservados e serão restaurados ao ativar a assinatura.
            </p>
          </div>

          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-left">
              {plans.map((p) => {
                const highlight = snapshot && p.name === snapshot;
                const priceId = p.stripe_price_id as string | null;
                return (
                  <div key={p.id} className={`surface-card rounded-xl p-5 flex flex-col ${highlight ? "border-primary ring-1 ring-primary" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div className="font-display font-bold text-lg">{p.name}</div>
                      {highlight && <span className="text-[10px] uppercase tracking-wider font-mono text-primary">Escolhido</span>}
                    </div>
                    <div className="mt-2 text-2xl font-bold">
                      {p.monthly_price ? fmtBRL(Number(p.monthly_price)) : <span className="text-base">a combinar</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.vehicle_limit ? `até ${p.vehicle_limit} veículos` : "veículos a combinar"}
                    </div>
                    <div className="mt-auto pt-4">
                      {priceId ? (
                        <Button size="sm" className="w-full bg-gradient-primary text-primary-foreground" onClick={() => setCheckoutPriceId(priceId)}>
                          Ativar assinatura
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="w-full" asChild>
                          <a href="mailto:contato@frotaops.com.br?subject=Plano Enterprise">Falar com vendas</a>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-4 text-sm">
            Precisa de ajuda?{" "}
            <a className="text-primary underline" href="mailto:contato@frotaops.com.br">Falar com o suporte</a>
          </div>
          {trialEndsAt && new Date(trialEndsAt).getTime() < Date.now() && (
            <div className="text-xs text-muted-foreground">
              Trial encerrado em {new Date(trialEndsAt).toLocaleDateString("pt-BR")}
            </div>
          )}
        </div>
      </main>

      <Dialog open={!!checkoutPriceId} onOpenChange={(o) => !o && setCheckoutPriceId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ativar assinatura</DialogTitle>
            <DialogDescription>Cadastre seu cartão para reativar o acesso imediatamente.</DialogDescription>
          </DialogHeader>
          {checkoutPriceId && currentCompanyId && (
            <StripeEmbeddedCheckout
              priceId={checkoutPriceId}
              companyId={currentCompanyId}
              userId={user?.id}
              customerEmail={user?.email ?? undefined}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}