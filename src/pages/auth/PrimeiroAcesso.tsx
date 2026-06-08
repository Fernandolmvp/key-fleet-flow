import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Validated = { valid: true; email: string; nome: string | null; empresa: string | null };

function strengthOf(p: string): { score: 0 | 1 | 2 | 3; label: string; color: string } {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Za-z]/.test(p) && /\d/.test(p)) s++;
  if (p.length >= 12 && /[^A-Za-z0-9]/.test(p)) s++;
  const map = [
    { label: "Muito fraca", color: "bg-destructive" },
    { label: "Fraca", color: "bg-destructive" },
    { label: "Média", color: "bg-warning" },
    { label: "Forte", color: "bg-success" },
  ] as const;
  return { score: s as 0 | 1 | 2 | 3, ...map[s] };
}

export default function PrimeiroAcesso() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<Validated | null>(null);
  const [errReason, setErrReason] = useState<string | null>(null);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const strength = useMemo(() => strengthOf(pwd), [pwd]);

  useEffect(() => {
    (async () => {
      if (!token) { setErrReason("missing"); setLoading(false); return; }
      const { data, error } = await supabase.functions.invoke("validate-first-access-token", { body: { token } });
      setLoading(false);
      if (error || !data || !(data as any).valid) {
        setErrReason((data as any)?.reason ?? "invalid");
        return;
      }
      setInfo(data as Validated);
    })();
  }, [token]);

  async function submit() {
    if (pwd.length < 8 || !/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) {
      return toast.error("Senha precisa ter 8+ caracteres, com letra e número.");
    }
    if (pwd !== pwd2) return toast.error("As senhas não coincidem.");
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("set-first-access-password", {
        body: { token, password: pwd },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "Erro ao definir senha");
        return;
      }
      const email = (data as any).email || info?.email;
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: pwd });
      if (signErr) {
        toast.success("Senha definida! Faça login.");
        nav("/login");
        return;
      }
      toast.success("Bem-vindo à FrotaOps!");
      nav("/app");
    } catch (e) {
      console.error("[primeiro-acesso]", e);
      toast.error("Não foi possível concluir seu primeiro acesso. Tente novamente em alguns instantes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="text-3xl font-display font-extrabold tracking-tight text-primary">FrotaOps</div>
          <p className="text-xs text-muted-foreground mt-1">Primeiro acesso</p>
        </div>

        {loading && (
          <Card><CardContent className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>
        )}

        {!loading && !info && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Link inválido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Este link expirou ou já foi usado. Entre em contato com seu gestor ou escreva para <a className="text-primary underline" href="mailto:contato@frotaops.com.br">contato@frotaops.com.br</a>.</p>
              <Button variant="outline" className="w-full" onClick={() => nav("/login")}>Ir para login</Button>
            </CardContent>
          </Card>
        )}

        {!loading && info && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Olá, {info.nome || "gestor"}!
              </CardTitle>
              <p className="text-sm text-muted-foreground">Defina sua senha para começar{info.empresa ? ` na ${info.empresa}` : ""}.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input readOnly value={info.email} className="font-mono" />
              </div>
              <div>
                <Label>Nova senha</Label>
                <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" />
                {pwd && (
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 w-full bg-muted rounded">
                      <div className={`h-1.5 rounded ${strength.color}`} style={{ width: `${((strength.score + 1) / 4) * 100}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{strength.label} — mínimo 8 caracteres, com letra e número</p>
                  </div>
                )}
              </div>
              <div>
                <Label>Confirmar senha</Label>
                <Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} autoComplete="new-password" />
              </div>
              <Button className="w-full" onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Definir senha e acessar
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}