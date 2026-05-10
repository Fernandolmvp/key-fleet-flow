import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, verifyPostoJwt } from "../_shared/posto-jwt.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const claims = await verifyPostoJwt(auth.slice(7));

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const plate = url.searchParams.get("plate")?.trim().toUpperCase();
    const driverQ = url.searchParams.get("driver")?.trim().toLowerCase();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let q = supabase
      .from("fuel_records")
      .select(`
        id, fueled_at, liters, total_value, price_per_liter, notes, receipt_url,
        vehicle:vehicles(plate, brand, model),
        driver:drivers(full_name),
        company:companies(name)
      `)
      .eq("fuel_station_id", claims.station_id)
      .order("fueled_at", { ascending: false })
      .limit(500);

    if (from) q = q.gte("fueled_at", from);
    if (to) q = q.lte("fueled_at", to);

    const { data, error } = await q;
    if (error) throw error;

    let rows = (data ?? []) as any[];
    if (plate) rows = rows.filter((r) => r.vehicle?.plate?.toUpperCase().includes(plate));
    if (driverQ) rows = rows.filter((r) => r.driver?.full_name?.toLowerCase().includes(driverQ));

    return json({ rows });
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