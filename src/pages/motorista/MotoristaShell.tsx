import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import Colaborador from "@/pages/app/Colaborador";

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

  // Precisa ter o papel de motorista para acessar este painel
  if (!roles.includes("motorista")) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen bg-background">
      <main className="px-4 py-4">
        <Colaborador />
      </main>
    </div>
  );
}