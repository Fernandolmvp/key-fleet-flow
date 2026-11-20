// Conteúdo estático da página inicial pública (landing).
// Os valores abaixo espelham a tabela `plans` do app interno:
//   starter 149/10 · pro 349/30 · business 749/100 · enterprise custom (sem preço)
// Nada aqui é lido do banco: a landing permanece pública e fora do app interno.

export type LandingPlan = {
  slug: "starter" | "pro" | "business" | "enterprise";
  name: string;
  /** Rótulo de preço exibido. Enterprise não tem preço publicado. */
  priceLabel: string;
  /** Sufixo do preço ("/mês). Ausente quando não há preço. */
  priceSuffix?: string;
  /** Limite de veículos descrito em texto, como no cadastro. */
  limitLabel: string;
  blurb: string;
  highlights: string[];
  popular?: boolean;
  /** Todas as ações de plano levam ao agendamento de demonstração. */
  demoPath: string;
};

export const landingPlans: LandingPlan[] = [
  {
    slug: "starter",
    name: "Starter",
    priceLabel: "R$ 149",
    priceSuffix: "/mês",
    limitLabel: "até 10 veículos",
    blurb: "Para operações pequenas que querem sair da planilha.",
    highlights: [
      "Veículos, motoristas e documentos",
      "Abastecimento e checklists",
      "Alertas de vencimento",
    ],
    demoPath: "/agendar",
  },
  {
    slug: "pro",
    name: "Pro",
    priceLabel: "R$ 349",
    priceSuffix: "/mês",
    limitLabel: "até 30 veículos",
    blurb: "Para frotas em crescimento que precisam de manutenção sob controle.",
    highlights: [
      "Tudo do Starter",
      "Manutenção preventiva por KM",
      "Seguros com extração por IA",
    ],
    popular: true,
    demoPath: "/agendar",
  },
  {
    slug: "business",
    name: "Business",
    priceLabel: "R$ 749",
    priceSuffix: "/mês",
    limitLabel: "até 100 veículos",
    blurb: "Para operações com várias equipes e maior volume de registros.",
    highlights: [
      "Tudo do Pro",
      "Multas, sinistros e despesas",
      "BI executivo completo",
    ],
    demoPath: "/agendar",
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    priceLabel: "Sob consulta",
    limitLabel: "limite de veículos personalizado",
    blurb: "Para operações que precisam de regras e integrações dedicadas.",
    highlights: [
      "Tudo do Business",
      "Limite de veículos personalizado",
      "Integrações e API dedicada",
    ],
    demoPath: "/agendar",
  },
];

/**
 * Frases da faixa "Resultados". Não contêm números nem percentuais —
 * os indicadores numéricos (-27%, +41%, 100%) foram retirados da página.
 */
export const landingHighlights: string[] = [
  "Custo por km sob controle",
  "Disponibilidade da frota em alta",
  "Rastreabilidade fiscal completa",
  "Abastecimento registrado na hora",
];
