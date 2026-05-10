// Adapter: Google Gemini API direta (generateContent).
// Converte mensagens do formato OpenAI -> Gemini e normaliza a resposta de volta
// para o shape OpenAI ({ choices:[{message:{content,tool_calls}}], usage }).
import type { ProviderCallArgs, ProviderCallResult } from "./types.ts";

function modelShortName(model: string): string {
  // "google/gemini-2.5-flash" -> "gemini-2.5-flash"
  return model.includes("/") ? model.split("/").pop()! : model;
}

function dataUrlToInline(dataUrl: string): { mimeType: string; data: string } | null {
  // data:<mime>;base64,<payload>
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

function partsFromOpenAIContent(content: any): any[] {
  if (typeof content === "string") return [{ text: content }];
  if (!Array.isArray(content)) return [];
  const parts: any[] = [];
  for (const c of content) {
    if (!c) continue;
    if (c.type === "text") {
      parts.push({ text: c.text ?? "" });
    } else if (c.type === "image_url") {
      const url = c.image_url?.url ?? "";
      const inline = dataUrlToInline(url);
      if (inline) parts.push({ inlineData: inline });
    } else if (c.type === "file") {
      const url = c.file?.file_data ?? "";
      const inline = dataUrlToInline(url);
      if (inline) parts.push({ inlineData: inline });
    }
  }
  return parts;
}

export function adaptMessagesToGemini(messages: any[]): {
  systemInstruction?: { parts: { text: string }[] };
  contents: any[];
} {
  const sysTexts: string[] = [];
  const contents: any[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      if (typeof m.content === "string") sysTexts.push(m.content);
      else if (Array.isArray(m.content)) {
        for (const c of m.content) if (c?.type === "text") sysTexts.push(c.text ?? "");
      }
      continue;
    }
    const role = m.role === "assistant" ? "model" : "user";
    contents.push({ role, parts: partsFromOpenAIContent(m.content) });
  }
  const out: any = { contents };
  if (sysTexts.length) out.systemInstruction = { parts: [{ text: sysTexts.join("\n\n") }] };
  return out;
}

function adaptTools(tools?: any[], toolChoice?: any) {
  if (!tools || tools.length === 0) return {};
  const functionDeclarations = tools
    .filter((t) => t?.type === "function" && t.function)
    .map((t) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }));
  const out: any = { tools: [{ functionDeclarations }] };
  if (toolChoice?.type === "function" && toolChoice.function?.name) {
    out.toolConfig = {
      functionCallingConfig: { mode: "ANY", allowedFunctionNames: [toolChoice.function.name] },
    };
  }
  return out;
}

function normalizeGeminiResponse(data: any) {
  const cand = data?.candidates?.[0];
  const parts = cand?.content?.parts ?? [];
  let textOut = "";
  const toolCalls: any[] = [];
  for (const p of parts) {
    if (p?.text) textOut += p.text;
    if (p?.functionCall) {
      toolCalls.push({
        id: `call_${toolCalls.length}`,
        type: "function",
        function: {
          name: p.functionCall.name,
          arguments: JSON.stringify(p.functionCall.args ?? {}),
        },
      });
    }
  }
  const usage = data?.usageMetadata ?? {};
  return {
    choices: [
      {
        index: 0,
        finish_reason: cand?.finishReason ?? "stop",
        message: {
          role: "assistant",
          content: textOut || null,
          tool_calls: toolCalls.length ? toolCalls : undefined,
        },
      },
    ],
    usage: {
      prompt_tokens: usage.promptTokenCount ?? 0,
      completion_tokens: usage.candidatesTokenCount ?? 0,
      total_tokens: usage.totalTokenCount ?? 0,
    },
  };
}

export async function callGemini(args: ProviderCallArgs): Promise<ProviderCallResult> {
  const model = modelShortName(args.model);
  const base = (args.endpoint && args.endpoint.replace(/\/$/, "")) ||
    "https://generativelanguage.googleapis.com/v1beta";
  const url = `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(args.secret)}`;

  const adapted = adaptMessagesToGemini(args.messages);
  const toolPart = adaptTools(args.tools, args.toolChoice);
  const body = { ...adapted, ...toolPart };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: args.signal,
    });
    if (!resp.ok) {
      let errText = "";
      try { errText = await resp.text(); } catch { /* ignore */ }
      return {
        ok: false,
        status: resp.status,
        kind: "http",
        error: `gemini_http_${resp.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`,
        data: null,
        tokens: { input: 0, output: 0, total: 0 },
      };
    }
    const raw = await resp.json();
    const data = normalizeGeminiResponse(raw);
    return {
      ok: true,
      status: resp.status,
      kind: "ok",
      error: null,
      data,
      tokens: {
        input: data.usage.prompt_tokens,
        output: data.usage.completion_tokens,
        total: data.usage.total_tokens,
      },
    };
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return {
      ok: false,
      status: null,
      kind: isAbort ? "timeout" : "network",
      error: isAbort ? "gemini_timeout" : `gemini_network: ${String(e?.message ?? e)}`,
      data: null,
      tokens: { input: 0, output: 0, total: 0 },
    };
  }
}