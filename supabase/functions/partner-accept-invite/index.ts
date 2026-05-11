// Aceita convite (público): valida token, define senha, cria/atualiza usuário do parceiro
// e devolve JWT do portal.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, hashPassword, signPartnerJwt } from "../_shared/partner-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const mode: "peek" | "accept" = body.mode ?? "accept";
    const token = String(body.token ?? "");
    if (!token) return json({ error: "Token obrigatório" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: inv, error } = await admin.from("partner_invitations")
      .select("*").eq("token", token).maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!inv) return json({ error: "Convite não encontrado" }, 404);

    if (inv.status === "cancelled") return json({ error: "Convite cancelado" }, 410);
    if (inv.status === "accepted") return json({ error: "Convite já utilizado" }, 410);

    const expired = new Date(inv.expires_at).getTime() < Date.now();
    if (expired || inv.status === "expired") {
      if (inv.status !== "expired") {
        await admin.from("partner_invitations").update({ status: "expired" }).eq("id", inv.id);
      }
      return json({ error: "Convite expirado. Peça um novo ao gestor." }, 410);
    }

    if (inv.attempts >= 5) return json({ error: "Muitas tentativas. Solicite novo convite." }, 429);

    // Carrega dados do parceiro e empresa para exibir
    const [{ data: company }, station] = await Promise.all([
      admin.from("companies").select("name").eq("id", inv.company_id).maybeSingle(),
      inv.partner_type === "station"
        ? admin.from("fuel_stations").select("id, name, cnpj, city, state").eq("id", inv.partner_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (mode === "peek") {
      return json({
        ok: true,
        invitation: {
          email: inv.email, name: inv.name, partner_type: inv.partner_type,
          kind: inv.kind, expires_at: inv.expires_at,
        },
        company: company ?? null,
        partner: station.data ?? null,
      });
    }

    const password = String(body.password ?? "");
    if (password.length < 8) return json({ error: "Senha precisa de 8+ caracteres" }, 400);

    await admin.from("partner_invitations")
      .update({ attempts: inv.attempts + 1 }).eq("id", inv.id);

    const password_hash = await hashPassword(password);

    if (inv.partner_type !== "station") return json({ error: "partner_type não suportado" }, 400);

    // Se é reset, atualiza usuário existente; se é invite, cria/atualiza por (station,email)
    const { data: existing } = await admin.from("fuel_station_users")
      .select("id").eq("station_id", inv.partner_id).eq("email", inv.email).maybeSingle();

    let userId: string;
    if (existing) {
      const { error: uErr } = await admin.from("fuel_station_users")
        .update({ password_hash, name: inv.name, active: true, role: inv.role })
        .eq("id", existing.id);
      if (uErr) return json({ error: uErr.message }, 400);
      userId = existing.id;
    } else {
      const { data: created, error: cErr } = await admin.from("fuel_station_users")
        .insert({
          station_id: inv.partner_id,
          company_id: inv.company_id,
          email: inv.email,
          name: inv.name,
          role: inv.role,
          password_hash,
          created_by: inv.created_by,
        }).select("id").single();
      if (cErr) return json({ error: cErr.message }, 400);
      userId = created.id;
    }

    await admin.from("partner_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", inv.id);

    await admin.from("fuel_station_users")
      .update({ last_login_at: new Date().toISOString() }).eq("id", userId);

    const jwt = await signPartnerJwt({
      sub: userId,
      partner_type: "station",
      partner_id: inv.partner_id,
      station_id: inv.partner_id,
      company_id: inv.company_id,
      email: inv.email,
      name: inv.name,
    });

    return json({
      ok: true,
      token: jwt,
      user: { id: userId, name: inv.name, email: inv.email },
      partner: station.data ?? null,
      redirect: "/posto",
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});