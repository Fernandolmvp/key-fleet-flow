import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function onlyDigits(value: string) {
  return (value || "").replace(/\D/g, "");
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskEmail(email: string): string {
  const [user, domain] = (email || "").split("@");
  if (!user || !domain) return email;
  const head = user.length <= 2 ? user[0] : user.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email);
}

function isStrongPassword(password: string) {
  return password.length >= 8
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password);
}

function getFriendlyErrorMessage(error: unknown) {
  const authError = error as { code?: string; name?: string; reasons?: string[]; message?: string } | null;

  if (authError?.code === "weak_password" || authError?.name === "AuthWeakPasswordError") {
    if (authError?.reasons?.includes("pwned")) {
      return "Essa senha é fraca ou já apareceu em vazamentos. Use outra com pelo menos 8 caracteres, incluindo letra maiúscula, minúscula e número.";
    }

    return "A senha precisa ter pelo menos 8 caracteres, com letra maiúscula, minúscula e número.";
  }

  return authError?.message || String(error);
}

async function findAuthUserByEmail(email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (users.length < 200) break;
  }
  return null;
}

async function ensureCompanyMember(companyId: string, userId: string) {
  const { data: member } = await admin
    .from("company_members")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) {
    const { error } = await admin.from("company_members").insert({ company_id: companyId, user_id: userId });
    if (error && error.code !== "23505") throw error;
  }
}

async function ensureDriverRole(companyId: string, userId: string) {
  const { data: role } = await admin
    .from("user_roles")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("role", "motorista")
    .maybeSingle();

  if (!role) {
    const { error } = await admin.from("user_roles").insert({ company_id: companyId, user_id: userId, role: "motorista" });
    if (error && error.code !== "23505") throw error;
  }
}

async function ensureDriverAccessBindings(
  driver: { company_id: string; full_name: string },
  userId: string,
  phone: string | null,
) {
  await ensureCompanyMember(driver.company_id, userId);
  await ensureDriverRole(driver.company_id, userId);

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      full_name: driver.full_name,
      phone: phone || null,
      current_company_id: driver.company_id,
    },
    { onConflict: "id" },
  );

  if (profileError) throw profileError;
}

