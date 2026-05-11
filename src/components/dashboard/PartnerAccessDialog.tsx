import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Copy, RotateCw, X, KeyRound, UserMinus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stationId: string;
  stationName: string;
};

type Invite = {
  id: string; email: string; name: string; status: string; kind: string;
  expires_at: string; token: string; resent_count: number; created_at: string;
};
type FsUser = { id: string; email: string; name: string; role: string; active: boolean; last_login_at: string | null };

export default function PartnerAccessDialog({ open, onOpenChange, stationId, stationName }: Props) {
  const { currentCompanyId } = useAuth();
  const [users, setUsers] = useState<FsUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "operador" });

  const load = async () => {
    if (!stationId || !currentCompanyId) return;
    setLoading(true);
    const [u, i] = await Promise.all([
      supabase.from("fuel_station_users")
        .select("id,email,name,role,active,last_login_at")
        .eq("station_id", stationId).order("created_at"),
      supabase.from("partner_invitations")
        .select("id,email,name,status,kind,expires_at,token,resent_count,created_at")
        .eq("partner_type", "station").eq("partner_id", stationId)
        .order("created_at", { ascending: false }),
    ]);
    if (u.error) toast.error(u.error.message); else setUsers((u.data ?? []) as FsUser[]);
    if (i.error) toast.error(i.error.message); else setInvites((i.data ?? []) as Invite[]);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open, stationId]);

  const inviteUrl = (token: string) => `${window.location.origin}/parceiro/convite?token=${token}`;

  const submitInvite = async () => {
    if (!form.email || !form.name) return toast.error("Preencha nome e email");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("partner-invite", {
      body: {
        company_id: currentCompanyId, partner_type: "station", partner_id: stationId,
        email: form.email, name: form.name, role: form.role,
      },
    });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Falha");
    toast.success("Convite enviado");
    if ((data as any)?.accept_url) {
      navigator.clipboard?.writeText((data as any).accept_url).catch(() => {});
      toast.message("Link copiado para a área de transferência");
    }
    setForm({ email: "", name: "", role: "operador" });
    load();
  };

  const resend = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("partner-resend-invite", { body: { invitation_id: id } });
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Falha");
    toast.success("Convite reenviado");
    load();
  };
  const cancel = async (id: string) => {
    if (!confirm("Cancelar este convite?")) return;
    const { data, error } = await supabase.functions.invoke("partner-cancel-invite", { body: { invitation_id: id } });
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Falha");
    toast.success("Convite cancelado"); load();
  };
  const resetPwd = async (id: string) => {
    if (!confirm("Enviar email de redefinição de senha?")) return;
    const { data, error } = await supabase.functions.invoke("posto-admin-user", {
      body: { action: "reset_password", id, station_id: stationId, company_id: currentCompanyId },
    });
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Falha");
    toast.success("Convite de redefinição enviado");
    if ((data as any)?.accept_url) navigator.clipboard?.writeText((data as any).accept_url).catch(() => {});
    load();
  };
  const toggleActive = async (u: FsUser) => {
    const { data, error } = await supabase.functions.invoke("posto-admin-user", {
      body: { action: "toggle_active", id: u.id, active: !u.active, station_id: stationId, company_id: currentCompanyId },
    });
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Falha");
    load();
  };
  const remove = async (u: FsUser) => {
    if (!confirm(`Excluir acesso de ${u.email}?`)) return;
    const { data, error } = await supabase.functions.invoke("posto-admin-user", {
      body: { action: "delete", id: u.id, station_id: stationId, company_id: currentCompanyId },
    });
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Falha");
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Acessos do parceiro · {stationName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <section className="surface-card rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">Novo acesso</h3>
            <p className="text-xs text-muted-foreground">
              Enviaremos um convite por email. O responsável definirá a própria senha.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Função</Label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="operador">Operador</option>
                  <option value="admin">Administrador</option>
                </select></div>
            </div>
            <Button onClick={submitInvite} disabled={busy} size="sm" className="bg-gradient-primary text-primary-foreground">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4 mr-2" />Enviar convite</>}
            </Button>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-sm">Convites</h3>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : invites.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum convite registrado.</p>
            ) : (
              <div className="space-y-2">
                {invites.map((i) => (
                  <div key={i.id} className="surface-card rounded-lg p-3 flex items-center gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{i.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.name} · {i.kind === "reset" ? "Redefinição" : "Convite"} · expira {new Date(i.expires_at).toLocaleDateString("pt-BR")}
                        {i.resent_count > 0 ? ` · reenviado ${i.resent_count}x` : ""}
                      </div>
                    </div>
                    <Badge variant={i.status === "pending" ? "default" : "secondary"}
                      className={i.status === "pending" ? "bg-warning/15 text-warning border-warning/30" : ""}>
                      {i.status}
                    </Badge>
                    {i.status === "pending" && (
                      <Button size="sm" variant="ghost" title="Copiar link"
                        onClick={() => { navigator.clipboard.writeText(inviteUrl(i.token)); toast.success("Link copiado"); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {(i.status === "pending" || i.status === "expired") && (
                      <>
                        <Button size="sm" variant="ghost" title="Reenviar" onClick={() => resend(i.id)}>
                          <RotateCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Cancelar" onClick={() => cancel(i.id)}
                          className="text-destructive hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-sm">Usuários ativos</h3>
            {users.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum usuário ainda. Envie um convite acima.</p>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="surface-card rounded-lg p-3 flex items-center gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{u.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.name} · {u.role}{u.last_login_at ? ` · último login ${new Date(u.last_login_at).toLocaleDateString("pt-BR")}` : " · nunca acessou"}
                      </div>
                    </div>
                    <Badge variant={u.active ? "default" : "secondary"}
                      className={u.active ? "bg-success/15 text-success border-success/30" : ""}>
                      {u.active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button size="sm" variant="ghost" title="Redefinir senha" onClick={() => resetPwd(u.id)}>
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" title={u.active ? "Desativar" : "Ativar"} onClick={() => toggleActive(u)}>
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" title="Excluir" onClick={() => remove(u)}
                      className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}