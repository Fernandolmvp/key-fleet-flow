import { corsHeaders } from "@supabase/supabase-js/cors";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

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

    const prices = await stripe.prices.list({ lookup_keys: [priceId], expand: ["data.product"] });
    if (!prices.data.length) throw new Error("Preço não encontrado");
    const price = prices.data[0];
    const isRecurring = price.type === "recurring";

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: price.id, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      ...(customerEmail && { customer_email: customerEmail }),
      metadata: { companyId, userId: userId ?? "", priceId },
      ...(isRecurring && {
        subscription_data: {
          metadata: { companyId, userId: userId ?? "", priceId },
          // Cobrança proporcional automática em upgrades:
          proration_behavior: "create_prorations",
        },
      }),
    });

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