// Envia email de boas-vindas (primeiro acesso) via Resend gateway.
// Chamado pela função admin-create-company-manual.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "FrotaOps <noreply@frotaops.com.br>";
const REPLY_TO = "contato@frotaops.com.br";
const APP_BASE = "https://frotaops.com.br";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function buildHtml(nome: string, empresa: string, link: string) {
  const safeNome = (nome || "Gestor").replace(/[<>]/g, "");
  const safeEmpresa = (empresa || "").replace(/[<>]/g, "");
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#0b1220;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e6edf6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111a2e;border:1px solid #1f2a44;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:28px 28px 8px 28px;">
          <div style="font-size:22px;font-weight:800;letter-spacing:.5px;color:#22d3ee;">FrotaOps</div>
        </td></tr>
        <tr><td style="padding:8px 28px 0 28px;">
          <h1 style="margin:12px 0 6px 0;font-size:22px;color:#ffffff;">Olá, ${safeNome}!</h1>
          <p style="margin:0;color:#9fb0c9;font-size:15px;line-height:1.55;">Sua conta da empresa <strong style="color:#e6edf6;">${safeEmpresa}</strong> foi criada na FrotaOps. Defina sua senha para acessar a plataforma.</p>
        </td></tr>
        <tr><td style="padding:24px 28px;" align="center">
          <a href="${link}" style="display:inline-block;background:#22d3ee;color:#0b1220;text-decoration:none;font-weight:700;font-size:16px;padding:14px 22px;border-radius:10px;">Definir minha senha e acessar</a>
        </td></tr>
        <tr><td style="padding:0 28px 24px 28px;">
          <p style="margin:0;color:#7f93b0;font-size:13px;line-height:1.55;">Este link expira em <strong>48 horas</strong>. Se o botão não funcionar, copie e cole esta URL no navegador:<br/><span style="color:#9fb0c9;word-break:break-all;">${link}</span></p>
        </td></tr>
        <tr><td style="padding:0 28px 28px 28px;">
          <p style="margin:0;color:#9fb0c9;font-size:14px;">Bem-vindo a bordo,<br/><strong style="color:#e6edf6;">Equipe FrotaOps</strong></p>
        </td></tr>
        <tr><td style="padding:18px 28px;background:#0d152b;border-top:1px solid #1f2a44;">
          <p style="margin:0;color:#6b7d99;font-size:12px;">Dúvidas? Responda este email ou escreva para <a href="mailto:contato@frotaops.com.br" style="color:#22d3ee;text-decoration:none;">contato@frotaops.com.br</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}
function buildText(nome: string, empresa: string, link: string) {
  return `Olá, ${nome}!\n\nSua conta da empresa ${empresa} foi criada na FrotaOps. Defina sua senha para acessar:\n${link}\n\nO link expira em 48 horas.\n\nEquipe FrotaOps\ncontato@frotaops.com.br`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY ausente" }, 500);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const nome = String(body.nome ?? "").trim();
    const empresa = String(body.empresa ?? "").trim();
    const token = String(body.token ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Email inválido" }, 400);
    if (!token) return json({ error: "Token obrigatório" }, 400);

    const link = `${APP_BASE}/primeiro-acesso?token=${encodeURIComponent(token)}`;
    const html = buildHtml(nome, empresa, link);
    const text = buildText(nome, empresa, link);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Log pending
    await admin.from("email_send_log").insert({
      template_name: "welcome_first_access",
      recipient_email: email,
      status: "pending",
      metadata: { empresa, nome },
    });

    const r = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        reply_to: REPLY_TO,
        subject: "Bem-vindo à FrotaOps — acesse sua conta",
        html,
        text,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      await admin.from("email_send_log").insert({
        template_name: "welcome_first_access",
        recipient_email: email,
        status: "failed",
        error_message: `Resend ${r.status}: ${JSON.stringify(data)}`.slice(0, 1000),
        metadata: { empresa },
      });
      return json({ error: `Resend ${r.status}`, details: data }, 502);
    }

    const messageId = (data as any)?.id ?? null;
    await admin.from("email_send_log").insert({
      template_name: "welcome_first_access",
      recipient_email: email,
      status: "sent",
      message_id: messageId,
      metadata: { empresa },
    });

    return json({ ok: true, id: messageId, link });
  } catch (e) {
    console.error("send-welcome-email error", e);
    return json({ error: (e as Error).message }, 500);
  }
});