// Remove um usuário de teste (somente super admin). Apaga auth user + vínculos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.slice(7);
    let callerId: string | null = null;
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser(token);
    if (userData?.user?.id) {
      callerId = userData.user.id;
    } else {
      const { data: claimsData, error: clErr } = await (admin.auth as any).getClaims(token);
      if (clErr || !claimsData?.claims?.sub) {
        console.error("auth failed", clErr);
        return json({ error: "Token inválido" }, 401);
      }
      callerId = String(claimsData.claims.sub);
    }

    const { data: sa } = await admin.from("super_admins").select("user_id").eq("user_id", callerId).maybeSingle();
    if (!sa) return json({ error: "Apenas Super Admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId ?? "").trim();
    if (!userId) return json({ error: "userId obrigatório" }, 400);

    // Confirma que é mesmo um usuário de teste antes de apagar
    const { data: target, error: getErr } = await admin.auth.admin.getUserById(userId);
    if (getErr || !target?.user) return json({ error: "Usuário não encontrado" }, 404);
    const meta = (target.user.user_metadata ?? {}) as Record<string, unknown>;
    if (meta.is_test_user !== true) {
      return json({ error: "Apenas usuários de teste podem ser removidos por aqui" }, 400);
    }
    const companyId = (meta.test_user_company_id as string | undefined) ?? null;
    const email = target.user.email ?? null;

    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("company_members").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) return json({ error: delErr.message }, 500);

    await admin.from("audit_logs").insert({
      company_id: companyId,
      user_id: callerId,
      table_name: "auth.users",
      record_id: userId,
      action: "delete_test_user_by_super_admin",
      changes: { target_email: email, target_company_id: companyId },
    });

    return json({ ok: true });
  } catch (e) {
    console.error("admin-delete-test-user error", e);
    return json({ error: (e as Error).message }, 500);
  }
});