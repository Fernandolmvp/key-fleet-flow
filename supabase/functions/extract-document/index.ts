import { corsHeaders } from "@supabase/supabase-js/cors";

// Extrai dados estruturados de imagens/PDFs (CRLV de veículos, CNH de motoristas)
// usando Lovable AI Gateway com tool calling.

type DocType = "vehicle" | "driver";

const TOOL_VEHICLE = {
  type: "function",
  function: {
    name: "extract_vehicle",
    description:
      "Extrai dados do CRLV/DUT/CRV brasileiro. Use null para campos ilegíveis ou ausentes.",
    parameters: {
      type: "object",
      properties: {
        plate: { type: ["string", "null"], description: "Placa, formato Mercosul ou antigo, somente letras/números" },
        renavam: { type: ["string", "null"] },
        chassis: { type: ["string", "null"] },
        brand: { type: ["string", "null"], description: "Marca em maiúsculas" },
        model: { type: ["string", "null"] },
        year_manufacture: { type: ["integer", "null"] },
        year_model: { type: ["integer", "null"] },
        color: { type: ["string", "null"] },
        fuel_type: {
          type: ["string", "null"],
          enum: ["gasolina", "etanol", "diesel", "diesel_s10", "flex", "gnv", "eletrico", "hibrido", null],
        },
        vehicle_type: { type: ["string", "null"], description: "Sedan, utilitário, caminhão, etc" },
      },
      required: ["plate", "brand", "model"],
      additionalProperties: false,
    },
  },
};

const TOOL_DRIVER = {
  type: "function",
  function: {
    name: "extract_driver",
    description: "Extrai dados da CNH brasileira. Use null para campos ilegíveis ou ausentes.",
    parameters: {
      type: "object",
      properties: {
        full_name: { type: ["string", "null"] },
        cpf: { type: ["string", "null"], description: "Apenas dígitos, sem pontuação" },
        cnh_number: { type: ["string", "null"], description: "Número de registro da CNH" },
        cnh_category: { type: ["string", "null"], description: "Ex.: A, B, AB, D, E" },
        cnh_expires_at: { type: ["string", "null"], description: "Validade no formato YYYY-MM-DD" },
        medical_exam_expires_at: { type: ["string", "null"], description: "Validade do exame médico YYYY-MM-DD" },
        address: { type: ["string", "null"] },
      },
      required: ["full_name"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { type, fileBase64, mimeType } = (await req.json()) as {
      type: DocType;
      fileBase64: string;
      mimeType: string;
    };

    if (!type || !fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isVehicle = type === "vehicle";
    const tool = isVehicle ? TOOL_VEHICLE : TOOL_DRIVER;
    const fnName = isVehicle ? "extract_vehicle" : "extract_driver";
    const sys = isVehicle
      ? "Você é um especialista em documentos veiculares brasileiros (CRLV, CRV, DUT). Extraia os dados do documento com precisão. Datas em ISO YYYY-MM-DD. Placas em maiúsculas sem hífen."
      : "Você é um especialista em CNH (Carteira Nacional de Habilitação) brasileira. Extraia os dados com precisão. Datas em ISO YYYY-MM-DD. CPF apenas dígitos.";

    const dataUrl = `data:${mimeType};base64,${fileBase64}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
        tools: [tool],
        tool_choice: { type: "function", function: { name: fnName } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições da IA excedido. Tente em alguns instantes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Falha ao processar documento" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não conseguiu extrair dados deste documento." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "Resposta da IA inválida" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});