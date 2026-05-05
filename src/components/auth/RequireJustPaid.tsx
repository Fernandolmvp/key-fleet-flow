import { Navigate, Outlet, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function RequireJustPaid() {
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  // Acesso direto via Stripe return_url (?checkout=success) ou navegação interna logo após pagar
  const ok = params.get("checkout") === "success" || params.get("from") === "checkout";
  if (!ok) return <Navigate to="/app" replace />;
  return <Outlet />;
}