import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function onlyDigits(s: string) { return (s || "").replace(/\D/g, ""); }
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

function maskEmail(e: string): string {
  const [u, d] = (e || "").split("@");
  if (!u || !d) return e;
  const head = u.length <= 2 ? u[0] : u.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
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

      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { count: attemptsCount } = await admin
        .from("driver_onboarding_attempts")
        .select("id", { count: "exact", head: true })
        .eq("cpf", cpf).gte("attempted_at", since).eq("success", false);
      if ((attemptsCount ?? 0) >= 5) {
        return json({ error: "Muitas tentativas. Tente novamente em 30 minutos." }, 429);
      }

      const { data: byCpf } = await admin
        .from("drivers")
        .select("id, full_name, company_id, phone, email, birth_date, status, phone_verified_at, cpf")
        .eq("status", "ativo");
      const driver = (byCpf ?? []).find((d: any) =>
        onlyDigits(d.cpf || "") === cpf && d.birth_date === birth
      );

      await admin.from("driver_onboarding_attempts").insert({ cpf, ip, success: !!driver });

      if (!driver) return json({ error: "CPF ou data de nascimento não confere" }, 404);

      return json({
        driver_id: driver.id,
        full_name: driver.full_name,
        company_id: driver.company_id,
        existing_phone: driver.phone || null,
        existing_email: driver.email || null,
        already_onboarded: !!driver.phone_verified_at,
      });
    }

    // ===== send-otp: envia código de 6 dígitos por EMAIL (primeiro acesso) =====
    if (action === "send-otp") {
      const { driver_id, email } = payload;
      if (!driver_id || !email) return json({ error: "driver_id e email obrigatórios" }, 400);
      const emailNorm = String(email).trim().toLowerCase();
      if (!/.+@.+\..+/.test(emailNorm)) return json({ error: "Email inválido" }, 400);

      const { data: drv } = await admin
        .from("drivers").select("id, company_id").eq("id", driver_id).maybeSingle();
      if (!drv) return json({ error: "Motorista não encontrado" }, 404);

      await admin.from("driver_otp_codes")
        .update({ consumed_at: new Date().toISOString() })
        .eq("driver_id", driver_id).is("consumed_at", null);

      const code = genCode();
      const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: insErr } = await admin.from("driver_otp_codes").insert({
        driver_id, company_id: drv.company_id, phone: emailNorm, code, expires_at, created_ip: ip,
      });
      if (insErr) return json({ error: insErr.message }, 500);

      // O código fica visível em modo dev (toast amarelo na UI). Para produção,
      // configure o template "Magic Link" do Lovable Cloud e envie {{ .Token }}.
      console.log(`[OTP EMAIL] ${emailNorm} | código: ${code}`);
      return json({
        ok: true,
        expires_at,
        masked_email: maskEmail(emailNorm),
        dev_code: code,
      });
    }

    // ===== confirm-otp: valida código do primeiro acesso =====
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

      await admin.from("driver_otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);

      const { data: cur } = await admin
        .from("drivers").select("phone, email").eq("id", driver_id).maybeSingle();

      const update: Record<string, any> = {
        phone_verified_at: new Date().toISOString(),
        onboarded_at: new Date().toISOString(),
      };
      if (!cur?.phone && phone) update.phone = String(phone);
      if (!cur?.email && email) update.email = String(email).trim().toLowerCase();
      if (email) update.email_verified_at = new Date().toISOString();

      const { error: upErr } = await admin.from("drivers").update(update).eq("id", driver_id);
      if (upErr) return json({ error: upErr.message }, 500);

      return json({ ok: true });
    }

    // ===== lookup-by-cpf: retorna email do motorista a partir do CPF (para login) =====
    if (action === "lookup-by-cpf") {
      const cpf = onlyDigits(payload.cpf || "");
      if (cpf.length !== 11) return json({ error: "CPF inválido" }, 400);

      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { count: attemptsCount } = await admin
        .from("driver_onboarding_attempts")
        .select("id", { count: "exact", head: true })
        .eq("cpf", cpf).gte("attempted_at", since).eq("success", false);
      if ((attemptsCount ?? 0) >= 10) {
        return json({ error: "Muitas tentativas. Tente novamente em 30 minutos." }, 429);
      }

      const { data: drivers } = await admin
        .from("drivers")
        .select("id, email, status, cpf, phone_verified_at")
        .eq("status", "ativo");
      const driver = (drivers ?? []).find((d: any) => onlyDigits(d.cpf || "") === cpf);

      await admin.from("driver_onboarding_attempts").insert({ cpf, ip, success: !!driver });

      if (!driver) return json({ error: "CPF não encontrado ou motorista inativo" }, 404);
      if (!driver.email) return json({ error: "Motorista sem email cadastrado. Procure o gestor." }, 404);
      if (!driver.phone_verified_at) {
        return json({ error: "Você ainda não ativou seu acesso. Use 'Ativar acesso de motorista'." }, 409);
      }
      return json({ email: driver.email });
    }

    // ===== reset-password-send-email: dispara email de redefinição de senha =====
    if (action === "reset-password-send-email") {
      const cpf = onlyDigits(payload.cpf || "");
      const redirect_to = payload.redirect_to as string | undefined;
      if (cpf.length !== 11) return json({ error: "CPF inválido" }, 400);

      const { data: drivers } = await admin
        .from("drivers").select("id, email, cpf, status, phone_verified_at")
        .eq("status", "ativo");
      const driver = (drivers ?? []).find((d: any) => onlyDigits(d.cpf || "") === cpf);
      if (!driver) return json({ error: "CPF não encontrado" }, 404);
      if (!driver.email) return json({ error: "Sem email cadastrado. Procure o gestor." }, 400);
      if (!driver.phone_verified_at) {
        return json({ error: "Você ainda não ativou seu acesso. Use 'Ativar acesso de motorista'." }, 409);
      }

      // Sistema nativo do Supabase Auth — envia email de recovery automaticamente
      const { error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: driver.email,
        options: { redirectTo: redirect_to || undefined },
      });
      if (linkErr) return json({ error: linkErr.message }, 500);

      return json({ ok: true, masked_email: maskEmail(driver.email) });
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
