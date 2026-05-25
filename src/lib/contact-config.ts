// Configuração central de contato público (WhatsApp e agendamento).
// Trocar PUBLIC_WHATSAPP_NUMBER pelo número real quando disponível.
export const PUBLIC_WHATSAPP_NUMBER = "55017981709009";
export const PUBLIC_WHATSAPP_DEFAULT_MESSAGE = "Olá, gostaria de conhecer o FrotaOps.";
export const PUBLIC_CAL_URL = "https://cal.com/nandovolpijb-yegigv/demo";

export function buildWhatsappUrl(message?: string) {
  const text = encodeURIComponent(message ?? PUBLIC_WHATSAPP_DEFAULT_MESSAGE);
  return `https://wa.me/${PUBLIC_WHATSAPP_NUMBER}?text=${text}`;
}