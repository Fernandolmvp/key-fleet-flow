// Cria/reenvia convite para um usuário da Oficina (portal /oficina).
// Apenas gestor da empresa.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, newInvitationToken } from "../_shared/partner-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendInviteEmail(opts: {
  to: string;
  recipientName: string;
  companyName: string;
  workshopName: string;
  acceptUrl: string;
  kind: "invite" | "reset";
}) {
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const subject = opts.kind === "reset"
      ? `Redefinir senha do portal Oficina — ${opts.companyName}`
      : `Convite para o portal Oficina — ${opts.companyName}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 16px">${opts.kind === "reset" ? "Redefinir senha" : "Convite para acesso"}</h2>
        <p>Olá ${opts.recipientName},</p>
        <p>A empresa <strong>${opts.companyName}</strong> ${opts.kind === "reset" ? "solicitou a redefinição de senha do seu acesso ao" : "convidou você para acessar o"} portal da oficina <strong>${opts.workshopName}</strong> no FrotaOps.</p>
        <p style="margin:24px 0">
          <a href="${opts.acceptUrl}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">
            ${opts.kind === "reset" ? "Definir nova senha" : "Aceitar convite"}
          </a>
        </p>
        <p style="font-size:12px;color:#666">Ou copie e cole este link no navegador:<br>${opts.acceptUrl}</p>
        <p style="font-size:12px;color:#666">Este link expira em 7 dias.</p>
      </div>`;
    const r = await admin.functions.invoke("send-partner-email", {
      body: { to: opts.to, subject, html },
    });
    if (r.error) console.warn("[workshop-invite] email send failed:", r.error.message);
  } catch (e) {
    console.warn("[workshop-invite] email skipped:", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: cErr } = await userClient.auth.getClaims(authHeader.slice(7));
    if (cErr || !claimsData?.claims?.sub) return json({ error: "Token inválido" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { company_id, workshop_id, email, name, role, kind } = body as {
      company_id: string; workshop_id: string;
      email: string; name: string; role?: "admin" | "operator";
      kind?: "invite" | "reset";
    };

    if (!company_id || !workshop_id || !email || !name) {
      return json({ error: "Campos obrigatórios faltando" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: canManage } = await admin.rpc("can_manage_fleet", {
      _user_id: userId, _company_id: company_id,
    });
    if (!canManage) return json({ error: "Sem permissão" }, 403);

    const { data: ws } = await admin.from("workshops")
      .select("id, name, company_id").eq("id", workshop_id).maybeSingle();
    if (!ws || ws.company_id !== company_id) return json({ error: "Oficina inválida" }, 400);

    const emailNorm = String(email).trim().toLowerCase();
    const inviteKind = kind ?? "invite";

    if (inviteKind === "invite") {
      const { data: existing } = await admin.from("workshop_users")
        .select("id, password_hash").eq("workshop_id", workshop_id)
        .ilike("email", emailNorm).maybeSingle();
      if (existing && existing.password_hash) {
        return json({ error: "Já existe um usuário ativo com esse email para esta oficina" }, 409);
      }
    }

    // cancela pending anterior
    await admin.from("partner_invitations")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("partner_id", workshop_id).eq("partner_type", "workshop")
      .ilike("email", emailNorm).eq("status", "pending");

    const token = newInvitationToken();
    const { data: company } = await admin.from("companies").select("name").eq("id", company_id).maybeSingle();

    const { data: inv, error: insErr } = await admin.from("partner_invitations").insert({
      company_id,
      partner_type: "workshop",
      partner_id: workshop_id,
      email: emailNorm,
      name: String(name).trim(),
      role: role ?? "operator",
      kind: inviteKind,
      token,
      created_by: userId,
    }).select("id, expires_at").single();
    if (insErr) return json({ error: insErr.message }, 400);

    // marca convite enviado em workshop_users (cria placeholder se não existir)
    const { data: pre } = await admin.from("workshop_users")
      .select("id").eq("workshop_id", workshop_id).ilike("email", emailNorm).maybeSingle();
    if (!pre) {
      await admin.from("workshop_users").insert({
        workshop_id, company_id, email: emailNorm, name: String(name).trim(),
        role: role ?? "operator", invite_token: token, invite_sent_at: new Date().toISOString(),
        is_active: false, created_by: userId,
      });
    } else {
      await admin.from("workshop_users").update({
        invite_token: token, invite_sent_at: new Date().toISOString(),
        name: String(name).trim(), role: role ?? "operator",
      }).eq("id", pre.id);
    }

    const origin = req.headers.get("origin") ?? req.headers.get("referer")?.replace(/\/$/, "") ?? "";
    const acceptUrl = `${origin}/oficina/convite?token=${token}`;

    await sendInviteEmail({
      to: emailNorm,
      recipientName: name,
      companyName: company?.name ?? "Sua empresa",
      workshopName: ws.name,
      acceptUrl,
      kind: inviteKind,
    });

    return json({ ok: true, invitation_id: inv.id, accept_url: acceptUrl, expires_at: inv.expires_at });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});