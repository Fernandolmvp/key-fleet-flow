import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PermModule =
  | "vehicles" | "drivers" | "fuel" | "approvals" | "maintenance"
  | "tires" | "checklists" | "documents" | "insurance" | "brokers"
  | "fuel_stations" | "reports" | "settings";

export type PermAction = "view" | "create" | "edit" | "delete" | "approve" | "export";

export type AppRole =
  | "admin" | "gestor_frota" | "financeiro" | "manutencao"
  | "auditor" | "visualizador" | "motorista";

export const ALL_ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: "admin", label: "Administrador", description: "Acesso total à empresa" },
  { value: "gestor_frota", label: "Gestor de Frota", description: "Operação de frota" },
  { value: "financeiro", label: "Financeiro", description: "Custos, seguros, relatórios" },
  { value: "manutencao", label: "Manutenção", description: "Manutenção, pneus, checklists" },
  { value: "auditor", label: "Auditor", description: "Somente leitura + exportar" },
  { value: "visualizador", label: "Visualizador", description: "Somente leitura" },
  { value: "motorista", label: "Motorista", description: "Acessa apenas o app do motorista" },
];

export const ALL_MODULES: { value: PermModule; label: string }[] = [
  { value: "vehicles", label: "Veículos" },
  { value: "drivers", label: "Motoristas" },
  { value: "fuel", label: "Abastecimentos" },
  { value: "approvals", label: "Aprovações" },
  { value: "maintenance", label: "Manutenção" },
  { value: "tires", label: "Pneus" },
  { value: "checklists", label: "Checklists" },
  { value: "documents", label: "Documentação" },
  { value: "insurance", label: "Seguros" },
  { value: "brokers", label: "Corretores" },
  { value: "fuel_stations", label: "Postos" },
  { value: "reports", label: "Relatórios" },
  { value: "settings", label: "Configurações" },
];

export const ALL_ACTIONS: { value: PermAction; label: string }[] = [
  { value: "view", label: "Visualizar" },
  { value: "create", label: "Criar" },
  { value: "edit", label: "Editar" },
  { value: "delete", label: "Excluir" },
  { value: "approve", label: "Aprovar" },
  { value: "export", label: "Exportar" },
];

/**
 * Hook de permissões granulares para a empresa atual.
 * Admin sempre retorna true. Demais perfis são checados na tabela role_permissions.
 */
export function usePermissions() {
  const { currentCompanyId, roles } = useAuth();
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const isAdmin = roles.includes("admin");

  useEffect(() => {
    if (!currentCompanyId || roles.length === 0) {
      setPerms(new Set());
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("role_permissions")
        .select("module, action, allowed, role")
        .eq("company_id", currentCompanyId)
        .in("role", roles as any)
        .eq("allowed", true);
      const set = new Set<string>();
      (data ?? []).forEach((p: any) => set.add(`${p.module}:${p.action}`));
      setPerms(set);
      setLoading(false);
    })();
  }, [currentCompanyId, roles.join(",")]);

  const can = (module: PermModule, action: PermAction): boolean => {
    if (isAdmin) return true;
    return perms.has(`${module}:${action}`);
  };

  return { can, loading, isAdmin };
}