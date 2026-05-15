import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, signPartnerJwt, verifyPassword } from "../_shared/partner-auth.ts";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, password } = await req.json();
    if (!email || !password) return json({ error: "Email e senha são obrigatórios" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const emailNorm = String(email).trim().toLowerCase();
    const { data: user, error } = await supabase
      .from("workshop_users")
      .select("id, workshop_id, company_id, email, password_hash, name, is_active, role")
      .ilike("email", emailNorm)
      .maybeSingle();
    if (error) throw error;
    if (!user || !user.is_active || !user.password_hash) {
      return json({ error: "Credenciais inválidas" }, 401);
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return json({ error: "Credenciais inválidas" }, 401);

    await supabase.from("workshop_users")
      .update({ last_login_at: new Date().toISOString() }).eq("id", user.id);

    const { data: workshop } = await supabase
      .from("workshops")
      .select("id, name, document_number, city, state")
      .eq("id", user.workshop_id).maybeSingle();

    const token = await signPartnerJwt({
      sub: user.id,
      partner_type: "workshop",
      partner_id: user.workshop_id,
      company_id: user.company_id,
      email: user.email,
      name: user.name,
    });

    return json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      workshop,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});