import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um especialista em legislação de trânsito brasileira (CTB).
Analise a imagem enviada que pode ser um AVISO DE INFRAÇÃO (carta inicial, sem valor a pagar)
ou uma NOTIFICAÇÃO DE AUTUAÇÃO (com valor, AIT e prazo de vencimento/recurso/indicação).
Identifique primeiro o tipo do documento e extraia todos os campos que conseguir ler.
Use sempre formato ISO (YYYY-MM-DD) para datas. Para valores monetários, retorne número (R$ 195,23 -> 195.23).
Para gravidade, use exatamente um destes: "leve", "media", "grave", "gravissima".
Para tipo, use "aviso" ou "notificacao". Para tipo_infracao, prefira slugs como
velocidade, estacionamento_irregular, sem_cinto, celular_volante, alcool, avancar_sinal,
conversao_proibida, faixa_exclusiva, parada_proibida, embarque_desembarque, outro.
Retorne SOMENTE pela ferramenta extrair_multa.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { fileBase64, mimeType } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "fileBase64 e mimeType são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const tools = [{
      type: "function",
      function: {
        name: "extrair_multa",
        description: "Extrai os dados de um aviso ou notificação de infração de trânsito.",
        parameters: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: ["aviso", "notificacao"] },
            placa: { type: "string" },
            marca_modelo: { type: "string" },
            data_infracao: { type: "string", description: "YYYY-MM-DD" },
            hora_infracao: { type: "string", description: "HH:MM" },
            local: { type: "string" },
            cidade: { type: "string" },
            estado: { type: "string", description: "UF" },
            tipo_infracao: { type: "string" },
            descricao: { type: "string" },
            codigo_ctb: { type: "string" },
            gravidade: { type: "string", enum: ["leve","media","grave","gravissima"] },
            equipamento: { type: "string" },
            numero_ait: { type: "string" },
            valor: { type: "number" },
            valor_desconto: { type: "number" },
            pontos_cnh: { type: "number" },
            data_vencimento: { type: "string", description: "YYYY-MM-DD" },
            prazo_recurso: { type: "string", description: "YYYY-MM-DD" },
            prazo_indicacao: { type: "string", description: "YYYY-MM-DD" },
            confianca_extracao: { type: "number", description: "0 a 100" },
          },
          required: ["tipo", "confianca_extracao"],
          additionalProperties: false,
        },
      },
    }];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: "Analise este documento de infração de trânsito e extraia os campos." },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
          ]},
        ],
        tools,
        tool_choice: { type: "function", function: { name: "extrair_multa" } },
      }),
    });

    if (resp.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (resp.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("ai gateway", resp.status, t);
      return new Response(JSON.stringify({ error: `Falha na IA (${resp.status})` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não retornou dados estruturados." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let parsed: any = {};
    try { parsed = JSON.parse(call.function.arguments); } catch (e) {
      return new Response(JSON.stringify({ error: "JSON inválido da IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-traffic-fine error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});