import {
  guardAiCall,
  jsonResponse,
} from "../_shared/ai-tokens.ts";
import { callAi } from "../_shared/ai-router.ts";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PDF_CHUNK_PAGE_COUNT = 4;
const PDF_CHUNK_PAGE_THRESHOLD = 6;
const PDF_CHUNK_BYTES_THRESHOLD = 3_000_000;
const PDF_CHUNK_CONCURRENCY = 3;
const PDF_CHUNK_TIMEOUT_MS = 55_000;

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
        coverage_summary: { type: ["string", "null"], description: "Resumo CURTO e OBJETIVO da cobertura (máx. 3 linhas / ~280 caracteres). Comece SEMPRE com o tipo de seguro EXATAMENTE como está classificado na apólice (ex.: 'Compreensivo', 'Casco + RCF-V', 'Apenas Terceiros / RCF-V', 'Frota Compreensiva', etc.). Em seguida liste apenas as coberturas principais separadas por vírgula (ex.: Casco, RCF-V Danos Materiais, RCF-V Danos Corporais, APP, Assistência 24h). NÃO inclua valores, limites, franquias, condições, exclusões, observações ou textos de marketing — apenas o tipo + nomes das coberturas." },
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
        renavam: { type: ["string", "null"], description: "RENAVAM do veículo (apenas dígitos), se visível" },
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

const CHUNK_TOOL = {
  type: "function",
  function: {
    name: "extract_insurance_policy_chunk",
    description:
      "Extrai os dados visíveis de um TRECHO de uma apólice de seguro de frota brasileira. Retorne somente o que aparecer nessas páginas: dados gerais, placas e veículos. Se um campo não aparecer neste trecho, retorne null. NÃO invente placas.",
    parameters: {
      type: "object",
      properties: {
        policy_number: { type: ["string", "null"] },
        insurer_name: { type: ["string", "null"] },
        insurer_phone: { type: ["string", "null"] },
        insurer_email: { type: ["string", "null"] },
        insurer_document: { type: ["string", "null"] },
        start_date: { type: ["string", "null"] },
        end_date: { type: ["string", "null"] },
        emission_date: { type: ["string", "null"] },
        total_value: { type: ["number", "null"] },
        net_premium: { type: ["number", "null"] },
        iof: { type: ["number", "null"] },
        installments_count: { type: ["integer", "null"] },
        installment_value: { type: ["number", "null"] },
        deductible: { type: ["number", "null"] },
        coverage_summary: { type: ["string", "null"] },
        coverage_type: {
          type: ["string", "null"],
          enum: ["compreensivo", "terceiros", "casco_total", "casco_parcial", "frota", "outro", null],
        },
        insured_name: { type: ["string", "null"] },
        insured_document: { type: ["string", "null"] },
        broker_name: { type: ["string", "null"] },
        broker_document: { type: ["string", "null"] },
        broker_susep: { type: ["string", "null"] },
        broker_phone: { type: ["string", "null"] },
        broker_email: { type: ["string", "null"] },
        plates: {
          type: "array",
          items: { type: "string" },
        },
        vehicles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              plate: { type: "string" },
              brand: { type: ["string", "null"] },
              model: { type: ["string", "null"] },
              year: { type: ["string", "null"] },
              fipe_code: { type: ["string", "null"] },
              chassis: { type: ["string", "null"] },
              renavam: { type: ["string", "null"] },
              insured_amount: { type: ["number", "null"] },
              premium: { type: ["number", "null"] },
              deductible: { type: ["number", "null"] },
              inclusion_type: { type: ["string", "null"], enum: ["apolice", "adendo", null] },
              endorsement_number: { type: ["string", "null"] },
              coverage_notes: { type: ["string", "null"] },
              page_number: { type: ["integer", "null"] }
            },
            required: ["plate"],
            additionalProperties: false
          }
        }
      },
      required: ["plates", "vehicles"],
      additionalProperties: false,
    },
  },
};

type ExtractedVehicle = {
  plate: string;
  brand?: string | null;
  model?: string | null;
  year?: string | null;
  fipe_code?: string | null;
  chassis?: string | null;
  renavam?: string | null;
  insured_amount?: number | null;
  premium?: number | null;
  deductible?: number | null;
  inclusion_type?: "apolice" | "adendo" | null;
  endorsement_number?: string | null;
  coverage_notes?: string | null;
  page_number?: number | null;
};

