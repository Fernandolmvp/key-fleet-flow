// Cria um usuário de teste em qualquer empresa (somente super admin).
// O usuário é marcado em user_metadata.is_test_user=true para que possa ser
// listado/removido pelo painel super-admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const VALID_ROLES = new Set([
  "admin", "gestor_frota", "financeiro", "manutencao",
  "auditor", "visualizador", "motorista",
]);

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
    const { data: userData, error: cErr } = await userClient.auth.getUser(authHeader.slice(7));
    if (cErr || !userData?.user?.id) {
      console.error("getUser failed", cErr);
      return json({ error: "Token inválido" }, 401);
    }
    const callerId = userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sa } = await admin.from("super_admins").select("user_id").eq("user_id", callerId).maybeSingle();
    if (!sa) return json({ error: "Apenas Super Admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const companyId = String(body.companyId ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.full_name ?? "").trim();
    const role = String(body.role ?? "").trim();

    if (!companyId) return json({ error: "companyId obrigatório" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Email inválido" }, 400);
    if (password.length < 6) return json({ error: "Senha deve ter no mínimo 6 caracteres" }, 400);
    if (!fullName) return json({ error: "Nome obrigatório" }, 400);
    if (!VALID_ROLES.has(role)) return json({ error: "Papel inválido" }, 400);

    const { data: comp } = await admin.from("companies").select("id, name").eq("id", companyId).maybeSingle();
    if (!comp) return json({ error: "Empresa não encontrada" }, 404);

    const { data: created, error: cuErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        is_test_user: true,
        test_user_company_id: companyId,
        created_by: callerId,
      },
    });
    if (cuErr || !created.user) {
      const msg = String(cuErr?.message || "");
      if (/already|exists|registered/i.test(msg)) {
        return json({ error: "Já existe um usuário com este email" }, 409);
      }
      return json({ error: cuErr?.message || "Falha ao criar usuário" }, 500);
    }
    const userId = created.user.id;

    const { error: mErr } = await admin.from("company_members").insert({
      company_id: companyId, user_id: userId,
    });
    if (mErr) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      return json({ error: mErr.message }, 500);
    }
    const { error: rErr } = await admin.from("user_roles").insert({
      company_id: companyId, user_id: userId, role,
    } as any);
    if (rErr) {
      await admin.from("company_members").delete().eq("company_id", companyId).eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      return json({ error: rErr.message }, 500);
    }

    await admin.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      email,
      current_company_id: companyId,
    }, { onConflict: "id" });

    await admin.from("audit_logs").insert({
      company_id: companyId,
      user_id: callerId,
      table_name: "auth.users",
      record_id: userId,
      action: "create_test_user_by_super_admin",
      changes: {
        target_email: email,
        target_company_id: companyId,
        target_company_name: (comp as any).name,
        role,
      },
    });

    return json({ ok: true, user_id: userId });
  } catch (e) {
    console.error("admin-create-test-user error", e);
    return json({ error: (e as Error).message }, 500);
  }
});