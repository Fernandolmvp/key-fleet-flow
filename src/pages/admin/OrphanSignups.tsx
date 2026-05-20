import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, UserX, Mail, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Orphan = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

export default function OrphanSignups() {
  const [items, setItems] = useState<Orphan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-orphan-signups", {
      body: { action: "list" },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Erro");
      return;
    }
    setItems((data as any).orphans ?? []);
  };

  useEffect(() => { load(); }, []);

  async function sendRecovery(email: string) {
    setBusy(email);
    const { data, error } = await supabase.functions.invoke("admin-orphan-signups", {
      body: { action: "send_recovery", email, redirect_to: `${window.location.origin}/reset-password` },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Erro");
      return;
    }
    toast.success(`Link de redefinição enviado para ${email}`);
  }

  async function deleteUser(o: Orphan) {
    if (!confirm(`Excluir definitivamente ${o.email}?\n\nIsso libera o email pra novo cadastro.`)) return;
    setBusy(o.id);
    const { data, error } = await supabase.functions.invoke("admin-orphan-signups", {
      body: { action: "delete_user", user_id: o.id },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Erro");
      return;
    }
    toast.success("Usuário excluído");
    load();
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserX className="h-6 w-6 text-warning" />
          <div>
            <h1 className="text-2xl font-display font-bold">Cadastros incompletos</h1>
            <p className="text-sm text-muted-foreground">
              Usuários que se cadastraram mas não concluíram a criação da empresa.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="pt-6 flex gap-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p><strong>Como funciona:</strong> o cliente que aparece aqui já tem login no FrotaOps mas nunca cadastrou empresa.</p>
            <p><strong>Para destravar:</strong> envie o link de redefinição de senha. Ao logar, ele cai automaticamente na tela de "Finalizar cadastro da empresa" e pode usar o cupom dele.</p>
            <p><strong>Email não confirmado:</strong> se nunca confirmou o email, recomende excluir e pedir pra cadastrar de novo com email válido.</p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Carregando...
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <UserX className="h-10 w-10 mx-auto mb-3 opacity-50" />
            Nenhum cadastro incompleto.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{items.length} usuário(s) órfão(s)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Usuário</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Cadastrado</th>
                    <th className="text-left px-4 py-3">Último acesso</th>
                    <th className="text-right px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((o) => {
                    const confirmed = !!o.email_confirmed_at;
                    return (
                      <tr key={o.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="font-medium">{o.full_name || "—"}</div>
                          {o.phone && <div className="text-xs text-muted-foreground">{o.phone}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs">{o.email}</div>
                          <Badge className={`mt-1 text-[10px] ${confirmed ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"}`}>
                            {confirmed ? "Email confirmado" : "Email não confirmado"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs">{fmt(o.created_at)}</td>
                        <td className="px-4 py-3 text-xs">{fmt(o.last_sign_in_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => sendRecovery(o.email)}
                              disabled={busy === o.email || !confirmed}
                              title={confirmed ? "Enviar link de redefinição" : "Email não confirmado — não é possível enviar link"}
                            >
                              {busy === o.email ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5 mr-1" />}
                              Reenviar acesso
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteUser(o)}
                              disabled={busy === o.id}
                            >
                              {busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}