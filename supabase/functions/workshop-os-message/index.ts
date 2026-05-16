// Chat OS — oficina envia/lista mensagens.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, verifyPartnerJwt } from "../_shared/partner-auth.ts";

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const claims = await verifyPartnerJwt(auth.slice(7), "workshop");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const os_id = url.searchParams.get("os_id");
      if (!os_id) return json({ error: "os_id obrigatório" }, 400);
      const { data: os } = await supabase.from("maintenance_work_orders")
        .select("id").eq("id", os_id).eq("workshop_id", claims.partner_id).maybeSingle();
      if (!os) return json({ error: "OS não encontrada" }, 404);
      const { data } = await supabase.from("work_order_messages")
        .select("*").eq("work_order_id", os_id).order("created_at", { ascending: true });
      return json({ messages: data ?? [] });
    }

    const { os_id, message, attachments_paths } = await req.json();
    if (!os_id || !message?.trim()) return json({ error: "Mensagem obrigatória" }, 400);
    const { data: os } = await supabase.from("maintenance_work_orders")
      .select("id, company_id, workshop_id").eq("id", os_id).eq("workshop_id", claims.partner_id).maybeSingle();
    if (!os) return json({ error: "OS não encontrada" }, 404);

    const { data, error } = await supabase.from("work_order_messages").insert({
      work_order_id: os.id, company_id: os.company_id, workshop_id: os.workshop_id,
      sender_id: claims.sub, sender_role: "oficina", message,
      attachments_urls: attachments_paths ?? [],
    }).select().single();
    if (error) throw error;
    return json({ ok: true, msg: data });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});