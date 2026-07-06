import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_vehicles",
  title: "Listar veículos",
  description:
    "Lista os veículos da frota do usuário autenticado (respeita permissões da empresa).",
  inputSchema: {
    limit: z.number().int().min(1).max(200).default(50).describe("Máximo de veículos a retornar."),
    status: z
      .string()
      .optional()
      .describe("Filtrar por status (ex.: 'ativo', 'inativo', 'vendido')."),
    search: z
      .string()
      .optional()
      .describe("Busca por placa, marca ou modelo."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status, search }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("vehicles")
      .select(
        "id, plate, brand, model, year_model, color, status, current_km, fuel_type, licensing_year, chassis, renavam",
      )
      .order("plate", { ascending: true })
      .limit(limit);
    if (status) q = q.eq("status", status);
    if (search) {
      const s = `%${search}%`;
      q = q.or(`plate.ilike.${s},brand.ilike.${s},model.ilike.${s}`);
    }
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { vehicles: data ?? [], count: data?.length ?? 0 },
    };
  },
});