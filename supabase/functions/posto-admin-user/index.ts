// Endpoint usado pelo gestor (autenticado no app principal) para criar/atualizar
// usuários do portal do posto, gerando hash de senha com PBKDF2.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, hashPassword } from "../_shared/posto-jwt.ts";

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
      const { email, name, password, role } = body;
      if (!email || !name || !password) return json({ error: "Campos obrigatórios" }, 400);
      if (String(password).length < 6) return json({ error: "Senha precisa de 6+ caracteres" }, 400);
      const password_hash = await hashPassword(password);
      const { data, error } = await admin.from("fuel_station_users").insert({
        station_id, company_id,
        email: String(email).trim().toLowerCase(),
        name: String(name).trim(),
        password_hash,
        role: role ?? "operador",
        created_by: userId,
      }).select("id").single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, id: data.id });
    }

    if (action === "reset_password") {
      const { id, password } = body;
      if (!id || !password) return json({ error: "Campos obrigatórios" }, 400);
      const password_hash = await hashPassword(password);
      const { error } = await admin.from("fuel_station_users")
        .update({ password_hash }).eq("id", id).eq("company_id", company_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
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