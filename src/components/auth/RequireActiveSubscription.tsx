import { Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { TrialExpiredGate } from "@/components/TrialExpiredGate";

export default function RequireActiveSubscription() {
  const { loading: authLoading } = useAuth();
  const { loading, isActive, isExempt } = useTrialStatus();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!isActive && !isExempt) return <TrialExpiredGate />;
  return <Outlet />;
}