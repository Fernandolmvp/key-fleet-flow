import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function RequireAuth() {
  const { user, loading, companies, isSuperAdmin } = useAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  // Usuário órfão: logado mas sem empresa. Redireciona para onboarding,
  // exceto se já estiver lá ou for Super Admin (que não precisa de empresa).
  if (
    !isSuperAdmin &&
    companies.length === 0 &&
    !loc.pathname.startsWith("/onboarding")
  ) {
    return <Navigate to="/onboarding/empresa" replace />;
  }
  return <Outlet />;
}