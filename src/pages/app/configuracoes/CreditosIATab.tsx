import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import BalanceCards from "./credits/BalanceCards";
import UsageChart from "./credits/UsageChart";
import UsageHistory from "./credits/UsageHistory";
import TopFeatures from "./credits/TopFeatures";
import BalanceAlert from "./credits/BalanceAlert";


interface Props { companyId: string; }

export default function CreditosIATab({ companyId }: Props) {
  const [loading, setLoading] = useState(true);
  const [planRemaining, setPlanRemaining] = useState(0);
  const [extraBalance, setExtraBalance] = useState(0);
  const [planTotal, setPlanTotal] = useState(0);
  const [lastResetAt, setLastResetAt] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string | null }[]>([]);
  const [showBuy, setShowBuy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);

      const [balanceRes, subRes, logsRes, membersRes] = await Promise.all([
        supabase
          .from("ai_token_balance")
          .select("plan_tokens_remaining,extra_tokens_balance,last_plan_reset_at")
          .eq("company_id", companyId)
          .maybeSingle(),
        supabase
          .from("subscriptions")
          .select("plan_id, plans(tokens_monthly)")
          .eq("company_id", companyId)
          .in("status", ["ativa", "atrasada", "aguardando_pagamento"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("ai_usage_logs")
          .select("created_at,feature,tokens_total")
          .eq("company_id", companyId)
          .gte("created_at", new Date(Date.now() - 31 * 86400000).toISOString())
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("company_members")
          .select("user_id, profiles:user_id(id, full_name)")
          .eq("company_id", companyId),
      ]);

      if (!alive) return;

      setPlanRemaining(balanceRes.data?.plan_tokens_remaining ?? 0);
      setExtraBalance(balanceRes.data?.extra_tokens_balance ?? 0);
      setLastResetAt(balanceRes.data?.last_plan_reset_at ?? null);
      setPlanTotal(((subRes.data as any)?.plans?.tokens_monthly) ?? 0);
      setRecentLogs(logsRes.data ?? []);
      const mems = (membersRes.data ?? []).map((m: any) => ({
        id: m.user_id,
        full_name: m.profiles?.full_name ?? null,
      }));
      setMembers(mems);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [companyId]);

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <BalanceAlert
        totalAvailable={planRemaining + extraBalance}
        planTotal={planTotal}
      />

      <BalanceCards
        planRemaining={planRemaining}
        planTotal={planTotal}
        extraBalance={extraBalance}
        lastResetAt={lastResetAt}
        onBuy={() => setShowBuy(true)}
      />

      <UsageChart logs={recentLogs} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <UsageHistory companyId={companyId} members={members} />
        </div>
        <div className="lg:col-span-1">
          <TopFeatures logs={recentLogs} />
        </div>
      </div>

      <Dialog open={showBuy} onOpenChange={setShowBuy}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comprar tokens extras</DialogTitle>
            <DialogDescription>
              A compra de pacotes (Bronze, Prata, Ouro) estará disponível em breve.
              Em poucos cliques você poderá adicionar tokens sem prazo de validade à sua empresa.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}