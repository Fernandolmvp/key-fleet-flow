import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Fuel, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePostoAuth } from "@/contexts/PostoAuthContext";

export default function PostoLogin() {
  const { token, login, loading } = usePostoAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && token) return <Navigate to="/posto" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Bem-vindo");
      nav("/posto");
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
            <Fuel className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-display text-xl font-bold">Portal do Posto</h1>
          <p className="text-xs text-muted-foreground">Acesso para postos parceiros</p>
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