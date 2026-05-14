import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions, type PermModule } from "@/lib/permissions";
import {
  LayoutDashboard, Truck, Users, Wrench, Fuel, FileText, AlertTriangle,
  CircleDot, Receipt, BarChart3, Settings, LogOut, ChevronDown, ChevronRight, Building2, Loader2, ShieldCheck, Store, ClipboardCheck, CreditCard, Briefcase, ClipboardList, Database, Activity, UserCheck, CarFront, Package
} from "lucide-react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { NewCompanyDialog } from "@/components/NewCompanyDialog";

type NavItem = { to: string; label: string; icon: any; end?: boolean; badgeKey?: string; soon?: boolean; module?: PermModule; isNew?: boolean };
type NavGroup = { type: "group"; key: string; label: string; icon: any; items: NavItem[] };
type NavEntry = NavItem | NavGroup;

const nav: NavEntry[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  {
    type: "group", key: "cadastros", label: "Cadastros", icon: Database,
    items: [
      { to: "/app/vehicles", label: "Veículos", icon: Truck, module: "vehicles" },
      { to: "/app/drivers", label: "Motoristas", icon: Users, module: "drivers" },
      { to: "/app/fuel-stations", label: "Postos", icon: Store, module: "fuel_stations" },
      { to: "/app/workshops", label: "Oficinas", icon: Wrench, module: "workshops", isNew: true },
      { to: "/app/suppliers", label: "Fornecedores", icon: Package, module: "suppliers", isNew: true },
      { to: "/app/brokers", label: "Corretores", icon: Briefcase, module: "brokers" },
    ],
  },
  {
    type: "group", key: "movimentacao", label: "Movimentação", icon: Activity,
    items: [
      { to: "/app/fuel", label: "Abastecimentos", icon: Fuel, module: "fuel" },
      { to: "/app/approvals", label: "Aprovações", icon: ClipboardCheck, badgeKey: "approvals", module: "approvals" },
      { to: "/app/maintenance", label: "Manutenção", icon: Wrench, module: "maintenance" },
      { to: "/app/sinistros", label: "Sinistros", icon: CarFront, soon: true },
      { to: "/app/despesas", label: "Despesas", icon: Receipt, soon: true },
      { to: "/app/multas", label: "Multas", icon: AlertTriangle },
      { to: "/app/checklists", label: "Checklists", icon: ClipboardList, module: "checklists" },
      { to: "/app/tires", label: "Pneus", icon: CircleDot, module: "tires" },
      { to: "/app/documents", label: "Documentação", icon: FileText, badgeKey: "documents", module: "documents" },
      { to: "/app/insurance", label: "Seguros", icon: ShieldCheck, badgeKey: "insurance", module: "insurance" },
    ],
  },
  { to: "/app/assinatura", label: "Assinatura", icon: CreditCard },
  { to: "/app/configuracoes", label: "Configurações da Empresa", icon: Settings, module: "settings" },
  { to: "/app/alerts", label: "Alertas", icon: AlertTriangle, soon: true },
  { to: "/app/reports", label: "Relatórios", icon: BarChart3, soon: true, module: "reports" },
];

function isGroup(e: NavEntry): e is NavGroup {
  return (e as NavGroup).type === "group";
}

