import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle2, AlertTriangle, Truck, Users, Receipt, Loader2, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { getStripeEnvironment } from "@/lib/stripe";
import { useTrialStatus } from "@/hooks/useTrialStatus";

const fmtBRL = (v: number | null | undefined) =>
  v == null ? "a combinar" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const statusTone: Record<string, string> = {
  ativa: "bg-success/20 text-success border-success/30",
  trial: "bg-primary/20 text-primary border-primary/30",
  aguardando_pagamento: "bg-warning/20 text-warning border-warning/30",
  atrasada: "bg-destructive/20 text-destructive border-destructive/30",
  suspensa: "bg-destructive/30 text-destructive border-destructive/40",
  cancelada: "bg-muted text-muted-foreground",
  expirada: "bg-destructive/30 text-destructive border-destructive/40",
};
const statusLabel: Record<string, string> = {
  ativa: "Ativa", trial: "Trial 21 dias", aguardando_pagamento: "Aguardando pagamento",
  atrasada: "Atrasada", suspensa: "Suspensa", cancelada: "Cancelada", expirada: "Trial expirado",
};

export default function Subscription() {
  const { user, currentCompanyId } = useAuth();
  const trial = useTrialStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const reload = async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    const [{ data: u, error: eu }, { data: p }, { data: pays }] = await Promise.all([
      supabase.from("company_usage").select("*").eq("company_id", currentCompanyId).maybeSingle(),
      supabase.from("plans").select("*").eq("active", true).order("sort_order"),
      supabase.from("subscription_payments").select("*").eq("company_id", currentCompanyId).order("paid_at", { ascending: false }).limit(10),
    ]);
    if (eu) toast.error(eu.message);
    setData(u);
    setPlans(p ?? []);
    setPayments(pays ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [currentCompanyId]);

  // Volta do checkout
  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      // Se foi a primeira ativação (estava aguardando_pagamento), manda pra tela de boas-vindas
      if (data?.subscription_status === "aguardando_pagamento") {
        nav("/boas-vindas?checkout=success", { replace: true });
        return;
      }
      toast.success("Pagamento confirmado! Sua assinatura está sendo ativada.");
      setTimeout(() => { reload(); }, 1500);
      searchParams.delete("checkout");
      searchParams.delete("session_id");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, data?.subscription_status]);

  const handleUpgrade = (priceId: string) => {
    if (!currentCompanyId) return;
    setCheckoutPriceId(priceId);
  };

  const handleManageCard = async () => {
    if (!currentCompanyId) return;
    setPortalLoading(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          companyId: currentCompanyId,
          returnUrl: `${window.location.origin}/app/assinatura`,
          environment: getStripeEnvironment(),
        },
      });
      if (error || !resp?.url) throw new Error(error?.message || "Falha ao abrir portal");
      window.open(resp.url, "_blank");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!data) return <div className="text-muted-foreground">Sem dados de assinatura</div>;

  const limit = data.vehicle_limit;
  const usagePct = limit ? Math.min(100, Math.round((data.vehicles_used / limit) * 100)) : 0;
  const overdue = new Date(data.current_period_end) < new Date() && data.subscription_status !== "cancelada";
  const hasStripeCustomer = !!data.stripe_customer_id || data.subscription_status === "ativa" || data.subscription_status === "atrasada";

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Assinatura</h1>
        <p className="text-muted-foreground">Gerencie seu plano e pagamentos</p>
      </div>

      {/* Card principal */}
      <div className="surface-card rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Plano atual</div>
            <div className="font-display text-2xl font-bold mt-1">{data.plan_name}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {fmtBRL(data.monthly_amount)} / mês
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={`border ${statusTone[data.subscription_status] ?? ""}`}>
              {statusLabel[data.subscription_status] ?? data.subscription_status}
            </Badge>
            {hasStripeCustomer && (
              <Button size="sm" variant="outline" onClick={handleManageCard} disabled={portalLoading}>
                {portalLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
                Gerenciar cartão / faturas
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 pt-4 border-t border-border">
          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> Veículos</div>
            <div className="font-mono text-lg mt-1">{data.vehicles_used} / {limit ?? "∞"}</div>
            {limit && (
              <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                <div className={`h-full ${usagePct >= 90 ? "bg-destructive" : usagePct >= 70 ? "bg-warning" : "bg-success"}`} style={{ width: `${usagePct}%` }} />
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Equipe</div>
            <div className="font-mono text-lg mt-1">{data.drivers_count} mot. · {data.members_count} usu.</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" /> Próximo vencimento</div>
            <div className={`font-mono text-lg mt-1 ${overdue ? "text-destructive" : ""}`}>{fmtDate(data.current_period_end)}</div>
          </div>
        </div>

        {(data.subscription_status === "aguardando_pagamento" || overdue || data.subscription_status === "suspensa") && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
              <div>
                <div className="font-medium text-warning">Pagamento pendente</div>
                <div className="text-muted-foreground mt-1">
                  Entre em contato para regularizar via Pix ou boleto. Após o pagamento sua assinatura será renovada manualmente.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Planos disponíveis */}
      <div>
        <h2 className="font-display text-xl font-bold mb-3">Planos disponíveis</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const current = p.id === data.plan_id;
            const priceId = p.stripe_price_id as string | null;
            const canCheckout = !!priceId && !current;
            return (
              <div key={p.id} className={`surface-card rounded-xl p-5 ${current ? "border-primary" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="font-display font-bold text-lg">{p.name}</div>
                  {current && <Badge className="bg-primary/20 text-primary border-primary/30">Atual</Badge>}
                </div>
                <div className="mt-2 text-2xl font-bold">
                  {p.monthly_price ? fmtBRL(p.monthly_price) : <span className="text-base">a combinar</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.vehicle_limit ? `até ${p.vehicle_limit} veículos` : "veículos a combinar"}
                </div>
                <ul className="mt-4 space-y-1.5 text-xs">
                  {(p.features ?? []).map((f: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-success mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  {canCheckout ? (
                    <Button size="sm" className="w-full" onClick={() => handleUpgrade(priceId!)}>
                      <ArrowUpCircle className="h-3 w-3" /> Assinar este plano
                    </Button>
                  ) : !priceId ? (
                    <Button size="sm" variant="outline" className="w-full" asChild>
                      <a href="mailto:contato@suporte.com?subject=Plano Enterprise">Falar com vendas</a>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full" disabled>
                      Plano atual
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Cobrança automática mensal no cartão. Em upgrade, você paga só a diferença proporcional do mês corrente.
        </p>
      </div>

      {/* Histórico de pagamentos */}
      <div>
        <h2 className="font-display text-xl font-bold mb-3">Pagamentos recentes</h2>
        {payments.length === 0 ? (
          <div className="surface-card rounded-xl p-8 text-center text-muted-foreground text-sm">
            <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhum pagamento registrado ainda.
          </div>
        ) : (
          <div className="surface-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-left px-4 py-3">Valor</th>
                  <th className="text-left px-4 py-3">Método</th>
                  <th className="text-left px-4 py-3">Referência</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-2.5 text-xs">{fmtDate(p.paid_at)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{fmtBRL(Number(p.amount))}</td>
                    <td className="px-4 py-2.5 text-xs capitalize">{p.method}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.reference || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de checkout */}
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
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}