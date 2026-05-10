import {
  guardAiCall,
  registerAiUsage,
  extractTokensFromResponse,
  jsonResponse,
} from "../_shared/ai-tokens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  type: "function",
  function: {
    name: "review_insurance_vs_fleet",
    description:
      "Compara a apólice de seguro de frota (PDF) com o cadastro atual de veículos da empresa. Identifique veículos adicionados na apólice (endossos/adendos) que NÃO estão no cadastro, divergências de marca/modelo/ano, e veículos do cadastro que NÃO aparecem na apólice. Gere um resumo executivo claro.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Resumo executivo em 2-4 frases sobre o estado da cobertura vs cadastro." },
        vehicles_in_policy: {
          type: "array",
          description: "TODOS os veículos encontrados na apólice (incluindo endossos/adendos).",
          items: {
            type: "object",
            properties: {
              plate: { type: "string" },
              brand: { type: ["string", "null"] },
              model: { type: ["string", "null"] },
              year: { type: ["string", "null"] },
              insured_amount: { type: ["number", "null"] },
              inclusion_type: { type: ["string", "null"], enum: ["apolice", "adendo", null] },
              endorsement_number: { type: ["string", "null"] },
              page_number: { type: ["integer", "null"] },
              status_vs_registry: {
                type: "string",
                enum: ["cadastrado_ok", "cadastrado_divergente", "nao_cadastrado"],
                description: "Compare a placa com o cadastro recebido. 'cadastrado_divergente' se a placa existe mas marca/modelo diferem.",
              },
              divergence_notes: { type: ["string", "null"], description: "Descreva a divergência se houver." },
            },
            required: ["plate", "status_vs_registry"],
            additionalProperties: false,
          },
        },
        added_in_policy_not_in_registry: {
          type: "array",
          description: "Placas que aparecem na apólice mas NÃO no cadastro de veículos. Provavelmente foram adicionadas via endosso e ainda não cadastradas no sistema.",
          items: {
            type: "object",
            properties: {
              plate: { type: "string" },
              brand: { type: ["string", "null"] },
              model: { type: ["string", "null"] },
              year: { type: ["string", "null"] },
              inclusion_type: { type: ["string", "null"], enum: ["apolice", "adendo", null] },
              endorsement_number: { type: ["string", "null"] },
              page_number: { type: ["integer", "null"] },
              insured_amount: { type: ["number", "null"] },
              recommendation: { type: ["string", "null"], description: "Ex: 'Cadastrar veículo na frota'" },
            },
            required: ["plate"],
            additionalProperties: false,
          },
        },
        in_registry_not_in_policy: {
          type: "array",
          description: "Placas do cadastro recebido que NÃO foram encontradas na apólice (sem cobertura por esta apólice).",
          items: {
            type: "object",
            properties: {
              plate: { type: "string" },
              brand: { type: ["string", "null"] },
              model: { type: ["string", "null"] },
              recommendation: { type: ["string", "null"] },
            },
            required: ["plate"],
            additionalProperties: false,
          },
        },
        divergences: {
          type: "array",
          description: "Lista resumida de divergências de dados entre apólice e cadastro (marca, modelo, ano).",
          items: {
            type: "object",
            properties: {
              plate: { type: "string" },
              field: { type: "string" },
              policy_value: { type: ["string", "null"] },
              registry_value: { type: ["string", "null"] },
            },
            required: ["plate", "field"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "vehicles_in_policy", "added_in_policy_not_in_registry", "in_registry_not_in_policy"],
      additionalProperties: false,
    },
  },
};

