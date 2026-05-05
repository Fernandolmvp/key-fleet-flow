import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { CheckCircle2, Loader2, Truck, LogOut, ArrowUpCircle, MessageCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

const fmtBRL = (v: number | null | undefined) =>
  v == null ? "a combinar" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SALES_WHATSAPP = "5517999999999";
const SALES_EMAIL = "contato@frotaops.com";
const WHATSAPP_URL = `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(
  "Olá! Tenho interesse no plano Enterprise do FrotaOps."
)}`;

export default function PlanSelection() {
  const { user, signOut, companies, currentCompanyId, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const [hasActive, setHasActive] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      const [{ data: state }, { data: ps }] = await Promise.all([
        supabase.rpc("get_my_acquisition_state" as any),
        supabase.from("plans").select("*").eq("active", true).order("sort_order"),
      ]);
      const row: any = Array.isArray(state) ? state[0] : state;
      setHasActive(!!row?.is_active);
      setPlans(ps ?? []);
      setLoading(false);
    })();
  }, [authLoading, user]);

  if (!authLoading && !user) return <Navigate to="/login" replace />;
  if (loading || hasActive === null) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (hasActive) return <Navigate to="/app" replace />;

  const company = companies.find((c) => c.id === currentCompanyId) ?? companies[0];

  const handlePick = (priceId: string | null) => {
    if (!priceId) return toast.error("Plano sem preço configurado. Fale com vendas.");
    if (!currentCompanyId) return toast.error("Empresa não identificada. Recarregue a página.");
    setCheckoutPriceId(priceId);
  };

  return (
    <div className="min-h-screen bg-gradient-surface">
      <header className="h-16 border-b border-border bg-background-elevated/40 backdrop-blur flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-bold tracking-tight">FrotaOps</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
              {company?.name ?? "Sua empresa"}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </header>

      <main className="max-w-6xl mx-auto p-6 lg:p-12 space-y-10 animate-fade-in">
        <div className="text-center space-y-3">
          <Badge className="bg-primary/15 text-primary border-primary/30">Último passo</Badge>
          <h1 className="font-display text-4xl font-bold">Escolha seu plano para começar</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Sua conta foi criada com sucesso{company?.name ? ` para ${company.name}` : ""}. Escolha um plano para liberar o acesso completo ao sistema.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const priceId = p.stripe_price_id as string | null;
            const isEnterprise = !!p.is_custom;
            const isPopular = p.slug === "pro";
            return (
              <div
                key={p.id}
                className={`surface-card rounded-xl p-6 flex flex-col relative ${
                  isPopular ? "border-2 border-primary shadow-glow lg:scale-[1.03] z-10" : ""
                }`}
              >
                {isPopular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-primary text-primary-foreground border-0 shadow-glow">
                    <Sparkles className="h-3 w-3" /> Mais popular
                  </Badge>
                )}
                <div className="font-display font-bold text-lg">{p.name}</div>
                <div className="mt-2 text-3xl font-bold">
                  {p.monthly_price ? fmtBRL(Number(p.monthly_price)) : <span className="text-base">a combinar</span>}
                  {p.monthly_price && <span className="text-xs font-normal text-muted-foreground"> /mês</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {p.vehicle_limit ? `Até ${p.vehicle_limit} veículos` : "Veículos a combinar"}
                </div>
                <ul className="mt-5 space-y-2 text-xs flex-1">
                  {(p.features ?? []).map((f: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isEnterprise ? (
                    <div className="space-y-2">
                      <Button className="w-full bg-success text-white hover:bg-success/90 font-semibold" asChild>
                        <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                          <MessageCircle className="h-4 w-4" /> Fale conosco
                        </a>
                      </Button>
                      <a
                        href={`mailto:${SALES_EMAIL}?subject=Plano%20Enterprise%20-%20FrotaOps`}
                        className="block text-center text-[11px] text-muted-foreground hover:text-foreground underline"
                      >
                        ou {SALES_EMAIL}
                      </a>
                    </div>
                  ) : (
                    <Button
                      className={`w-full font-semibold ${
                        isPopular
                          ? "bg-gradient-primary text-primary-foreground shadow-glow"
                          : "bg-primary text-primary-foreground"
                      }`}
                      onClick={() => handlePick(priceId)}
                    >
                      <ArrowUpCircle className="h-4 w-4" /> Assinar agora
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Cobrança mensal automática no cartão. Você pode trocar de plano ou cancelar a qualquer momento.
        </p>
      </main>

      <Dialog open={!!checkoutPriceId} onOpenChange={(o) => !o && setCheckoutPriceId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar assinatura</DialogTitle>
            <DialogDescription>
              Cadastre seu cartão. A cobrança é mensal e renova automaticamente.
            </DialogDescription>
          </DialogHeader>
          {checkoutPriceId && currentCompanyId && (
            <StripeEmbeddedCheckout
              priceId={checkoutPriceId}
              companyId={currentCompanyId}
              userId={user?.id}
              customerEmail={user?.email ?? undefined}
              returnUrl={`${window.location.origin}/boas-vindas?checkout=success&session_id={CHECKOUT_SESSION_ID}`}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}