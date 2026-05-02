import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Crown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ALL_ROLES, type AppRole } from "@/lib/permissions";

type Member = {
  user_id: string;
  full_name: string | null;
  roles: AppRole[];
};

export default function CompanyMembersDialog({
  companyId,
  companyName,
  onClose,
}: {
  companyId: string | null;
  companyName: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingFor, setSavingFor] = useState<string | null>(null);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data: cm } = await supabase
      .from("company_members")
      .select("user_id")
      .eq("company_id", companyId);
    const userIds = (cm ?? []).map((m: any) => m.user_id);
    if (userIds.length === 0) { setMembers([]); setLoading(false); return; }
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", userIds),
      supabase.from("user_roles").select("user_id, role").eq("company_id", companyId).in("user_id", userIds),
    ]);
    const byUser: Record<string, Member> = {};
    userIds.forEach((uid) => {
      const p = profiles?.find((x: any) => x.id === uid);
      byUser[uid] = { user_id: uid, full_name: p?.full_name ?? null, roles: [] };
    });
    (roles ?? []).forEach((r: any) => {
      if (byUser[r.user_id]) byUser[r.user_id].roles.push(r.role as AppRole);
    });
    setMembers(Object.values(byUser));
    setLoading(false);
  };

  useEffect(() => { if (companyId) load(); }, [companyId]);

  const setPrimaryRole = async (userId: string, newRole: AppRole) => {
    if (!companyId) return;
    setSavingFor(userId);
    try {
      await supabase.from("user_roles").delete()
        .eq("company_id", companyId).eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({
        company_id: companyId, user_id: userId, role: newRole,
      } as any);
      if (error) throw error;
      toast.success("Perfil alterado");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao alterar perfil");
    } finally {
      setSavingFor(null);
    }
  };

  const removeMember = async (userId: string) => {
    if (!companyId) return;
    if (!confirm("Remover este membro da empresa? Ele perderá o acesso.")) return;
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

  const isAdmin = (m: Member) => m.roles.includes("admin");
  const sorted = [...members].sort((a, b) => Number(isAdmin(b)) - Number(isAdmin(a)));

  return (
    <Dialog open={!!companyId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Membros · {companyName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-8 text-sm text-muted-foreground text-center">
            Nenhum membro cadastrado nesta empresa.
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {sorted.map((m) => {
              const primary = m.roles[0] ?? null;
              const admin = isAdmin(m);
              return (
                <div key={m.user_id} className="py-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-primary grid place-items-center text-primary-foreground text-xs font-semibold shrink-0">
                    {(m.full_name ?? "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {m.full_name ?? "(sem nome)"}
                      {admin && (
                        <Badge className="bg-primary/15 text-primary border border-primary/30 text-[10px] gap-1">
                          <Crown className="h-3 w-3" /> Administrador
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">{m.user_id}</div>
                  </div>
                  <div className="w-56 shrink-0">
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
                    title="Remover membro"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground pt-2">
          Alterações aqui valem apenas dentro desta empresa cliente. O acesso ao Super Admin Master
          continua exclusivo aos super admins do SaaS.
        </p>
      </DialogContent>
    </Dialog>
  );
}