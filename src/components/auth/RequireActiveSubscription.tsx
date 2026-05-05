import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function RequireActiveSubscription() {
  const { user, isSuperAdmin, isDriverOnly, loading: authLoading } = useAuth();
  const loc = useLocation();
  const [checking, setChecking] = useState(true);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || isSuperAdmin || isDriverOnly) {
      setChecking(false);
      setActive(true);
      return;
    }
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.rpc("get_my_acquisition_state" as any);
      if (!mounted) return;
      if (error) {
        // Não bloqueia em caso de erro do RPC — preserva acesso para não quebrar
        setActive(true);
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        setActive(!!row?.is_active);
      }
      setChecking(false);
    })();
    return () => { mounted = false; };
  }, [user, isSuperAdmin, isDriverOnly, authLoading, loc.pathname]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!active) return <Navigate to="/planos" replace />;
  return <Outlet />;
}