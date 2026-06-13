import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

type ApiKeyRow = {
  id: string;
  nome: string;
  key_prefix: string;
  ativa: boolean;
  last_used_at: string | null;
  created_at: string;
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateRawKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // base64url
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return "fops_live_" + b64;
}

export default function ApiKeyPanel({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ApiKeyRow | null>(null);
  const [working, setWorking] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("api_keys")
      .select("id, nome, key_prefix, ativa, last_used_at, created_at")
      .eq("company_id", companyId)
      .eq("ativa", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActive((data as ApiKeyRow) ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [companyId]);

  const issueKey = async () => {
    setWorking(true);
    try {
      // Revoga anteriores
      if (active) {
        const { error: upErr } = await supabase
          .from("api_keys")
          .update({ ativa: false })
          .eq("company_id", companyId)
          .eq("ativa", true);
        if (upErr) throw upErr;
      }
      const raw = generateRawKey();
      const hash = await sha256Hex(raw);
      const prefix = raw.slice(0, 14);
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("api_keys").insert({
        company_id: companyId,
        key_hash: hash,
        key_prefix: prefix,
        nome: "Central Agentes IA",
        ativa: true,
        created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
      setFreshKey(raw);
      toast.success("Chave gerada. Copie agora — não será exibida novamente.");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar chave");
    } finally {
      setWorking(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  if (loading) {
    return (
      <div className="surface-card rounded-xl p-6 max-w-2xl grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="surface-card rounded-xl p-6 max-w-2xl space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-primary grid place-items-center shadow-glow shrink-0">
          <KeyRound className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-display font-semibold">Conectar Central de Agentes</h3>
          <p className="text-sm text-muted-foreground">
            Gere uma chave de API e cole na Central de Agentes de IA para conectar esta empresa.
            A Central usa essa chave para puxar nome, CNPJ e dados da frota automaticamente.
          </p>
        </div>
      </div>

      {freshKey && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-2">
          <Label className="text-xs uppercase tracking-wide text-primary">
            Sua nova chave (mostrada apenas uma vez)
          </Label>
          <div className="flex gap-2">
            <Input readOnly value={freshKey} className="font-mono text-xs" />
            <Button type="button" variant="secondary" onClick={() => copy(freshKey)} className="gap-2">
              <Copy className="h-4 w-4" /> Copiar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Cole esta chave na Central de Agentes para conectar. Se você perder a chave, gere uma nova.
          </p>
        </div>
      )}

      {active ? (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Chave ativa</div>
              <div className="text-xs text-muted-foreground">
                {active.nome} · prefixo <span className="font-mono">{active.key_prefix}…</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Criada em {new Date(active.created_at).toLocaleString("pt-BR")}
                {active.last_used_at
                  ? ` · último uso ${new Date(active.last_used_at).toLocaleString("pt-BR")}`
                  : " · nunca usada"}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={issueKey}
              disabled={working}
              className="gap-2"
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Gerar nova (revoga atual)
            </Button>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5 mt-0.5" />
            <span>
              Por segurança a chave em si não fica visível — só o prefixo. Se a chave foi exposta,
              gere uma nova para revogar a anterior.
            </span>
          </div>
        </div>
      ) : (
        <Button type="button" onClick={issueKey} disabled={working} className="gap-2">
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Conectar Central de Agentes
        </Button>
      )}
    </div>
  );
}