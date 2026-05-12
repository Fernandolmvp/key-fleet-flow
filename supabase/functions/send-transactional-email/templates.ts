// Templates HTML inline para emails transacionais FrotaOps.
// Renderizam string HTML — sem dependências externas, leve, robusto em Deno.

const COLORS = {
  bgOuter: "#0a0e1a",
  bgCard: "#0f1420",
  border: "#1f2937",
  text: "#e5e7eb",
  textMuted: "#94a3b8",
  primary: "#3b82f6",
  accent: "#8b5cf6",
};

function shell(opts: {
  preview: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  footerNote?: string;
}): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>FrotaOps</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bgOuter};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS.text};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${opts.preview}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bgOuter};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${COLORS.bgCard};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
      <tr><td style="padding:28px 32px;border-bottom:1px solid ${COLORS.border};background:linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.04));">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;padding-right:12px;">
              <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent});display:inline-block;text-align:center;line-height:40px;font-size:20px;">🚚</div>
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#fff;">FrotaOps</span>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:36px 32px 24px;">
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#fff;line-height:1.3;">${opts.heading}</h1>
        <div style="font-size:15px;line-height:1.6;color:${COLORS.text};">${opts.body}</div>
        <div style="margin:32px 0;text-align:center;">
          <a href="${opts.ctaUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent});color:#fff;text-decoration:none;font-weight:600;font-size:15px;border-radius:999px;box-shadow:0 8px 24px rgba(59,130,246,0.35);">${opts.ctaLabel} &rarr;</a>
        </div>
        <p style="margin:20px 0 8px;font-size:13px;color:${COLORS.textMuted};">Ou copie e cole este link no navegador:</p>
        <p style="margin:0;font-size:12px;word-break:break-all;color:${COLORS.primary};"><a href="${opts.ctaUrl}" style="color:${COLORS.primary};text-decoration:underline;">${opts.ctaUrl}</a></p>
        ${opts.footerNote ? `<p style="margin:24px 0 0;font-size:12px;color:${COLORS.textMuted};">${opts.footerNote}</p>` : ""}
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid ${COLORS.border};background:${COLORS.bgOuter};">
        <p style="margin:0 0 6px;font-size:12px;color:${COLORS.textMuted};">Precisa de ajuda? <a href="mailto:contato@frotaops.com.br" style="color:${COLORS.primary};text-decoration:none;">contato@frotaops.com.br</a></p>
        <p style="margin:0;font-size:11px;color:${COLORS.textMuted};">FrotaOps · Enterprise Fleet Intelligence · Você recebeu este email porque uma ação foi solicitada na sua conta.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export type AuthEmailType =
  | "auth_signup"
  | "auth_recovery"
  | "auth_email_change"
  | "auth_magiclink";

export function renderAuthEmail(
  type: AuthEmailType,
  data: { confirmation_url: string; token?: string }
): { subject: string; html: string } {
  switch (type) {
    case "auth_signup":
      return {
        subject: "Confirme seu email · FrotaOps",
        html: shell({
          preview: "Confirme seu email para ativar sua conta FrotaOps",
          heading: "Bem-vindo à FrotaOps",
          body: `<p style="margin:0;">Estamos felizes em ter você por aqui. Para ativar sua conta e começar a usar o painel de comando da sua frota, confirme seu email clicando no botão abaixo.</p>`,
          ctaLabel: "Confirmar email",
          ctaUrl: data.confirmation_url,
          footerNote: "Este link expira em 24 horas. Se não foi você quem criou esta conta, pode ignorar este email.",
        }),
      };
    case "auth_recovery":
      return {
        subject: "Redefinir sua senha · FrotaOps",
        html: shell({
          preview: "Link para redefinir a senha da sua conta FrotaOps",
          heading: "Vamos redefinir sua senha",
          body: `<p style="margin:0;">Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para definir uma nova senha. Se não foi você, ignore este email — sua senha atual continua válida.</p>`,
          ctaLabel: "Redefinir senha",
          ctaUrl: data.confirmation_url,
          footerNote: "Este link expira em 1 hora. Por segurança, ele só pode ser usado uma única vez.",
        }),
      };
    case "auth_email_change":
      return {
        subject: "Confirme seu novo email · FrotaOps",
        html: shell({
          preview: "Confirme seu novo endereço de email FrotaOps",
          heading: "Confirmação de novo email",
          body: `<p style="margin:0;">Você solicitou alterar o email de acesso da sua conta FrotaOps. Para confirmar essa alteração, clique no botão abaixo.</p>`,
          ctaLabel: "Confirmar novo email",
          ctaUrl: data.confirmation_url,
          footerNote: "Se não foi você, entre em contato imediatamente: contato@frotaops.com.br",
        }),
      };
    case "auth_magiclink":
      return {
        subject: "Seu link de acesso · FrotaOps",
        html: shell({
          preview: "Acesse sua conta FrotaOps com 1 clique",
          heading: "Acesse sua conta",
          body: `<p style="margin:0;">Use o link abaixo para entrar na sua conta FrotaOps sem precisar de senha.</p>`,
          ctaLabel: "Entrar agora",
          ctaUrl: data.confirmation_url,
          footerNote: "Este link expira em 1 hora e só pode ser usado uma vez.",
        }),
      };
  }
}