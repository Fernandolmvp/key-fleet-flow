import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Fuel, Wrench, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { usePostoAuth } from "@/contexts/PostoAuthContext";

type PeekResult = {
  ok: true;
  invitation: { email: string; name: string; partner_type: "station" | "workshop"; kind: "invite" | "reset"; expires_at: string };
  company: { name: string } | null;
  partner: { id: string; name: string; cnpj?: string; city?: string; state?: string } | null;
};

export default function PartnerInviteAccept() {
  const [search] = useSearchParams();
  const token = search.get("token") ?? "";
  const nav = useNavigate();
  const posto = usePostoAuth();

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<PeekResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) { setErr("Token ausente"); setLoading(false); return; }
      const { data, error } = await supabase.functions.invoke("partner-accept-invite", {
        body: { token, mode: "peek" },
      });
      if (error || (data as any)?.error) {
        setErr((data as any)?.error ?? error?.message ?? "Convite inválido");
      } else {
        setInfo(data as PeekResult);
      }
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    if (pwd.length < 8) return toast.error("Senha precisa de 8+ caracteres");
    if (pwd !== pwd2) return toast.error("As senhas não coincidem");
    if (!accepted) return toast.error("Você precisa aceitar os termos");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("partner-accept-invite", {
      body: { token, password: pwd },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error ?? error?.message ?? "Falha ao aceitar convite");
    }
    const r = data as { token: string; user: any; partner: any; redirect: string };
    posto.setSession({ token: r.token, user: r.user, station: r.partner });
    toast.success("Acesso ativado!");
    nav(r.redirect ?? "/posto", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (err || !info) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="surface-card rounded-xl p-8 max-w-md text-center space-y-3">
          <ShieldCheck className="h-10 w-10 mx-auto text-destructive" />
          <h1 className="font-display text-xl font-semibold">Convite indisponível</h1>
          <p className="text-sm text-muted-foreground">{err ?? "Tente solicitar um novo convite."}</p>
        </div>
      </div>
    );
  }

  const isReset = info.invitation.kind === "reset";
  const Icon = info.invitation.partner_type === "station" ? Fuel : Wrench;

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="surface-card rounded-2xl p-8 max-w-md w-full space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 grid place-items-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">
              {isReset ? "Redefinir sua senha" : "Convite para acesso"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Portal de parceiros — {info.invitation.partner_type === "station" ? "Posto" : "Oficina"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4 text-sm space-y-1 bg-muted/20">
          <div><span className="text-muted-foreground">Empresa:</span> <strong>{info.company?.name ?? "—"}</strong></div>
          {info.partner && (
            <div><span className="text-muted-foreground">Parceiro:</span> <strong>{info.partner.name}</strong>{info.partner.cnpj ? ` · ${info.partner.cnpj}` : ""}</div>
          )}
          <div><span className="text-muted-foreground">Para:</span> {info.invitation.email}</div>
          <div className="text-xs text-muted-foreground pt-1">
            Expira em {new Date(info.invitation.expires_at).toLocaleDateString("pt-BR")}
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nova senha (mínimo 8 caracteres)</Label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <Label>Confirmar senha</Label>
            <Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} autoComplete="new-password" />
          </div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
            <span>Li e aceito os termos de uso do portal de parceiros.</span>
          </label>
        </div>

        <Button onClick={submit} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (isReset ? "Definir nova senha e entrar" : "Criar acesso e entrar")}
        </Button>
      </div>
    </div>
  );
}