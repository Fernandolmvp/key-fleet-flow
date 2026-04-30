import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook, createStripeClient } from "../_shared/stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  }
  return _supabase;
}

function tsToIso(ts: number | null | undefined): string | null {
  return ts ? new Date(ts * 1000).toISOString() : null;
}

async function applySubscription(subscription: any, env: StripeEnv) {
  const companyId = subscription.metadata?.companyId;
  if (!companyId) {
    console.error("subscription sem metadata.companyId", subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceLookup = item?.price?.metadata?.lovable_external_id || item?.price?.lookup_key;
  if (!priceLookup) {
    console.error("price sem lookup_key/external_id", subscription.id);
    return;
  }
  const periodStart = tsToIso(item?.current_period_start ?? subscription.current_period_start);
  const periodEnd = tsToIso(item?.current_period_end ?? subscription.current_period_end);

  const { error } = await getSupabase().rpc("apply_stripe_subscription", {
    _company_id: companyId,
    _stripe_customer_id: subscription.customer,
    _stripe_subscription_id: subscription.id,
    _stripe_price_id: priceLookup,
    _stripe_status: subscription.status,
    _current_period_start: periodStart,
    _current_period_end: periodEnd,
    _cancel_at_period_end: !!subscription.cancel_at_period_end,
    _environment: env,
  });
  if (error) console.error("apply_stripe_subscription error:", error);
}

async function recordPayment(invoice: any, env: StripeEnv) {
  // Tenta companyId do invoice metadata, depois da subscription
  let companyId = invoice.metadata?.companyId as string | undefined;
  const subId = invoice.subscription || invoice.parent?.subscription_details?.subscription;

  if (!companyId && subId) {
    try {
      const stripe = createStripeClient(env);
      const sub = await stripe.subscriptions.retrieve(subId);
      companyId = sub.metadata?.companyId;
    } catch (e) {
      console.error("falha ao buscar subscription:", e);
    }
  }
  if (!companyId) {
    console.error("invoice sem companyId", invoice.id);
    return;
  }

  const amount = (invoice.amount_paid ?? 0) / 100;
  const { error } = await getSupabase().rpc("record_stripe_payment", {
    _company_id: companyId,
    _amount: amount,
    _stripe_invoice_id: invoice.id ?? null,
    _stripe_payment_intent_id: invoice.payment_intent ?? null,
    _paid_at: tsToIso(invoice.status_transitions?.paid_at ?? invoice.created),
  });
  if (error) console.error("record_stripe_payment error:", error);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  console.log("event:", event.type);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applySubscription(event.data.object, env);
      break;
    case "invoice.payment_succeeded":
      await recordPayment(event.data.object, env);
      // Também sincroniza status (renovação)
      {
        const subId = (event.data.object as any).subscription || (event.data.object as any).parent?.subscription_details?.subscription;
        if (subId) {
          try {
            const stripe = createStripeClient(env);
            const sub = await stripe.subscriptions.retrieve(subId);
            await applySubscription(sub, env);
          } catch (e) { console.error("sync after invoice fail:", e); }
        }
      }
      break;
    case "invoice.payment_failed": {
      const subId = (event.data.object as any).subscription || (event.data.object as any).parent?.subscription_details?.subscription;
      if (subId) {
        try {
          const stripe = createStripeClient(env);
          const sub = await stripe.subscriptions.retrieve(subId);
          await applySubscription(sub, env);
        } catch (e) { console.error("sync after fail:", e); }
      }
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object as any;
      if (session.mode === "subscription" && session.subscription) {
        try {
          const stripe = createStripeClient(env);
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await applySubscription(sub, env);
        } catch (e) { console.error("sync after checkout:", e); }
      }
      break;
    }
    default:
      console.log("unhandled:", event.type);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("invalid env:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
  try {
    await handleWebhook(req, rawEnv);
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});