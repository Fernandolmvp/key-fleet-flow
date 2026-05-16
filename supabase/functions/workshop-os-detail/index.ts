// Detalhe de uma OS para portal Oficina.
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
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "id obrigatório" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: os, error } = await supabase.from("maintenance_work_orders")
      .select(`*, company:companies(id, name), vehicle:vehicles(id, plate, brand, model, current_km), driver:drivers(id, full_name, phone)`)
      .eq("id", id).eq("workshop_id", claims.partner_id).maybeSingle();
    if (error) throw error;
    if (!os) return json({ error: "OS não encontrada" }, 404);

    const { data: messages } = await supabase.from("work_order_messages")
      .select("id, sender_role, sender_id, message, attachments_urls, created_at, is_read")
      .eq("work_order_id", id).order("created_at", { ascending: true });

    // signed urls para anexos
    const sign = async (paths: string[] | null | undefined) => {
      if (!paths?.length) return [] as { path: string; url: string }[];
      const out: { path: string; url: string }[] = [];
      for (const p of paths) {
        const { data } = await supabase.storage.from("work-orders").createSignedUrl(p, 3600);
        if (data?.signedUrl) out.push({ path: p, url: data.signedUrl });
      }
      return out;
    };
    const beforePhotos = await sign(os.before_photos_urls);
    const afterPhotos = await sign(os.after_photos_urls);
    const invoiceUrl = os.invoice_url ? (await supabase.storage.from("work-orders").createSignedUrl(os.invoice_url, 3600)).data?.signedUrl : null;
    const quoteUrl = os.quote_attachment_url ? (await supabase.storage.from("work-orders").createSignedUrl(os.quote_attachment_url, 3600)).data?.signedUrl : null;

    return json({ os, messages: messages ?? [], signed: { beforePhotos, afterPhotos, invoiceUrl, quoteUrl } });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});