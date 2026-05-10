import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, signPostoJwt, verifyPassword } from "../_shared/posto-jwt.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return json({ error: "Email e senha são obrigatórios" }, 400);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: user, error } = await supabase
      .from("fuel_station_users")
      .select("id, station_id, company_id, email, password_hash, name, active")
      .eq("email", String(email).trim().toLowerCase())
      .maybeSingle();
    if (error) throw error;
    if (!user || !user.active) return json({ error: "Credenciais inválidas" }, 401);
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return json({ error: "Credenciais inválidas" }, 401);

    await supabase.from("fuel_station_users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);

    const { data: station } = await supabase
      .from("fuel_stations")
      .select("id, name, cnpj, city, state")
      .eq("id", user.station_id).maybeSingle();

    const token = await signPostoJwt({
      sub: user.id,
      station_id: user.station_id,
      company_id: user.company_id,
      email: user.email,
      name: user.name,
    });
    return json({ token, user: { id: user.id, name: user.name, email: user.email }, station });
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