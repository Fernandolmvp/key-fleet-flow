// Lista OS da oficina autenticada via JWT do portal.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, verifyPartnerJwt } from "../_shared/partner-auth.ts";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const claims = await verifyPartnerJwt(auth.slice(7), "workshop");

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let q = supabase.from("maintenance_work_orders")
      .select(`
        id, os_number, title, description, priority, problem_category,
        scheduled_date, scheduled_time, estimated_duration_hours,
        quote_status, quote_amount_total, quote_sent_at,
        execution_status, execution_started_at, execution_completed_at,
        actual_amount_total, payment_status, rating, rating_comment,
        created_at,
        company:companies(id, name),
        vehicle:vehicles(id, plate, brand, model)
      `)
      .eq("workshop_id", claims.partner_id)
      .order("scheduled_date", { ascending: false })
      .limit(500);

    if (status) q = q.eq("execution_status", status);
    if (from) q = q.gte("scheduled_date", from);
    if (to) q = q.lte("scheduled_date", to);

    const { data, error } = await q;
    if (error) throw error;

    return json({ rows: data ?? [] });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});