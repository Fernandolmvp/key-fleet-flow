import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Copy, Check, AlertTriangle, Building2 } from "lucide-react";
import { toast } from "sonner";
import { formatCnpj, isValidCnpj, onlyDigits } from "@/lib/document";

type Result = {
  company_id: string;
  manager_email: string;
  temp_password: string;
  coupon_applied: any;
};

export default function CompanyManualCreate() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const leadId = params.get("leadId");
  const [form, setForm] = useState({
    name: "", cnpj: "", phone: "", city: "", state: "",
    mgrName: "", mgrEmail: "", mgrPhone: "",
    couponCode: "", isExempt: false,
  });
  const [couponPreview, setCouponPreview] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Pre-fill form when converting a lead
  useEffect(() => {
    if (!leadId) return;
    (async () => {
      const { data, error } = await supabase
        .from("leads").select("*").eq("id", leadId).maybeSingle();
      if (error || !data) return;
      setForm((f) => ({
        ...f,
        name: data.empresa ?? f.name,
        cnpj: data.cnpj ? formatCnpj(data.cnpj) : f.cnpj,
        phone: data.telefone ?? f.phone,
        mgrName: data.nome ?? f.mgrName,
        mgrEmail: data.email ?? f.mgrEmail,
        mgrPhone: data.telefone ?? f.mgrPhone,
      }));
      toast.info("Dados do lead pré-preenchidos");
    })();
  }, [leadId]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function validateCoupon() {
    if (!form.couponCode.trim()) return;
    setValidating(true);
    const { data, error } = await supabase.rpc("preview_coupon", {
      p_code: form.couponCode.trim().toUpperCase(),
      p_cnpj: onlyDigits(form.cnpj) || null,
    });
    setValidating(false);
    if (error) { toast.error(error.message); return; }
    setCouponPreview(data);
    if ((data as any)?.valid) toast.success("Cupom válido");
    else toast.error((data as any)?.message || "Cupom inválido");
  }

  async function submit() {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    if (!isValidCnpj(form.cnpj)) return toast.error("CNPJ inválido");
    if (!form.mgrName.trim()) return toast.error("Nome do gestor obrigatório");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.mgrEmail)) return toast.error("Email do gestor inválido");

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("admin-create-company-manual", {
      body: {
        company: {
          name: form.name.trim(),
          cnpj: onlyDigits(form.cnpj),
          phone: form.phone || null,
          city: form.city || null,
          state: form.state || null,
        },
        manager: {
          name: form.mgrName.trim(),
          email: form.mgrEmail.trim().toLowerCase(),
          phone: form.mgrPhone || null,
        },
        coupon_code: form.couponCode.trim() || null,
        is_exempt_from_trial: form.isExempt,
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Erro");
      return;
    }
    setResult(data as Result);
    toast.success("Empresa criada!");

    // Mark lead as converted
    if (leadId && (data as any)?.company_id) {
      await supabase
        .from("leads")
        .update({ status: "CONVERTIDO", converted_company_id: (data as any).company_id })
        .eq("id", leadId);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado");
    setTimeout(() => setCopied(null), 1500);
  }

  if (result) {
    const wa = `Olá! Sua conta no FrotaOps está pronta. Acesse https://frotaops.com.br com email ${result.manager_email} e senha temporária ${result.temp_password}. Recomendo trocar a senha no primeiro acesso em Perfil → Alterar senha.`;
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Card className="border-success bg-success/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <Check className="h-5 w-5" /> Empresa criada com sucesso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/30 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <span><strong>Atenção:</strong> a senha temporária NÃO será exibida novamente. Copie agora.</span>
            </div>
            <div>
              <Label>Email do gestor</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={result.manager_email} className="font-mono" />
                <Button variant="outline" size="icon" onClick={() => copy(result.manager_email, "email")}>
                  {copied === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label>Senha temporária</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={result.temp_password} className="font-mono text-lg" />
                <Button variant="outline" size="icon" onClick={() => copy(result.temp_password, "pwd")}>
                  {copied === "pwd" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={() => copy(wa, "all")}>
              {copied === "all" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Copiar mensagem pronta para WhatsApp
            </Button>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setResult(null); setForm({ name:"", cnpj:"", phone:"", city:"", state:"", mgrName:"", mgrEmail:"", mgrPhone:"", couponCode:"", isExempt:false }); setCouponPreview(null); }}>
                Criar outra
              </Button>
              <Button className="flex-1" onClick={() => nav("/super-admin")}>Ver empresas</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-display font-bold">Criar empresa manualmente</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Cria empresa + gestor com senha temporária. Email já vem confirmado (bypass).
      </p>

      <Card>
        <CardHeader><CardTitle>Dados da empresa</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <Label>CNPJ *</Label>
            <Input value={form.cnpj} onChange={(e) => set("cnpj", formatCnpj(e.target.value))} placeholder="00.000.000/0000-00" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div>
            <Label>Estado (UF)</Label>
            <Input maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dados do gestor</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.mgrName} onChange={(e) => set("mgrName", e.target.value)} />
          </div>
          <div>
            <Label>Email *</Label>
            <Input type="email" value={form.mgrEmail} onChange={(e) => set("mgrEmail", e.target.value)} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.mgrPhone} onChange={(e) => set("mgrPhone", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Opcionais</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Cupom</Label>
            <div className="flex gap-2 mt-1">
              <Input value={form.couponCode} onChange={(e) => { set("couponCode", e.target.value.toUpperCase()); setCouponPreview(null); }} placeholder="EX: PROMO30" />
              <Button variant="outline" onClick={validateCoupon} disabled={validating || !form.couponCode.trim()}>
                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar"}
              </Button>
            </div>
            {couponPreview && (
              <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto">
                {JSON.stringify(couponPreview, null, 2)}
              </pre>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="exempt" checked={form.isExempt} onCheckedChange={(v) => set("isExempt", !!v)} />
            <Label htmlFor="exempt" className="cursor-pointer">Marcar como isento de trial (acesso vitalício)</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => nav("/super-admin")}>Cancelar</Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Criar empresa
        </Button>
      </div>
    </div>
  );
}
