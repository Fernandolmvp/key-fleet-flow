import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json(401, { error: "Não autenticado" });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return json(401, { error: "Sessão inválida" });

    const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: u.user.id });
    if (!isSA) return json(403, { error: "Acesso negado" });

    const { secret_names } = await req.json();
    if (!Array.isArray(secret_names)) return json(400, { error: "secret_names deve ser array" });

    const secrets: Record<string, boolean> = {};
    for (const name of secret_names) {
      if (typeof name !== "string") continue;
      const v = Deno.env.get(name);
      secrets[name] = !!(v && v.length > 0);
    }
    return json(200, { secrets });
  } catch (e) {
    return json(500, { error: String(e?.message ?? e) });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}