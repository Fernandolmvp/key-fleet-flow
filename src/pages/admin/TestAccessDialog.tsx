import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, AlertTriangle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ALL_ROLES, type AppRole } from "@/lib/permissions";

type TestUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  created_at: string;
};

export default function TestAccessDialog({
  companyId,
  companyName,
  onClose,
}: {
  companyId: string | null;
  companyName: string;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<TestUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("gestor_frota");

  const resetForm = () => {
    setEmail(""); setPassword(""); setFullName(""); setRole("gestor_frota");
  };

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-list-test-users", {
      body: { companyId },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setUsers((data as any)?.users ?? []);
  };

  useEffect(() => {
    if (companyId) { resetForm(); load(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const create = async () => {
    if (!companyId) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast.error("Email inválido");
    if (password.length < 6) return toast.error("Senha deve ter no mínimo 6 caracteres");
    if (!fullName.trim()) return toast.error("Informe o nome");
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-create-test-user", {
      body: {
        companyId,
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        role,
      },
    });
    setCreating(false);
    if (error) {
      const msg = (data as any)?.error || error.message;
      return toast.error(msg);
    }
    if ((data as any)?.error) return toast.error((data as any).error);
    toast.success("Acesso de teste criado");
    resetForm();
    load();
  };

  const remove = async (userId: string) => {
    if (!confirm("Remover este acesso de teste? O usuário será apagado.")) return;
    setRemoving(userId);
    const { data, error } = await supabase.functions.invoke("admin-delete-test-user", {
      body: { userId },
    });
    setRemoving(null);
    if (error) return toast.error((data as any)?.error || error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    toast.success("Acesso de teste removido");
    load();
  };

  return (
    <Dialog open={!!companyId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Acesso de teste · {companyName}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground flex gap-2">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div>
            Use um papel comum (ex.: <strong>Gestor de Frota</strong>) para validar permissões reais —
            <strong> Administrador</strong> enxerga tudo e não serve para esse teste.
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 pt-2">
          <div>
            <label className="text-xs text-muted-foreground">Nome completo</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex: Teste Gestor" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teste@exemplo.com" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Senha (mín. 6)</label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="senha provisória" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Papel</label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}{r.value === "admin" ? " (não recomendado)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button onClick={create} disabled={creating} className="bg-gradient-primary">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4 mr-1" /> Criar acesso de teste</>}
          </Button>
        </DialogFooter>

        <div className="pt-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Acessos de teste existentes
          </div>
          {loading ? (
            <div className="grid place-items-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">Nenhum acesso de teste para esta empresa.</div>
          ) : (
            <div className="divide-y divide-border max-h-[40vh] overflow-y-auto">
              {users.map((u) => (
                <div key={u.user_id} className="py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {u.full_name ?? "(sem nome)"} <span className="text-muted-foreground">· {u.email}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      criado em {new Date(u.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{u.role ?? "—"}</Badge>
                  <Button
                    size="icon" variant="ghost"
                    onClick={() => remove(u.user_id)}
                    disabled={removing === u.user_id}
                    title="Remover acesso de teste"
                  >
                    {removing === u.user_id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4 text-destructive" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}