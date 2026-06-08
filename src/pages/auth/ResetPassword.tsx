import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Truck, Loader2, KeyRound, Check } from "lucide-react";

export default function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // O Supabase Auth processa o token na URL automaticamente e dispara um
    // PASSWORD_RECOVERY event. Aqui apenas habilitamos o formulário quando há sessão.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pwd)) return toast.error("A senha deve ter exatamente 6 dígitos numéricos");
    if (pwd !== confirm) return toast.error("As senhas não conferem");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) return toast.error("Não foi possível redefinir a senha. Solicite um novo link e tente novamente.");
      setDone(true);
      toast.success("Senha redefinida!");
      setTimeout(async () => {
        await supabase.auth.signOut();
        nav("/login");
      }, 1500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-gradient-surface">
      <div className="w-full max-w-md surface-card rounded-2xl p-8 space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">FrotaOps</span>
        </div>

        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Redefinir senha
          </h2>
            <p className="text-sm text-muted-foreground mt-1">
            {ready ? "Defina sua nova senha com 6 dígitos numéricos." : "Validando link de redefinição..."}
          </p>
        </div>

        {done ? (
          <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-4 text-sm text-emerald-200 flex gap-2">
            <Check className="h-4 w-4 mt-0.5 shrink-0" />
            <div>Senha redefinida com sucesso. Redirecionando para o login...</div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input type="password" inputMode="numeric" value={pwd} onChange={(e) => setPwd(e.target.value.replace(/\D/g, "").slice(0, 6))} minLength={6} maxLength={6} required disabled={!ready} />
            </div>
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input type="password" inputMode="numeric" value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))} minLength={6} maxLength={6} required disabled={!ready} />
            </div>
            <Button type="submit" disabled={busy || !ready} className="w-full bg-gradient-primary text-primary-foreground h-11 shadow-glow font-semibold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redefinir senha"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
