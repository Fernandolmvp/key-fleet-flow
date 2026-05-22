// Valida token de primeiro acesso. Público (verify_jwt=false).
// Rate limit: 5 tentativas por IP por hora (in-memory).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const attempts = new Map<string, { count: number; resetAt: number }>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  rec.count += 1;
  return rec.count <= 5;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    if (!checkRate(ip)) return json({ error: "Muitas tentativas. Aguarde uma hora." }, 429);

    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    if (!token) return json({ valid: false, error: "Token ausente" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: row } = await admin
      .from("first_access_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();
    if (!row) return json({ valid: false, reason: "not_found" });
    if (row.used_at) return json({ valid: false, reason: "used" });
    if (new Date(row.expires_at).getTime() < Date.now()) return json({ valid: false, reason: "expired" });

    const { data: u } = await admin.auth.admin.getUserById(row.user_id);
    const email = u?.user?.email ?? null;
    const nome = (u?.user?.user_metadata as any)?.full_name ?? null;

    let empresa: string | null = null;
    const { data: prof } = await admin.from("profiles").select("current_company_id").eq("id", row.user_id).maybeSingle();
    if (prof?.current_company_id) {
      const { data: c } = await admin.from("companies").select("name").eq("id", prof.current_company_id).maybeSingle();
      empresa = c?.name ?? null;
    }

    return json({ valid: true, email, nome, empresa });
  } catch (e) {
    console.error("validate-first-access-token error", e);
    return json({ valid: false, error: (e as Error).message }, 500);
  }
});