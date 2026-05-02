import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ALL_ROLES, type AppRole } from "@/lib/permissions";
import { useAuth } from "@/contexts/AuthContext";

type Member = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  roles: AppRole[];
};

export default function MembersTab({ companyId }: { companyId: string }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingFor, setSavingFor] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: cm } = await supabase
      .from("company_members")
      .select("user_id")
      .eq("company_id", companyId);
    const userIds = (cm ?? []).map((m: any) => m.user_id);
    if (userIds.length === 0) {
      setMembers([]); setLoading(false); return;
    }
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").in("id", userIds),
      supabase.from("user_roles").select("user_id, role").eq("company_id", companyId).in("user_id", userIds),
    ]);
    const byUser: Record<string, Member> = {};
    userIds.forEach((uid) => {
      const p = profiles?.find((x: any) => x.id === uid);
      byUser[uid] = { user_id: uid, email: (p as any)?.email ?? null, full_name: p?.full_name ?? null, roles: [] };
    });
    (roles ?? []).forEach((r: any) => {
      if (byUser[r.user_id]) byUser[r.user_id].roles.push(r.role as AppRole);
    });
    setMembers(Object.values(byUser));
    setLoading(false);
  };

  useEffect(() => { load(); }, [companyId]);

  const setPrimaryRole = async (userId: string, newRole: AppRole) => {
    setSavingFor(userId);
    try {
      // Remove todos os perfis atuais e insere o novo (modelo simples: 1 perfil principal por usuário/empresa)
      await supabase.from("user_roles").delete().eq("company_id", companyId).eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({
        company_id: companyId, user_id: userId, role: newRole,
      } as any);
      if (error) throw error;
      toast.success("Perfil atualizado");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao atualizar perfil");
    } finally {
      setSavingFor(null);
    }
  };

  const removeMember = async (userId: string) => {
    if (userId === user?.id) {
      toast.error("Você não pode remover a si mesmo.");
      return;
    }
    if (!confirm("Remover este membro da empresa?")) return;
    try {
      await supabase.from("user_roles").delete().eq("company_id", companyId).eq("user_id", userId);
      const { error } = await supabase.from("company_members").delete()
        .eq("company_id", companyId).eq("user_id", userId);
      if (error) throw error;
      toast.success("Membro removido");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao remover");
    }
  };

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="surface-card rounded-xl p-4 flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold">Membros da empresa</h3>
          <p className="text-xs text-muted-foreground">Defina o perfil de acesso de cada usuário.</p>
        </div>
        <Button variant="outline" size="sm" disabled className="gap-2">
          <UserPlus className="h-4 w-4" /> Convidar (em breve)
        </Button>
      </div>

      <div className="surface-card rounded-xl divide-y divide-border">
        {members.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground text-center">Nenhum membro encontrado.</div>
        )}
        {members.map((m) => {
          const primary = m.roles[0] ?? null;
          const isSelf = m.user_id === user?.id;
          return (
            <div key={m.user_id} className="p-4 flex items-center gap-4">
              <div className="h-9 w-9 rounded-full bg-gradient-primary grid place-items-center text-primary-foreground text-xs font-semibold">
                {(m.full_name ?? "?")[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-2">
                  {m.full_name ?? "(sem nome)"}
                  {isSelf && <Badge variant="secondary" className="text-[10px]">você</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{m.email ?? m.user_id}</div>
              </div>
              <div className="w-56">
                <Select
                  value={primary ?? undefined}
                  onValueChange={(v) => setPrimaryRole(m.user_id, v as AppRole)}
                  disabled={savingFor === m.user_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <div className="flex flex-col">
                          <span>{r.label}</span>
                          <span className="text-[10px] text-muted-foreground">{r.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost" size="icon"
                onClick={() => removeMember(m.user_id)}
                disabled={isSelf}
                title={isSelf ? "Você não pode remover a si mesmo" : "Remover"}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Motoristas têm acesso apenas ao app dedicado em <code>/motorista</code>. Ninguém da empresa
        tem acesso ao Super Admin Master.
      </p>
    </div>
  );
}