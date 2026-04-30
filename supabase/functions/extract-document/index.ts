const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Extrai dados estruturados de imagens/PDFs (CRLV de veículos, CNH de motoristas)
// usando Lovable AI Gateway com tool calling.

type DocType = "vehicle" | "driver" | "plate" | "odometer" | "maintenance_invoice" | "tire_invoice" | "document" | "fuel_receipt";

const TOOL_VEHICLE = {
  type: "function",
  function: {
    name: "extract_vehicle",
    description:
      "Extrai dados do CRLV/DUT/CRV brasileiro. Antes de extrair, IDENTIFIQUE o tipo do documento. Se NÃO for um documento veicular (CRLV/CRV/DUT), preencha detected_doc_kind com o tipo real e deixe os demais campos null.",
    parameters: {
      type: "object",
      properties: {
        detected_doc_kind: {
          type: "string",
          enum: ["crlv","crv","dut","cnh","ipva","licenciamento","seguro","rg","cpf","nota_fiscal","comprovante","outro","ilegivel"],
          description: "Tipo real identificado no documento. Use 'crlv'/'crv'/'dut' apenas se for de fato um documento veicular.",
        },
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
      required: ["detected_doc_kind"],
      additionalProperties: false,
    },
  },
};

const TOOL_DRIVER = {
  type: "function",
  function: {
    name: "extract_driver",
    description: "Extrai dados da CNH brasileira. Antes de extrair, IDENTIFIQUE o tipo do documento (deve ser CNH). Se for outro documento (CRLV, IPVA, RG, CPF, comprovante, nota fiscal, apólice, etc.), preencha detected_doc_kind com o tipo real e deixe os demais campos null.",
    parameters: {
      type: "object",
      properties: {
        detected_doc_kind: {
          type: "string",
          enum: ["cnh","crlv","ipva","licenciamento","seguro","rg","cpf","exame_medico","exame_toxicologico","mopp","nota_fiscal","comprovante","outro","ilegivel"],
          description: "Tipo real identificado no documento. Use 'cnh' apenas se for de fato uma Carteira Nacional de Habilitação.",
        },
        full_name: { type: ["string", "null"] },
        cpf: { type: ["string", "null"], description: "Apenas dígitos, sem pontuação" },
        cnh_number: { type: ["string", "null"], description: "Número de registro da CNH" },
        cnh_category: { type: ["string", "null"], description: "Ex.: A, B, AB, D, E" },
        cnh_expires_at: { type: ["string", "null"], description: "Validade no formato YYYY-MM-DD" },
        medical_exam_expires_at: { type: ["string", "null"], description: "Validade do exame médico YYYY-MM-DD" },
        birth_date: { type: ["string", "null"], description: "Data de nascimento no formato YYYY-MM-DD" },
        address: { type: ["string", "null"] },
      },
      required: ["detected_doc_kind"],
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

const TOOL_FUEL_RECEIPT = {
  type: "function",
  function: {
    name: "extract_fuel_receipt",
    description:
      "Extrai dados de cupom fiscal/NFC-e/recibo de posto de combustível brasileiro. Retorna razão social, CNPJ, data, total e TODOS os itens (combustível e extras como aditivo, troca de óleo, etc.).",
    parameters: {
      type: "object",
      properties: {
        station_name: { type: ["string", "null"], description: "Razão social do posto" },
        station_cnpj: { type: ["string", "null"], description: "CNPJ apenas dígitos" },
        city: { type: ["string", "null"] },
        state: { type: ["string", "null"] },
        issued_at: { type: ["string", "null"], description: "Data e hora da emissão YYYY-MM-DD HH:MM" },
        receipt_number: { type: ["string", "null"], description: "Número do cupom/NFC-e" },
        total_value: { type: ["number", "null"], description: "Valor total do cupom" },
        items: {
          type: "array",
          description: "Itens listados no cupom",
          items: {
            type: "object",
            properties: {
              description: { type: "string", description: "Descrição do produto" },
              quantity: { type: ["number", "null"] },
              unit_value: { type: ["number", "null"] },
              total: { type: ["number", "null"] },
              is_fuel: { type: ["boolean", "null"], description: "true se for combustível (gasolina, etanol, diesel, etc.)" },
              fuel_type: {
                type: ["string", "null"],
                enum: ["gasolina", "etanol", "diesel", "diesel_s10", "flex", "gnv", null],
              },
            },
            required: ["description"],
            additionalProperties: false,
          },
        },
      },
      required: ["items", "total_value"],
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
      sys = "Você é um especialista em documentos veiculares brasileiros (CRLV, CRV, DUT). PRIMEIRO identifique o tipo do documento e preencha detected_doc_kind. Se NÃO for um documento veicular (CRLV/CRV/DUT) — por exemplo CNH, RG, comprovante, nota fiscal —, preencha detected_doc_kind com o tipo real e deixe os demais campos como null. Quando for documento veicular, extraia TODOS os dados visíveis: PROPRIETÁRIO, CPF/CNPJ, MUNICÍPIO de emplacamento, DATA DE EMISSÃO do CRLV e EXERCÍCIO (ano do licenciamento). Datas em ISO YYYY-MM-DD. Placas em maiúsculas sem hífen. CPF/CNPJ apenas dígitos.";
    } else if (type === "driver") {
      tool = TOOL_DRIVER; fnName = "extract_driver";
      sys = "Você é um especialista em CNH (Carteira Nacional de Habilitação) brasileira. PRIMEIRO identifique o tipo do documento e preencha detected_doc_kind. Se NÃO for uma CNH (ex.: CRLV, IPVA, RG, comprovante, nota fiscal), preencha detected_doc_kind com o tipo real e deixe os demais campos como null — NÃO invente dados de motorista a partir de outros documentos. Datas em ISO YYYY-MM-DD. CPF apenas dígitos.";
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
    } else if (type === "fuel_receipt") {
      tool = TOOL_FUEL_RECEIPT; fnName = "extract_fuel_receipt";
      sys = "Você lê cupons fiscais (NFC-e/SAT/ECF) de postos de combustível brasileiros. Extraia razão social, CNPJ (apenas dígitos), data, valor total e TODOS os itens — identifique combustíveis (gasolina, etanol, diesel, S10, GNV) marcando is_fuel=true e o fuel_type. Inclua também itens não-combustível (aditivo, óleo, água, etc.) com is_fuel=false. Quantidade, valor unitário e total exatamente como no cupom.";
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