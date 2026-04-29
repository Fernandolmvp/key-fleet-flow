import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Truck, Users, Wrench, Fuel, FileText, AlertTriangle,
  CircleDot, Receipt, BarChart3, Settings, LogOut, ChevronDown, Building2, Loader2, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/vehicles", label: "Veículos", icon: Truck },
  { to: "/app/drivers", label: "Motoristas", icon: Users },
  { to: "/app/fuel", label: "Abastecimentos", icon: Fuel },
  { to: "/app/maintenance", label: "Manutenção", icon: Wrench },
  { to: "/app/tires", label: "Pneus", icon: CircleDot },
  { to: "/app/documents", label: "Documentação", icon: FileText, badgeKey: "documents" },
  { to: "/app/fines", label: "Multas", icon: Receipt, soon: true },
  { to: "/app/alerts", label: "Alertas", icon: AlertTriangle, soon: true },
  { to: "/app/reports", label: "Relatórios", icon: BarChart3, soon: true },
  { to: "/app/settings", label: "Configurações", icon: Settings, soon: true },
];

export default function AppLayout() {
  const { user, loading, companies, currentCompanyId, setCurrentCompany, signOut, isDriverOnly } = useAuth();
  const loc = useLocation();
  const [docPending, setDocPending] = useState(0);

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
  }, [currentCompanyId, loc.pathname]);

  if (loading) return (
    <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  );
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;

  // Motorista (sem cargo de gestão) só acessa /app/colaborador
  if (isDriverOnly && loc.pathname !== "/app/colaborador") {
    return <Navigate to="/app/colaborador" replace />;
  }

  const currentCompany = companies.find((c) => c.id === currentCompanyId);
  const visibleNav = isDriverOnly
    ? [{ to: "/app/colaborador", label: "Abastecimento", icon: ShieldCheck }]
    : nav;

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
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {visibleNav.map((it: any) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) => cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <it.icon className="h-4 w-4" />
              <span className="flex-1">{it.label}</span>
              {it.badgeKey === "documents" && docPending > 0 && (
                <span className="text-[10px] font-mono bg-destructive/20 text-destructive border border-destructive/40 px-1.5 py-0.5 rounded">
                  {docPending}
                </span>
              )}
              {it.soon && <span className="text-[9px] uppercase font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">soon</span>}
            </NavLink>
          ))}
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
                <span className="font-medium">{currentCompany?.name ?? "Selecionar empresa"}</span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Empresas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {companies.map((c) => (
                <DropdownMenuItem key={c.id} onClick={() => setCurrentCompany(c.id)}>
                  <Building2 className="h-4 w-4 mr-2" />{c.name}
                </DropdownMenuItem>
              ))}
              {!companies.length && <DropdownMenuItem disabled>Nenhuma empresa</DropdownMenuItem>}
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
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
