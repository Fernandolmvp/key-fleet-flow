import { useEffect, useMemo, useRef, useState } from "react";
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
  const [errPwd, setErrPwd] = useState<string | null>(null);
  const [errPwd2, setErrPwd2] = useState<string | null>(null);
  const pwdRef = useRef<HTMLInputElement>(null);
  const pwd2Ref = useRef<HTMLInputElement>(null);
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
    setErrPwd(null); setErrPwd2(null);
    if (pwd.length < 8 || !/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) {
      const msg = "Senha precisa ter no mínimo 8 caracteres com letra e número";
      setErrPwd(msg);
      toast.error(msg);
      pwdRef.current?.focus();
      return;
    }
    if (pwd !== pwd2) {
      const msg = "As senhas não coincidem";
      setErrPwd2(msg);
      toast.error(msg);
      pwd2Ref.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("set-first-access-password", {
        body: { token, password: pwd },
      });
      if (error || (data as any)?.error) {
        const raw = (data as any)?.error || error?.message || "";
        // Erros transitórios: rede / 503 / timeout — não invalida o token
        const transient = /fetch|network|timeout|503|temporar|gateway|unavailable/i.test(String(raw));
        toast.error(transient ? "Erro temporário, tente novamente" : (raw || "Não foi possível definir sua senha"));
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
    } catch (e: any) {
      console.error("[primeiro-acesso]", e);
      const msg = String(e?.message || "");
      const transient = /fetch|network|timeout|failed to fetch/i.test(msg);
      toast.error(transient ? "Erro temporário, tente novamente" : "Não foi possível concluir seu primeiro acesso. Tente novamente em alguns instantes.");
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
                <Input
                  ref={pwdRef}
                  type="password"
                  value={pwd}
                  onChange={(e) => { setPwd(e.target.value); if (errPwd) setErrPwd(null); }}
                  autoComplete="new-password"
                  className={errPwd ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errPwd && <p className="text-xs text-destructive mt-1">{errPwd}</p>}
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
                <Input
                  ref={pwd2Ref}
                  type="password"
                  value={pwd2}
                  onChange={(e) => { setPwd2(e.target.value); if (errPwd2) setErrPwd2(null); }}
                  autoComplete="new-password"
                  className={errPwd2 ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errPwd2 && <p className="text-xs text-destructive mt-1">{errPwd2}</p>}
              </div>
              <Button className="w-full" onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {submitting ? "Definindo senha…" : "Definir senha e acessar"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}