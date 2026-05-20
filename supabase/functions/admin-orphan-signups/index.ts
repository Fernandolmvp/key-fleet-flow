// Lista e gerencia usuários "órfãos": fizeram signup mas não têm empresa vinculada.
// Apenas Super Admin. Permite reenviar link de redefinição de senha ou excluir o usuário.
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
    if (cErr || !userData?.user?.id) return json({ error: "Token inválido" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: sa } = await admin.from("super_admins").select("user_id").eq("user_id", callerId).maybeSingle();
    if (!sa) return json({ error: "Apenas Super Admin" }, 403);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action ?? "list";

    if (action === "list") {
      // Pagina por auth.admin.listUsers (até 1000 por chamada). Em SaaS pequeno cobre o caso.
      const scope = String(body.scope ?? "all"); // all | orphans | with_company
      const all: any[] = [];
      let page = 1;
      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) return json({ error: error.message }, 500);
        all.push(...data.users);
        if (data.users.length < 200) break;
        page++;
        if (page > 25) break; // teto de segurança
      }
      const userIds = all.map((u) => u.id);

      // Filtra os que NÃO têm membership e NÃO são super admin
      const { data: mems } = await admin
        .from("company_members")
        .select("user_id, company_id, companies(id,name,cnpj,status,created_at)")
        .in("user_id", userIds);
      const memMap = new Map<string, any[]>();
      (mems ?? []).forEach((m: any) => {
        const arr = memMap.get(m.user_id) ?? [];
        arr.push(m);
        memMap.set(m.user_id, arr);
      });
      const { data: sas } = await admin.from("super_admins").select("user_id").in("user_id", userIds);
      const saSet = new Set((sas ?? []).map((s: any) => s.user_id));
      const { data: drv } = await admin.from("drivers").select("user_id,name").in("user_id", userIds.filter(Boolean));
      const drvMap = new Map<string, any>();
      (drv ?? []).forEach((d: any) => { if (d.user_id) drvMap.set(d.user_id, d); });

      const everyone = all.map((u) => {
        const memberships = memMap.get(u.id) ?? [];
        const companies = memberships.map((m: any) => m.companies).filter(Boolean);
        const isSuper = saSet.has(u.id);
        const isDriver = drvMap.has(u.id);
        const isOrphan = memberships.length === 0 && !isSuper && !isDriver;
        let kind: string = "orphan";
        if (isSuper) kind = "super_admin";
        else if (companies.length > 0) kind = "company";
        else if (isDriver) kind = "driver";
        return {
          id: u.id,
          email: u.email,
          full_name: u.user_metadata?.full_name ?? null,
          phone: u.phone ?? u.user_metadata?.phone ?? null,
          created_at: u.created_at,
          email_confirmed_at: u.email_confirmed_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          kind,
          is_orphan: isOrphan,
          companies,
        };
      }).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

      const filtered = scope === "orphans"
        ? everyone.filter((u) => u.is_orphan)
        : scope === "with_company"
        ? everyone.filter((u) => u.companies.length > 0)
        : everyone;

      // Retorna ambos os campos pra retrocompatibilidade
      return json({ users: filtered, orphans: everyone.filter((u) => u.is_orphan), total: everyone.length });
    }

    if (action === "send_recovery") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email) return json({ error: "Email obrigatório" }, 400);
      const redirectTo = body.redirect_to || `${new URL(req.url).origin}/reset-password`;
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "delete_user") {
      const userId = String(body.user_id ?? "");
      if (!userId) return json({ error: "user_id obrigatório" }, 400);
      // Segurança: bloqueia exclusão de quem tem membership/super-admin/driver
      const [{ data: mem }, { data: sa2 }, { data: dr }] = await Promise.all([
        admin.from("company_members").select("user_id").eq("user_id", userId).limit(1),
        admin.from("super_admins").select("user_id").eq("user_id", userId).limit(1),
        admin.from("drivers").select("id").eq("user_id", userId).limit(1),
      ]);
      if ((mem && mem.length) || (sa2 && sa2.length) || (dr && dr.length)) {
        return json({ error: "Usuário não é órfão (tem vínculos: empresa, super admin ou motorista). Exclusão bloqueada." }, 200);
      }
      await admin.from("profiles").delete().eq("id", userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 500);
      await admin.from("audit_logs").insert({
        user_id: callerId,
        table_name: "auth.users",
        record_id: userId,
        action: "orphan_user_deleted",
        changes: { deleted_by: callerId },
      });
      return json({ success: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("admin-orphan-signups error", e);
    return json({ error: (e as Error).message }, 500);
  }
});