import { supabase } from "@/integrations/supabase/client";

/** Returns the highest KM ever registered for a vehicle (0 if none). */
export async function getMaxVehicleKm(vehicleId: string): Promise<number> {
  if (!vehicleId) return 0;
  const [{ data: v }, { data: f }, { data: c }, { data: m }, { data: a }] = await Promise.all([
    supabase.from("vehicles").select("current_km").eq("id", vehicleId).maybeSingle(),
    supabase.from("fuel_records").select("km_at_fueling").eq("vehicle_id", vehicleId).order("km_at_fueling", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("checklist_runs").select("km_at_check").eq("vehicle_id", vehicleId).not("km_at_check", "is", null).order("km_at_check", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("maintenance_records").select("km_at_service").eq("vehicle_id", vehicleId).not("km_at_service", "is", null).order("km_at_service", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("fuel_authorizations").select("km_at_request").eq("vehicle_id", vehicleId).not("km_at_request", "is", null).order("km_at_request", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return Math.max(
    Number(v?.current_km ?? 0) || 0,
    Number(f?.km_at_fueling ?? 0) || 0,
    Number(c?.km_at_check ?? 0) || 0,
    Number(m?.km_at_service ?? 0) || 0,
    Number(a?.km_at_request ?? 0) || 0,
  );
}

/** Translates DB exception text into a friendly toast message. */
export function friendlyKmError(message: string): string | null {
  if (!message) return null;
  if (message.includes("KM_REGRESSIVO")) {
    const m = message.match(/\((\d+)\).*\((\d+)\)/);
    if (m) return `KM informado (${Number(m[1]).toLocaleString("pt-BR")}) é menor que o último KM do veículo (${Number(m[2]).toLocaleString("pt-BR")}). Peça a um gestor para corrigir com justificativa.`;
    return "KM informado é menor que o último KM registrado do veículo. Peça a um gestor para corrigir com justificativa.";
  }
  if (message.includes("KM_OVERRIDE_REASON")) {
    return "A justificativa do override de KM precisa ter pelo menos 10 caracteres.";
  }
  return null;
}