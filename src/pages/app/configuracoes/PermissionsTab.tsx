import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ALL_ROLES, ALL_MODULES, ALL_ACTIONS, type AppRole, type PermAction, type PermModule } from "@/lib/permissions";

type Row = { role: AppRole; module: PermModule; action: PermAction; allowed: boolean };

export default function PermissionsTab({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeRole, setActiveRole] = useState<AppRole>("gestor_frota");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("role_permissions")
      .select("role, module, action, allowed")
      .eq("company_id", companyId);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [companyId]);

  const map = useMemo(() => {
    const m = new Map<string, boolean>();
    rows.forEach((r) => m.set(`${r.role}:${r.module}:${r.action}`, r.allowed));
    return m;
  }, [rows]);

  const toggle = (role: AppRole, module: PermModule, action: PermAction) => {
    const key = `${role}:${module}:${action}`;
    const cur = map.get(key) ?? false;
    const idx = rows.findIndex((r) => r.role === role && r.module === module && r.action === action);
    const next: Row = { role, module, action, allowed: !cur };
    if (idx >= 0) {
      const copy = [...rows]; copy[idx] = next; setRows(copy);
    } else {
      setRows([...rows, next]);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = rows.map((r) => ({
        company_id: companyId, role: r.role, module: r.module, action: r.action, allowed: r.allowed,
      }));
      const { error } = await supabase
        .from("role_permissions")
        .upsert(payload as any, { onConflict: "company_id,role,module,action" });
      if (error) throw error;
      toast.success("Permissões salvas");
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
      // chamada à função SQL via RPC requer expor; como alternativa, deletamos e recriamos via INSERT default no client
      // mais simples: deletar e chamar função via RPC se exposta. Aqui usamos SQL via .rpc não disponível; então deletamos e recarregamos do servidor (a função seed_default só popula o que falta).
      await supabase.from("role_permissions").delete().eq("company_id", companyId);
      // Re-seed via re-insert dos defaults conhecidos no client
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
            <strong>Administrador</strong> sempre tem acesso total e não pode ser editado.{" "}
            <strong>Motorista</strong> usa apenas o app do motorista e também não é editável aqui.
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
                  {ALL_MODULES.map((m) => (
                    <tr key={m.value} className="border-b border-border/60">
                      <td className="p-3 font-medium">{m.label}</td>
                      {ALL_ACTIONS.map((a) => {
                        const checked = map.get(`${r.value}:${m.value}:${a.value}`) ?? false;
                        return (
                          <td key={a.value} className="p-3 text-center">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggle(r.value, m.value, a.value)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}