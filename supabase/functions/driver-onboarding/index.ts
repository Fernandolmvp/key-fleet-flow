import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function onlyDigits(s: string) { return (s || "").replace(/\D/g, ""); }
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

function normalizePhone(raw: string): string {
  const d = onlyDigits(raw);
  if (!d) return "";
  if (d.startsWith("55")) return "+" + d;
  if (d.length === 10 || d.length === 11) return "+55" + d;
  return "+" + d;
}

async function sendSms(to: string, body: string): Promise<{ ok: boolean; devCode?: string; error?: string }> {
  if (!TWILIO_API_KEY || !LOVABLE_API_KEY || !TWILIO_FROM) {
    console.log(`[DEV MODE] SMS para ${to}: ${body}`);
    return { ok: true };
  }
  try {
    const r = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("Twilio error", data);
      return { ok: false, error: data?.message || "Falha SMS" };
    }
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: String(e) };
  }
}

function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, ...payload } = await req.json();
    const ip = getIp(req);

    // ===== verify-identity: CPF + birth_date =====
    if (action === "verify-identity") {
      const cpf = onlyDigits(payload.cpf || "");
      const birth = payload.birth_date as string;
      if (cpf.length !== 11 || !birth) {
        return json({ error: "CPF e data de nascimento são obrigatórios" }, 400);
      }

      // Rate limit: 5 tentativas / 30 min por CPF
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { count: attemptsCount } = await admin
        .from("driver_onboarding_attempts")
        .select("id", { count: "exact", head: true })
        .eq("cpf", cpf).gte("attempted_at", since).eq("success", false);
      if ((attemptsCount ?? 0) >= 5) {
        return json({ error: "Muitas tentativas. Tente novamente em 30 minutos." }, 429);
      }

      const { data: drivers } = await admin
        .from("drivers")
        .select("id, full_name, company_id, phone, email, birth_date, status, phone_verified_at")
        .eq("status", "ativo");
      const match = (drivers ?? []).find((d: any) =>
        onlyDigits(d.cpf || "") === cpf || true // fallback if cpf not selected
      );
      // Re-query with cpf field to be precise
      const { data: byCpf } = await admin
        .from("drivers")
        .select("id, full_name, company_id, phone, email, birth_date, status, phone_verified_at, cpf")
        .eq("status", "ativo");
      const driver = (byCpf ?? []).find((d: any) =>
        onlyDigits(d.cpf || "") === cpf &&
        d.birth_date === birth
      );

      await admin.from("driver_onboarding_attempts").insert({
        cpf, ip, success: !!driver,
      });

      if (!driver) {
        return json({ error: "CPF ou data de nascimento não confere" }, 404);
      }

      return json({
        driver_id: driver.id,
        full_name: driver.full_name,
        company_id: driver.company_id,
        existing_phone: driver.phone || null,
        existing_email: driver.email || null,
        already_onboarded: !!driver.phone_verified_at,
      });
    }

    // ===== send-otp =====
    if (action === "send-otp") {
      const { driver_id, phone } = payload;
      if (!driver_id || !phone) return json({ error: "driver_id e phone obrigatórios" }, 400);
      const normalized = normalizePhone(phone);
      if (!normalized || normalized.length < 12) return json({ error: "Telefone inválido" }, 400);

      const { data: drv } = await admin
        .from("drivers").select("id, company_id").eq("id", driver_id).maybeSingle();
      if (!drv) return json({ error: "Motorista não encontrado" }, 404);

      // Invalida códigos anteriores ainda válidos para esse motorista
      await admin.from("driver_otp_codes")
        .update({ consumed_at: new Date().toISOString() })
        .eq("driver_id", driver_id).is("consumed_at", null);

      const code = genCode();
      const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const { error: insErr } = await admin.from("driver_otp_codes").insert({
        driver_id, company_id: drv.company_id, phone: normalized, code, expires_at, created_ip: ip,
      });
      if (insErr) return json({ error: insErr.message }, 500);

      const sms = await sendSms(normalized, `FrotaOps: seu código de confirmação é ${code}. Válido por 5 minutos.`);
      if (!sms.ok) return json({ error: sms.error || "Falha ao enviar SMS" }, 500);

      const dev = !TWILIO_API_KEY || !TWILIO_FROM;
      return json({ ok: true, expires_at, dev_code: dev ? code : undefined });
    }

    // ===== confirm-otp =====
    if (action === "confirm-otp") {
      const { driver_id, code, phone, email } = payload;
      if (!driver_id || !code) return json({ error: "driver_id e code obrigatórios" }, 400);

      const { data: otp } = await admin
        .from("driver_otp_codes")
        .select("*")
        .eq("driver_id", driver_id)
        .is("consumed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otp) return json({ error: "Nenhum código ativo. Solicite um novo." }, 404);
      if (new Date(otp.expires_at).getTime() < Date.now()) {
        return json({ error: "Código expirado. Solicite um novo." }, 410);
      }
      if ((otp.attempts ?? 0) >= 5) {
        await admin.from("driver_otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
        return json({ error: "Muitas tentativas. Solicite um novo código." }, 429);
      }
      if (String(code).trim() !== otp.code) {
        await admin.from("driver_otp_codes").update({ attempts: (otp.attempts ?? 0) + 1 }).eq("id", otp.id);
        return json({ error: "Código inválido" }, 401);
      }

      // Consome o código
      await admin.from("driver_otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);

      // Atualiza dados do motorista (sobrescreve só se vazio; senão mantém)
      const { data: cur } = await admin
        .from("drivers").select("phone, email").eq("id", driver_id).maybeSingle();

      const update: Record<string, any> = {
        phone_verified_at: new Date().toISOString(),
        onboarded_at: new Date().toISOString(),
      };
      const normalized = normalizePhone(otp.phone);
      if (!cur?.phone) update.phone = normalized;
      if (!cur?.email && email) update.email = String(email).trim().toLowerCase();
      if (email && cur?.email && cur.email !== String(email).trim().toLowerCase()) {
        // mantém o antigo, sinaliza pendência
        update.notes = `[ONBOARDING] Motorista informou email diferente: ${email} (atual: ${cur.email})`;
      }
      if (cur?.phone && cur.phone !== normalized) {
        update.notes = `${update.notes ? update.notes + " | " : ""}[ONBOARDING] Telefone informado ${normalized} difere do cadastro ${cur.phone}`;
      }
      if (email) update.email_verified_at = new Date().toISOString();

      const { error: upErr } = await admin.from("drivers").update(update).eq("id", driver_id);
      if (upErr) return json({ error: upErr.message }, 500);

      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}