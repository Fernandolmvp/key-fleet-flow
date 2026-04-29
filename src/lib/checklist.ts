// Checklist padrão fixo para manutenção preventiva
export interface ChecklistItem {
  key: string;
  label: string;
  category: string;
}

export const PREVENTIVE_CHECKLIST: ChecklistItem[] = [
  // Motor / Lubrificação
  { key: "oleo_motor", label: "Troca de óleo do motor", category: "Motor" },
  { key: "filtro_oleo", label: "Filtro de óleo", category: "Motor" },
  { key: "filtro_ar", label: "Filtro de ar", category: "Motor" },
  { key: "filtro_combustivel", label: "Filtro de combustível", category: "Motor" },
  { key: "filtro_cabine", label: "Filtro do ar-condicionado / cabine", category: "Motor" },
  { key: "velas", label: "Velas de ignição", category: "Motor" },
  { key: "correia_dentada", label: "Correia dentada / acessórios", category: "Motor" },
  // Freios
  { key: "pastilhas_freio", label: "Pastilhas de freio", category: "Freios" },
  { key: "discos_freio", label: "Discos de freio", category: "Freios" },
  { key: "fluido_freio", label: "Fluido de freio", category: "Freios" },
  { key: "freio_estacionamento", label: "Freio de estacionamento", category: "Freios" },
  // Suspensão / Direção
  { key: "amortecedores", label: "Amortecedores", category: "Suspensão" },
  { key: "buchas_pivos", label: "Buchas e pivôs", category: "Suspensão" },
  { key: "alinhamento", label: "Alinhamento e balanceamento", category: "Suspensão" },
  { key: "fluido_direcao", label: "Fluido da direção hidráulica", category: "Direção" },
  // Arrefecimento
  { key: "agua_radiador", label: "Aditivo do radiador", category: "Arrefecimento" },
  { key: "mangueiras", label: "Mangueiras de arrefecimento", category: "Arrefecimento" },
  // Pneus
  { key: "calibragem", label: "Calibragem dos pneus", category: "Pneus" },
  { key: "rodizio_pneus", label: "Rodízio de pneus", category: "Pneus" },
  // Elétrica
  { key: "bateria", label: "Bateria (teste de carga)", category: "Elétrica" },
  { key: "luzes_lanternas", label: "Luzes e lanternas", category: "Elétrica" },
  { key: "limpadores", label: "Palhetas dos limpadores", category: "Elétrica" },
  // Câmbio / Embreagem
  { key: "oleo_cambio", label: "Óleo do câmbio", category: "Câmbio" },
  { key: "embreagem", label: "Embreagem", category: "Câmbio" },
  // Inspeção geral
  { key: "vazamentos", label: "Inspeção de vazamentos", category: "Geral" },
  { key: "escapamento", label: "Sistema de escapamento", category: "Geral" },
];

export const DEFAULT_INTERVAL_KM = 10000;
export const ALERT_THRESHOLD_KM = 1000;