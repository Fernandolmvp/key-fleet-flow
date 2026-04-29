const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Extrai dados estruturados de imagens/PDFs (CRLV de veículos, CNH de motoristas)
// usando Lovable AI Gateway com tool calling.

type DocType = "vehicle" | "driver" | "plate" | "odometer" | "maintenance_invoice" | "tire_invoice" | "document";

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
        owner_name: { type: ["string", "null"], description: "Nome do proprietário conforme CRLV" },
        owner_doc: { type: ["string", "null"], description: "CPF ou CNPJ do proprietário, apenas dígitos, sem pontuação" },
        crlv_city: { type: ["string", "null"], description: "Município de emplacamento (cidade) conforme CRLV" },
        crlv_issue_date: { type: ["string", "null"], description: "Data de emissão do CRLV YYYY-MM-DD" },
        licensing_year: { type: ["integer", "null"], description: "Ano do exercício de licenciamento (ex.: 2026)" },
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

const TOOL_PLATE = {
  type: "function",
  function: {
    name: "extract_plate",
    description: "Extrai a placa visível em uma foto de veículo brasileiro (formato Mercosul ABC1D23 ou antigo ABC1234).",
    parameters: {
      type: "object",
      properties: {
        plate: { type: ["string", "null"], description: "Placa em maiúsculas, sem hífen nem espaços" },
        confidence: { type: ["number", "null"], description: "Confiança 0-1" },
      },
      required: ["plate"],
      additionalProperties: false,
    },
  },
};

const TOOL_ODOMETER = {
  type: "function",
  function: {
    name: "extract_odometer",
    description: "Extrai a quilometragem (KM) exibida no painel/hodômetro de um veículo. Apenas o número inteiro de KM total (não trip).",
    parameters: {
      type: "object",
      properties: {
        km: { type: ["integer", "null"], description: "KM total como inteiro" },
        confidence: { type: ["number", "null"], description: "Confiança 0-1" },
      },
      required: ["km"],
      additionalProperties: false,
    },
  },
};

