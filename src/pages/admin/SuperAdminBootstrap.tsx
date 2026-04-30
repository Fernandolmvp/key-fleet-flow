import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminBootstrap() {
  const { user, isSuperAdmin, refreshCompanies } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  if (isSuperAdmin) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="surface-card rounded-xl p-8 max-w-md w-full text-center space-y-4">
          <ShieldCheck className="h-12 w-12 mx-auto text-success" />
          <h1 className="font-display text-2xl font-bold">Você já é Super Admin</h1>
          <Button onClick={() => nav("/super-admin")} className="w-full">Abrir painel</Button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (!user) return toast.error("Faça login primeiro");
    setLoading(true);
    const { error } = await supabase.rpc("bootstrap_super_admin", { _email: email });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cadastrado como Super Admin");
    await refreshCompanies();
    window.location.href = "/super-admin";
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="surface-card rounded-xl p-8 max-w-md w-full space-y-5">
        <div className="text-center space-y-2">
          <ShieldCheck className="h-12 w-12 mx-auto text-primary" />
          <h1 className="font-display text-2xl font-bold">Ativar acesso Super Admin</h1>
          <p className="text-sm text-muted-foreground">Confirme seu email para se cadastrar como dono do SaaS.</p>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Email</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
        </div>
        <Button onClick={submit} disabled={loading} className="w-full bg-gradient-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar Super Admin"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Só funciona se ainda não houver Super Admin cadastrado.
        </p>
      </div>
    </div>
  );
}