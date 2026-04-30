import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, CreditCard } from "lucide-react";

export function SubscriptionBanner() {
  const { currentCompanyId, isSuperAdmin } = useAuth();
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    if (!currentCompanyId || isSuperAdmin) return;
    (async () => {
      const { data } = await supabase.from("company_usage").select("subscription_status,current_period_end,vehicles_used,vehicle_limit").eq("company_id", currentCompanyId).maybeSingle();
      setInfo(data);
    })();
  }, [currentCompanyId, isSuperAdmin]);

  if (!info) return null;

  const overdue = new Date(info.current_period_end) < new Date();
  const blocking = ["suspensa","cancelada"].includes(info.subscription_status);
  const aguardando = info.subscription_status === "aguardando_pagamento";
  const atLimit = info.vehicle_limit && info.vehicles_used >= info.vehicle_limit;

  if (!blocking && !aguardando && !overdue && !atLimit) return null;

  const tone = blocking
    ? "bg-destructive/15 border-destructive/40 text-destructive"
    : "bg-warning/15 border-warning/40 text-warning";

  return (
    <Link to="/app/assinatura" className={`block border-b ${tone} px-6 py-2 text-sm hover:opacity-90`}>
      <div className="flex items-center gap-2">
        {blocking ? <AlertTriangle className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
        <span className="font-medium">
          {blocking && "Assinatura suspensa — regularize para liberar cadastros."}
          {!blocking && overdue && "Pagamento em atraso. Renove sua assinatura."}
          {!blocking && !overdue && aguardando && "Aguardando confirmação de pagamento."}
          {!blocking && !overdue && !aguardando && atLimit && `Limite do plano atingido (${info.vehicles_used}/${info.vehicle_limit} veículos). Faça upgrade.`}
        </span>
        <span className="ml-auto underline">Ver assinatura</span>
      </div>
    </Link>
  );
}