const TOOL_MAINT = {
  type: "function",
  function: {
    name: "extract_maintenance_invoice",
    description:
      "Extrai dados de nota fiscal/orçamento de manutenção/oficina. Itens detalhados de peças e serviços. Use null para campos ausentes.",
    parameters: {
      type: "object",
      properties: {
        workshop_name: { type: ["string", "null"], description: "Razão social da oficina" },
        workshop_cnpj: { type: ["string", "null"], description: "Apenas dígitos" },
        city: { type: ["string", "null"] },
        state: { type: ["string", "null"], description: "UF" },
        service_at: { type: ["string", "null"], description: "Data do serviço YYYY-MM-DD" },
        plate: { type: ["string", "null"], description: "Placa do veículo, se constar" },
        km_at_service: { type: ["integer", "null"] },
        category: { type: ["string", "null"], description: "Ex.: óleo, freios, suspensão, motor, elétrica, pneus, funilaria" },
        description: { type: ["string", "null"], description: "Resumo do serviço executado" },
        labor_value: { type: ["number", "null"], description: "Total de mão de obra" },
        parts_value: { type: ["number", "null"], description: "Total de peças" },
        total_value: { type: ["number", "null"] },
        parts: {
          type: "array",
          description: "Itens de peças/serviços",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              qty: { type: ["number", "null"] },
              unit_value: { type: ["number", "null"] },
              total: { type: ["number", "null"] },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
      },
      required: ["total_value"],
      additionalProperties: false,
    },
  },
};

const TOOL_TIRE = {
  type: "function",
  function: {
    name: "extract_tire_invoice",
    description:
      "Extrai dados de nota fiscal de compra/recapagem de pneus. Cada item é um pneu individual com marca, modelo, medida, DOT (se houver), preço e quantidade.",
    parameters: {
      type: "object",
      properties: {
        supplier: { type: ["string", "null"], description: "Razão social do fornecedor/recapadora" },
        supplier_cnpj: { type: ["string", "null"] },
        invoice_number: { type: ["string", "null"] },
        purchase_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
        total_value: { type: ["number", "null"] },
        kind: { type: ["string", "null"], enum: ["novo", "recapado", "remold", null] },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              brand: { type: ["string", "null"] },
              model: { type: ["string", "null"] },
              size: { type: ["string", "null"], description: "Ex.: 295/80 R22.5 ou 175/65 R14" },
              dot: { type: ["string", "null"] },
              serial: { type: ["string", "null"] },
              qty: { type: ["integer", "null"] },
              unit_price: { type: ["number", "null"] },
              total: { type: ["number", "null"] },
            },
            required: ["brand", "size"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
};

const TOOL_DOCUMENT = {
  type: "function",
  function: {
    name: "extract_document_generic",
    description:
      "Extrai dados de qualquer documento de frota (CRLV, IPVA, Licenciamento, Apólice de Seguro, CNH, Exame Médico, Toxicológico, MOPP, Certificados). Identifique o tipo do documento, número, emissor, datas de emissão e validade, e o titular (CPF do motorista ou placa do veículo).",
    parameters: {
      type: "object",
      properties: {
        doc_type: {
          type: ["string", "null"],
          enum: [
            "crlv","ipva","licenciamento","seguro","rastreador","laudo_veiculo","outro_veiculo",
            "cnh","exame_medico","exame_toxicologico","curso_mopp","curso_transporte_passageiros","outro_motorista",
            null,
          ],
        },
        title: { type: ["string", "null"], description: "Título/descrição curta do documento" },
        document_number: { type: ["string", "null"], description: "Número/registro do documento (sem pontuação)" },
        issuer: { type: ["string", "null"], description: "Órgão emissor (DETRAN, seguradora, clínica, etc)" },
        issue_date: { type: ["string", "null"], description: "Data de emissão YYYY-MM-DD" },
        expires_at: { type: ["string", "null"], description: "Data de vencimento/validade YYYY-MM-DD. Se sem validade, null" },
        plate: { type: ["string", "null"], description: "Placa do veículo, se for documento veicular" },
        cpf: { type: ["string", "null"], description: "CPF do titular (apenas dígitos), se for documento de motorista" },
        full_name: { type: ["string", "null"], description: "Nome completo do titular, se aplicável" },
        cnh_category: { type: ["string", "null"] },
        notes: { type: ["string", "null"], description: "Observações relevantes" },
        owner_name: { type: ["string", "null"], description: "CRLV: nome do proprietário" },
        owner_doc: { type: ["string", "null"], description: "CRLV: CPF/CNPJ do proprietário (apenas dígitos)" },
        crlv_city: { type: ["string", "null"], description: "CRLV: município de emplacamento" },
        licensing_year: { type: ["integer", "null"], description: "CRLV: ano do exercício de licenciamento (ex: 2026)" },
      },
      required: ["doc_type"],
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

    let tool: any, fnName: string, sys: string;
    if (type === "vehicle") {
      tool = TOOL_VEHICLE; fnName = "extract_vehicle";
      sys = "Você é um especialista em documentos veiculares brasileiros (CRLV, CRV, DUT). Extraia TODOS os dados visíveis com precisão, incluindo: PROPRIETÁRIO (nome completo), CPF/CNPJ do proprietário (apenas dígitos), MUNICÍPIO de emplacamento (geralmente próximo ao UF, na seção do proprietário), DATA DE EMISSÃO do CRLV (campo 'Local e Data' ou 'Data Emissão' — fica próximo ao código de barras/autenticação), e EXERCÍCIO (ano do licenciamento, geralmente em destaque no topo, ex.: 'EXERCÍCIO 2026'). Datas em ISO YYYY-MM-DD. Placas em maiúsculas sem hífen. CPF/CNPJ apenas dígitos.";
    } else if (type === "driver") {
      tool = TOOL_DRIVER; fnName = "extract_driver";
      sys = "Você é um especialista em CNH (Carteira Nacional de Habilitação) brasileira. Extraia os dados com precisão. Datas em ISO YYYY-MM-DD. CPF apenas dígitos.";
    } else if (type === "plate") {
      tool = TOOL_PLATE; fnName = "extract_plate";
      sys = "Você lê placas veiculares brasileiras em fotos. Retorne apenas a placa do veículo principal, em letras maiúsculas, sem hífen ou espaços. Formatos válidos: ABC1234 (antigo) ou ABC1D23 (Mercosul).";
    } else if (type === "odometer") {
      tool = TOOL_ODOMETER; fnName = "extract_odometer";
      sys = "Você lê painéis/hodômetros de veículos. Retorne a quilometragem total (odômetro), nunca o trip parcial. Apenas o número inteiro em KM.";
    } else if (type === "tire_invoice") {
      tool = TOOL_TIRE; fnName = "extract_tire_invoice";
      sys = "Você lê notas fiscais de pneus (compra ou recapagem). Cada item é um pneu individual: marca, modelo, medida (ex.: 295/80 R22.5), DOT, preço unitário. Datas em ISO YYYY-MM-DD.";
    } else if (type === "document") {
      tool = TOOL_DOCUMENT; fnName = "extract_document_generic";
      sys = "Você é um especialista em documentos de frota brasileiros: CRLV, IPVA, Licenciamento, Apólice de Seguro, CNH, Exame Médico, Toxicológico, MOPP. Identifique o tipo do documento e extraia número, emissor, datas e titular (placa ou CPF). Para CRLV, extraia também: proprietário (owner_name), CPF/CNPJ do proprietário (owner_doc, apenas dígitos), município (crlv_city) e ANO DO EXERCÍCIO de licenciamento (licensing_year — número em destaque no topo, ex.: 'EXERCÍCIO 2026'). Datas em ISO YYYY-MM-DD. Placas em maiúsculas sem hífen. CPF/CNPJ apenas dígitos.";
    } else {
      tool = TOOL_MAINT; fnName = "extract_maintenance_invoice";
      sys = "Você é um especialista em notas fiscais e ordens de serviço de oficinas mecânicas brasileiras. Extraia dados de oficina, valores (mão de obra, peças, total), data, e itens individuais. Datas em ISO YYYY-MM-DD.";
    }

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