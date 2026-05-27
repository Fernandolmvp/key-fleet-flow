// Cria empresa + gestor manualmente pelo Super Admin, com senha temporária e
// email já confirmado (bypass de confirmação enquanto domínio de email não está verificado).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
function genTempPassword(len = 10) {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

function isValidCnpj(v: string) {
  const d = onlyDigits(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (slice: number) => {
    const w = slice === 12
      ? [5,4,3,2,9,8,7,6,5,4,3,2]
      : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let s = 0;
    for (let i = 0; i < slice; i++) s += parseInt(d[i], 10) * w[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(d[12], 10) && calc(13) === parseInt(d[13], 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: cErr } = await userClient.auth.getUser(authHeader.slice(7));
    if (cErr || !userData?.user?.id) return json({ error: "Token inválido" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sa } = await admin.from("super_admins").select("user_id").eq("user_id", callerId).maybeSingle();
    if (!sa) return json({ error: "Apenas Super Admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const company = body.company ?? {};
    const manager = body.manager ?? {};
    const couponCode: string | null = body.coupon_code ? String(body.coupon_code).trim().toUpperCase() : null;
    const isExempt: boolean = !!body.is_exempt_from_trial;
    // Modo padrão: enviar email de boas-vindas com link de primeiro acesso.
    // Se send_welcome_email === false, mantém fluxo legado (senha temporária retornada).
    const sendWelcomeEmail: boolean = body.send_welcome_email !== false;

    const name = String(company.name ?? "").trim();
    const cnpj = onlyDigits(company.cnpj);
    if (!name) return json({ error: "Nome da empresa obrigatório" }, 400);
    if (!isValidCnpj(cnpj)) return json({ error: "CNPJ inválido" }, 400);
    const mgrEmail = String(manager.email ?? "").trim().toLowerCase();
    const mgrName = String(manager.name ?? "").trim();
    if (!mgrName) return json({ error: "Nome do gestor obrigatório" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mgrEmail)) return json({ error: "Email do gestor inválido" }, 400);

    const { data: dup } = await admin.from("companies").select("id").eq("cnpj", cnpj).maybeSingle();
    if (dup) return json({ error: "Já existe empresa com este CNPJ" }, 409);

    // Em modo welcome email, geramos uma senha aleatória longa que o cliente nunca usa.
    const tempPassword = sendWelcomeEmail ? genTempPassword(32) : genTempPassword(10);
    const { data: created, error: cuErr } = await admin.auth.admin.createUser({
      email: mgrEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: mgrName, created_manually_by: callerId },
    });
    if (cuErr || !created.user) {
      const msg = String(cuErr?.message || "");
      if (/already|exists|registered/i.test(msg)) {
        return json({ error: "Já existe um usuário com este email" }, 409);
      }
      return json({ error: cuErr?.message || "Falha ao criar usuário" }, 500);
    }
    const userId = created.user.id;

    const trialEnd = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
    const { data: comp, error: ceErr } = await admin.from("companies").insert({
      name,
      cnpj,
      phone: company.phone ?? null,
      city: company.city ?? null,
      state: company.state ?? null,
      contact_name: mgrName,
      email: mgrEmail,
      status: "ativa",
      trial_started_at: new Date().toISOString(),
      trial_ends_at: trialEnd,
      is_exempt_from_trial: isExempt,
    }).select("id").single();
    if (ceErr || !comp) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      return json({ error: ceErr?.message || "Falha ao criar empresa" }, 500);
    }
    const companyId = comp.id as string;

    await admin.from("company_members").insert({ company_id: companyId, user_id: userId });
    await admin.from("user_roles").insert({ company_id: companyId, user_id: userId, role: "admin" });
    await admin.from("profiles").upsert({
      id: userId,
      full_name: mgrName,
      email: mgrEmail,
      phone: manager.phone ?? null,
      current_company_id: companyId,
    }, { onConflict: "id" });

    const { data: plan } = await admin.from("plans").select("id,name")
      .eq("active", true).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    if (plan) {
      const today = new Date().toISOString().slice(0, 10);
      const endDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await admin.from("subscriptions").insert({
        company_id: companyId,
        plan_id: plan.id,
        status: "trial",
        current_period_start: today,
        current_period_end: endDate,
        trial_plan_snapshot: plan.name,
      });
    }

    let couponApplied: any = null;
    if (couponCode) {
      const { data: coupon } = await admin.from("coupons").select("*").eq("code", couponCode).maybeSingle();
      if (coupon && coupon.is_active) {
        if (coupon.type === "trial_days" && coupon.trial_days) {
          const newEnd = new Date(Date.now() + coupon.trial_days * 24 * 60 * 60 * 1000).toISOString();
          await admin.from("companies").update({ trial_ends_at: newEnd }).eq("id", companyId);
          couponApplied = { trial_days: coupon.trial_days };
        } else if (coupon.type === "discount_percent" || coupon.type === "discount_fixed") {
          await admin.from("pending_coupon_discounts").insert({
            company_id: companyId,
            coupon_id: coupon.id,
            discount_percent: coupon.discount_percent,
            discount_amount: coupon.discount_amount,
            months_remaining: coupon.discount_months ?? 1,
          });
          couponApplied = {
            discount_percent: coupon.discount_percent,
            discount_amount: coupon.discount_amount,
            months: coupon.discount_months ?? 1,
          };
        }
        await admin.from("coupon_redemptions").insert({
          coupon_id: coupon.id,
          company_id: companyId,
          applied_type: coupon.type,
          applied_value: couponApplied,
          cnpj_at_redemption: cnpj,
        });
        await admin.from("coupons").update({ current_uses: (coupon.current_uses ?? 0) + 1 }).eq("id", coupon.id);
      }
    }

    await admin.from("audit_logs").insert({
      company_id: companyId,
      user_id: callerId,
      table_name: "companies",
      record_id: companyId,
      action: "manual_create_by_super_admin",
      changes: {
        manager_user_id: userId,
        manager_email: mgrEmail,
        is_exempt_from_trial: isExempt,
        coupon_applied: couponApplied,
        mode: sendWelcomeEmail ? "welcome_email" : "temp_password",
      },
    });

    // Fluxo welcome email: gera token e dispara envio.
    if (sendWelcomeEmail) {
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      const token = btoa(String.fromCharCode(...tokenBytes))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      await admin.from("first_access_tokens").insert({
        user_id: userId,
        token,
        expires_at: expiresAt,
      });
      const welcomeLink = `https://frotaops.com.br/primeiro-acesso?token=${encodeURIComponent(token)}`;

      // Dispara envio do email (não bloqueia criação se falhar)
      let emailSent = false;
      let emailError: string | null = null;
      try {
        const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ email: mgrEmail, nome: mgrName, empresa: name, token }),
        });
        const j = await r.json().catch(() => ({}));
        emailSent = r.ok && !!(j as any)?.ok;
        if (!emailSent) emailError = (j as any)?.error || `HTTP ${r.status}`;
      } catch (e) {
        emailError = (e as Error).message;
      }

      await admin.from("audit_logs").insert({
        company_id: companyId,
        user_id: callerId,
        table_name: "companies",
        record_id: companyId,
        action: "welcome_email_sent",
        changes: { manager_email: mgrEmail, email_sent: emailSent, email_error: emailError },
      });

      return json({
        success: true,
        company_id: companyId,
        manager_email: mgrEmail,
        mode: "welcome_email",
        email_sent: emailSent,
        email_error: emailError,
        welcome_link: welcomeLink,
        coupon_applied: couponApplied,
      });
    }

    return json({
      success: true,
      company_id: companyId,
      manager_email: mgrEmail,
      mode: "temp_password",
      temp_password: tempPassword,
      coupon_applied: couponApplied,
    });
  } catch (e) {
    console.error("admin-create-company-manual error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
