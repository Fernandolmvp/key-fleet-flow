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
  name: "list_drivers",
  title: "Listar motoristas",
  description: "Lista os motoristas cadastrados na empresa do usuário autenticado.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).default(50),
    search: z.string().optional().describe("Busca por nome ou CPF."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, search }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("drivers")
      .select("id, full_name, cpf, cnh, cnh_category, cnh_expires_at, phone, email, status")
      .order("full_name", { ascending: true })
      .limit(limit);
    if (search) {
      const s = `%${search}%`;
      q = q.or(`full_name.ilike.${s},cpf.ilike.${s}`);
    }
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { drivers: data ?? [], count: data?.length ?? 0 },
    };
  },
});