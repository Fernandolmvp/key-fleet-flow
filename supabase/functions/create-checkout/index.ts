import { corsHeaders } from "@supabase/supabase-js/cors";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { priceId, companyId, customerEmail, userId, returnUrl, environment } = body ?? {};

    if (!priceId || typeof priceId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      throw new Error("priceId inválido");
    }
    if (!companyId || typeof companyId !== "string") throw new Error("companyId obrigatório");
    if (!returnUrl || typeof returnUrl !== "string") throw new Error("returnUrl obrigatório");
    if (environment !== "sandbox" && environment !== "live") throw new Error("environment inválido");

    const env: StripeEnv = environment;
    const stripe = createStripeClient(env);

    // Aceita tanto Stripe price IDs (price_xxx) quanto lookup_keys
    let price: any;
    if (priceId.startsWith("price_")) {
      price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
    } else {
      const prices = await stripe.prices.list({ lookup_keys: [priceId], expand: ["data.product"] });
      if (!prices.data.length) throw new Error("Preço não encontrado");
      price = prices.data[0];
    }
    const isRecurring = price.type === "recurring";

    // Aplica cupom pendente (se houver) — cria um Stripe Coupon na hora e anexa via discounts
    const supabase = getServiceClient();
    const { data: pending } = await supabase
      .from("pending_coupon_discounts")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let discounts: any[] | undefined;
    let appliedPendingId: string | null = null;
    if (pending) {
      try {
        const months = Math.max(1, Number(pending.months_remaining) || 1);
        const couponParams: any = {
          duration: months > 1 ? "repeating" : "once",
          ...(months > 1 && { duration_in_months: months }),
          name: `Cupom FrotaOps`,
        };
        if (pending.discount_percent) {
          couponParams.percent_off = Number(pending.discount_percent);
        } else if (pending.discount_amount) {
          couponParams.amount_off = Math.round(Number(pending.discount_amount) * 100);
          couponParams.currency = "brl";
        }
        const stripeCoupon = await stripe.coupons.create(couponParams);
        discounts = [{ coupon: stripeCoupon.id }];
        appliedPendingId = pending.id;
      } catch (e) {
        console.error("failed to apply pending coupon:", e);
      }
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: price.id, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      ...(customerEmail && { customer_email: customerEmail }),
      metadata: { companyId, userId: userId ?? "", priceId, pendingDiscountId: appliedPendingId ?? "" },
      ...(discounts && { discounts }),
      ...(isRecurring && {
        subscription_data: {
          metadata: { companyId, userId: userId ?? "", priceId },
          // Cobrança proporcional automática em upgrades:
          proration_behavior: "create_prorations",
        },
      }),
    });

    // Remove o pending após aplicar (Stripe controla a duração do desconto)
    if (appliedPendingId) {
      await supabase.from("pending_coupon_discounts").delete().eq("id", appliedPendingId);
    }

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("create-checkout error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});