export default function AppLayout() {
  const { user, loading, companies, currentCompanyId, setCurrentCompany, signOut, isDriverOnly, isSuperAdmin, roles } = useAuth();
  const { can, isAdmin, loading: permsLoading } = usePermissions();
  const loc = useLocation();
  const [docPending, setDocPending] = useState(0);
  const [approvalPending, setApprovalPending] = useState(0);
  const [insurancePending, setInsurancePending] = useState(0);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ cadastros: true, movimentacao: true });
  const [showNewCompany, setShowNewCompany] = useState(false);

  useEffect(() => {
    if (!currentCompanyId) return;
    (async () => {
      const { count } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("company_id", currentCompanyId)
        .in("status", ["vencido", "vencendo"]);
      setDocPending(count || 0);
    })();
    (async () => {
      const { count } = await supabase
        .from("fuel_authorizations")
        .select("id", { count: "exact", head: true })
        .eq("company_id", currentCompanyId)
        .eq("status", "pendente");
      setApprovalPending(count || 0);
    })();
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const [expiring, expired, vehiclesRes, linksRes, policiesRes] = await Promise.all([
        supabase.from("insurance_policies").select("id", { count: "exact", head: true })
          .eq("company_id", currentCompanyId).eq("status", "ativa")
          .gte("end_date", today).lte("end_date", in30),
        supabase.from("insurance_policies").select("id", { count: "exact", head: true })
          .eq("company_id", currentCompanyId).eq("status", "ativa").lt("end_date", today),
        supabase.from("vehicles").select("id").eq("company_id", currentCompanyId).eq("status", "ativo"),
        supabase.from("insurance_policy_vehicles").select("vehicle_id,policy_id")
          .eq("company_id", currentCompanyId).is("removed_at", null),
        supabase.from("insurance_policies").select("id").eq("company_id", currentCompanyId).eq("status", "ativa"),
      ]);
      const activePolicyIds = new Set(((policiesRes.data as any[]) || []).map((p) => p.id));
      const coveredIds = new Set(
        ((linksRes.data as any[]) || []).filter((l) => activePolicyIds.has(l.policy_id)).map((l) => l.vehicle_id)
      );
      const uncovered = ((vehiclesRes.data as any[]) || []).filter((v) => !coveredIds.has(v.id)).length;
      setInsurancePending((expiring.count || 0) + (expired.count || 0) + uncovered);
    })();
  }, [currentCompanyId, loc.pathname]);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const e of nav) {
        if (isGroup(e) && e.items.some((it) => loc.pathname.startsWith(it.to))) {
          next[e.key] = true;
        }
      }
      return next;
    });
  }, [loc.pathname]);

  if (loading) return (
    <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  );
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;

  // Motorista (sem cargo de gestão) usa interface dedicada mobile, fora do AppLayout
  if (isDriverOnly) {
    return <Navigate to="/motorista" replace />;
  }

  const currentCompany = companies.find((c) => c.id === currentCompanyId) ?? null;
  const headerCompanyLabel =
    currentCompany?.name ??
    (companies.length === 0
      ? "Nenhuma empresa"
      : currentCompanyId
        ? "Carregando empresa…"
        : "Selecionar empresa");
  const hasDriverRole = roles.includes("motorista");

  // Filtra a sidebar por permissão de visualizar do módulo. Itens sem `module`
  // (Dashboard, Assinatura, "soon") aparecem para todos os perfis de gestão.
  const filterByPerm = (entries: NavEntry[]): NavEntry[] => {
    const out: NavEntry[] = [];
    for (const e of entries) {
      if (isGroup(e)) {
        const items = e.items.filter((it) => !it.module || can(it.module, "view"));
        if (items.length > 0) out.push({ ...e, items });
      } else if (!e.module || can(e.module, "view")) {
        out.push(e);
      }
    }
    return out;
  };

  const visibleNav: NavEntry[] = isDriverOnly
    ? [{ to: "/app/colaborador", label: "Abastecimento", icon: ShieldCheck }]
    : permsLoading
      ? nav
      : filterByPerm(nav);

  const renderItem = (it: NavItem, opts: { indent?: boolean; primary?: boolean } = {}) => {
    const { indent = false, primary = false } = opts;
    return (
      <NavLink
        key={it.to}
        to={it.to}
        end={it.end}
        className={({ isActive }) => cn(
          "group flex items-center gap-3 rounded-lg transition-all",
          primary
            ? "px-2.5 py-2.5 text-[13px] font-semibold tracking-wide uppercase"
            : "px-3 py-2 text-sm",
          indent && "ml-4 pl-3 border-l border-sidebar-border/60",
          isActive
            ? primary
              ? "bg-gradient-to-r from-primary/15 to-transparent text-sidebar-accent-foreground border border-primary/40 shadow-glow"
              : "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
            : primary
              ? "text-sidebar-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground border border-transparent"
              : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        )}
      >
        <span className={cn(
          "grid place-items-center rounded-md transition-colors shrink-0",
          primary ? "h-7 w-7 bg-primary/10 text-primary group-hover:bg-primary/20" : ""
        )}>
          <it.icon className={cn(primary ? "h-4 w-4" : "h-4 w-4")} />
        </span>
        <span className="flex-1">{it.label}</span>
        {it.badgeKey === "documents" && docPending > 0 && (
          <span className="text-[10px] font-mono bg-destructive/20 text-destructive border border-destructive/40 px-1.5 py-0.5 rounded">
            {docPending}
          </span>
        )}
        {it.badgeKey === "insurance" && insurancePending > 0 && (
          <span className="text-[10px] font-mono bg-destructive/20 text-destructive border border-destructive/40 px-1.5 py-0.5 rounded">
            {insurancePending > 99 ? "99+" : insurancePending}
          </span>
        )}
        {it.badgeKey === "approvals" && approvalPending > 0 && (
          <span className="text-[10px] font-mono bg-warning/20 text-warning border border-warning/40 px-1.5 py-0.5 rounded">
            {approvalPending}
          </span>
        )}
        {it.soon && <span className="text-[9px] uppercase font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">soon</span>}
        {it.isNew && <span className="text-[9px] uppercase font-mono text-primary bg-primary/15 border border-primary/30 px-1.5 py-0.5 rounded">novo</span>}
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-bold tracking-tight">FrotaOps</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Fleet Intelligence</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleNav.map((entry) => {
            if (!isGroup(entry)) return renderItem(entry, { primary: true });
            const open = !!openGroups[entry.key];
            const Icon = entry.icon;
            const pendingCount =
              (entry.items.some((i) => i.badgeKey === "approvals") ? approvalPending : 0) +
              (entry.items.some((i) => i.badgeKey === "documents") ? docPending : 0) +
              (entry.items.some((i) => i.badgeKey === "insurance") ? insurancePending : 0);
            const groupActive = entry.items.some((it) => loc.pathname.startsWith(it.to));
            return (
              <div key={entry.key} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setOpenGroups((p) => ({ ...p, [entry.key]: !open }))}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-all",
                    groupActive
                      ? "bg-gradient-to-r from-primary/15 to-transparent text-sidebar-accent-foreground border border-primary/40 shadow-glow"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground border border-transparent"
                  )}
                >
                  <span className="grid place-items-center rounded-md h-7 w-7 bg-primary/10 text-primary shrink-0">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-left font-semibold tracking-wide uppercase text-[13px]">{entry.label}</span>
                  {!open && pendingCount > 0 && (
                    <span className="text-[10px] font-mono bg-warning/20 text-warning border border-warning/40 px-1.5 py-0.5 rounded">
                      {pendingCount}
                    </span>
                  )}
                  {open
                    ? <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    : <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                </button>
                {open && (
                  <div className="space-y-0.5 pt-0.5">
                    {entry.items.map((it) => renderItem(it, { indent: true }))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="surface-card rounded-lg p-3 text-xs text-muted-foreground">
            <div className="font-mono text-primary">v1.0 · MVP</div>
            <div className="mt-1">Fase 1 ativa. Mais módulos em construção.</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-background-elevated/50 backdrop-blur flex items-center justify-between px-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 -ml-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-medium">{headerCompanyLabel}</span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>
                Empresas {companies.length > 0 && `(${companies.length})`}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {companies.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() => setCurrentCompany(c.id)}
                  className={c.id === currentCompanyId ? "bg-primary/10 text-primary" : ""}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.id === currentCompanyId && (
                    <span className="text-[10px] uppercase tracking-wider text-primary">atual</span>
                  )}
                </DropdownMenuItem>
              ))}
              {!companies.length && (
                <DropdownMenuItem disabled>Nenhuma empresa cadastrada</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowNewCompany(true)} className="text-primary">
                <Plus className="h-4 w-4 mr-2" /> Nova empresa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-primary grid place-items-center text-primary-foreground text-xs font-semibold">
                  {user.email?.[0].toUpperCase()}
                </div>
                <span className="text-sm hidden md:inline">{user.email}</span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isSuperAdmin && (
                <DropdownMenuItem onClick={() => window.location.href = "/super-admin"}>
                  <ShieldCheck className="h-4 w-4 mr-2" /> Painel Super Admin
                </DropdownMenuItem>
              )}
              {hasDriverRole && (
                <DropdownMenuItem onClick={() => window.location.href = "/motorista"}>
                  <UserCheck className="h-4 w-4 mr-2" /> Modo Motorista
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <PaymentTestModeBanner />
        <SubscriptionBanner />
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          <Outlet />
        </main>
        <NewCompanyDialog
          open={showNewCompany}
          onClose={() => setShowNewCompany(false)}
          alreadyHasCompany={companies.length > 0}
        />
      </div>
    </div>
  );
}
