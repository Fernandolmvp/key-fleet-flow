import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Wrench, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useWorkshopAuth } from "@/contexts/WorkshopAuthContext";

export default function OficinaLogin() {
  const { token, login, loading } = useWorkshopAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && token) return <Navigate to="/oficina" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Bem-vindo");
      nav("/oficina");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao entrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-4">
      <form onSubmit={submit} className="surface-card rounded-2xl p-8 w-full max-w-sm space-y-5 shadow-glow">
        <div className="flex flex-col items-center gap-2">
          <div className="h-12 w-12 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <Wrench className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-display text-xl font-bold">Portal da Oficina</h1>
          <p className="text-xs text-muted-foreground">Acesso para oficinas parceiras</p>
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Senha</Label>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
        </Button>
      </form>
    </div>
  );
}