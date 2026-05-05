import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Truck, Loader2 } from "lucide-react";
import { z } from "zod";

const onlyDigits = (v: string) => v.replace(/\D/g, "");
function maskCnpj(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a && a.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join("")
    );
  }
  return d.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
}

const schema = z.object({
  fullName: z.string().trim().min(2, "Nome obrigatório").max(100),
  companyName: z.string().trim().min(2, "Empresa obrigatória").max(120),
  cnpj: z.string().trim().refine((v) => onlyDigits(v).length === 14, "CNPJ deve ter 14 dígitos"),
  phone: z.string().trim().refine((v) => {
    const n = onlyDigits(v).length;
    return n === 10 || n === 11;
  }, "Telefone inválido"),
  contactName: z.string().trim().min(2, "Responsável obrigatório").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
});

export default function Signup() {
  const { user, loading, refreshCompanies } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    companyName: "",
    cnpj: "",
    phone: "",
    contactName: "",
    email: "",
    password: "",
  });

  if (!loading && user) return <Navigate to="/app" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setBusy(true);
    const { data: auth, error } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { full_name: form.fullName },
      },
    });
    if (error) { setBusy(false); return toast.error(error.message); }
    if (!auth.user) { setBusy(false); return toast.error("Falha ao criar usuário"); }

    // Garantir sessão (caso confirmação de e-mail esteja ativa, faz signIn imediato)
    if (!auth.session) {
      const { error: sErr } = await supabase.auth.signInWithPassword({
        email: form.email, password: form.password,
      });
      if (sErr) {
        setBusy(false);
        return toast.error("Conta criada. Verifique seu e-mail para confirmar e depois faça login.");
      }
    }

    // Bootstrap empresa + membership + role + profile + subscription placeholder (RPC SECURITY DEFINER)
    const { error: rpcErr } = await supabase.rpc("bootstrap_company_v2" as any, {
      _company_name: form.companyName,
      _full_name: form.fullName,
      _cnpj: onlyDigits(form.cnpj),
      _phone: onlyDigits(form.phone),
      _contact_name: form.contactName,
      _email: form.email,
    });
    if (rpcErr) { setBusy(false); return toast.error(rpcErr.message); }

    await refreshCompanies();
    setBusy(false);
    toast.success("Conta criada! Escolha seu plano para começar.");
    nav("/planos");
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
          <h2 className="font-display text-2xl font-bold">Crie sua conta</h2>
          <p className="text-sm text-muted-foreground mt-1">Você será o administrador da sua empresa</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label>Nome completo</Label>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required maxLength={100} />
          </div>
          <div className="space-y-2"><Label>Nome da empresa</Label>
            <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required maxLength={120} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: maskCnpj(e.target.value) })} placeholder="00.000.000/0000-00" inputMode="numeric" required />
            </div>
            <div className="space-y-2"><Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} placeholder="(00) 00000-0000" inputMode="numeric" required />
            </div>
          </div>
          <div className="space-y-2"><Label>Responsável pelo contato</Label>
            <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} required maxLength={100} placeholder="Nome de quem cuida da frota" />
          </div>
          <div className="space-y-2"><Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="space-y-2"><Label>Senha</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow font-semibold h-11">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
          </Button>
        </form>
        <p className="text-sm text-center text-muted-foreground">
          Já tem conta? <Link to="/login" className="text-primary hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
