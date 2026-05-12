// Supabase Auth Email Hook — recebe webhook do Auth, valida HMAC (standardwebhooks),
// renderiza email via send-transactional-email e devolve 200.
// Configurar no painel: Cloud → Auth → Hooks → "Send Email Hook"
//   URL:    https://<project>.supabase.co/functions/v1/auth-email-hook
//   Secret: gerado pelo painel → salvar como SEND_EMAIL_HOOK_SECRET
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type EmailActionType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email_change_new"
  | "email_change_current";

interface HookPayload {
  user: { id: string; email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

const TYPE_MAP: Record<EmailActionType, "auth_signup" | "auth_recovery" | "auth_email_change" | "auth_magiclink"> = {
  signup: "auth_signup",
  invite: "auth_signup",
  magiclink: "auth_magiclink",
  recovery: "auth_recovery",
  email_change: "auth_email_change",
  email_change_new: "auth_email_change",
  email_change_current: "auth_email_change",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
    if (!HOOK_SECRET) {
      console.error("[auth-email-hook] SEND_EMAIL_HOOK_SECRET ausente");
      return new Response(JSON.stringify({ error: "hook secret missing" }), { status: 500 });
    }

    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);

    // Standardwebhooks: secret pode vir como "v1,whsec_xxx" — extrair parte base64
    const cleanSecret = HOOK_SECRET.replace(/^v1,whsec_/, "");
    const wh = new Webhook(cleanSecret);
    const verified = wh.verify(payload, headers) as HookPayload;
    const { user, email_data } = verified;

    const templateType = TYPE_MAP[email_data.email_action_type] ?? "auth_signup";

    // confirmation_url padrão Supabase
    const confirmation_url =
      `${email_data.site_url}/auth/v1/verify` +
      `?token=${encodeURIComponent(email_data.token_hash)}` +
      `&type=${encodeURIComponent(email_data.email_action_type)}` +
      `&redirect_to=${encodeURIComponent(email_data.redirect_to ?? "")}`;

    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({
        type: templateType,
        to: user.email,
        data: { confirmation_url, token: email_data.token },
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error(`[auth-email-hook] sender failed ${r.status}:`, err);
      return new Response(JSON.stringify({ error: "sender failed", details: err }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[auth-email-hook] ok type=${email_data.email_action_type} to=${user.email}`);
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[auth-email-hook] fail:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
});