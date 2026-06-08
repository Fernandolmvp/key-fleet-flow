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
  const [planSlug, setPlanSlug] = useState<string>("pro");
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<{ valid: boolean; message: string } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
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

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    const { data, error } = await supabase.rpc("preview_coupon" as any, {
      p_code: couponCode.trim(),
      p_cnpj: onlyDigits(form.cnpj),
    });
    setValidatingCoupon(false);
    if (error) { setCouponPreview({ valid: false, message: error.message }); return; }
    const r: any = data;
    setCouponPreview({ valid: !!r?.valid, message: r?.message ?? "" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setBusy(true);
    try {
      let { data: auth, error } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          data: { full_name: form.fullName },
        },
      });
      if (error) {
        const msg = String(error.message || "");
        const alreadyExists = /already|registered|exists/i.test(msg) || (error as any).status === 422;
        if (!alreadyExists) {
          return toast.error(msg || "Falha ao criar conta");
        }
        const { data: signIn, error: sErr } = await supabase.auth.signInWithPassword({
          email: form.email, password: form.password,
        });
        if (sErr || !signIn.user) {
          toast.error(
            "Já existe uma conta com este email. Se for sua, faça login ou recupere a senha.",
            { duration: 8000 }
          );
          nav("/login");
          return;
        }
        const { data: existingMem } = await supabase
          .from("company_members").select("company_id").eq("user_id", signIn.user.id).limit(1);
        if (existingMem && existingMem.length > 0) {
          toast.success("Você já tinha conta — conectamos você ao sistema.");
          await refreshCompanies();
          nav("/app");
          return;
        }
        auth = { user: signIn.user, session: signIn.session } as any;
      }
      if (!auth.user) return toast.error("Falha ao criar usuário");

      if (!auth.session) {
        const { error: sErr } = await supabase.auth.signInWithPassword({
          email: form.email, password: form.password,
        });
        if (sErr) {
          return toast.error("Conta criada. Verifique seu e-mail para confirmar e depois faça login.");
        }
      }

      const { data: companyIdRet, error: rpcErr } = await supabase.rpc("bootstrap_company_v2" as any, {
        _company_name: form.companyName,
        _full_name: form.fullName,
        _cnpj: onlyDigits(form.cnpj),
        _phone: onlyDigits(form.phone),
        _contact_name: form.contactName,
        _email: form.email,
        _trial_plan_slug: planSlug,
      });
      if (rpcErr) {
        const m = String(rpcErr.message || "");
        if (/duplicate|unique|cnpj/i.test(m)) {
          return toast.error("Já existe uma empresa com este CNPJ. Se for sua, peça acesso ao administrador.");
        }
        return toast.error("Sua conta foi criada, mas falhou ao cadastrar a empresa. Faça login para continuar.", { duration: 8000 });
      }

      await refreshCompanies();

      if (couponCode.trim() && companyIdRet) {
        try {
          const { data: r } = await supabase.rpc("redeem_coupon" as any, {
            p_code: couponCode.trim(),
            p_company_id: companyIdRet as any,
          });
          const res: any = r;
          if (res?.success) toast.success(res?.message ?? "Cupom aplicado");
          else if (res?.message) toast.warning(`Cupom: ${res.message}`);
        } catch (_) { /* silencioso */ }
      }

      try {
        const ends = new Date(Date.now() + 21 * 86400000).toLocaleDateString("pt-BR");
        await supabase.functions.invoke("send-partner-email", {
          body: {
            to: form.email,
            subject: "Bem-vindo ao FrotaOps — 21 dias grátis liberados",
            html: `<p>Olá ${form.fullName},</p><p>Sua conta no <strong>FrotaOps</strong> foi criada com <strong>21 dias grátis</strong> de todos os módulos liberados. Aproveite até <strong>${ends}</strong>.</p><p><a href="${window.location.origin}/app">Acessar a plataforma</a></p><p>Após o período de teste, basta ativar sua assinatura para continuar sem interrupção.</p>`,
          },
        });
      } catch (_) { /* silencioso */ }

      toast.success("Conta criada! Você tem 21 dias grátis para testar tudo.");
      nav("/app");
    } catch (e) {
      console.error("[signup]", e);
      toast.error("Não foi possível concluir o cadastro. Tente novamente em alguns instantes.");
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
          <div className="space-y-2">
            <Label>Plano de interesse (após o trial)</Label>
            <select
              value={planSlug}
              onChange={(e) => setPlanSlug(e.target.value)}
              className="w-full h-10 rounded-md bg-background border border-input px-3 text-sm"
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Durante os 21 dias de trial, <strong>todos os módulos estão liberados</strong>. A escolha do plano é só para depois do teste — sem cobrança agora, sem cartão.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Código de cupom (opcional)</Label>
            <div className="flex gap-2">
              <Input
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponPreview(null); }}
                placeholder="Ex.: FROTA21"
                className="font-mono uppercase"
              />
              <Button type="button" variant="outline" onClick={validateCoupon} disabled={validatingCoupon || !couponCode.trim()}>
                {validatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar"}
              </Button>
            </div>
            {couponPreview && (
              <p className={`text-xs ${couponPreview.valid ? "text-success" : "text-destructive"}`}>
                {couponPreview.valid ? `✓ ${couponPreview.message}` : `✗ ${couponPreview.message}`}
              </p>
            )}
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
