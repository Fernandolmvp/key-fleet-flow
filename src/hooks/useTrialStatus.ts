import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type TrialStatus = {
  loading: boolean;
  isActive: boolean;
  isExempt: boolean;
  isExpired: boolean;
  isBlocked: boolean;
  daysRemaining: number | null;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
  refetch: () => Promise<void>;
};

const FIVE_MIN = 5 * 60 * 1000;

export function useTrialStatus(): TrialStatus {
  const { user, isSuperAdmin, isDriverOnly } = useAuth();
  const [state, setState] = useState<Omit<TrialStatus, "refetch">>({
    loading: true,
    isActive: true,
    isExempt: false,
    isExpired: false,
    isBlocked: false,
    daysRemaining: null,
    trialEndsAt: null,
    subscriptionStatus: null,
  });

  const fetchNow = useCallback(async () => {
    if (!user || isSuperAdmin || isDriverOnly) {
      setState({
        loading: false, isActive: true, isExempt: true, isExpired: false, isBlocked: false,
        daysRemaining: null, trialEndsAt: null, subscriptionStatus: null,
      });
      return;
    }
    const { data, error } = await supabase.rpc("get_my_acquisition_state" as any);
    if (error) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const row: any = Array.isArray(data) ? data[0] : data;
    const isExempt = !!row?.is_exempt;
    const isBlocked = !!row?.is_blocked;
    // Fonte da verdade: is_blocked. is_active = NOT blocked.
    const isActive = isExempt || !isBlocked;
    const subStatus = row?.subscription_status ?? null;
    const days = row?.trial_days_remaining ?? null;
    setState({
      loading: false,
      isActive,
      isExempt,
      isBlocked,
      isExpired: isBlocked,
      daysRemaining: days,
      trialEndsAt: row?.trial_ends_at ?? null,
      subscriptionStatus: subStatus,
    });
  }, [user, isSuperAdmin, isDriverOnly]);

  useEffect(() => {
    fetchNow();
    const id = setInterval(fetchNow, FIVE_MIN);
    const onFocus = () => fetchNow();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [fetchNow]);

  return { ...state, refetch: fetchNow };
}