type ExtractedPolicy = Record<string, unknown> & {
  plates?: string[];
  vehicles?: ExtractedVehicle[];
};

type PdfChunk = {
  index: number;
  startPage: number;
  endPage: number;
  totalPages: number;
  bytes: Uint8Array;
};

function normalizePlate(plate: unknown): string {
  return String(plate ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeVehicle(vehicle: ExtractedVehicle, pageOffset = 0, chunkPageCount?: number): ExtractedVehicle | null {
  const plate = normalizePlate(vehicle?.plate);
  if (!plate) return null;
  const rawPage = typeof vehicle.page_number === "number" && Number.isFinite(vehicle.page_number)
    ? Math.max(1, Math.trunc(vehicle.page_number))
    : null;
  const page = rawPage == null
    ? null
    : (chunkPageCount && rawPage <= chunkPageCount ? rawPage + pageOffset : rawPage);
  return {
    ...vehicle,
    plate,
    page_number: page,
  };
}

function firstMeaningful<T>(...values: T[]): T | null {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return null;
}

function mergeVehicle(base: ExtractedVehicle, incoming: ExtractedVehicle): ExtractedVehicle {
  return {
    plate: base.plate,
    brand: firstMeaningful(base.brand, incoming.brand),
    model: firstMeaningful(base.model, incoming.model),
    year: firstMeaningful(base.year, incoming.year),
    fipe_code: firstMeaningful(base.fipe_code, incoming.fipe_code),
    chassis: firstMeaningful(base.chassis, incoming.chassis),
    renavam: firstMeaningful(base.renavam, incoming.renavam),
    insured_amount: firstMeaningful(base.insured_amount, incoming.insured_amount),
    premium: firstMeaningful(base.premium, incoming.premium),
    deductible: firstMeaningful(base.deductible, incoming.deductible),
    inclusion_type: firstMeaningful(base.inclusion_type, incoming.inclusion_type),
    endorsement_number: firstMeaningful(base.endorsement_number, incoming.endorsement_number),
    coverage_notes: firstMeaningful(base.coverage_notes, incoming.coverage_notes),
    page_number: firstMeaningful(base.page_number, incoming.page_number),
  };
}

function mergePolicies(parts: ExtractedPolicy[]): ExtractedPolicy {
  const merged: ExtractedPolicy = {};
  const vehicles = new Map<string, ExtractedVehicle>();
  const scalarKeys = [
    "policy_number",
    "insurer_name",
    "insurer_phone",
    "insurer_email",
    "insurer_document",
    "start_date",
    "end_date",
    "emission_date",
    "total_value",
    "net_premium",
    "iof",
    "installments_count",
    "installment_value",
    "deductible",
    "coverage_type",
    "insured_name",
    "insured_document",
    "broker_name",
    "broker_document",
    "broker_susep",
    "broker_phone",
    "broker_email",
  ] as const;

  for (const key of scalarKeys) {
    const candidate = parts.map((part) => part[key]).find((value) => firstMeaningful(value) !== null);
    if (candidate !== undefined) merged[key] = candidate;
  }

  const summaries = parts
    .map((part) => String(part.coverage_summary ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  merged.coverage_summary = summaries[0] ?? null;

  for (const part of parts) {
    for (const rawVehicle of Array.isArray(part.vehicles) ? part.vehicles : []) {
      const normalized = normalizeVehicle(rawVehicle);
      if (!normalized) continue;
      const existing = vehicles.get(normalized.plate);
      vehicles.set(normalized.plate, existing ? mergeVehicle(existing, normalized) : normalized);
    }
  }

  const dedupedPlates = new Set<string>();
  for (const part of parts) {
    for (const plate of Array.isArray(part.plates) ? part.plates : []) {
      const normalized = normalizePlate(plate);
      if (normalized) dedupedPlates.add(normalized);
    }
  }
  for (const plate of vehicles.keys()) dedupedPlates.add(plate);

  merged.vehicles = Array.from(vehicles.values()).sort((a, b) => {
    const pa = a.page_number ?? Number.MAX_SAFE_INTEGER;
    const pb = b.page_number ?? Number.MAX_SAFE_INTEGER;
    return pa - pb || a.plate.localeCompare(b.plate);
  });
  merged.plates = Array.from(dedupedPlates.values());

  return merged;
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function splitPdfIntoChunks(bytes: Uint8Array): Promise<PdfChunk[]> {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const totalPages = source.getPageCount();
  const chunks: PdfChunk[] = [];

  for (let start = 0, index = 0; start < totalPages; start += PDF_CHUNK_PAGE_COUNT, index += 1) {
    const end = Math.min(start + PDF_CHUNK_PAGE_COUNT, totalPages);
    const chunkDoc = await PDFDocument.create();
    const copiedPages = await chunkDoc.copyPages(source, Array.from({ length: end - start }, (_, i) => start + i));
    for (const page of copiedPages) chunkDoc.addPage(page);
    const chunkBytes = await chunkDoc.save({ useObjectStreams: false });
    chunks.push({
      index,
      startPage: start + 1,
      endPage: end,
      totalPages,
      bytes: chunkBytes,
    });
  }

  return chunks;
}

async function parseFunctionArguments(result: Awaited<ReturnType<typeof callAi>>, functionName: string): Promise<ExtractedPolicy> {
  if (!result.success) {
    throw new Error(result.errorMessage || "Falha ao processar apólice");
  }

  const toolCalls = result.data?.choices?.[0]?.message?.tool_calls ?? [];
  const call = toolCalls.find((entry: any) => entry?.function?.name === functionName) ?? toolCalls[0];
  if (!call?.function?.arguments) {
    throw new Error("IA não conseguiu extrair dados.");
  }

  try {
    return JSON.parse(call.function.arguments) as ExtractedPolicy;
  } catch {
    throw new Error("Resposta da IA inválida");
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await worker(items[current]);
    }
  });

  await Promise.all(runners);
  return results;
}

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
      "Você é especialista em apólices de seguro de frota brasileiras (Porto, Bradesco, Allianz, Tokio, Sompo, HDI, Mapfre, Liberty, Suhai, etc.). Leia a apólice INTEIRA — TODAS as páginas, incluindo a relação de bens segurados, endossos, adendos e cláusulas. Extraia: número da apólice, seguradora (telefone/email/CNPJ), segurado (nome/CNPJ), vigência (início/fim/emissão), prêmio total, prêmio líquido, IOF, parcelas, franquia padrão, corretor (nome, CNPJ, SUSEP, telefone, email), coberturas principais com limites, e a LISTA COMPLETA E DETALHADA de TODOS os veículos cobertos (placa, marca, modelo, ano, FIPE, chassi, RENAVAM, importância segurada, prêmio individual quando discriminado). Inclua veículos adicionados por endosso/adendo marcando inclusion_type='adendo'. Placas SEMPRE em maiúsculas, sem hífen/espaços. Datas em ISO YYYY-MM-DD. NUNCA invente placas — se não tiver certeza, omita.";

    const callSingleExtraction = async () => {
      const userContent: any[] = [
        { type: "text", text: "Extraia TODOS os dados visíveis do documento e retorne pela function call. Não resuma a lista de veículos — inclua TODOS." },
      ];
      if (isPdf) {
        userContent.push({ type: "file", file: { filename: "apolice.pdf", file_data: dataUrl } });
      } else {
        userContent.push({ type: "image_url", image_url: { url: dataUrl } });
      }

      return await callAi({
        ctx,
        feature: FEATURE,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userContent },
        ],
        tools: [TOOL],
        toolChoice: { type: "function", function: { name: "extract_insurance_policy" } },
        timeoutMs: isPdf ? PDF_CHUNK_TIMEOUT_MS : 45_000,
      });
    };

    let parsed: ExtractedPolicy | null = null;
    let chunkMeta: { totalPages: number; chunks: number } | null = null;

    if (isPdf) {
      try {
        const pdfBytes = decodeBase64(fileBase64);
        const pdfChunks = await splitPdfIntoChunks(pdfBytes);
        const totalPages = pdfChunks[0]?.totalPages ?? 0;
        const shouldChunk = pdfChunks.length > 1 && (totalPages > PDF_CHUNK_PAGE_THRESHOLD || pdfBytes.byteLength >= PDF_CHUNK_BYTES_THRESHOLD);

        if (shouldChunk) {
          chunkMeta = { totalPages, chunks: pdfChunks.length };
          console.log("[extract-insurance-policy] chunked:start", {
            feature: FEATURE,
            requestId: ctx.requestId,
            totalPages,
            chunks: pdfChunks.length,
            approxBytes: pdfBytes.byteLength,
          });

          const partials = await mapWithConcurrency(pdfChunks, PDF_CHUNK_CONCURRENCY, async (chunk) => {
            const chunkDataUrl = `data:application/pdf;base64,${encodeBase64(chunk.bytes)}`;
            const chunkUserContent = [
              {
                type: "text",
                text:
                  `Estas são apenas as páginas ${chunk.startPage}-${chunk.endPage} de ${chunk.totalPages} da apólice. ` +
                  "Extraia SOMENTE o que estiver visível neste trecho. Se um campo não aparecer aqui, retorne null. Inclua todas as placas/veículos destas páginas.",
              },
              { type: "file", file: { filename: `apolice_parte_${chunk.index + 1}.pdf`, file_data: chunkDataUrl } },
            ];

            const chunkResult = await callAi({
              ctx,
              feature: FEATURE,
              messages: [
                { role: "system", content: sys },
                { role: "user", content: chunkUserContent },
              ],
              tools: [CHUNK_TOOL],
              toolChoice: { type: "function", function: { name: "extract_insurance_policy_chunk" } },
              timeoutMs: PDF_CHUNK_TIMEOUT_MS,
            });

            const part = await parseFunctionArguments(chunkResult, "extract_insurance_policy_chunk");
            return {
              ...part,
              plates: (Array.isArray(part.plates) ? part.plates : []).map(normalizePlate).filter(Boolean),
              vehicles: (Array.isArray(part.vehicles) ? part.vehicles : [])
                .map((vehicle) => normalizeVehicle(vehicle, chunk.startPage - 1, chunk.endPage - chunk.startPage + 1))
                .filter(Boolean) as ExtractedVehicle[],
            } satisfies ExtractedPolicy;
          });

          parsed = mergePolicies(partials);
        }
      } catch (chunkError) {
        console.warn("[extract-insurance-policy] chunked:unavailable", {
          feature: FEATURE,
          requestId: ctx.requestId,
          error: String((chunkError as Error)?.message ?? chunkError),
        });
      }
    }

    if (!parsed) {
      const result = await callSingleExtraction();
      if (!result.success) {
        const status = result.httpStatus && result.httpStatus >= 400 && result.httpStatus < 600 ? result.httpStatus : 500;
        const errLower = String(result.errorMessage || "").toLowerCase();
        const isTimeout = errLower.includes("timeout") || errLower.includes("aborted") || status === 504;
        const isParse = errLower.includes("unexpected end of json") || errLower.includes("network");
        const userMsg =
          status === 429 ? "Limite de requisições da IA excedido. Tente novamente em instantes." :
          status === 402 ? "Créditos de IA esgotados." :
          isTimeout ? "Apólice grande/escaneada demais para leitura em bloco. Agora o sistema já tenta quebrar o PDF automaticamente, mas este arquivo ainda excedeu o limite. Tente reenviar; se persistir, envie em partes (ex.: apólice e endossos separados)." :
          isParse ? "Falha de comunicação com a IA ao processar a apólice. Tente novamente em instantes." :
          "Falha ao processar apólice. Tente novamente; se persistir, envie em partes ou outro formato (PDF nativo, não escaneado).";
        console.error("[extract-insurance-policy] ai-failed", { feature: FEATURE, status, provider: result.providerUsed, error: result.errorMessage });
        return new Response(JSON.stringify({ error: userMsg }), {
          status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      parsed = await parseFunctionArguments(result, "extract_insurance_policy");
      console.log("[extract-insurance-policy] success", { feature: FEATURE, requestId: ctx.requestId, provider: result.providerUsed, model: result.modelUsed, fallback: result.wasFallback, tokensTotal: result.tokensTotal, mode: "single" });
    } else {
      console.log("[extract-insurance-policy] success", { feature: FEATURE, requestId: ctx.requestId, mode: "chunked", totalPages: chunkMeta?.totalPages ?? null, chunks: chunkMeta?.chunks ?? null, vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles.length : 0 });
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