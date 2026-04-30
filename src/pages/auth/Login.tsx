import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Truck, Loader2 } from "lucide-react";

export default function Login() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/app" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta");
    nav("/app");
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
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email corporativo</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwd">Senha</Label>
              <Input id="pwd" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow font-semibold h-11">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
            </Button>
          </form>
          <p className="text-sm text-center text-muted-foreground">
            Primeiro acesso? <Link to="/signup" className="text-primary hover:underline">Criar conta</Link>
          </p>
          <p className="text-xs text-center text-muted-foreground">
            É motorista? <Link to="/motorista/primeiro-acesso" className="text-primary hover:underline">Ativar acesso</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
