import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Truck,
  Gauge,
  Fuel,
  Wrench,
  ShieldCheck,
  BarChart3,
  ClipboardCheck,
  Users,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  AlertOctagon,
  Receipt,
  AlertTriangle,
  History,
} from "lucide-react";

const features = [
  { icon: Truck, title: "Veículos & Documentos", desc: "Cadastro completo, vencimentos, histórico e auditoria por veículo." },
  { icon: Fuel, title: "Combustível Inteligente", desc: "Detecção de anomalias, consumo esperado e fluxo posto-confirma." },
  { icon: Wrench, title: "Manutenção Preventiva", desc: "Planos por KM/tempo, ordens, custos e indicadores de disponibilidade." },
  { icon: ClipboardCheck, title: "Checklists Digitais", desc: "Templates customizáveis, evidências por foto e bloqueio operacional." },
  { icon: ShieldCheck, title: "Seguros & Sinistros", desc: "Apólices, corretores e extração automática por IA." },
  { icon: BarChart3, title: "BI Executivo", desc: "Custo/km, KPIs em tempo real e exportação para a diretoria." },
  { icon: AlertOctagon, title: "Gestão de Sinistros", desc: "Registro de ocorrências, fotos, BO e custo de reparo por veículo.", soon: true },
  { icon: Receipt, title: "Despesas Operacionais", desc: "IPVA, licenciamento, lavagem, pedágio e estacionamento centralizados.", soon: true },
  { icon: AlertTriangle, title: "Gestão Completa de Multas e Avisos", desc: "Cadastro via foto com IA, controle de prazos, indicação de motorista, recursos, alertas e relatórios por motorista e veículo." },
  { icon: History, title: "Histórico Completo do Veículo", desc: "Linha do tempo 360°: manutenções, combustível, sinistros e indicadores.", soon: true },
];

const metrics = [
  { v: "−27%", l: "custo por km" },
  { v: "+41%", l: "disponibilidade da frota" },
  { v: "100%", l: "rastreabilidade fiscal" },
  { v: "<2min", l: "para registrar abastecimento" },
];

const plans = [
  {
    name: "Starter",
    price: "R$ 149",
    suffix: "/mês",
    desc: "Para frotas em estruturação.",
    features: ["Até 10 veículos", "Motoristas ilimitados", "Combustível + manutenção", "Suporte por email"],
    cta: "Começar",
    highlight: false,
  },
  {
    name: "Pro",
    price: "R$ 449",
    suffix: "/mês",
    desc: "Operação consolidada com BI.",
    features: ["Até 50 veículos", "Checklists & seguros", "Detecção de anomalias", "Posto integrado", "Suporte prioritário"],
    cta: "Assinar Pro",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    suffix: "",
    desc: "Multi-empresa, SSO e SLA.",
    features: ["Veículos ilimitados", "Multi-empresa / grupo", "SSO + auditoria avançada", "Onboarding dedicado"],
    cta: "Falar com vendas",
    highlight: false,
  },
];

