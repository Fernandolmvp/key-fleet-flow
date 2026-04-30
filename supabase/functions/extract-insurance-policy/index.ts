const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  type: "function",
  function: {
    name: "extract_insurance_policy",
    description:
      "Extrai dados de uma apólice de seguro de frota brasileira. Retorne placas cobertas, dados da seguradora e do corretor.",
    parameters: {
      type: "object",
      properties: {
        policy_number: { type: ["string", "null"], description: "Número da apólice" },
        insurer_name: { type: ["string", "null"], description: "Nome da seguradora (Porto, Bradesco, Allianz, etc.)" },
        insurer_phone: { type: ["string", "null"], description: "Telefone da seguradora (apenas dígitos)" },
        insurer_email: { type: ["string", "null"] },
        start_date: { type: ["string", "null"], description: "Início de vigência YYYY-MM-DD" },
        end_date: { type: ["string", "null"], description: "Fim de vigência YYYY-MM-DD" },
        total_value: { type: ["number", "null"], description: "Prêmio total" },
        deductible: { type: ["number", "null"], description: "Franquia padrão" },
        coverage_summary: { type: ["string", "null"], description: "Resumo curto de coberturas principais" },
        broker_name: { type: ["string", "null"], description: "Nome/razão social do corretor de seguros" },
        broker_document: { type: ["string", "null"], description: "CNPJ/CPF do corretor (apenas dígitos)" },
        broker_susep: { type: ["string", "null"], description: "Registro SUSEP do corretor" },
        broker_phone: { type: ["string", "null"] },
        broker_email: { type: ["string", "null"] },
        plates: {
          type: "array",
          description: "Placas dos veículos cobertos pela apólice",
          items: { type: "string" },
        },
      },
      required: ["insurer_name"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { fileBase64, mimeType } = (await req.json()) as { fileBase64: string; mimeType: string };
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dataUrl = `data:${mimeType};base64,${fileBase64}`;
    const sys =
      "Você é especialista em apólices de seguro de frota brasileiras. Leia a apólice e extraia: número, seguradora (com telefone/email de atendimento), vigência (início e fim), prêmio total, franquia padrão, corretor (nome, CNPJ, SUSEP, telefone, email) e a LISTA COMPLETA DE PLACAS de todos os veículos cobertos (incluindo adendos/endossos se aparecerem). Datas em ISO YYYY-MM-DD. Placas em maiúsculas, sem hífen ou espaços.";

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia todos os dados visíveis e retorne pela function call." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "extract_insurance_policy" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições da IA excedido." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Falha ao processar apólice" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não conseguiu extrair dados." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(call.function.arguments); }
    catch {
      return new Response(JSON.stringify({ error: "Resposta da IA inválida" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-insurance-policy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});