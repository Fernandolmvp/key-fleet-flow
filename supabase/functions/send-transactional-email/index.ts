// Sender genérico transacional: aceita type discriminado.
// - "raw"  → { to, subject, html, reply_to? }  (compatível com chamadas existentes)
// - "auth_signup" | "auth_recovery" | "auth_email_change" | "auth_magiclink"
//      → { to, data: { confirmation_url, token? } } e renderiza template interno
import { corsHeaders } from "../_shared/partner-auth.ts";
import { renderAuthEmail, type AuthEmailType } from "./templates.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "FrotaOps <noreply@frotaops.com.br>";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Body =
  | { type: "raw"; to: string; subject: string; html: string; reply_to?: string }
  | { type: AuthEmailType; to: string; data: { confirmation_url: string; token?: string }; reply_to?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY ausente" }, 500);

    const body = (await req.json()) as Body;
    if (!body?.type || !body?.to) return json({ error: "Campos obrigatórios: type, to" }, 400);

    let subject: string;
    let html: string;
    let reply_to: string | undefined = (body as any).reply_to;

    if (body.type === "raw") {
      if (!body.subject || !body.html) return json({ error: "raw exige subject e html" }, 400);
      subject = body.subject;
      html = body.html;
    } else {
      if (!body.data?.confirmation_url) return json({ error: "auth_* exige data.confirmation_url" }, 400);
      const rendered = renderAuthEmail(body.type, body.data);
      subject = rendered.subject;
      html = rendered.html;
    }

    const r = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: FROM,
        to: [body.to],
        subject,
        html,
        ...(reply_to ? { reply_to } : {}),
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("[send-transactional-email] resend error:", r.status, data);
      return json({ error: `Resend ${r.status}`, details: data }, 502);
    }
    console.log(`[send-transactional-email] sent type=${body.type} to=${body.to} id=${(data as any)?.id}`);
    return json({ ok: true, id: (data as any)?.id ?? null });
  } catch (e) {
    console.error("[send-transactional-email] fail:", e);
    return json({ error: (e as Error).message }, 500);
  }
});