export default function Landing() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">FrotaOps</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#recursos" className="hover:text-foreground transition-colors">Recursos</a>
            <a href="#metricas" className="hover:text-foreground transition-colors">Resultados</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-glow font-semibold">
                Começar grátis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-70 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="max-w-3xl space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Plataforma executiva de gestão de frota
            </div>
            <h1 className="font-display text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
              Comando total <span className="text-primary glow-text">da sua frota</span>,
              do posto à diretoria.
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Veículos, motoristas, manutenção, abastecimento, checklists e BI — em uma única
              plataforma com auditoria fiscal e detecção de anomalias por IA.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link to="/signup">
                <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow font-semibold h-12 px-7">
                  Começar agora <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 text-success border border-success/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide">
                <CheckCircle2 className="h-3.5 w-3.5" />
                21 dias grátis — sem cartão de crédito
              </span>
              <a href="#planos">
                <Button size="lg" variant="outline" className="h-12 px-7">
                  Ver planos
                </Button>
              </a>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Sem cartão para começar · Cancele quando quiser · Dados em conformidade LGPD
            </p>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section id="metricas" className="border-y border-border/60 bg-background-elevated/40">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((m) => (
            <div key={m.l} className="text-center lg:text-left">
              <div className="font-display text-4xl lg:text-5xl font-bold text-primary glow-text">{m.v}</div>
              <div className="text-sm text-muted-foreground mt-1">{m.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-2xl mb-12">
          <h2 className="font-display text-4xl font-bold leading-tight">
            Tudo que sua operação precisa, <span className="text-primary">sem planilha</span>.
          </h2>
          <p className="text-muted-foreground mt-4">
            Módulos integrados que conversam entre si. Cada KM, cada litro, cada nota — rastreável.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="surface-card rounded-xl p-6 hover:border-primary/40 transition-colors relative">
              {f.soon && (
                <span className="absolute top-3 right-3 text-[10px] uppercase font-mono tracking-wider text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-full">
                  Em breve
                </span>
              )}
              <div className="h-11 w-11 rounded-lg bg-primary/15 grid place-items-center text-primary mb-4">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-background-elevated/40 border-y border-border/60">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="max-w-2xl mb-12">
            <h2 className="font-display text-4xl font-bold">Da frota ao boardroom em 3 passos</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Truck, t: "1. Cadastre sua frota", d: "Importe veículos, motoristas e documentos. Em minutos sua operação está modelada." },
              { icon: Gauge, t: "2. Operação no campo", d: "Motoristas registram KM, abastecem com QR no posto e completam checklists pelo celular." },
              { icon: BarChart3, t: "3. Decisão executiva", d: "BI consolida custos, alertas e KPIs. A diretoria enxerga a frota em tempo real." },
            ].map((s) => (
              <div key={s.t} className="space-y-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
                  <s.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-display text-xl font-semibold">{s.t}</h3>
                <p className="text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="planos" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-4xl font-bold">Planos que escalam com sua frota</h2>
          <p className="text-muted-foreground mt-4">Comece pequeno. Cresça sem trocar de sistema.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl p-7 flex flex-col ${
                p.highlight
                  ? "ring-glow bg-gradient-card border border-primary/40"
                  : "surface-card"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                {p.highlight && (
                  <span className="text-[10px] uppercase tracking-wider font-mono text-primary">Mais popular</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{p.desc}</p>
              <div className="mt-5 mb-6">
                <span className="font-display text-4xl font-bold">{p.price}</span>
                <span className="text-muted-foreground">{p.suffix}</span>
              </div>
              <ul className="space-y-2.5 text-sm flex-1">
                {p.features.map((it) => (
                  <li key={it} className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
              <Link to="/signup" className="mt-7">
                <Button
                  className={`w-full h-11 font-semibold ${
                    p.highlight
                      ? "bg-gradient-primary text-primary-foreground shadow-glow"
                      : ""
                  }`}
                  variant={p.highlight ? "default" : "outline"}
                >
                  {p.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="surface-card rounded-3xl p-10 lg:p-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-glow opacity-50 pointer-events-none" />
          <div className="relative space-y-5 max-w-2xl mx-auto">
            <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
              <Users className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="font-display text-3xl lg:text-4xl font-bold">
              Coloque sua frota no piloto executivo.
            </h2>
            <p className="text-muted-foreground">Crie sua conta em 2 minutos. Cancele quando quiser.</p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link to="/signup">
                <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow font-semibold h-12 px-7">
                  Criar conta gratuita <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="h-12 px-7">Já tenho conta</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-gradient-primary grid place-items-center">
              <Truck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-foreground">FrotaOps</span>
            <span className="ml-2">© {new Date().getFullYear()} · Enterprise Fleet Intelligence</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/login" className="hover:text-foreground">Entrar</Link>
            <Link to="/signup" className="hover:text-foreground">Criar conta</Link>
            <Link to="/termos" className="hover:text-foreground">Termos</Link>
            <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <a href="mailto:contato@frotaops.com.br" className="hover:text-foreground">contato@frotaops.com.br</a>
          </div>
        </div>
      </footer>
    </div>
  );
}