// Endpoint usado pelo gestor (autenticado no app principal) para criar/atualizar
// usuários do portal do posto, gerando hash de senha com PBKDF2.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, hashPassword } from "../_shared/posto-jwt.ts";
import { newInvitationToken } from "../_shared/partner-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: cErr } = await userClient.auth.getClaims(authHeader.slice(7));
    if (cErr || !claimsData?.claims?.sub) return json({ error: "Token inválido" }, 401);
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { action, station_id, company_id } = body;
    if (!station_id || !company_id) return json({ error: "Posto e empresa obrigatórios" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // valida que o usuário é gestor da empresa
    const { data: canManage } = await admin.rpc("can_manage_fleet", {
      _user_id: userId,
      _company_id: company_id,
    });
    if (!canManage) return json({ error: "Sem permissão" }, 403);

    if (action === "create") {
      // Novo fluxo: cria CONVITE, parceiro define a própria senha.
      const { email, name, role } = body;
      if (!email || !name) return json({ error: "Email e nome são obrigatórios" }, 400);
      const emailNorm = String(email).trim().toLowerCase();

      const { data: existing } = await admin.from("fuel_station_users")
        .select("id").eq("station_id", station_id).eq("email", emailNorm).maybeSingle();
      if (existing) return json({ error: "Já existe usuário com esse email para este posto" }, 409);

      // cancela pendentes anteriores
      await admin.from("partner_invitations")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("partner_id", station_id).ilike("email", emailNorm).eq("status", "pending");

      const token = newInvitationToken();
      const { data: inv, error } = await admin.from("partner_invitations").insert({
        company_id,
        partner_type: "station",
        partner_id: station_id,
        email: emailNorm,
        name: String(name).trim(),
        role: role ?? "operador",
        kind: "invite",
        token,
        created_by: userId,
      }).select("id, expires_at").single();
      if (error) return json({ error: error.message }, 400);

      const origin = req.headers.get("origin") ?? "";
      const accept_url = `${origin}/parceiro/convite?token=${token}`;
      return json({ ok: true, invitation_id: inv.id, accept_url, expires_at: inv.expires_at });
    }

    if (action === "reset_password") {
      // Novo fluxo: gera convite kind='reset' para o usuário definir nova senha.
      const { id } = body;
      if (!id) return json({ error: "id obrigatório" }, 400);
      const { data: u } = await admin.from("fuel_station_users")
        .select("id, email, name, station_id, company_id, role")
        .eq("id", id).eq("company_id", company_id).maybeSingle();
      if (!u) return json({ error: "Usuário não encontrado" }, 404);

      await admin.from("partner_invitations")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("partner_id", u.station_id).ilike("email", u.email).eq("status", "pending");

      const token = newInvitationToken();
      const { data: inv, error } = await admin.from("partner_invitations").insert({
        company_id: u.company_id,
        partner_type: "station",
        partner_id: u.station_id,
        email: u.email,
        name: u.name,
        role: u.role ?? "operador",
        kind: "reset",
        token,
        created_by: userId,
      }).select("id, expires_at").single();
      if (error) return json({ error: error.message }, 400);

      const origin = req.headers.get("origin") ?? "";
      const accept_url = `${origin}/parceiro/convite?token=${token}`;
      return json({ ok: true, invitation_id: inv.id, accept_url, expires_at: inv.expires_at });
    }

    if (action === "toggle_active") {
      const { id, active } = body;
      const { error } = await admin.from("fuel_station_users")
        .update({ active: !!active }).eq("id", id).eq("company_id", company_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      const { id } = body;
      const { error } = await admin.from("fuel_station_users")
        .delete().eq("id", id).eq("company_id", company_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}