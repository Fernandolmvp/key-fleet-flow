import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_company",
  title: "Obter dados da empresa",
  description:
    "Retorna dados da empresa atual do usuário autenticado (nome, CNPJ, endereço, contato).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data: profile, error: pErr } = await sb
      .from("profiles")
      .select("current_company_id")
      .eq("id", ctx.getUserId())
      .maybeSingle();
    if (pErr) return { content: [{ type: "text", text: pErr.message }], isError: true };
    const companyId = profile?.current_company_id;
    if (!companyId) {
      return {
        content: [{ type: "text", text: "Usuário não tem empresa atual selecionada." }],
        isError: true,
      };
    }
    const { data, error } = await sb
      .from("companies")
      .select(
        "id, name, cnpj, email, phone, contact_name, cep, address, address_number, neighborhood, city, state, status",
      )
      .eq("id", companyId)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { company: data },
    };
  },
});