// Cron diário: expira trials vencidos e dispara lembretes 7/3/1 dias antes.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "FrotaOps <noreply@frotaops.com.br>";

async function sendEmail(to: string, subject: string, html: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) return;
  try {
    await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
  } catch (e) {
    console.error("[trial-cron] email fail", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1) Expira trials vencidos (exceto isentas)
  const { data: expired } = await supabase
    .from("companies")
    .select("id, email, name, is_exempt_from_trial, trial_ends_at")
    .lt("trial_ends_at", new Date().toISOString())
    .eq("is_exempt_from_trial", false);

  let expiredCount = 0;
  for (const c of expired ?? []) {
    const { data: sub } = await supabase
      .from("subscriptions").select("id,status").eq("company_id", c.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (sub && sub.status === "trial") {
      await supabase.from("subscriptions").update({ status: "expirada" }).eq("id", sub.id);
      expiredCount++;
      if (c.email) await sendEmail(
        c.email,
        "Seu trial do FrotaOps terminou",
        `<p>Olá,</p><p>O período de teste gratuito de 21 dias da <strong>${c.name}</strong> terminou. Seus dados estão preservados — basta ativar uma assinatura para retomar o acesso.</p><p><a href="https://www.frotaops.com.br/app/assinatura">Ativar assinatura</a></p>`
      );
    }
  }

  // 2) Lembretes 7/3/1 dias antes
  const remind = async (days: number, subject: string) => {
    const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate() + days);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, email, trial_ends_at, is_exempt_from_trial")
      .gte("trial_ends_at", start.toISOString())
      .lt("trial_ends_at", end.toISOString())
      .eq("is_exempt_from_trial", false);
    for (const c of companies ?? []) {
      const { data: sub } = await supabase
        .from("subscriptions").select("status").eq("company_id", c.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!sub || sub.status !== "trial" || !c.email) continue;
      await sendEmail(
        c.email,
        subject,
        `<p>Olá,</p><p>Faltam <strong>${days} dia(s)</strong> para o término do seu trial gratuito do FrotaOps (${c.name}). Para não perder acesso, ative sua assinatura agora.</p><p><a href="https://www.frotaops.com.br/app/assinatura">Ativar assinatura</a></p>`
      );
    }
  };
  await remind(7, "Faltam 7 dias para acabar seu trial");
  await remind(3, "Faltam 3 dias para acabar seu trial");
  await remind(1, "Último dia do seu trial — ative agora");

  return new Response(
    JSON.stringify({ ok: true, expired: expiredCount }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});