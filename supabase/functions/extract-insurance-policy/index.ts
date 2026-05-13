import {
  guardAiCall,
  jsonResponse,
} from "../_shared/ai-tokens.ts";
import { callAi } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  type: "function",
  function: {
    name: "extract_insurance_policy",
    description:
      "Extrai dados completos de uma apólice de seguro de frota brasileira. Retorne TODAS as placas cobertas (apólice e endossos/adendos), com dados detalhados por veículo, dados da seguradora, do corretor, vigência, prêmio total, franquia e coberturas.",
    parameters: {
      type: "object",
      properties: {
        policy_number: { type: ["string", "null"], description: "Número da apólice" },
        insurer_name: { type: ["string", "null"], description: "Nome da seguradora (Porto, Bradesco, Allianz, etc.)" },
        insurer_phone: { type: ["string", "null"], description: "Telefone da seguradora (apenas dígitos)" },
        insurer_email: { type: ["string", "null"] },
        insurer_document: { type: ["string", "null"], description: "CNPJ da seguradora (apenas dígitos)" },
        start_date: { type: ["string", "null"], description: "Início de vigência YYYY-MM-DD" },
        end_date: { type: ["string", "null"], description: "Fim de vigência YYYY-MM-DD" },
        emission_date: { type: ["string", "null"], description: "Data de emissão da apólice YYYY-MM-DD" },
        total_value: { type: ["number", "null"], description: "Prêmio total" },
        net_premium: { type: ["number", "null"], description: "Prêmio líquido se informado" },
        iof: { type: ["number", "null"], description: "Valor do IOF se informado" },
        installments_count: { type: ["integer", "null"], description: "Número de parcelas" },
        installment_value: { type: ["number", "null"], description: "Valor de cada parcela" },
        deductible: { type: ["number", "null"], description: "Franquia padrão" },
        coverage_summary: { type: ["string", "null"], description: "Resumo das coberturas principais (Casco, RCF-V, APP, assistência etc.) com limites quando possível" },
        coverage_type: {
          type: ["string", "null"],
          enum: ["compreensivo", "terceiros", "casco_total", "casco_parcial", "frota", "outro", null],
          description: "Tipo principal da cobertura. 'compreensivo' = casco + RCF + APP completo; 'terceiros' = apenas RCF (responsabilidade civil); 'casco_total' = casco completo; 'casco_parcial' = casco com restrições; 'frota' = apólice coletiva de frota; 'outro' = não se encaixa.",
        },
        insured_name: { type: ["string", "null"], description: "Razão social/nome do segurado (estipulante da frota)" },
        insured_document: { type: ["string", "null"], description: "CNPJ/CPF do segurado (apenas dígitos)" },
        broker_name: { type: ["string", "null"], description: "Nome/razão social do corretor de seguros" },
        broker_document: { type: ["string", "null"], description: "CNPJ/CPF do corretor (apenas dígitos)" },
        broker_susep: { type: ["string", "null"], description: "Registro SUSEP do corretor" },
        broker_phone: { type: ["string", "null"] },
        broker_email: { type: ["string", "null"] },
        plates: {
          type: "array",
          description: "Lista simples e COMPLETA de TODAS as placas cobertas (incluindo as de endossos/adendos). Em maiúsculas, sem hífen ou espaços.",
          items: { type: "string" },
        },
        vehicles: {
          type: "array",
          description: "Detalhamento por veículo coberto. Inclua TODOS os veículos listados na apólice e nos endossos. Se algum dado não estiver visível, retorne null naquele campo, mas SEMPRE inclua a placa.",
          items: {
            type: "object",
            properties: {
              plate: { type: "string", description: "Placa em maiúsculas, sem hífen/espaços" },
              brand: { type: ["string", "null"] },
              model: { type: ["string", "null"] },
              year: { type: ["string", "null"], description: "Ano modelo/fabricação como string" },
              fipe_code: { type: ["string", "null"] },
              chassis: { type: ["string", "null"] },
              insured_amount: { type: ["number", "null"], description: "Importância segurada / valor do casco para este veículo" },
              premium: { type: ["number", "null"], description: "Prêmio individual deste veículo, se discriminado" },
              deductible: { type: ["number", "null"], description: "Franquia específica deste veículo, se diferente da padrão" },
              inclusion_type: { type: ["string", "null"], enum: ["apolice", "adendo", null], description: "'adendo' se foi incluído por endosso após emissão; 'apolice' se está na lista original" },
              endorsement_number: { type: ["string", "null"] },
              coverage_notes: { type: ["string", "null"], description: "Observação curta sobre coberturas/limites específicos deste veículo" },
              page_number: { type: ["integer", "null"], description: "Número da página do PDF onde este veículo aparece (1-indexado). Se aparecer em várias páginas, indique a primeira." }
            },
            required: ["plate"],
            additionalProperties: false
          }
        }
      },
      required: ["insurer_name"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("[extract-insurance-policy] start", { method: req.method });

    const { fileBase64, mimeType } = (await req.json()) as { fileBase64: string; mimeType: string };
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FEATURE = "extract_insurance_policy";
    const guard = await guardAiCall(req, FEATURE);
    if ("err" in guard) return jsonResponse(guard.err.status, guard.err.body);
    const ctx = guard.ctx;
    console.log("[extract-insurance-policy] guard-ok", { feature: FEATURE, requestId: ctx.requestId, companyId: ctx.companyId });

    console.log("extract-insurance-policy: received", {
      mimeType,
      base64Len: fileBase64.length,
      approxBytes: Math.round((fileBase64.length * 3) / 4),
    });

    const dataUrl = `data:${mimeType};base64,${fileBase64}`;
    const isPdf = (mimeType || "").toLowerCase().includes("pdf");
    const sys =
      "Você é especialista em apólices de seguro de frota brasileiras (Porto, Bradesco, Allianz, Tokio, Sompo, HDI, Mapfre, Liberty, Suhai, etc.). Leia a apólice INTEIRA — TODAS as páginas, incluindo a relação de bens segurados, endossos, adendos e cláusulas. Extraia: número da apólice, seguradora (telefone/email/CNPJ), segurado (nome/CNPJ), vigência (início/fim/emissão), prêmio total, prêmio líquido, IOF, parcelas, franquia padrão, corretor (nome, CNPJ, SUSEP, telefone, email), coberturas principais com limites, e a LISTA COMPLETA E DETALHADA de TODOS os veículos cobertos (placa, marca, modelo, ano, FIPE, chassi, importância segurada, prêmio individual quando discriminado). Inclua veículos adicionados por endosso/adendo marcando inclusion_type='adendo'. Placas SEMPRE em maiúsculas, sem hífen/espaços. Datas em ISO YYYY-MM-DD. NUNCA invente placas — se não tiver certeza, omita.";

    // Para PDFs: usar input_file (Gemini lê o documento inteiro). Para imagens: image_url.
    const userContent: any[] = [
      { type: "text", text: "Extraia TODOS os dados visíveis do documento e retorne pela function call. Não resuma a lista de veículos — inclua TODOS." },
    ];
    if (isPdf) {
      userContent.push({
        type: "file",
        file: { filename: "apolice.pdf", file_data: dataUrl },
      });
    } else {
      userContent.push({ type: "image_url", image_url: { url: dataUrl } });
    }

    const result = await callAi({
      ctx, feature: FEATURE,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userContent },
      ],
      tools: [TOOL],
      toolChoice: { type: "function", function: { name: "extract_insurance_policy" } },
      timeoutMs: isPdf ? 120_000 : 45_000,
    });

    if (!result.success) {
      const status = result.httpStatus && result.httpStatus >= 400 && result.httpStatus < 600 ? result.httpStatus : 500;
      const errLower = String(result.errorMessage || "").toLowerCase();
      const isTimeout = errLower.includes("timeout") || errLower.includes("aborted") || status === 504;
      const isParse = errLower.includes("unexpected end of json") || errLower.includes("network");
      const userMsg =
        status === 429 ? "Limite de requisições da IA excedido. Tente novamente em instantes." :
        status === 402 ? "Créditos de IA esgotados." :
        isTimeout ? "Apólice muito grande/complexa — a IA não conseguiu processar dentro do tempo limite. Tente novamente, ou envie a apólice em partes (ex.: separe os endossos)." :
        isParse ? "Falha de comunicação com a IA ao processar a apólice. Tente novamente em instantes." :
        "Falha ao processar apólice. Tente novamente; se persistir, envie em partes ou outro formato (PDF nativo, não escaneado).";
      console.error("[extract-insurance-policy] ai-failed", { feature: FEATURE, status, provider: result.providerUsed, error: result.errorMessage });
      return new Response(JSON.stringify({ error: userMsg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const call = result.data?.choices?.[0]?.message?.tool_calls?.[0];
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
    console.log("[extract-insurance-policy] success", { feature: FEATURE, requestId: ctx.requestId, provider: result.providerUsed, model: result.modelUsed, fallback: result.wasFallback, tokensTotal: result.tokensTotal });

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