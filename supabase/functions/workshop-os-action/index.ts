// Ações da oficina sobre uma OS: enviar orçamento, iniciar, marcar aguardando peças,
// retomar, concluir, reportar problema.
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
    const body = await req.json();
    const { os_id, action, payload } = body ?? {};
    if (!os_id || !action) return json({ error: "os_id e action obrigatórios" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: os } = await supabase.from("maintenance_work_orders")
      .select("*").eq("id", os_id).eq("workshop_id", claims.partner_id).maybeSingle();
    if (!os) return json({ error: "OS não encontrada" }, 404);

    const upd: Record<string, unknown> = { updated_by: claims.sub };
    const now = new Date().toISOString();

    switch (action) {
      case "send_quote": {
        const p = payload ?? {};
        const parts = Number(p.amount_parts ?? 0);
        const labor = Number(p.amount_labor ?? 0);
        const other = Number(p.amount_other ?? 0);
        upd.quote_amount_parts = parts;
        upd.quote_amount_labor = labor;
        upd.quote_amount_other = other;
        upd.quote_amount_total = parts + labor + other;
        upd.quote_details = p.details ?? [];
        upd.quote_warranty_days = p.warranty_days ?? 90;
        upd.quote_validity_days = p.validity_days ?? 7;
        upd.quote_notes = p.notes ?? null;
        upd.quote_attachment_url = p.attachment_path ?? os.quote_attachment_url;
        upd.quote_status = "enviado";
        upd.quote_sent_at = now;
        break;
      }
      case "start_execution":
        if (os.quote_status !== "aprovado") return json({ error: "Orçamento ainda não aprovado" }, 400);
        upd.execution_status = "em_execucao";
        upd.execution_started_at = now;
        upd.km_at_start = payload?.km_at_start ?? null;
        upd.before_photos_urls = payload?.before_photos_paths ?? os.before_photos_urls;
        break;
      case "mark_waiting_parts":
        upd.execution_status = "aguardando_pecas";
        break;
      case "resume_execution":
        upd.execution_status = "em_execucao";
        break;
      case "complete":
        if (os.execution_status !== "em_execucao") return json({ error: "OS não está em execução" }, 400);
        upd.execution_status = "concluido";
        upd.execution_completed_at = now;
        upd.km_at_completion = payload?.km_at_completion ?? null;
        upd.actual_amount_total = payload?.actual_amount_total ?? os.quote_amount_total;
        upd.after_photos_urls = payload?.after_photos_paths ?? os.after_photos_urls;
        upd.invoice_number = payload?.invoice_number ?? null;
        upd.invoice_url = payload?.invoice_path ?? null;
        upd.warranty_until = payload?.warranty_until ?? null;
        upd.final_notes = payload?.final_notes ?? null;
        upd.services_performed = payload?.services_performed ?? [];
        upd.parts_used = payload?.parts_used ?? [];
        upd.payment_status = "pendente";
        upd.payment_due_date = payload?.payment_due_date ?? null;
        break;
      case "report_problem":
        upd.execution_status = "problema_relatado";
        break;
      default:
        return json({ error: "Ação inválida" }, 400);
    }

    const { data, error } = await supabase.from("maintenance_work_orders")
      .update(upd).eq("id", os_id).select().single();
    if (error) throw error;
    return json({ ok: true, os: data });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});