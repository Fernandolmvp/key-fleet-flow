import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, ArrowLeft, Loader2, Building2, Brain, Cpu, Workflow, BarChart3, Ticket, PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Saas",
    items: [
      { to: "/super-admin", icon: Building2, label: "Empresas", end: true },
      { to: "/super-admin/empresas/nova", icon: PlusCircle, label: "Criar empresa" },
      { to: "/super-admin/cupons", icon: Ticket, label: "Cupons" },
    ],
  },
  {
    label: "Inteligência Artificial",
    items: [
      { to: "/super-admin/ai/providers", icon: Brain, label: "Provedores" },
      { to: "/super-admin/ai/models", icon: Cpu, label: "Modelos" },
      { to: "/super-admin/ai/routing", icon: Workflow, label: "Roteamento" },
      { to: "/super-admin/ai/usage", icon: BarChart3, label: "Uso & Logs" },
    ],
  },
];

export default function SuperAdminShell() {
  const { user, loading: authLoading, isSuperAdmin, signOut } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/super-admin/ativar" replace />;

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 shrink-0 border-r border-border bg-background-elevated/40 hidden md:flex flex-col">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-border">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <div className="font-display font-bold leading-none">Super Admin</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">SaaS Control</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 space-y-6">
          {navGroups.map((g) => (
            <div key={g.label}>
              <div className="px-5 text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                {g.label}
              </div>
              <ul className="space-y-0.5 px-2">
                {g.items.map((it) => {
                  const active = it.end
                    ? location.pathname === it.to
                    : location.pathname.startsWith(it.to);
                  return (
                    <li key={it.to}>
                      <NavLink
                        to={it.to}
                        end={it.end}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                          active
                            ? "bg-primary/15 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                        )}
                      >
                        <it.icon className="h-4 w-4" />
                        {it.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-3 space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => (window.location.href = "/app")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao app
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="md:hidden h-14 border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-display font-bold text-sm">Super Admin</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => (window.location.href = "/app")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden border-b border-border overflow-x-auto">
          <div className="flex gap-1 p-2 min-w-max">
            {navGroups.flatMap((g) =>
              g.items.map((it) => {
                const active = it.end
                  ? location.pathname === it.to
                  : location.pathname.startsWith(it.to);
                return (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.end}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
                      active
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    <it.icon className="h-3.5 w-3.5" />
                    {it.label}
                  </NavLink>
                );
              }),
            )}
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}