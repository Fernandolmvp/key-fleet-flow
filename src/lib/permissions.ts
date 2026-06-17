import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PermModule =
  | "vehicles" | "drivers" | "fuel" | "approvals" | "maintenance"
  | "tires" | "checklists" | "documents" | "insurance" | "brokers"
  | "fuel_stations" | "workshops" | "suppliers" | "reports" | "settings";

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
  { value: "workshops", label: "Oficinas" },
  { value: "suppliers", label: "Fornecedores" },
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
 * Mapa de abas (sub-seções) por módulo. Quando definido, a tela de permissões
 * permite refinar quem acessa cada aba. A ausência aqui significa que o módulo
 * não tem abas controláveis.
 */
export const MODULE_TABS: Partial<Record<PermModule, { value: string; label: string }[]>> = {
  vehicles: [
    { value: "ativos", label: "Ativos" },
    { value: "vendidos", label: "Vendidos" },
    { value: "inativos", label: "Inativos" },
    { value: "todos", label: "Todos" },
  ],
  drivers: [
    { value: "ativos", label: "Ativos" },
    { value: "inativos", label: "Inativos" },
    { value: "todos", label: "Todos" },
  ],
  approvals: [
    { value: "pendente", label: "Pendentes" },
    { value: "aprovada", label: "Aprovadas" },
    { value: "anomalia", label: "Anomalias" },
    { value: "historico", label: "Histórico" },
  ],
  maintenance: [
    { value: "situacao", label: "Situação da frota" },
    { value: "agenda", label: "Agenda" },
    { value: "historico", label: "Histórico & Custos" },
    { value: "preventivo", label: "Calendário Preventivo" },
  ],
  tires: [
    { value: "list", label: "Pneus" },
    { value: "map", label: "Mapa do veículo" },
    { value: "movements", label: "Movimentações" },
    { value: "alerts", label: "Alertas" },
  ],
  checklists: [
    { value: "pendentes", label: "Pendentes" },
    { value: "historico", label: "Histórico" },
    { value: "modelos", label: "Modelos" },
  ],
  documents: [
    { value: "vehicles", label: "Veículos" },
    { value: "drivers", label: "Motoristas" },
  ],
  fuel_stations: [
    { value: "ativos", label: "Ativos" },
    { value: "inativos", label: "Inativos" },
    { value: "todos", label: "Todos" },
  ],
};

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
        .select("module, action, allowed, role, tab")
        .eq("company_id", currentCompanyId)
        .in("role", roles as any)
        .eq("allowed", true);
      const set = new Set<string>();
      (data ?? []).forEach((p: any) => {
        // Regra a nível de módulo
        if (!p.tab) set.add(`${p.module}:${p.action}`);
        // Regra a nível de aba específica
        else set.add(`${p.module}:${p.action}:${p.tab}`);
      });
      setPerms(set);
      setLoading(false);
    })();
  }, [currentCompanyId, roles.join(",")]);

  const can = (module: PermModule, action: PermAction, tab?: string): boolean => {
    if (isAdmin) return true;
    // Se uma aba foi pedida e existe regra específica, ela prevalece;
    // caso contrário, cai no nível de módulo.
    if (tab && perms.has(`${module}:${action}:${tab}`)) return true;
    return perms.has(`${module}:${action}`);
  };

  return { can, loading, isAdmin };
}

/**
 * Helper para filtrar e auto-selecionar abas com base nas permissões do
 * usuário corrente. Recebe a lista de abas do módulo e devolve apenas as
 * abas visíveis. Caso a aba atual não esteja visível, devolve também a
 * primeira aba liberada para que a página possa redirecionar.
 */
export function useTabPermissions(
  module: PermModule,
  allTabs: string[],
  currentTab: string,
) {
  const { can } = usePermissions();
  const visible = allTabs.filter((t) => can(module, "view", t));
  const isVisible = visible.includes(currentTab);
  const fallback = visible[0] ?? null;
  const canViewTab = (t: string) => can(module, "view", t);
  return { visible, isVisible, fallback, canViewTab };
}