export type AxleLayout = "moto_2" | "carro_4" | "truck_6" | "truck_10" | "carreta_18" | "custom";

export const AXLE_LAYOUTS: { value: AxleLayout; label: string; positions: string[] }[] = [
  { value: "moto_2", label: "Moto (2 pneus)", positions: ["DI", "TR"] },
  {
    value: "carro_4",
    label: "Carro / utilitário (4 + estepe)",
    positions: ["DD", "DE", "TD", "TE", "EST"],
  },
  {
    value: "truck_6",
    label: "Caminhão 6x2 leve (6 pneus)",
    positions: ["DD", "DE", "TDD", "TDE", "TTD", "TTE"],
  },
  {
    value: "truck_10",
    label: "Caminhão truck (10 pneus)",
    positions: ["DD", "DE", "1DD", "1DI", "1EI", "1ED", "2DD", "2DI", "2EI", "2ED"],
  },
  {
    value: "carreta_18",
    label: "Carreta + cavalo (18 pneus)",
    positions: [
      "C-DD","C-DE","C-1DD","C-1DI","C-1EI","C-1ED","C-2DD","C-2DI","C-2EI","C-2ED",
      "R-1DD","R-1DI","R-1EI","R-1ED","R-2DD","R-2DI","R-2EI","R-2ED",
    ],
  },
  { value: "custom", label: "Personalizado", positions: [] },
];

export const TIRE_KIND = [
  { value: "novo", label: "Novo" },
  { value: "recapado", label: "Recapado" },
  { value: "remold", label: "Remold" },
] as const;

export const TIRE_STATUS = [
  { value: "estoque", label: "Em estoque" },
  { value: "instalado", label: "Instalado" },
  { value: "recapagem", label: "Em recapagem" },
  { value: "descartado", label: "Descartado" },
] as const;

export const MOVEMENT_TYPES = [
  { value: "instalacao", label: "Instalação" },
  { value: "remocao", label: "Remoção" },
  { value: "rodizio", label: "Rodízio" },
  { value: "recapagem", label: "Enviar p/ recapagem" },
  { value: "calibragem", label: "Calibragem" },
  { value: "inspecao", label: "Inspeção" },
  { value: "descarte", label: "Descarte" },
  { value: "compra", label: "Compra" },
] as const;

export const STATUS_TONE: Record<string, string> = {
  estoque: "bg-info/20 text-info border-info/30",
  instalado: "bg-success/20 text-success border-success/30",
  recapagem: "bg-warning/20 text-warning border-warning/30",
  descartado: "bg-muted text-muted-foreground",
};

export const KIND_TONE: Record<string, string> = {
  novo: "bg-primary/20 text-primary border-primary/30",
  recapado: "bg-warning/20 text-warning border-warning/30",
  remold: "bg-accent/20 text-accent border-accent/30",
};

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function getLayoutPositions(layout: AxleLayout, custom: string[] = []): string[] {
  if (layout === "custom") return custom;
  return AXLE_LAYOUTS.find((l) => l.value === layout)?.positions ?? [];
}

/** % de vida útil restante baseado no sulco atual vs inicial. */
export function treadHealth(initial?: number | null, current?: number | null, min = 1.6): number {
  if (!initial || !current) return 100;
  const usable = Math.max(0, initial - min);
  const left = Math.max(0, current - min);
  return Math.round((left / usable) * 100);
}

/** Label do alerta com base em sulco e km. */
export function tireAlertLevel(t: {
  current_tread_mm?: number | null;
  min_tread_mm?: number | null;
  km_accumulated?: number | null;
  km_target?: number | null;
}): { level: "ok" | "atencao" | "critico"; reason?: string } {
  const min = t.min_tread_mm ?? 1.6;
  if (t.current_tread_mm != null && t.current_tread_mm <= min)
    return { level: "critico", reason: "Sulco abaixo do limite" };
  if (t.km_target && t.km_accumulated != null && t.km_accumulated >= t.km_target)
    return { level: "critico", reason: "KM alvo atingido" };
  if (t.current_tread_mm != null && t.current_tread_mm <= min + 1.5)
    return { level: "atencao", reason: "Sulco próximo ao limite" };
  if (t.km_target && t.km_accumulated != null && t.km_accumulated >= t.km_target * 0.85)
    return { level: "atencao", reason: "Próximo do KM alvo" };
  return { level: "ok" };
}