import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, verifyPostoJwt } from "../_shared/posto-jwt.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const claims = await verifyPostoJwt(auth.slice(7));

    const body = await req.json();
    const action = body.action ?? "confirm";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "lookup") {
      const code = String(body.code ?? "").trim();
      if (code.length !== 6) return json({ error: "Código inválido" }, 400);
      const { data, error } = await supabase
        .from("fuel_authorizations")
        .select(`
          id, status, expires_at, fuel_station_id, approved_amount, fuel_type, km_at_request,
          vehicle:vehicles(id, plate, brand, model),
          driver:drivers(id, full_name, phone),
          company:companies(name)
        `)
        .eq("authorization_code", code)
        .eq("status", "aprovada")
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Código não encontrado ou já utilizado" }, 404);
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return json({ error: "Código expirado" }, 410);
      }
      if (data.fuel_station_id && data.fuel_station_id !== claims.station_id) {
        return json({ error: "Código não pertence a este posto" }, 403);
      }
      return json({ authorization: data });
    }

    if (action === "confirm") {
      const { code, liters, total_value, receipt_number, receipt_url, km_at_fueling } = body;
      const { data: recordId, error } = await supabase.rpc("confirm_authorization_by_station", {
        _code: String(code ?? "").trim(),
        _station_id: claims.station_id,
        _liters: Number(liters),
        _total_value: Number(total_value),
        _receipt_number: receipt_number ?? null,
        _receipt_url: receipt_url ?? null,
        _km_at_fueling: km_at_fueling ?? null,
      });
      if (error) return json({ error: error.message }, 400);

      // Email para a empresa cliente (não bloqueia se falhar)
      try {
        const { data: rec } = await supabase
          .from("fuel_records")
          .select(`
            id, fueled_at, liters, total_value, notes, receipt_url,
            company:companies(id, name, email),
            vehicle:vehicles(plate, brand, model),
            driver:drivers(full_name),
            station:fuel_stations(name, cnpj)
          `)
          .eq("id", recordId).maybeSingle();
        const companyEmail = (rec as any)?.company?.email;
        if (companyEmail) {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "fuel-confirmation",
              recipientEmail: companyEmail,
              idempotencyKey: `fuel-confirm-${recordId}`,
              templateData: {
                companyName: (rec as any)?.company?.name,
                vehiclePlate: (rec as any)?.vehicle?.plate,
                vehicle: `${(rec as any)?.vehicle?.brand ?? ""} ${(rec as any)?.vehicle?.model ?? ""}`.trim(),
                driverName: (rec as any)?.driver?.full_name,
                stationName: (rec as any)?.station?.name,
                stationCnpj: (rec as any)?.station?.cnpj,
                fueledAt: rec?.fueled_at,
                liters: rec?.liters,
                totalValue: rec?.total_value,
                receiptNumber: receipt_number,
                receiptUrl: receipt_url,
                authCode: code,
              },
            },
          });
        }
      } catch (_) { /* email é best-effort */ }

      return json({ ok: true, fuel_record_id: recordId });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}