// Define a senha do usuário usando token de primeiro acesso. Público (verify_jwt=false).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function isStrong(pwd: string) {
  return pwd.length >= 8 && /[A-Za-z]/.test(pwd) && /\d/.test(pwd);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    const password = String(body.password ?? "");
    if (!token) return json({ error: "Token ausente" }, 400);
    if (!isStrong(password)) return json({ error: "A senha deve ter no mínimo 8 caracteres, incluindo letra e número." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: row } = await admin
      .from("first_access_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();
    if (!row) return json({ error: "Link inválido" }, 400);
    if (row.used_at) return json({ error: "Este link já foi usado" }, 400);
    if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "Este link expirou" }, 400);

    const { error: upErr } = await admin.auth.admin.updateUserById(row.user_id, { password });
    if (upErr) return json({ error: upErr.message }, 500);

    await admin.from("first_access_tokens").update({ used_at: new Date().toISOString() }).eq("id", row.id);

    let companyId: string | null = null;
    const { data: prof } = await admin.from("profiles").select("current_company_id, email").eq("id", row.user_id).maybeSingle();
    if (prof?.current_company_id) companyId = prof.current_company_id;
    await admin.from("audit_logs").insert({
      company_id: companyId,
      user_id: row.user_id,
      table_name: "first_access_tokens",
      record_id: row.id,
      action: "first_access_password_set",
      changes: { token_used: true },
    });

    return json({ ok: true, email: prof?.email ?? null });
  } catch (e) {
    console.error("set-first-access-password error", e);
    return json({ error: (e as Error).message }, 500);
  }
});