type RegistryVehicle = { plate: string; brand?: string | null; model?: string | null; year?: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { fileBase64, mimeType, registryVehicles, policyMeta } = (await req.json()) as {
      fileBase64?: string;
      mimeType?: string;
      registryVehicles: RegistryVehicle[];
      policyMeta?: { policy_number?: string | null; insurer_name?: string | null };
    };

    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "PDF da apólice ausente. Reanexe a apólice para revisar." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(registryVehicles)) {
      return new Response(JSON.stringify({ error: "registryVehicles inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FEATURE = "review_insurance_policy";
    const MODEL = "google/gemini-2.5-pro";
    const guard = await guardAiCall(req, FEATURE);
    if ("err" in guard) return jsonResponse(guard.err.status, guard.err.body);
    const ctx = guard.ctx;

    const dataUrl = `data:${mimeType};base64,${fileBase64}`;
    const isPdf = (mimeType || "").toLowerCase().includes("pdf");

    const registryText = registryVehicles
      .map((v) => `- ${String(v.plate || "").toUpperCase()} | ${[v.brand, v.model, v.year].filter(Boolean).join(" ") || "(sem detalhes)"}`)
      .join("\n");

    const sys =
      "Você é especialista em apólices de seguro de frota brasileiras. Sua tarefa é COMPARAR a apólice (PDF) com o cadastro de veículos da empresa fornecido pelo usuário. Releia a apólice INTEIRA, incluindo endossos/adendos. Para cada veículo da apólice, decida se está 'cadastrado_ok' (placa bate, dados consistentes), 'cadastrado_divergente' (placa bate mas marca/modelo/ano diverge), ou 'nao_cadastrado' (placa não está no cadastro). Liste separadamente: (a) placas adicionadas na apólice e ausentes no cadastro — provavelmente endossos novos; (b) placas do cadastro que NÃO estão na apólice. Placas SEMPRE em maiúsculas, sem hífen/espaços. NÃO invente placas. Se uma placa do cadastro tem leve variação tipográfica com a apólice (ex: O vs 0), trate como mesma placa e marque como divergência.";

    const userText =
      `Apólice: ${policyMeta?.insurer_name || "(seguradora)"} #${policyMeta?.policy_number || "(s/ número)"}\n\n` +
      `CADASTRO DE VEÍCULOS DA EMPRESA (${registryVehicles.length} veículo(s)):\n${registryText || "(vazio)"}\n\n` +
      `Compare com o PDF da apólice e retorne pela function call.`;

    const userContent: any[] = [{ type: "text", text: userText }];
    if (isPdf) {
      userContent.push({ type: "file", file: { filename: "apolice.pdf", file_data: dataUrl } });
    } else {
      userContent.push({ type: "image_url", image_url: { url: dataUrl } });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userContent },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "review_insurance_vs_fleet" } },
      }),
    });

    if (aiResp.status === 429) {
      await registerAiUsage(ctx, { feature: FEATURE, model: MODEL, tokensInput: 0, tokensOutput: 0, tokensTotal: 0, success: false, error: "rate_limited_429" });
      return new Response(JSON.stringify({ error: "Limite de requisições da IA excedido." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      await registerAiUsage(ctx, { feature: FEATURE, model: MODEL, tokensInput: 0, tokensOutput: 0, tokensTotal: 0, success: false, error: "gateway_402" });
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      await registerAiUsage(ctx, { feature: FEATURE, model: MODEL, tokensInput: 0, tokensOutput: 0, tokensTotal: 0, success: false, error: `gateway_${aiResp.status}` });
      return new Response(JSON.stringify({ error: "Falha ao revisar apólice" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const usage = extractTokensFromResponse(data);
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      await registerAiUsage(ctx, { feature: FEATURE, model: MODEL, tokensInput: usage.input, tokensOutput: usage.output, tokensTotal: usage.total, success: false, error: "no_tool_call" });
      return new Response(JSON.stringify({ error: "IA não retornou análise." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(call.function.arguments); }
    catch {
      await registerAiUsage(ctx, { feature: FEATURE, model: MODEL, tokensInput: usage.input, tokensOutput: usage.output, tokensTotal: usage.total, success: false, error: "invalid_ai_response" });
      return new Response(JSON.stringify({ error: "Resposta da IA inválida" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await registerAiUsage(ctx, { feature: FEATURE, model: MODEL, tokensInput: usage.input, tokensOutput: usage.output, tokensTotal: usage.total, success: true });

    return new Response(JSON.stringify({ data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("review-insurance-policy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});