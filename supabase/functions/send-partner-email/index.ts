// Envio de emails transacionais via Resend (gateway Lovable).
// Usado para convites/reset de parceiros (postos, oficinas).
import { corsHeaders } from "../_shared/partner-auth.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "FrotaOps <noreply@send.frotaops.com.br>";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY ausente" }, 500);

    const body = await req.json();
    const { to, subject, html, reply_to } = body as {
      to: string; subject: string; html: string; reply_to?: string;
    };
    if (!to || !subject || !html) return json({ error: "Campos obrigatórios: to, subject, html" }, 400);

    const r = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html,
        ...(reply_to ? { reply_to } : {}),
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("[send-partner-email] resend error:", r.status, data);
      return json({ error: `Resend ${r.status}`, details: data }, 502);
    }
    return json({ ok: true, id: (data as any)?.id ?? null });
  } catch (e) {
    console.error("[send-partner-email] fail:", e);
    return json({ error: (e as Error).message }, 500);
  }
});