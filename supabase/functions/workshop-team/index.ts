// Lista e gerencia equipe da oficina autenticada via JWT do portal.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, newInvitationToken, verifyPartnerJwt } from "../_shared/partner-auth.ts";

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const claims = await verifyPartnerJwt(auth.slice(7), "workshop");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (req.method === "GET") {
      const { data, error } = await sb.from("workshop_users")
        .select("id, name, email, role, is_active, last_login_at, invite_sent_at, invite_accepted_at, created_at")
        .eq("workshop_id", claims.partner_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ rows: data ?? [] });
    }

    // POST: invite / toggle_active
    const { data: me } = await sb.from("workshop_users").select("role").eq("id", claims.sub).maybeSingle();
    if (!me || me.role !== "admin") return json({ error: "Apenas admins podem gerenciar a equipe" }, 403);

    const body = await req.json();
    if (body.action === "toggle_active") {
      const { error } = await sb.from("workshop_users")
        .update({ is_active: !!body.is_active })
        .eq("id", body.user_id).eq("workshop_id", claims.partner_id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (body.action === "invite") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const name = String(body.name ?? "").trim();
      const role = body.role === "admin" ? "admin" : "mecanico";
      if (!email || !name) return json({ error: "Nome e email obrigatórios" }, 400);

      const { data: dup } = await sb.from("workshop_users").select("id, password_hash")
        .eq("workshop_id", claims.partner_id).ilike("email", email).maybeSingle();
      if (dup?.password_hash) return json({ error: "Já existe usuário ativo com esse email" }, 409);

      const token = newInvitationToken();
      const { data: ws } = await sb.from("workshops").select("name, company_id").eq("id", claims.partner_id).single();
      const { data: inv, error: invErr } = await sb.from("partner_invitations").insert({
        company_id: ws!.company_id, partner_type: "workshop", partner_id: claims.partner_id,
        email, name, role, kind: "invite", token, created_by: null,
      }).select("id, expires_at").single();
      if (invErr) throw invErr;

      if (dup) {
        await sb.from("workshop_users").update({
          invite_token: token, invite_sent_at: new Date().toISOString(),
          name, role,
        }).eq("id", dup.id);
      } else {
        await sb.from("workshop_users").insert({
          workshop_id: claims.partner_id, company_id: ws!.company_id,
          email, name, role, invite_token: token, invite_sent_at: new Date().toISOString(), is_active: false,
        });
      }

      const origin = req.headers.get("origin") ?? "";
      const acceptUrl = `${origin}/oficina/convite?token=${token}`;
      try {
        await sb.functions.invoke("send-partner-email", {
          body: {
            to: email,
            subject: `Convite para o portal Oficina — ${ws!.name}`,
            html: `<p>Olá ${name},</p><p>Você foi convidado para a equipe da oficina <strong>${ws!.name}</strong>.</p>
              <p><a href="${acceptUrl}">Aceitar convite</a></p><p>${acceptUrl}</p>`,
          },
        });
      } catch (_) { /* email é best-effort */ }

      return json({ ok: true, accept_url: acceptUrl, invitation_id: inv.id });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) { return json({ error: (e as Error).message }, 500); }
});