async function ensureDriverAuthUser(
  driver: { user_id: string | null; full_name: string; company_id: string },
  email: string,
  password: string,
  phone: string | null,
) {
  let authUserId = driver.user_id;

  if (authUserId) {
    const { data, error } = await admin.auth.admin.getUserById(authUserId);
    if (error || !data.user) authUserId = null;
  }

  if (!authUserId) {
    const existingUser = await findAuthUserByEmail(email);
    authUserId = existingUser?.id ?? null;
  }

  if (authUserId) {
    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: driver.full_name, phone: phone || undefined },
    });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: driver.full_name, phone: phone || undefined },
    });
    if (error) throw error;
    authUserId = data.user?.id ?? null;
  }

  if (!authUserId) throw new Error("Não foi possível preparar o acesso do motorista.");

  await ensureDriverAccessBindings(driver, authUserId, phone || null);

  const { data: confirmedUser, error: confirmedUserError } = await admin.auth.admin.getUserById(authUserId);
  if (confirmedUserError || !confirmedUser.user) {
    throw confirmedUserError ?? new Error("Usuário do motorista não encontrado após a ativação.");
  }

  return authUserId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, ...payload } = await req.json();
    const ip = getIp(req);

    if (action === "verify-identity") {
      const cpf = onlyDigits(payload.cpf || "");
      const birth = String(payload.birth_date || "");

      if (cpf.length !== 11 || !birth) {
        return json({ error: "CPF e data de nascimento são obrigatórios" }, 400);
      }

      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { count: attemptsCount } = await admin
        .from("driver_onboarding_attempts")
        .select("id", { count: "exact", head: true })
        .eq("cpf", cpf)
        .gte("attempted_at", since)
        .eq("success", false);

      if ((attemptsCount ?? 0) >= 5) {
        return json({ error: "Muitas tentativas. Tente novamente em 30 minutos." }, 429);
      }

      const { data: activeDrivers } = await admin
        .from("drivers")
        .select("id, full_name, company_id, email, phone, birth_date, status, onboarded_at, cpf")
        .eq("status", "ativo");

      const sameCpf = (activeDrivers ?? []).filter((driver: any) => onlyDigits(driver.cpf || "") === cpf);
      const driver = sameCpf.find((item: any) => item.birth_date === birth);

      await admin.from("driver_onboarding_attempts").insert({ cpf, ip, success: !!driver });

      if (!driver) {
        if (sameCpf.length > 0 && sameCpf.every((item: any) => !item.birth_date)) {
          return json({ error: "Sua data de nascimento não está cadastrada. Peça para a empresa atualizar seu cadastro." }, 409);
        }
        return json({ error: "CPF ou data de nascimento não conferem" }, 404);
      }

      return json({
        driver_id: driver.id,
        full_name: driver.full_name,
        company_id: driver.company_id,
        existing_email: driver.email || null,
        existing_phone: driver.phone || null,
        already_onboarded: !!driver.onboarded_at,
      });
    }

    if (action === "send-otp") {
      const driverId = String(payload.driver_id || "");
      const email = String(payload.email || "").trim().toLowerCase();

      if (!driverId || !email) {
        return json({ error: "driver_id e email são obrigatórios" }, 400);
      }
      if (!isValidEmail(email)) {
        return json({ error: "Email inválido" }, 400);
      }

      const { data: driver } = await admin
        .from("drivers")
        .select("id, company_id, status")
        .eq("id", driverId)
        .maybeSingle();

      if (!driver || driver.status !== "ativo") {
        return json({ error: "Motorista não encontrado" }, 404);
      }

      await admin
        .from("driver_otp_codes")
        .update({ consumed_at: new Date().toISOString() })
        .eq("driver_id", driverId)
        .is("consumed_at", null);

      const code = genCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: insertError } = await admin.from("driver_otp_codes").insert({
        driver_id: driverId,
        company_id: driver.company_id,
        phone: email,
        code,
        expires_at: expiresAt,
        created_ip: ip,
      });

      if (insertError) {
        return json({ error: insertError.message }, 500);
      }

      console.log(`[OTP EMAIL] ${email} | código: ${code}`);

      return json({
        ok: true,
        expires_at: expiresAt,
        masked_email: maskEmail(email),
        dev_code: code,
      });
    }

    if (action === "confirm-otp") {
      const driverId = String(payload.driver_id || "");
      const code = String(payload.code || "").trim();
      const email = String(payload.email || "").trim().toLowerCase();
      const password = String(payload.password || "");
      const phone = onlyDigits(String(payload.phone || ""));

      if (!driverId || !code || !email || !password) {
        return json({ error: "driver_id, code, email e senha são obrigatórios" }, 400);
      }
      if (!isValidEmail(email)) {
        return json({ error: "Email inválido" }, 400);
      }
      if (!isStrongPassword(password)) {
        return json({ error: "A senha precisa ter pelo menos 8 caracteres, com letra maiúscula, minúscula e número." }, 400);
      }

      const { data: otp } = await admin
        .from("driver_otp_codes")
        .select("*")
        .eq("driver_id", driverId)
        .is("consumed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otp) {
        return json({ error: "Nenhum código ativo. Solicite um novo." }, 404);
      }
      if (new Date(otp.expires_at).getTime() < Date.now()) {
        return json({ error: "Código expirado. Solicite um novo." }, 410);
      }
      if ((otp.attempts ?? 0) >= 5) {
        await admin.from("driver_otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
        return json({ error: "Muitas tentativas. Solicite um novo código." }, 429);
      }
      if (otp.phone !== email) {
        await admin.from("driver_otp_codes").update({ attempts: (otp.attempts ?? 0) + 1 }).eq("id", otp.id);
        return json({ error: "O email informado não confere com o código enviado." }, 401);
      }
      if (code !== otp.code) {
        await admin.from("driver_otp_codes").update({ attempts: (otp.attempts ?? 0) + 1 }).eq("id", otp.id);
        return json({ error: "Código inválido" }, 401);
      }

      const { data: driver } = await admin
        .from("drivers")
        .select("id, company_id, full_name, user_id")
        .eq("id", driverId)
        .maybeSingle();

      if (!driver) {
        return json({ error: "Motorista não encontrado" }, 404);
      }

      const authUserId = await ensureDriverAuthUser(driver, email, password, phone || null);

      await admin.from("driver_otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);

      const { error: updateError } = await admin
        .from("drivers")
        .update({
          user_id: authUserId,
          email,
          phone: phone || null,
          email_verified_at: new Date().toISOString(),
          phone_verified_at: phone ? new Date().toISOString() : null,
          onboarded_at: new Date().toISOString(),
        })
        .eq("id", driverId);

      if (updateError) {
        return json({ error: updateError.message }, 500);
      }

      return json({ ok: true, email });
    }

    if (action === "lookup-by-cpf") {
      const cpf = onlyDigits(payload.cpf || "");
      if (cpf.length !== 11) return json({ error: "CPF inválido" }, 400);

      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { count: attemptsCount } = await admin
        .from("driver_onboarding_attempts")
        .select("id", { count: "exact", head: true })
        .eq("cpf", cpf)
        .gte("attempted_at", since)
        .eq("success", false);

      if ((attemptsCount ?? 0) >= 10) {
        return json({ error: "Muitas tentativas. Tente novamente em 30 minutos." }, 429);
      }

      const { data: drivers } = await admin
        .from("drivers")
        .select("id, email, status, cpf, onboarded_at, user_id, company_id, full_name, phone, email_verified_at")
        .eq("status", "ativo");

      const driver = (drivers ?? []).find((item: any) => onlyDigits(item.cpf || "") === cpf);

      await admin.from("driver_onboarding_attempts").insert({ cpf, ip, success: !!driver });

      if (!driver) return json({ error: "CPF não encontrado ou motorista inativo" }, 404);
      if (!driver.email) return json({ error: "Motorista sem email cadastrado. Procure o gestor." }, 404);
      if (!driver.onboarded_at) {
        return json({ error: "Você ainda não ativou seu acesso. Use 'Ativar acesso de motorista'." }, 409);
      }

      let authUserId = driver.user_id || null;

      if (authUserId) {
        const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(authUserId);
        if (authUserError || !authUser.user) authUserId = null;
      }

      if (!authUserId) {
        const authUser = await findAuthUserByEmail(String(driver.email).toLowerCase());
        authUserId = authUser?.id ?? null;
      }

      if (!authUserId) {
        return json({ error: "Seu acesso anterior não foi concluído corretamente. Use 'Ativar acesso de motorista' novamente para finalizar." }, 409);
      }

      await ensureDriverAccessBindings(driver, authUserId, driver.phone || null);

      if (driver.user_id !== authUserId) {
        const { error: repairError } = await admin
          .from("drivers")
          .update({
            user_id: authUserId,
            email_verified_at: driver.email_verified_at || new Date().toISOString(),
            onboarded_at: driver.onboarded_at || new Date().toISOString(),
          })
          .eq("id", driver.id);

        if (repairError) return json({ error: repairError.message }, 500);
      }

      return json({ email: driver.email });
    }

    if (action === "reset-password-send-email") {
      const cpf = onlyDigits(payload.cpf || "");
      const redirectTo = String(payload.redirect_to || "").trim();

      if (cpf.length !== 11) return json({ error: "CPF inválido" }, 400);

      const { data: drivers } = await admin
        .from("drivers")
        .select("id, email, cpf, status, onboarded_at")
        .eq("status", "ativo");

      const driver = (drivers ?? []).find((item: any) => onlyDigits(item.cpf || "") === cpf);

      if (!driver) return json({ error: "CPF não encontrado" }, 404);
      if (!driver.email) return json({ error: "Sem email cadastrado. Procure o gestor." }, 400);
      if (!driver.onboarded_at) {
        return json({ error: "Você ainda não ativou seu acesso. Use 'Ativar acesso de motorista'." }, 409);
      }

      const { error } = await admin.auth.resetPasswordForEmail(driver.email, {
        redirectTo: redirectTo || undefined,
      });

      if (error) return json({ error: error.message }, 500);

      return json({ ok: true, masked_email: maskEmail(driver.email) });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (error) {
    console.error(error);
    const friendlyMessage = getFriendlyErrorMessage(error);
    const status = (error as { status?: number } | null)?.status ?? 500;
    return json({ error: friendlyMessage }, status);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}