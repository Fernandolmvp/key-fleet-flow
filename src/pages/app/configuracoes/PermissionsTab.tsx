import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ALL_ROLES, ALL_MODULES, ALL_ACTIONS, MODULE_TABS, type AppRole, type PermAction, type PermModule } from "@/lib/permissions";

type Row = { role: AppRole; module: PermModule; action: PermAction; allowed: boolean; tab: string | null };

export default function PermissionsTab({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeRole, setActiveRole] = useState<AppRole>("gestor_frota");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("role_permissions")
      .select("role, module, action, allowed, tab")
      .eq("company_id", companyId);
    setRows(((data ?? []) as any[]).map((r) => ({ ...r, tab: r.tab ?? null })) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [companyId]);

  const map = useMemo(() => {
    const m = new Map<string, boolean>();
    rows.forEach((r) => m.set(`${r.role}:${r.module}:${r.action}:${r.tab ?? "_"}`, r.allowed));
    return m;
  }, [rows]);

  const toggle = (role: AppRole, module: PermModule, action: PermAction, tab: string | null = null) => {
    const key = `${role}:${module}:${action}:${tab ?? "_"}`;
    const cur = map.get(key) ?? false;
    const idx = rows.findIndex((r) => r.role === role && r.module === module && r.action === action && (r.tab ?? null) === tab);
    const next: Row = { role, module, action, allowed: !cur, tab };
    if (idx >= 0) {
      const copy = [...rows]; copy[idx] = next; setRows(copy);
    } else {
      setRows([...rows, next]);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      // Separa regras de módulo (tab=null) e de aba para tratar com índices únicos parciais.
      const moduleRows = rows.filter((r) => r.tab == null).map((r) => ({
        company_id: companyId, role: r.role, module: r.module, action: r.action, allowed: r.allowed, tab: null,
      }));
      const tabRows = rows.filter((r) => r.tab != null).map((r) => ({
        company_id: companyId, role: r.role, module: r.module, action: r.action, allowed: r.allowed, tab: r.tab,
      }));

      // Limpa regras de aba existentes para esta empresa e regrava (mais simples
      // que upsert composto, dado o índice único parcial).
      const { error: delErr } = await supabase
        .from("role_permissions")
        .delete()
        .eq("company_id", companyId)
        .not("tab", "is", null);
      if (delErr) throw delErr;

      if (moduleRows.length) {
        const { error } = await supabase
          .from("role_permissions")
          .upsert(moduleRows as any, { onConflict: "company_id,role,module,action" });
        if (error) throw error;
      }
      if (tabRows.length) {
        const { error } = await supabase.from("role_permissions").insert(tabRows as any);
        if (error) throw error;
      }
      toast.success("Permissões salvas");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const restoreDefaults = async () => {
    if (!confirm("Restaurar as permissões padrão para todos os perfis desta empresa?")) return;
    setSaving(true);
    try {
      await supabase.from("role_permissions").delete().eq("company_id", companyId);
      const { error } = await supabase.rpc("seed_default_role_permissions" as any, { _company_id: companyId });
      if (error) throw error;
      toast.success("Permissões padrão restauradas");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao restaurar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const editableRoles = ALL_ROLES.filter((r) => r.value !== "admin" && r.value !== "motorista");

  return (
    <div className="space-y-4">
      <div className="surface-card rounded-xl p-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-display font-semibold">Permissões por perfil</h3>
          <p className="text-xs text-muted-foreground max-w-2xl">
            A coluna <strong>Visualizar</strong> controla se o perfil enxerga o módulo (e o ícone na barra lateral).{" "}
            Clique no <ChevronRight className="inline h-3 w-3" /> ao lado de um módulo para liberar/bloquear cada <strong>aba</strong> de forma independente.{" "}
            <strong>Administrador</strong> sempre tem acesso total. <strong>Motorista</strong> usa apenas o app do motorista.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={restoreDefaults} disabled={saving} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Restaurar padrões
          </Button>
          <Button size="sm" onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar alterações
          </Button>
        </div>
      </div>

      <Tabs value={activeRole} onValueChange={(v) => setActiveRole(v as AppRole)}>
        <TabsList className="flex-wrap h-auto">
          {editableRoles.map((r) => (
            <TabsTrigger key={r.value} value={r.value}>{r.label}</TabsTrigger>
          ))}
        </TabsList>
        {editableRoles.map((r) => (
          <TabsContent key={r.value} value={r.value}>
            <div className="surface-card rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background-elevated/40">
                    <th className="text-left p-3 font-medium">Módulo</th>
                    {ALL_ACTIONS.map((a) => (
                      <th key={a.value} className="text-center p-3 font-medium">{a.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALL_MODULES.map((m) => {
                    const tabs = MODULE_TABS[m.value] ?? [];
                    const expKey = `${r.value}:${m.value}`;
                    const isExp = !!expanded[expKey];
                    return (
                      <FragmentRow
                        key={m.value}
                        moduleLabel={m.label}
                        moduleValue={m.value}
                        role={r.value}
                        tabs={tabs}
                        expanded={isExp}
                        onToggleExpand={() => setExpanded((p) => ({ ...p, [expKey]: !isExp }))}
                        map={map}
                        onToggle={toggle}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function FragmentRow({
  moduleLabel, moduleValue, role, tabs, expanded, onToggleExpand, map, onToggle,
}: {
  moduleLabel: string;
  moduleValue: PermModule;
  role: AppRole;
  tabs: { value: string; label: string }[];
  expanded: boolean;
  onToggleExpand: () => void;
  map: Map<string, boolean>;
  onToggle: (role: AppRole, module: PermModule, action: PermAction, tab?: string | null) => void;
}) {
  const hasTabs = tabs.length > 0;
  return (
    <>
      <tr className="border-b border-border/60 hover:bg-muted/10">
        <td className="p-3 font-medium">
          <div className="flex items-center gap-2">
            {hasTabs ? (
              <button type="button" onClick={onToggleExpand} className="text-muted-foreground hover:text-foreground">
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="inline-block w-4" />
            )}
            <span>{moduleLabel}</span>
            {hasTabs && <span className="text-[10px] text-muted-foreground">({tabs.length} abas)</span>}
          </div>
        </td>
        {ALL_ACTIONS.map((a) => {
          const checked = map.get(`${role}:${moduleValue}:${a.value}:_`) ?? false;
          return (
            <td key={a.value} className="p-3 text-center">
              <Checkbox
                checked={checked}
                onCheckedChange={() => onToggle(role, moduleValue, a.value, null)}
              />
            </td>
          );
        })}
      </tr>
      {expanded && hasTabs && tabs.map((t) => (
        <tr key={t.value} className="border-b border-border/40 bg-muted/5">
          <td className="p-2 pl-12 text-xs text-muted-foreground">
            ↳ {t.label}
          </td>
          {ALL_ACTIONS.map((a) => {
            const tabChecked = map.get(`${role}:${moduleValue}:${a.value}:${t.value}`) ?? false;
            return (
              <td key={a.value} className="p-2 text-center">
                <Checkbox
                  checked={tabChecked}
                  onCheckedChange={() => onToggle(role, moduleValue, a.value, t.value)}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}