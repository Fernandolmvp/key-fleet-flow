import { useAuth } from "@/contexts/AuthContext";
import MembersTab from "./configuracoes/MembersTab";
import { Users } from "lucide-react";

export default function Equipe() {
  const { currentCompanyId } = useAuth();

  if (!currentCompanyId) {
    return (
      <div className="surface-card rounded-xl p-8 text-center">
        <p className="text-muted-foreground">Selecione uma empresa para acessar a equipe.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
          <Users className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Equipe</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie membros e convide colaboradores.
          </p>
        </div>
      </div>
      <MembersTab companyId={currentCompanyId} />
    </div>
  );
}
