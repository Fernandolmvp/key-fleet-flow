// Cria convite para parceiro (posto/oficina). Apenas gestor da empresa.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, newInvitationToken, type PartnerType } from "../_shared/partner-auth.ts";

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
  partnerName: string;
  partnerType: PartnerType;
  acceptUrl: string;
  kind: "invite" | "reset";
}) {
  // Se não houver send-transactional-email disponível, apenas log silencioso.
  // Cliente recebe accept_url para copiar manualmente até domínio de email estar ativo.
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const ptypeLabel = opts.partnerType === "station" ? "posto" : "oficina";
    const subject = opts.kind === "reset"
      ? `Redefinir senha do portal — ${opts.companyName}`
      : `Você foi convidado para o portal de parceiros — ${opts.companyName}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 16px">${opts.kind === "reset" ? "Redefinir senha" : "Convite para acesso"}</h2>
        <p>Olá ${opts.recipientName},</p>
        <p>A empresa <strong>${opts.companyName}</strong> ${opts.kind === "reset" ? "solicitou a redefinição de senha do seu acesso ao" : "convidou você para acessar o"} portal do ${ptypeLabel} <strong>${opts.partnerName}</strong>.</p>
        <p style="margin:24px 0">
          <a href="${opts.acceptUrl}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">
            ${opts.kind === "reset" ? "Definir nova senha" : "Aceitar convite"}
          </a>
        </p>
        <p style="font-size:12px;color:#666">Ou copie e cole este link no navegador:<br>${opts.acceptUrl}</p>
        <p style="font-size:12px;color:#666">Este link expira em 7 dias. Se você não esperava este email, ignore-o.</p>
      </div>`;
    const r = await admin.functions.invoke("send-transactional-email", {
      body: {
        to: opts.to,
        subject,
        html,
        purpose: "transactional",
      },
    });
    if (r.error) console.warn("[partner-invite] email send failed:", r.error.message);
  } catch (e) {
    console.warn("[partner-invite] email skipped:", (e as Error).message);
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
    const { company_id, partner_type, partner_id, email, name, role, kind } = body as {
      company_id: string; partner_type: PartnerType; partner_id: string;
      email: string; name: string; role?: string; kind?: "invite" | "reset";
    };

    if (!company_id || !partner_id || !email || !name) return json({ error: "Campos obrigatórios faltando" }, 400);
    if (partner_type !== "station" && partner_type !== "workshop") return json({ error: "partner_type inválido" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: canManage } = await admin.rpc("can_manage_fleet", { _user_id: userId, _company_id: company_id });
    if (!canManage) return json({ error: "Sem permissão" }, 403);

    // Valida parceiro
    let partnerName = name;
    if (partner_type === "station") {
      const { data: st } = await admin.from("fuel_stations")
        .select("id, name, company_id").eq("id", partner_id).maybeSingle();
      if (!st || st.company_id !== company_id) return json({ error: "Posto inválido" }, 400);
      partnerName = st.name;
    }
    // workshop: tabela ainda não existe — bloqueia até a feature de Oficina.
    if (partner_type === "workshop") return json({ error: "Módulo Oficina ainda não disponível" }, 400);

    const emailNorm = String(email).trim().toLowerCase();

    // Bloqueia se já existe usuário ativo (apenas para station por enquanto)
    if (partner_type === "station" && (kind ?? "invite") === "invite") {
      const { data: existing } = await admin.from("fuel_station_users")
        .select("id").eq("station_id", partner_id).eq("email", emailNorm).maybeSingle();
      if (existing) return json({ error: "Já existe um usuário com esse email para este posto" }, 409);
    }

    // Cancela qualquer pending anterior para liberar índice único
    await admin.from("partner_invitations")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("partner_id", partner_id).ilike("email", emailNorm).eq("status", "pending");

    const token = newInvitationToken();
    const { data: company } = await admin.from("companies").select("name").eq("id", company_id).maybeSingle();

    const { data: inv, error: insErr } = await admin.from("partner_invitations").insert({
      company_id,
      partner_type,
      partner_id,
      email: emailNorm,
      name: String(name).trim(),
      role: role ?? "operador",
      kind: kind ?? "invite",
      token,
      created_by: userId,
    }).select("id, expires_at").single();
    if (insErr) return json({ error: insErr.message }, 400);

    const origin = req.headers.get("origin") ?? req.headers.get("referer")?.replace(/\/$/, "") ?? "";
    const acceptUrl = `${origin}/parceiro/convite?token=${token}`;

    await sendInviteEmail({
      to: emailNorm,
      recipientName: name,
      companyName: company?.name ?? "Sua empresa",
      partnerName,
      partnerType: partner_type,
      acceptUrl,
      kind: kind ?? "invite",
    });

    return json({ ok: true, invitation_id: inv.id, accept_url: acceptUrl, expires_at: inv.expires_at });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});