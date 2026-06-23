// Lista usuários de teste de uma empresa (somente super admin).
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
    if (!companyId) return json({ error: "companyId obrigatório" }, 400);

    // Paginação simples — até 1000 usuários é suficiente
    const out: Array<{ user_id: string; email: string | null; full_name: string | null; role: string | null; created_at: string }> = [];
    const { data: cm } = await admin.from("company_members").select("user_id").eq("company_id", companyId);
    const memberIds = new Set((cm ?? []).map((m: any) => m.user_id));
    if (memberIds.size === 0) return json({ users: [] });

    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id, role")
      .eq("company_id", companyId)
      .in("user_id", Array.from(memberIds));
    const roleByUser: Record<string, string> = {};
    (roles ?? []).forEach((r: any) => { if (!roleByUser[r.user_id]) roleByUser[r.user_id] = r.role; });

    // Itera páginas do listUsers
    let page = 1;
    const perPage = 200;
    // Limita a 10 páginas (2000 usuários)
    for (let i = 0; i < 10; i++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) break;
      for (const u of data.users) {
        const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
        if (meta.is_test_user !== true) continue;
        if (meta.test_user_company_id !== companyId) continue;
        if (!memberIds.has(u.id)) continue;
        out.push({
          user_id: u.id,
          email: u.email ?? null,
          full_name: (meta.full_name as string | undefined) ?? null,
          role: roleByUser[u.id] ?? null,
          created_at: u.created_at,
        });
      }
      if (data.users.length < perPage) break;
      page++;
    }

    return json({ users: out });
  } catch (e) {
    console.error("admin-list-test-users error", e);
    return json({ error: (e as Error).message }, 500);
  }
});