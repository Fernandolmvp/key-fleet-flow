// Upload de arquivo (base64) ao bucket work-orders pela oficina.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, verifyPartnerJwt } from "../_shared/partner-auth.ts";

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const claims = await verifyPartnerJwt(auth.slice(7), "workshop");
    const { os_id, kind, filename, content_type, base64 } = await req.json();
    if (!os_id || !kind || !filename || !base64) return json({ error: "Parâmetros incompletos" }, 400);
    if (!["antes", "depois", "nf", "orcamento", "chat"].includes(kind)) return json({ error: "kind inválido" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: os } = await supabase.from("maintenance_work_orders")
      .select("id, company_id").eq("id", os_id).eq("workshop_id", claims.partner_id).maybeSingle();
    if (!os) return json({ error: "OS não encontrada" }, 404);

    const ext = (filename.split(".").pop() || "bin").toLowerCase();
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `${os.company_id}/${os.id}/${kind}/${safe}`;
    const { error } = await supabase.storage.from("work-orders").upload(path, decodeBase64(base64), {
      contentType: content_type ?? "application/octet-stream",
      upsert: false,
    });
    if (error) throw error;

    const { data: signed } = await supabase.storage.from("work-orders").createSignedUrl(path, 3600);
    return json({ ok: true, path, url: signed?.signedUrl });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});