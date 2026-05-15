import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import Colaborador from "@/pages/app/Colaborador";
import { Route as RouteIcon } from "lucide-react";

export default function MotoristaShell() {
  const { user, loading, roles } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;

  // Permite motoristas, admins e gestores acessarem o modo motorista
  const allowed =
    roles.includes("motorista") ||
    roles.includes("admin") ||
    roles.includes("gestor_frota");
  if (!allowed) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen bg-background">
      <main className="px-4 py-4">
        <Link to="/motorista/viagens" className="surface-card rounded-xl p-3 mb-4 flex items-center gap-3 hover:border-primary/50 transition-all">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <RouteIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Minhas viagens</div>
            <div className="text-xs text-muted-foreground">Adiantamentos, despesas e acerto</div>
          </div>
        </Link>
        <Colaborador />
      </main>
    </div>
  );
}