import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Truck, Loader2, ShieldCheck, Mail, Check } from "lucide-react";

type Step = "identity" | "contact" | "otp" | "done";

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}
function maskDate(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
function brToIso(v: string): string | null {
  const d = v.replace(/\D/g, "");
  if (d.length !== 8) return null;
  const dd = d.slice(0, 2), mm = d.slice(2, 4), yyyy = d.slice(4, 8);
  const day = parseInt(dd, 10), mon = parseInt(mm, 10), year = parseInt(yyyy, 10);
  if (mon < 1 || mon > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export default function DriverFirstAccess() {
  const [step, setStep] = useState<Step>("identity");
  const [busy, setBusy] = useState(false);

  const [cpf, setCpf] = useState("");
  const [birth, setBirth] = useState("");

  const [driver, setDriver] = useState<{ id: string; full_name: string; existing_email: string | null } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const verifyIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) return toast.error("CPF inválido");
    const iso = brToIso(birth);
    if (!iso) return toast.error("Data de nascimento inválida (use DD/MM/AAAA)");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("driver-onboarding", {
      body: { action: "verify-identity", cpf: cpfDigits, birth_date: iso },
    });
    setBusy(false);
    if (error || data?.error) return toast.error(data?.error || error?.message || "Falha");
    setDriver({ id: data.driver_id, full_name: data.full_name, existing_email: data.existing_email });
    setEmail(data.existing_email || "");
    setStep("contact");
  };

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driver) return;
    if (!email.trim() || !/.+@.+\..+/.test(email)) return toast.error("Email inválido");
    if (password.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres");
    if (password !== password2) return toast.error("As senhas não conferem");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("driver-onboarding", {
      body: { action: "send-otp", driver_id: driver.id, email: email.trim().toLowerCase() },
    });
    setBusy(false);
    if (error || data?.error) return toast.error(data?.error || error?.message || "Falha ao enviar email");
    setExpiresAt(data.expires_at);
    setDevCode(data.dev_code || null);
    setStep("otp");
    toast.success("Código enviado por email");
  };

  const confirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driver) return;
    if (code.replace(/\D/g, "").length !== 6) return toast.error("Código deve ter 6 dígitos");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("driver-onboarding", {
      body: { action: "confirm-otp", driver_id: driver.id, code: code.trim(), email: email.trim().toLowerCase(), password },
    });
    setBusy(false);
    if (error || data?.error) return toast.error(data?.error || error?.message || "Código inválido");
    setStep("done");
  };

  const resend = async () => {
    if (!driver) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("driver-onboarding", {
      body: { action: "send-otp", driver_id: driver.id, email: email.trim().toLowerCase() },
    });
    setBusy(false);
    if (error || data?.error) return toast.error(data?.error || error?.message || "Falha");
    setExpiresAt(data.expires_at);
    setDevCode(data.dev_code || null);
    toast.success("Novo código enviado");
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-gradient-surface">
      <div className="w-full max-w-md surface-card rounded-2xl p-8 space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">FrotaOps · Motorista</span>
        </div>

        {step === "identity" && (
          <>
            <div>
              <h2 className="font-display text-2xl font-bold">Primeiro acesso</h2>
              <p className="text-sm text-muted-foreground mt-1">Confirme sua identidade para continuar</p>
            </div>
            <form onSubmit={verifyIdentity} className="space-y-4">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" required />
              </div>
              <div className="space-y-2">
                <Label>Data de nascimento</Label>
                <Input
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  value={birth}
                  onChange={(e) => setBirth(maskDate(e.target.value))}
                  maxLength={10}
                  required
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow font-semibold h-11">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="h-4 w-4" /> Validar</>}
              </Button>
            </form>
          </>
        )}

        {step === "contact" && driver && (
          <>
            <div>
              <h2 className="font-display text-2xl font-bold">Olá, {driver.full_name.split(" ")[0]}</h2>
              <p className="text-sm text-muted-foreground mt-1">Crie sua senha e confirme seu email</p>
            </div>
            <form onSubmit={sendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={driver.full_name} disabled />
              </div>
              <div className="space-y-2">
                <Label>Email (receberá o código)</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
              <div className="space-y-2">
                <Label>Crie sua senha (mín. 6 caracteres)</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label>Confirme sua senha</Label>
                <Input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••" required minLength={6} />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow font-semibold h-11">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4" /> Enviar código por email</>}
              </Button>
            </form>
          </>
        )}

        {step === "otp" && (
          <>
            <div>
              <h2 className="font-display text-2xl font-bold">Confirme o código</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Enviamos um código de 6 dígitos para {email}. Válido por 10 minutos.
              </p>
              {devCode && (
                <p className="mt-2 text-xs rounded-md bg-amber-500/10 text-amber-200 border border-amber-500/30 px-3 py-2">
                  Modo desenvolvimento (template de email não configurado). Código: <strong>{devCode}</strong>
                </p>
              )}
            </div>
            <form onSubmit={confirmOtp} className="space-y-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" maxLength={6} className="text-center tracking-[0.5em] text-lg" required />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow font-semibold h-11">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Confirmar</>}
              </Button>
              <Button type="button" variant="ghost" onClick={resend} disabled={busy} className="w-full">
                Não recebi — reenviar código
              </Button>
            </form>
          </>
        )}

        {step === "done" && (
          <>
            <div className="text-center py-6">
              <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 grid place-items-center mb-3">
                <Check className="h-7 w-7 text-emerald-400" />
              </div>
              <h2 className="font-display text-2xl font-bold">Tudo certo!</h2>
              <p className="text-sm text-muted-foreground mt-2">Acesso ativado! Use seu CPF e a senha que você acabou de criar para entrar.</p>
            </div>
            <Link to="/login" className="block">
              <Button variant="outline" className="w-full">Ir para o login</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}