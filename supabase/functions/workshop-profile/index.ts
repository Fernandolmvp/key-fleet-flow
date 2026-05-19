import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, verifyPartnerJwt } from "../_shared/partner-auth.ts";

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const claims = await verifyPartnerJwt(auth.slice(7), "workshop");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (req.method === "GET") {
      const { data, error } = await sb.from("workshops").select("*").eq("id", claims.partner_id).single();
      if (error) throw error;
      return json({ workshop: data });
    }

    const body = await req.json();
    if (!body.update) return json({ error: "update obrigatório" }, 400);
    // sanitize: só permitimos colunas seguras
    const allowed = ["name","trade_name","document_number","phone","whatsapp","email",
      "zip_code","street","address_number","address_complement","neighborhood","city","state",
      "specialties","workshop_type","operating_hours"];
    const patch: any = {};
    for (const k of allowed) if (k in body.update) patch[k] = body.update[k];
    // operating_hours vai em portal_settings
    if ("operating_hours" in patch) {
      const oh = patch.operating_hours; delete patch.operating_hours;
      const { data: cur } = await sb.from("workshops").select("portal_settings").eq("id", claims.partner_id).single();
      patch.portal_settings = { ...(cur?.portal_settings ?? {}), operating_hours: oh };
    }
    const { error } = await sb.from("workshops").update(patch).eq("id", claims.partner_id);
    if (error) throw error;
    return json({ ok: true });
  } catch (e) { return json({ error: (e as Error).message }, 500); }
});