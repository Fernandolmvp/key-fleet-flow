import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Truck, Loader2, LogOut } from "lucide-react";
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
  companyName: z.string().trim().min(2, "Empresa obrigatória").max(120),
  cnpj: z.string().trim().refine((v) => onlyDigits(v).length === 14, "CNPJ deve ter 14 dígitos"),
  phone: z.string().trim().refine((v) => {
    const n = onlyDigits(v).length;
    return n === 10 || n === 11;
  }, "Telefone inválido"),
  contactName: z.string().trim().min(2, "Responsável obrigatório").max(100),
});

export default function OnboardingEmpresa() {
  const { user, loading, companies, refreshCompanies, signOut } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [planSlug, setPlanSlug] = useState("pro");
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<{ valid: boolean; message: string } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    cnpj: "",
    phone: "",
    contactName: user?.user_metadata?.full_name || "",
  });

  if (!loading && !user) return <Navigate to="/login" replace />;
  if (!loading && companies.length > 0) return <Navigate to="/app" replace />;

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
    const fullName = user?.user_metadata?.full_name || form.contactName;
    const email = user?.email || null;
    const { data: companyIdRet, error: rpcErr } = await supabase.rpc("bootstrap_company_v2" as any, {
      _company_name: form.companyName,
      _full_name: fullName,
      _cnpj: onlyDigits(form.cnpj),
      _phone: onlyDigits(form.phone),
      _contact_name: form.contactName,
      _email: email,
      _trial_plan_slug: planSlug,
    });
    if (rpcErr) {
      setBusy(false);
      const msg = String(rpcErr.message || "");
      if (/duplicate|unique|cnpj/i.test(msg)) {
        return toast.error("Já existe uma empresa com este CNPJ. Verifique ou fale com o suporte.");
      }
      return toast.error(msg || "Falha ao criar empresa");
    }

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

    await refreshCompanies();
    setBusy(false);
    toast.success("Empresa criada! Você tem 21 dias grátis pra testar tudo.");
    nav("/app");
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-gradient-surface">
      <div className="w-full max-w-md surface-card rounded-2xl p-8 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">FrotaOps</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold">Finalize o cadastro da sua empresa</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sua conta ({user?.email}) está pronta. Falta apenas configurar a empresa.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
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
            <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} required maxLength={100} />
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
              Durante os 21 dias de trial, <strong>todos os módulos estão liberados</strong>. Sem cobrança agora.
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
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar empresa e entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}