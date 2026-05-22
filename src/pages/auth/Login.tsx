import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Truck, Loader2, Building2, IdCard, KeyRound, Mail, Check } from "lucide-react";

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export default function Login() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [cpf, setCpf] = useState("");
  const [pwdMot, setPwdMot] = useState("");

  // Rate limit no frontend: 5 tentativas falhas → bloqueio de 30s
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockSeconds, setLockSeconds] = useState(0);

  useEffect(() => {
    if (lockSeconds <= 0) return;
    const t = setTimeout(() => setLockSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [lockSeconds]);

  const registerFailure = () => {
    setFailedAttempts((n) => {
      const next = n + 1;
      if (next >= 5) {
        setLockSeconds(30);
        return 0;
      }
      return next;
    });
  };

  // Reset senha motorista
  const [resetOpen, setResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState<"cpf" | "sent">("cpf");
  const [resetCpf, setResetCpf] = useState("");
  const [resetMaskedEmail, setResetMaskedEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  // Reset senha empresa
  const [resetCoOpen, setResetCoOpen] = useState(false);
  const [resetCoEmail, setResetCoEmail] = useState("");
  const [resetCoBusy, setResetCoBusy] = useState(false);
  const [resetCoSent, setResetCoSent] = useState(false);

  if (!loading && user) return <Navigate to="/app" replace />;

  const routeAfterLogin = async () => {
    const { data } = await supabase.rpc("get_my_acquisition_state" as any);
    const row: any = Array.isArray(data) ? data[0] : data;
    if (row?.has_company && !row?.is_active) {
      nav("/planos");
    } else {
      nav("/app");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockSeconds > 0) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error("[login-empresa]", error.message);
        registerFailure();
        toast.error("Email ou senha incorretos. Tente novamente ou clique em 'Esqueci minha senha'.");
        return;
      }
      setFailedAttempts(0);
      toast.success("Bem-vindo de volta");
      await routeAfterLogin();
    } catch (e: any) {
      console.error("[login-empresa]", e);
      registerFailure();
      toast.error("Não foi possível entrar. Tente novamente em alguns instantes.");
    } finally {
      setBusy(false);
    }
  };

  const submitDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockSeconds > 0) return;
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) return toast.error("CPF inválido");
    if (!pwdMot) return toast.error("Informe a senha");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("driver-onboarding", {
        body: { action: "lookup-by-cpf", cpf: cpfDigits },
      });
      if (error || data?.error) {
        registerFailure();
        toast.error("CPF ou senha incorretos. Tente novamente.");
        return;
      }
      const { error: sErr } = await supabase.auth.signInWithPassword({ email: data.email, password: pwdMot });
      if (sErr) {
        registerFailure();
        toast.error("CPF ou senha incorretos. Tente novamente.");
        return;
      }
      setFailedAttempts(0);
      toast.success("Bem-vindo");
      nav("/motorista");
    } catch (e: any) {
      console.error("[login-motorista]", e);
      registerFailure();
      toast.error("Não foi possível entrar. Tente novamente em alguns instantes.");
    } finally {
      setBusy(false);
    }
  };

  const openReset = () => {
    setResetStep("cpf");
    setResetCpf(cpf || "");
    setResetMaskedEmail("");
    setResetOpen(true);
  };

  const sendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = resetCpf.replace(/\D/g, "");
    if (d.length !== 11) return toast.error("CPF inválido");
    setResetBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("driver-onboarding", {
        body: {
          action: "reset-password-send-email",
          cpf: d,
          redirect_to: `${window.location.origin}/reset-password`,
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Falha");
        return;
      }
      setResetMaskedEmail(data.masked_email || "");
      setResetStep("sent");
      toast.success("Email de redefinição enviado");
    } finally {
      setResetBusy(false);
    }
  };

  const openResetCompany = () => {
    setResetCoEmail(email || "");
    setResetCoSent(false);
    setResetCoOpen(true);
  };

  const sendCompanyResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = resetCoEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return toast.error("Email inválido");
    setResetCoBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(value, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setResetCoSent(true);
      if (error) console.warn("[reset-empresa]", error.message);
      toast.success("Se o email existir, enviaremos instruções em alguns minutos");
    } finally {
      setResetCoBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-surface">
        <div className="absolute inset-0 bg-gradient-glow opacity-60" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
              <Truck className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight">FrotaOps</span>
          </div>
          <div className="space-y-6">
            <h1 className="font-display text-5xl font-bold leading-tight">
              Comando total <span className="text-primary glow-text">da sua frota</span>.
            </h1>
            <p className="text-muted-foreground text-lg max-w-md">
              BI executivo, manutenção preventiva, controle de combustível com detecção de anomalias e auditoria completa — em uma única plataforma.
            </p>
            <div className="grid grid-cols-3 gap-4 pt-4 max-w-md">
              {[
                { v: "−27%", l: "custo/km" },
                { v: "+41%", l: "disponibilidade" },
                { v: "100%", l: "rastreabilidade" },
              ].map((s) => (
                <div key={s.l} className="surface-card rounded-xl p-4">
                  <div className="font-display text-2xl text-primary font-bold">{s.v}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">© FrotaOps · Enterprise Fleet Intelligence</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="lg:hidden flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center"><Truck className="h-5 w-5 text-primary-foreground" /></div>
            <span className="font-display text-xl font-bold">FrotaOps</span>
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold">Acesse seu painel</h2>
            <p className="text-muted-foreground mt-2">Entre com suas credenciais corporativas</p>
          </div>
          <Tabs defaultValue="empresa" className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="empresa" className="gap-2">
                <Building2 className="h-4 w-4" /> Empresa
              </TabsTrigger>
              <TabsTrigger value="motorista" className="gap-2">
                <IdCard className="h-4 w-4" /> Motorista
              </TabsTrigger>
            </TabsList>

            <TabsContent value="empresa" className="space-y-4 mt-6">
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email corporativo</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pwd">Senha</Label>
                  <Input id="pwd" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy || lockSeconds > 0} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow font-semibold h-11">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : lockSeconds > 0 ? `Aguarde ${lockSeconds}s antes de tentar novamente` : "Entrar"}
                </Button>
              </form>
              <button
                type="button"
                onClick={openResetCompany}
                className="text-sm text-primary hover:underline w-full text-center"
              >
                Esqueci minha senha
              </button>
              <p className="text-sm text-center text-muted-foreground">
                Primeiro acesso? <Link to="/signup" className="text-primary hover:underline">Criar conta da empresa</Link>
              </p>
            </TabsContent>

            <TabsContent value="motorista" className="space-y-4 mt-6">
              <form onSubmit={submitDriver} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf-mot">CPF do motorista</Label>
                  <Input id="cpf-mot" inputMode="numeric" required value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pwd-mot">Senha</Label>
                  <Input id="pwd-mot" type="password" inputMode="numeric" maxLength={6} required value={pwdMot} onChange={(e) => setPwdMot(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                </div>
                <Button type="submit" disabled={busy || lockSeconds > 0} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow font-semibold h-11">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : lockSeconds > 0 ? `Aguarde ${lockSeconds}s antes de tentar novamente` : "Entrar como motorista"}
                </Button>
              </form>
              <button
                type="button"
                onClick={openReset}
                className="text-sm text-primary hover:underline w-full text-center"
              >
                Esqueci minha senha (receber email)
              </button>
              <div className="surface-card rounded-lg p-4 text-center space-y-2">
                <p className="text-sm font-medium">É seu primeiro acesso?</p>
                <p className="text-xs text-muted-foreground">
                  Ative seu cadastro com o CPF informado pela sua empresa.
                </p>
                <Link
                  to="/motorista/primeiro-acesso"
                  className="inline-flex items-center justify-center w-full h-10 rounded-md border border-primary/40 text-primary hover:bg-primary/10 text-sm font-medium transition-colors"
                >
                  Ativar acesso de motorista
                </Link>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Redefinir senha do motorista
            </DialogTitle>
            <DialogDescription>
              {resetStep === "cpf" && "Informe seu CPF. Enviaremos um link de redefinição por email."}
              {resetStep === "sent" && `Enviamos um email para ${resetMaskedEmail}. Abra a mensagem e clique no link para definir uma nova senha.`}
            </DialogDescription>
          </DialogHeader>

          {resetStep === "cpf" && (
            <form onSubmit={sendResetEmail} className="space-y-4">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={resetCpf} onChange={(e) => setResetCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" required />
              </div>
              <Button type="submit" disabled={resetBusy} className="w-full bg-gradient-primary text-primary-foreground h-11">
                {resetBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4" /> Enviar link por email</>}
              </Button>
            </form>
          )}

          {resetStep === "sent" && (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-4 text-sm text-emerald-200 flex gap-2">
              <Check className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                Caso não receba em alguns minutos, verifique a caixa de spam. O link expira após o uso.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resetCoOpen} onOpenChange={setResetCoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Redefinir senha da empresa
            </DialogTitle>
            <DialogDescription>
              {resetCoSent
                ? "Se o email existir em nossa base, enviamos instruções em alguns minutos. Verifique também a caixa de spam."
                : "Informe o email corporativo cadastrado. Enviaremos um link para definir uma nova senha."}
            </DialogDescription>
          </DialogHeader>

          {!resetCoSent ? (
            <form onSubmit={sendCompanyResetEmail} className="space-y-4">
              <div className="space-y-2">
                <Label>Email corporativo</Label>
                <Input type="email" value={resetCoEmail} onChange={(e) => setResetCoEmail(e.target.value)} placeholder="voce@empresa.com" required />
              </div>
              <Button type="submit" disabled={resetCoBusy} className="w-full bg-gradient-primary text-primary-foreground h-11">
                {resetCoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4" /> Enviar link por email</>}
              </Button>
            </form>
          ) : (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-4 text-sm text-emerald-200 flex gap-2">
              <Check className="h-4 w-4 mt-0.5 shrink-0" />
              <div>O link expira em 1 hora e só pode ser usado uma vez.</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
