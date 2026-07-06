import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";

type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};

function getOAuth(): OAuthNs | null {
  const a: any = (supabase.auth as any).oauth;
  return a && typeof a.getAuthorizationDetails === "function" ? (a as OAuthNs) : null;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("authorization_id ausente");
      const oauth = getOAuth();
      if (!oauth) return setError("Fluxo OAuth do backend indisponível nesta versão.");

      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    const oauth = getOAuth();
    if (!oauth) return setError("Fluxo OAuth indisponível.");
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("O servidor de autorização não retornou um redirect.");
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="surface-card rounded-xl p-6 max-w-md w-full text-center space-y-3">
          <h1 className="font-display text-xl font-semibold">Autorização indisponível</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }
  if (!details) {
    return (
      <main className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  const clientName = details.client?.name ?? details.client?.client_name ?? "um aplicativo";
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="surface-card rounded-xl p-8 max-w-md w-full space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">Conectar {clientName}</h1>
            <p className="text-xs text-muted-foreground">Autorizar acesso à sua conta FrotaOps</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {clientName} poderá acessar dados e ferramentas do FrotaOps em seu nome,
          respeitando as permissões da sua empresa.
        </p>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Negar
          </Button>
          <Button
            type="button"
            className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow"
            disabled={busy}
            onClick={() => decide(true)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Autorizar"}
          </Button>
        </div>
      </div>
    </main>
  );
}