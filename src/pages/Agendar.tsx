import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Truck, ArrowLeft, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import WhatsappFloatingButton from "@/components/WhatsappFloatingButton";

const VEICULOS_OPTS = ["1-10", "11-30", "31-100", "Mais de 100"];

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function Agendar() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    empresa: "",
    quantidade_veiculos: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.nome.trim() || form.nome.trim().length < 2) e.nome = "Informe seu nome completo";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Email inválido";
    const digits = form.telefone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) e.telefone = "WhatsApp inválido";
    if (!form.empresa.trim()) e.empresa = "Informe a empresa";
    if (!form.quantidade_veiculos) e.quantidade_veiculos = "Selecione a quantidade";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-lead", {
        body: {
          nome: form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          telefone: form.telefone.replace(/\D/g, ""),
          empresa: form.empresa.trim(),
          quantidade_veiculos: form.quantidade_veiculos,
          origem: "CAL_COM",
        },
      });
      if (error || (data as any)?.error) {
        const msg = (data as any)?.error;
        toast.error(typeof msg === "string" ? msg : error?.message || "Não foi possível salvar. Tente novamente.");
        setSubmitting(false);
        return;
      }
      const qs = new URLSearchParams({
        name: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
      }).toString();
      nav(`/agendar/calendario?${qs}`);
    } catch (err: any) {
      toast.error(err?.message || "Erro inesperado.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">FrotaOps</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="sm">Entrar</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-60 pointer-events-none" />
        <div className="relative max-w-2xl mx-auto px-4 md:px-6 pt-10 pb-6 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">
            Vamos conhecer <span className="text-primary glow-text">sua frota</span>
          </h1>
          <p className="text-muted-foreground mt-3">
            Preencha rápido e agende sua demo de 30 minutos.
          </p>
        </div>
      </section>

      <section className="max-w-xl mx-auto px-4 md:px-6 pb-16">
        <form onSubmit={submit} className="surface-card rounded-xl border border-border/60 p-5 md:p-7 space-y-4">
          <Field label="Nome completo" error={errors.nome}>
            <Input
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
            />
          </Field>
          <Field label="Email corporativo" error={errors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="voce@empresa.com.br"
              autoComplete="email"
              inputMode="email"
            />
          </Field>
          <Field label="WhatsApp" error={errors.telefone}>
            <Input
              value={form.telefone}
              onChange={(e) => set("telefone", maskPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              autoComplete="tel"
              inputMode="tel"
            />
          </Field>
          <Field label="Nome da empresa" error={errors.empresa}>
            <Input
              value={form.empresa}
              onChange={(e) => set("empresa", e.target.value)}
              placeholder="Sua empresa"
              autoComplete="organization"
            />
          </Field>
          <Field label="Quantos veículos tem a frota" error={errors.quantidade_veiculos}>
            <Select
              value={form.quantidade_veiculos}
              onValueChange={(v) => set("quantidade_veiculos", v)}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {VEICULOS_OPTS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Button
            type="submit"
            disabled={submitting}
            size="lg"
            className="w-full bg-gradient-primary text-primary-foreground shadow-glow font-semibold h-12"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Continuar para agendamento <ArrowRight className="h-4 w-4 ml-1" />
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Seus dados são tratados em conformidade com a LGPD.
          </p>
        </form>
      </section>

      <WhatsappFloatingButton message="Olá! Vi a página de agendamento do FrotaOps e gostaria de falar antes de marcar." />
    </div>
  );
}

function Field({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}